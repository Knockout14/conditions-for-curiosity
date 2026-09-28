// Shared input handling for the three write endpoints (submit-pick,
// submit-circleback, submit-weeksummary). Each one appends a row to the
// Google Sheet, which both apps share, so every value is bounded here before
// it goes anywhere near it. Matches the counting-games repo's submit-night.

// Every client makes its session id with crypto.randomUUID() (or a v4-shaped
// fallback), so anything else is a scripted call.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isSessionId = (v) => typeof v === "string" && UUID.test(v);

const AGE_BANDS = ["3-4", "5-6", "7-8"];
export const ageBand = (v) => (AGE_BANDS.includes(v) ? v : "");

// Any value as trimmed text, at most `max` characters. Objects and arrays
// never reach the Sheets API as structures, only as bounded strings.
export const text = (v, max) => String(v ?? "").trim().slice(0, max);

// Free text a family writes (their answer, a circle-back note). Matches the
// maxlength on the app's textareas, so a real family never hits it.
export const LONG_TEXT = 4000;

// Question fields are copied from the bank by the client. Real bank text is
// far shorter than this; the cap only bounds a scripted call.
export const QUESTION_TEXT = 300; // the longest in the bank is 82
export const QUESTION_TAG = 200;

// The question's "domain · big idea" label, as the Sheet has always shown it.
export function tagFor(q) {
  if (!q || typeof q !== "object") return "";
  return text(`${text(q.domain, 60)} · ${text(q.bigIdea || q.category, 120)}`, QUESTION_TAG);
}

// Netlify's logger prints a raw Error as a blank line, so log the message as
// text. Messages here are "env vars not set" or Google's HTTP error text,
// never the key.
export const errorMessage = (e) => (e && e.message ? e.message : String(e));
