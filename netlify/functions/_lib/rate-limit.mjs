import { getStore } from "@netlify/blobs";

// Coarse per-identity-per-day request cap, backed by a Netlify Blobs
// counter. Not meant to stop a determined, patient attacker — it exists to
// make bulk-scraping the question bank through the read endpoints slow and
// costly rather than a five-minute script, while staying invisible to any
// real family's actual usage (a handful of calls per week, not dozens in a
// day).
//
// Identity is IP-based for now, since the app has no login yet and a
// client-sent sessionId can be freely reminted by a script — it's not a
// real security boundary. getIdentity() is deliberately the only place
// that decision lives: once real authentication exists, swap this one
// function to key off the authenticated account id instead (falling back
// to IP for anyone still anonymous), and every call site keeps working
// unchanged. Account-scoped limiting — and, separately, a real per-account
// "only ids this account was actually offered" allowlist — is the natural
// next layer once accounts exist. This isn't meant to be torn out when
// that ships; anonymous/IP-based limiting stays useful defense-in-depth
// even after login exists, it just stops being the only layer.
function getIdentity(req) {
  return req.headers.get("x-nf-client-connection-ip") || "unknown";
}

export async function checkRateLimit(req, bucket, limit) {
  const identity = getIdentity(req);
  const day = new Date().toISOString().slice(0, 10); // UTC date — counters reset daily by construction, no cleanup job needed
  const key = `${bucket}:${day}:${identity}`;

  const store = getStore("rate-limits");
  // Blobs defaults to eventual consistency, which is fine for the question
  // bank itself (rarely written, read constantly) but wrong for a counter —
  // a read landing on a stale replica would silently undercount and let
  // the limit be bypassed. Strong consistency forces this read to reflect
  // the latest write regardless of which edge node serves it.
  const current = parseInt((await store.get(key, { type: "text", consistency: "strong" })) || "0", 10);
  const count = current + 1;
  await store.set(key, String(count));

  return count <= limit;
}
