import { getStore } from "@netlify/blobs";

// Full question fields — used once a question is part of a family's
// *confirmed* pick (the "you're set" summary, and later the nightly
// loop), never for browsing or sampling the bank at large. `ids` is
// capped hard so this can't be turned into a bulk dump of the bank by
// requesting id 1..165 in one call.
function toFull(q) {
  const { id, text, domain, bigIdea, category, seed, prep, ages } = q;
  return { id, text, domain, bigIdea, category, seed, prep, ages };
}

const MAX_IDS = 10; // a week is 3; room for the odd edit/retry, nothing more

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

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id) => Number.isInteger(id)).slice(0, MAX_IDS)
    : [];
  if (!ids.length) {
    return new Response(JSON.stringify([]), { headers: { "content-type": "application/json" } });
  }

  const store = getStore("question-bank");
  const all = await store.get("all", { type: "json" });
  if (!all) return new Response("Question bank not populated", { status: 500 });

  const byId = new Map(all.map((q) => [q.id, q]));
  const result = ids.map((id) => byId.get(id)).filter(Boolean).map(toFull);

  return new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/questions-by-ids" };
