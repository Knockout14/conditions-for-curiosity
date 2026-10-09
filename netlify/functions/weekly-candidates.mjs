import { getStore } from "@netlify/blobs";
import { checkRateLimit, tooManyRequests } from "./_lib/rate-limit.mjs";
import { isServable } from "./_lib/question-bank.mjs";

// Mirrors the sampling rule agreed for the weekly pick (spec §3b): one
// guaranteed Math question, one guaranteed General-or-Both, a third from
// whatever's left in the Raw/Found pool — age-matched, already-asked
// questions excluded until the pool would come up short.

const AGE_BANDS = { "3-4": [3, 4], "5-6": [5, 6], "7-8": [7, 8] };

function parseRange(s) {
  const [a, b] = s.split("-").map(Number);
  return [a, b];
}

// Callers validate bandKey first; an unknown band matches nothing rather
// than everything, so a bad value can never widen the pool.
function ageOverlaps(bandKey, questionAges) {
  const band = AGE_BANDS[bandKey];
  if (!band) return false;
  const [qa, qb] = parseRange(questionAges);
  return qa <= band[1] && qb >= band[0];
}

const FIRST_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

// firstPickAt comes from the browser as an ISO string. A missing or unreadable
// value means "no start date": then only a family with nothing asked yet
// counts as new. A date in the future (clock skew) counts as new.
function inFirstWeeks(firstPickAt, askedCount, now = Date.now()) {
  const t = typeof firstPickAt === "string" ? Date.parse(firstPickAt) : NaN;
  if (Number.isFinite(t)) return t > now || now - t < FIRST_WEEKS_MS;
  return askedCount === 0;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Only what the pick screen renders — text and its tag. Seed/prep stay
// server-side until a question is part of a confirmed pick.
function toCandidate(q) {
  const { id, text, domain, bigIdea, category } = q;
  return { id, text, domain, bigIdea, category };
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Two caps bound what one IP can collect: at most 3 candidates per call
  // (below), and 20 calls/day here, so 60 question texts a day, sampled at
  // random from one age band. That's generous for a real family (a pick
  // plus an occasional swap, a couple of times a week). It makes harvesting
  // slow, not impossible: these questions are shown to families by design,
  // so a patient scraper with many IPs could still collect them.
  if (!(await checkRateLimit(req, "weekly-candidates", 20))) {
    return tooManyRequests();
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Every client sends one of the three bands; anything else is a scripted
  // call. It used to fall through to "all ages", which let one call see the
  // whole Raw/Found pool.
  const ageBand = body.ageBand;
  if (!Object.hasOwn(AGE_BANDS, ageBand)) {
    return new Response("Bad request", { status: 400 });
  }
  // Integer ids only, most recent 500 at most: askedQuestionIds grows by 3
  // a week, so 500 is years of history while still bounding the work.
  const idList = (v) => (Array.isArray(v) ? v.filter(Number.isInteger).slice(-500) : []);
  const asked = new Set(idList(body.askedQuestionIds));
  // Extra ids to exclude beyond what's been asked — used when fetching a
  // single replacement for the weekly-pick "swap one" allowance, so the
  // replacement can't just be one of the other two already on the table.
  const exclude = new Set(idList(body.excludeIds));
  // The app asks for exactly two sizes: 3 (a weekly pick) or 1 (a swap).
  // Anything else gets 3. An uncapped count used to return the whole
  // eligible pool in a single call.
  const count = body.count === 1 ? 1 : 3;

  const store = getStore("question-bank");
  const all = await store.get("all", { type: "json" });
  if (!all) return new Response("Question bank not populated", { status: 500 });

  let eligible = all.filter((q) => isServable(q) && ageOverlaps(ageBand, q.ages));

  // A family's first two weeks get only low-stakes questions. The window
  // starts at its first confirmed pick (firstPickAt, saved by the app). A
  // family that has asked nothing and has no start date yet is new, so it is
  // inside the window too. A family already mid-use before this existed has
  // asked questions but no date, so it gets no restriction. A question with
  // no stakes tag does not count as low. If the stored bank has no stakes
  // tags at all, or too few low-stakes questions to fill the request, the
  // filter is skipped rather than returning nothing.
  if (inFirstWeeks(body.firstPickAt, asked.size)) {
    const gentle = eligible.filter((q) => q.stakes === "low");
    if (all.some((q) => q.stakes) && gentle.length >= count) eligible = gentle;
  }

  let pool = eligible.filter((q) => !asked.has(q.id) && !exclude.has(q.id));
  if (pool.length < count) pool = eligible.filter((q) => !exclude.has(q.id));

  // At most one Imagine question in a weekly pick of three, so silliness
  // stays a change of pace. For a swap, the other cards on the table are in
  // excludeIds, so count the Imagine ones there. If the cap would leave the
  // pick short, it gives way (see the fill-up loop at the end).
  const categoryById = new Map(all.map((q) => [q.id, q.category]));
  let imagineUsed = count === 1 && [...exclude].some((id) => categoryById.get(id) === "Imagine");
  const allowed = (q) => !(q.category === "Imagine" && imagineUsed);
  const add = (q) => {
    picks.push(q);
    if (q.category === "Imagine") imagineUsed = true;
  };

  const picks = [];

  if (count === 3) {
    // The full weekly pick: mix General/Math on purpose (spec §3b) rather
    // than leaving it to chance.
    const takeFrom = (fromPool) => {
      const options = shuffle(fromPool).filter((q) => allowed(q) && !picks.some((p) => p.id === q.id));
      if (options.length) add(options[0]);
    };
    takeFrom(pool.filter((q) => q.domain === "Math"));
    takeFrom(pool.filter((q) => q.domain !== "Math")); // General or Both
    takeFrom(pool); // third slot: whatever's left, any domain
  }

  for (const q of shuffle(pool)) {
    if (picks.length >= count) break;
    if (allowed(q) && !picks.some((p) => p.id === q.id)) add(q);
  }
  // Only if the cap left the pick short (a pool that is nearly all Imagine).
  for (const q of shuffle(pool)) {
    if (picks.length >= count) break;
    if (!picks.some((p) => p.id === q.id)) picks.push(q);
  }

  const result = shuffle(picks.slice(0, count)).map(toCandidate);
  return new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/weekly-candidates" };
