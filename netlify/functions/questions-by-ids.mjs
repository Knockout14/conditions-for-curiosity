import { getStore } from "@netlify/blobs";
import { checkRateLimit, tooManyRequests } from "./_lib/rate-limit.mjs";
import { isServable } from "./_lib/question-bank.mjs";

// Full question fields — used once a question is part of a family's
// *confirmed* pick (the "you're set" summary, and later the nightly
// loop), never for browsing or sampling the bank at large.
function toFull(q) {
  const { id, text, domain, bigIdea, category, seed, prep, ages } = q;
  return { id, text, domain, bigIdea, category, seed, prep, ages };
}

// Every caller sends weeklyPick.questionIds, which is always exactly 3.
const MAX_IDS = 3;

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // MAX_IDS bounds one call; this bounds repeated ones. Together, one IP
  // can read at most 60 questions' full fields a day. Only Raw/Found
  // questions are ever returned (isServable), so ids for the rest of the
  // bank come back empty however they're requested. Like weekly-candidates,
  // this makes harvesting the v1 questions slow, not impossible.
  if (!(await checkRateLimit(req, "questions-by-ids", 20))) {
    return tooManyRequests();
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

  const byId = new Map(all.filter(isServable).map((q) => [q.id, q]));
  const result = ids.map((id) => byId.get(id)).filter(Boolean).map(toFull);

  return new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/questions-by-ids" };
