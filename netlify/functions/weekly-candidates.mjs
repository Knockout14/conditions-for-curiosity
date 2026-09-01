import { getStore } from "@netlify/blobs";

// Mirrors the sampling rule agreed for the weekly pick (spec §3b): one
// guaranteed Math question, one guaranteed General-or-Both, a third from
// whatever's left in the Raw/Found pool — age-matched, already-asked
// questions excluded until the pool would come up short.

const AGE_BANDS = { "3-4": [3, 4], "5-6": [5, 6], "7-8": [7, 8] };

function parseRange(s) {
  const [a, b] = s.split("-").map(Number);
  return [a, b];
}

function ageOverlaps(bandKey, questionAges) {
  const band = AGE_BANDS[bandKey];
  if (!band) return true;
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

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const ageBand = typeof body.ageBand === "string" ? body.ageBand : null;
  const asked = new Set(Array.isArray(body.askedQuestionIds) ? body.askedQuestionIds : []);
  // Extra ids to exclude beyond what's been asked — used when fetching a
  // single replacement for the weekly-pick "swap one" allowance, so the
  // replacement can't just be one of the other two already on the table.
  const exclude = new Set(Array.isArray(body.excludeIds) ? body.excludeIds : []);
  const count = Number.isInteger(body.count) && body.count > 0 ? body.count : 3;

  const store = getStore("question-bank");
  const all = await store.get("all", { type: "json" });
  if (!all) return new Response("Question bank not populated", { status: 500 });

  const eligible = all.filter(
    (q) => (q.anchor === "RAW" || q.anchor === "FOUND") && ageOverlaps(ageBand, q.ages)
  );
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
