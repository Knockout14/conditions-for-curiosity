import { isSessionId } from "./_lib/input.mjs";

// Hands a family's own app progress straight back to their browser as a
// cookie, so it survives Safari clearing localStorage.
//
// Why a server is involved at all: Safari (ITP) deletes localStorage, and
// every cookie JavaScript creates, after 7 days of Safari use without a
// visit to the site. A weekly app can easily go that long. Cookies set in
// an HTTP response by the site's own server are not capped that way
// (https://webkit.org/tracking-prevention/), so the app sends its state here
// and this sets it as one. app.js restores from it when localStorage comes
// back empty.
//
// Nothing is stored or logged: the state goes in, the same bytes come back
// out as a cookie on the caller's own device. There's no rate limit, since
// a call has no effect beyond the caller's own browser, and limiting it
// would cost more (Blobs reads and writes) than the call itself.

const COOKIE = "cfc_state";
// A cookie holds about 4 KB. 2800 bytes of JSON is about 3.7 KB as base64,
// leaving room for the name and attributes. A real family's state is well
// under half of this (app.js drops repeated ids before sending).
const MAX_STATE_BYTES = 2800;
const MAX_AGE = 400 * 24 * 60 * 60; // 400 days, the longest Chrome allows

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Only the app's own pages may set this cookie. A form on another site
  // can't send application/json, and browsers that send Sec-Fetch-Site mark
  // cross-site requests. Without this, another site could overwrite a
  // family's backup with a state of its choosing.
  const site = req.headers.get("sec-fetch-site");
  const type = req.headers.get("content-type") || "";
  if ((site && site !== "same-origin") || !type.startsWith("application/json")) {
    return new Response("Forbidden", { status: 403 });
  }

  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_STATE_BYTES) {
    return new Response("Too large", { status: 413 });
  }
  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!state || typeof state !== "object" || Array.isArray(state) || !isSessionId(state.sessionId)) {
    return new Response("Bad request", { status: 400 });
  }

  // Re-serialized, so only valid JSON can ever end up in the cookie.
  const value = Buffer.from(JSON.stringify(state)).toString("base64url");
  return new Response(null, {
    status: 204,
    headers: {
      // Path=/app: sent only with the app's own pages, never the podcast site.
      // Not HttpOnly: app.js has to read it to restore from it.
      "set-cookie": `${COOKIE}=${value}; Path=/app; Max-Age=${MAX_AGE}; SameSite=Lax; Secure`,
      "cache-control": "no-store",
    },
  });
};

export const config = { path: "/api/remember-state" };
