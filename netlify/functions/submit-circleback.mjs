import { appendRow } from "./_lib/google-sheets.mjs";

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

  const { sessionId, name, email, ageBand, question, adultAnswer, childAskedQuestion, note } = body;

  const row = [
    new Date().toISOString(),
    sessionId || "",
    name || "",
    email || "",
    ageBand || "",
    question?.id ?? "",
    question?.text || "",
    question ? `${question.domain} · ${question.bigIdea || question.category}` : "",
    adultAnswer || "",
    childAskedQuestion ? "yes" : "no",
    note || "",
  ];

  try {
    await appendRow("Circle-back", row);
  } catch (e) {
    console.error(e);
    return new Response("Failed to record submission", { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/submit-circleback" };
