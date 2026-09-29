import { appendRow } from "./_lib/google-sheets.mjs";
import { checkRateLimit, tooManyRequests } from "./_lib/rate-limit.mjs";
import { isSessionId, ageBand, text, tagFor, errorMessage, LONG_TEXT, QUESTION_TEXT } from "./_lib/input.mjs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // At most one circle-back a night per family, plus retries. Same
  // 30/day/IP budget as submit-pick, for the same reason.
  if (!(await checkRateLimit(req, "submit-circleback", 30))) {
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

  const { sessionId, name, email, question, rank, adultAnswer, childAskedQuestion, note } = body;
  const q = question && typeof question === "object" ? question : null;

  const row = [
    new Date().toISOString(),
    sessionId,
    text(name, 60),
    text(email, 120),
    ageBand(body.ageBand),
    Number.isInteger(q?.id) ? q.id : "",
    text(q?.text, QUESTION_TEXT),
    tagFor(q),
    [1, 2, 3].includes(rank) ? rank : "", // position (1/2/3) it held when asked — not wherever it ranks now, if it's since been reordered
    text(adultAnswer, LONG_TEXT),
    childAskedQuestion === true ? "yes" : "no",
    text(note, LONG_TEXT),
  ];

  try {
    await appendRow("Circle-back", row);
  } catch (e) {
    console.error(`submit-circleback: ${errorMessage(e)}`);
    return new Response("Failed to record submission", { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/submit-circleback" };
