import { appendRow } from "./_lib/google-sheets.mjs";
import { checkRateLimit, tooManyRequests } from "./_lib/rate-limit.mjs";
import { isSessionId, ageBand, text, tagFor, errorMessage, QUESTION_TEXT } from "./_lib/input.mjs";

// check.html now always fills all three keys — either an {selected,
// correct} object or the literal string "skipped" — but this stays
// permissive for any older client-side state that only sent whichever
// keys were actually answered.
function checkCol(v) {
  if (v === "skipped") return "skipped";
  return v?.correct ? "yes" : "no";
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // A family confirms a pick about once a week, plus the odd edit or retry.
  // 30/day/IP leaves room for several families on one network while keeping
  // a script from flooding the Sheet both apps share.
  if (!(await checkRateLimit(req, "submit-pick", 30))) {
    return tooManyRequests();
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

  const { sessionId, name, email, checkAnswers, questions, isEdit } = body;
  const q = Array.isArray(questions) ? questions.slice(0, 3) : [];

  const row = [
    new Date().toISOString(),
    sessionId,
    text(name, 60),
    text(email, 120),
    ageBand(body.ageBand),
    isEdit === true ? "yes" : "no",
    checkCol(checkAnswers?.room),
    checkCol(checkAnswers?.in),
    checkCol(checkAnswers?.out),
    text(q[0]?.text, QUESTION_TEXT),
    tagFor(q[0]),
    text(q[1]?.text, QUESTION_TEXT),
    tagFor(q[1]),
    text(q[2]?.text, QUESTION_TEXT),
    tagFor(q[2]),
  ];

  try {
    await appendRow("Sheet1", row);
  } catch (e) {
    console.error(`submit-pick: ${errorMessage(e)}`);
    return new Response("Failed to record submission", { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/submit-pick" };
