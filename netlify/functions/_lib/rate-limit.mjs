import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";

// Coarse per-identity-per-day request cap, backed by a Netlify Blobs
// counter. Not meant to stop a determined, patient attacker — it exists to
// make bulk-scraping the question bank and flooding the Sheet slow and
// costly rather than a five-minute script, while staying invisible to any
// real family's actual usage (a handful of calls per week, not dozens in a
// day).
//
// Identity is IP-based for now, since the app has no login yet and a
// client-sent sessionId can be freely reminted by a script — it's not a
// real security boundary. getIdentity() is deliberately the only place
// that decision lives.
//
// Known cost, accepted only until login: everyone on one network shares
// one budget, so a large group on one Wi-Fi (a school PD session) can hit
// the caps. Once users are limited to people who log in, the plan (KO's
// call, 2026-09-28) is to remove these IP-based limits in general, not to
// stack account limits on top of them. Until then, tooManyRequests() tells
// the app when the cap resets, so it can say so plainly, and the first
// refusal per network per day is logged, so real families hitting the
// limit show up in the Function logs.
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

  // Once per network per bucket per day, and never the IP itself.
  if (count === limit + 1) {
    console.warn(`rate limit reached: ${bucket} (${limit}/day) by one network`);
    await recordRefusal(day, bucket);
  }
  return count <= limit;
}

// A lasting record next to the log line, since Netlify keeps Function logs
// only briefly. One entry per network refused, per bucket per day, read by
// `npm run limits` (scripts/rate-limit-report.mjs). Each entry gets its own
// random key rather than bumping a shared counter, so two refusals at once
// can't overwrite each other, and nothing about the network is stored.
// A failure here never blocks the request.
export const STATS_STORE = "rate-limit-stats";
async function recordRefusal(day, bucket) {
  try {
    await getStore(STATS_STORE).set(`${day}/${bucket}/${randomUUID()}`, "1");
  } catch (e) {
    console.error(`rate-limit-stats: ${e && e.message ? e.message : String(e)}`);
  }
}

// The 429 every endpoint returns. Retry-After is the seconds until the
// counters reset (the next UTC midnight), which the app turns into a local
// time: "It resets today at 8:00 PM."
export function tooManyRequests() {
  const now = Date.now();
  const nextUtcMidnight = Math.ceil((now + 1) / 864e5) * 864e5;
  return new Response("Too many requests", {
    status: 429,
    headers: { "retry-after": String(Math.ceil((nextUtcMidnight - now) / 1000)) },
  });
}
