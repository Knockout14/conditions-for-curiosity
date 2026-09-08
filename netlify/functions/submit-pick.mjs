import { appendRow } from "./_lib/google-sheets.mjs";

function tagFor(q) {
  return q ? `${q.domain} · ${q.bigIdea || q.category}` : "";
}

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

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { sessionId, name, email, ageBand, checkAnswers, questions, isEdit } = body;
  const q = Array.isArray(questions) ? questions : [];

  const row = [
    new Date().toISOString(),
    sessionId || "",
    name || "",
    email || "",
    ageBand || "",
    isEdit ? "yes" : "no",
    checkCol(checkAnswers?.room),
    checkCol(checkAnswers?.in),
    checkCol(checkAnswers?.out),
    q[0]?.text || "",
    tagFor(q[0]),
    q[1]?.text || "",
    tagFor(q[1]),
    q[2]?.text || "",
    tagFor(q[2]),
  ];

  try {
    await appendRow("Sheet1", row);
  } catch (e) {
    console.error(e);
    return new Response("Failed to record submission", { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/submit-pick" };
