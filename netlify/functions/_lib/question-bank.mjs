// The one definition of which questions the app may ever send to a browser.
// v1 uses only the Raw and Found anchors (spec §3c); the rest of the bank
// (Prepared, Situational, Retrospective) stays server-side entirely, so no
// endpoint can be asked for it, whatever ids a caller sends. A question
// marked retired is never served, even if it is still in the stored bank.
export function isServable(q) {
  return !q.retired && (q.anchor === "RAW" || q.anchor === "FOUND");
}
