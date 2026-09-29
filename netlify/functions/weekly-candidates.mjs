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

  const eligible = all.filter((q) => isServable(q) && ageOverlaps(ageBand, q.ages));
  let pool = eligible.filter((q) => !asked.has(q.id) && !exclude.has(q.id));
  if (pool.length < count) pool = eligible.filter((q) => !exclude.has(q.id));

  const picks = [];

  if (count === 3) {
    // The full weekly pick: mix General/Math on purpose (spec §3b) rather
    // than leaving it to chance.
    const takeFrom = (fromPool) => {
      const options = shuffle(fromPool).filter((q) => !picks.some((p) => p.id === q.id));
      if (options.length) picks.push(options[0]);
    };
    takeFrom(pool.filter((q) => q.domain === "Math"));
    takeFrom(pool.filter((q) => q.domain !== "Math")); // General or Both
    takeFrom(pool); // third slot: whatever's left, any domain
  }

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
