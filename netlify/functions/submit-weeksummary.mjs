import { appendRow } from "./_lib/google-sheets.mjs";
import { checkRateLimit } from "./_lib/rate-limit.mjs";
import { isSessionId, ageBand, text, errorMessage, QUESTION_TEXT } from "./_lib/input.mjs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // One row per finished week, retried on the next page load if it failed.
  // Same 30/day/IP budget as the other two writes.
  if (!(await checkRateLimit(req, "submit-weeksummary", 30))) {
    return new Response("Too many requests", { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!isSessionId(body?.sessionId)) {
    return new Response("Bad request", { status: 400 });
  }

  const { sessionId, name, email, finalOrder, askedOrder } = body;
  const fo = Array.isArray(finalOrder) ? finalOrder.slice(0, 3) : [];
  const ao = Array.isArray(askedOrder) ? askedOrder.slice(0, 3) : [];
  const matched = fo.length === ao.length && fo.every((q, i) => q?.id === ao[i]?.id);

  const row = [
    new Date().toISOString(),
    sessionId,
    text(name, 60),
    text(email, 120),
    ageBand(body.ageBand),
    text(fo[0]?.text, QUESTION_TEXT),
    text(fo[1]?.text, QUESTION_TEXT),
    text(fo[2]?.text, QUESTION_TEXT),
    text(ao[0]?.text, QUESTION_TEXT),
    text(ao[1]?.text, QUESTION_TEXT),
    text(ao[2]?.text, QUESTION_TEXT),
    matched ? "yes" : "no",
  ];

  try {
    await appendRow("Week Summary", row);
  } catch (e) {
    console.error(`submit-weeksummary: ${errorMessage(e)}`);
    return new Response("Failed to record submission", { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/submit-weeksummary" };
