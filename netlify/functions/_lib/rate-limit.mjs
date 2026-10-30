import { createHmac, randomUUID } from "node:crypto";
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
//
// The stored identity is never the IP itself: a keyed hash that changes every
// day, so a counter can't be read back as an address or linked across days.
// The key is the service-account secret only because it's already a private
// value here; nothing is ever signed or decrypted with this hash, and the
// result only has to stay stable for one day.
function getIdentity(req, day) {
  const ip = req.headers.get("x-nf-client-connection-ip") || "unknown";
  const secret = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64 || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";
  return createHmac("sha256", secret).update(`${day}:${ip}`).digest("hex").slice(0, 32);
}

export async function checkRateLimit(req, bucket, limit) {
  const day = new Date().toISOString().slice(0, 10); // UTC date — counters reset daily by construction; cleanup-rate-limits removes old ones
  const identity = getIdentity(req, day);
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

// A counter is only ever read on its own day, so anything older is removed.
// Its key is `<bucket>:<YYYY-MM-DD>:<identity>`. Keys that don't match are left
// alone. Returns how many were removed. The refusal stats above stay: they
// hold no network information and are the lasting record.
export async function removeOldCounters(today = new Date().toISOString().slice(0, 10)) {
  const store = getStore("rate-limits");
  const { blobs } = await store.list();
  const old = blobs.map((b) => b.key).filter((key) => {
    const day = key.split(":")[1] || "";
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && day < today;
  });
  await Promise.all(old.map((key) => store.delete(key)));
  return old.length;
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
