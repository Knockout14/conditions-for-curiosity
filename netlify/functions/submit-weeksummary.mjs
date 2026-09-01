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

  const { sessionId, name, email, ageBand, finalOrder, askedOrder } = body;
  const fo = Array.isArray(finalOrder) ? finalOrder : [];
  const ao = Array.isArray(askedOrder) ? askedOrder : [];
  const matched = fo.length === ao.length && fo.every((q, i) => q?.id === ao[i]?.id);

  const row = [
    new Date().toISOString(),
    sessionId || "",
    name || "",
    email || "",
    ageBand || "",
    fo[0]?.text || "",
    fo[1]?.text || "",
    fo[2]?.text || "",
    ao[0]?.text || "",
    ao[1]?.text || "",
    ao[2]?.text || "",
    matched ? "yes" : "no",
  ];

  try {
    await appendRow("Week Summary", row);
  } catch (e) {
    console.error(e);
    return new Response("Failed to record submission", { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/submit-weeksummary" };
