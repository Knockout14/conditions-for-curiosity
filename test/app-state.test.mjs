// Tests for the week logic and the storage backup in site/app/app.js.
// app.js is a plain browser script, so it runs here in a vm sandbox with a
// small fake of the browser pieces it touches: localStorage, a cookie jar,
// fetch, location. No network, no real browser.
// Run: npm test
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const APP_JS = fs.readFileSync(path.join(root, "site/app/app.js"), "utf8");
const SESSION = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";

// A fresh fake browser with app.js loaded into it. `stored` is the
// localStorage state to start from; `cookie` the document.cookie string.
function boot({ stored = null, cookie = "" } = {}) {
  const store = new Map(stored ? [["cfc_app_state", JSON.stringify(stored)]] : []);
  const fakeStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const calls = [];
  const win = {
    localStorage: fakeStorage,
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { cookie, body: null, getElementById: () => null },
    location: { pathname: "/app/pick.html", href: "", replace() {} },
    fetch: async (url, init = {}) => {
      calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
      return { ok: true, json: async () => ({ ok: true }) };
    },
    crypto: globalThis.crypto, atob, btoa, TextDecoder, TextEncoder, Uint8Array,
    AbortController, setTimeout, clearTimeout, console, URL, Blob,
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(APP_JS, win);
  return { CFC: win.CFC, calls, stored: () => JSON.parse(store.get("cfc_app_state") || "null"), win };
}

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failures++; };
const Q = (id) => ({ id, text: `q${id}`, domain: "Math", bigIdea: "b" });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const base = { sessionId: SESSION, episode5: true, name: "Priya", ageBand: "3-4", onboardingComplete: true };

// ---- the mid-week edit (used to reset a counter, so the week never finished)
{
  const { CFC } = boot({ stored: { ...base, askedQuestionIds: [], weeklyPick: { questionIds: [1, 2, 3], askedIds: [], pickedAt: "t0" } } });
  CFC.markQuestionAsked(CFC.load(), 1);
  CFC.patch({ weeklyPick: CFC.buildWeeklyPick(CFC.load(), [3, 2, 1], true) }); // reorder mid-week
  check(same(CFC.weekAskedIds(CFC.load()), [1]), "edit mid-week: what was already asked is kept");
  CFC.markQuestionAsked(CFC.load(), 3);
  CFC.markQuestionAsked(CFC.load(), 2);
  const s = CFC.load();
  check(CFC.isWeekDone(s), "edit mid-week, then finish: the week counts as done");
  check(CFC.nextQuestion(s, [Q(3), Q(2), Q(1)]) === null, "…and there's no next question, so 'Pick again' samples fresh");
}

// ---- swapping an unasked question mid-week keeps the asked one
{
  const { CFC } = boot({ stored: { ...base, askedQuestionIds: [1], weeklyPick: { questionIds: [1, 2, 3], askedIds: [1], pickedAt: "t0" } } });
  CFC.patch({ weeklyPick: CFC.buildWeeklyPick(CFC.load(), [1, 2, 9], true) });
  const s = CFC.load();
  check(same(s.weeklyPick.askedIds, [1]) && !CFC.isWeekDone(s), "edit with a swap: asked stays asked, the new question is still to come");
}

// ---- one swap a week (it used to come back every time the screen reopened)
{
  const { CFC } = boot({ stored: { ...base, askedQuestionIds: [] } });
  CFC.patch({ weeklyPick: CFC.buildWeeklyPick(CFC.load(), [1, 9, 3], false, true) }); // fresh pick, swapped one
  check(CFC.load().weeklyPick.swapUsed === true, "swap: a swap during the pick is saved with it");
  CFC.patch({ weeklyPick: CFC.buildWeeklyPick(CFC.load(), [3, 9, 1], true, false) }); // reopened to reorder only
  check(CFC.load().weeklyPick.swapUsed === true, "swap: reopening the week to edit keeps it spent");
  CFC.patch({ weeklyPick: CFC.buildWeeklyPick(CFC.load(), [4, 5, 6], false, false) }); // next week's fresh pick
  check(CFC.load().weeklyPick.swapUsed === false, "swap: a new week gets a new swap");
}
{
  const { CFC } = boot({ stored: { ...base, askedQuestionIds: [], weeklyPick: { questionIds: [1, 2, 3], askedIds: [], pickedAt: "t0" } } });
  CFC.patch({ weeklyPick: CFC.buildWeeklyPick(CFC.load(), [1, 2, 7], true, true) }); // an older pick, first swap
  check(CFC.load().weeklyPick.swapUsed === true, "swap: an older saved pick (no swapUsed yet) can still use its one swap");
}

// ---- unconfirmed candidates survive a reload (it used to be a full reroll)
{
  const { CFC } = boot({ stored: { ...base, askedQuestionIds: [] } });
  check(CFC.pendingPick(CFC.load()) === null, "pending: nothing pending to start with");
  CFC.savePendingPick([4, 5, 6], false);
  check(same(CFC.pendingPick(CFC.load()), { questionIds: [4, 5, 6], swapUsed: false }), "pending: the drawn three are saved, in order");
  CFC.savePendingPick([6, 9, 4], true); // reordered, then swapped 5 for 9
  check(same(CFC.pendingPick(CFC.load()), { questionIds: [6, 9, 4], swapUsed: true }), "pending: a reorder and the swap are saved too");
  CFC.patch({ weeklyPick: CFC.buildWeeklyPick(CFC.load(), [6, 9, 4], false, true), pendingPick: null });
  check(CFC.pendingPick(CFC.load()) === null && CFC.load().weeklyPick.swapUsed === true, "pending: confirming clears it, and the swap carries into the week");
}
{
  const { CFC } = boot({ stored: { ...base, askedQuestionIds: [], pendingPick: { questionIds: [4, 5, 6], swapUsed: false } } });
  CFC.saveDetails({ name: "Priya R", email: "", ageBand: "3-4" });
  check(CFC.pendingPick(CFC.load()) !== null, "pending: editing a name keeps the candidates");
  CFC.saveDetails({ name: "Priya R", email: "", ageBand: "5-6" });
  check(CFC.pendingPick(CFC.load()) === null && CFC.load().ageBand === "5-6", "pending: changing the age band drops them (drawn for the old band)");
}
{
  for (const bad of [{ questionIds: [1, 2] }, { questionIds: ["1", "2", "3"] }, { questionIds: null }, "x"]) {
    const { CFC } = boot({ stored: { ...base, pendingPick: bad } });
    if (CFC.pendingPick(CFC.load()) !== null) { check(false, `pending: a malformed value is ignored (${JSON.stringify(bad)})`); }
  }
  check(true, "pending: malformed saved values are ignored, so the screen just draws fresh");
}

// ---- the first two weeks start at a family's first confirmed pick
{
  const { CFC } = boot({ stored: { ...base, askedQuestionIds: [] } });
  const first = CFC.firstPickAtFor(CFC.load());
  check(typeof first === "string" && Math.abs(Date.now() - Date.parse(first)) < 5000, "first weeks: a new family's first pick starts the window now");
}
{
  const { CFC } = boot({ stored: { ...base, firstPickAt: "2026-10-01T00:00:00.000Z", askedQuestionIds: [4] } });
  check(CFC.firstPickAtFor(CFC.load()) === "2026-10-01T00:00:00.000Z", "first weeks: a saved start date is never overwritten");
}
{
  const { CFC } = boot({ stored: { ...base, askedQuestionIds: [4, 5] } });
  check(CFC.firstPickAtFor(CFC.load()) === undefined, "first weeks: a family already mid-use gets no start date, so no restriction");
}
{
  // Confirmed a pick before start dates existed, asked nothing yet: the first
  // question asked fixes the start to that pick's date.
  const { CFC } = boot({ stored: { ...base, askedQuestionIds: [], weeklyPick: { questionIds: [1, 2, 3], askedIds: [], pickedAt: "2026-10-05T10:00:00.000Z" } } });
  CFC.markQuestionAsked(CFC.load(), 1);
  check(CFC.load().firstPickAt === "2026-10-05T10:00:00.000Z", "first weeks: a pick from before start dates existed backfills on the first question asked");
}
{
  const { CFC } = boot({ stored: { ...base, askedQuestionIds: [9], weeklyPick: { questionIds: [1, 2, 3], askedIds: [], pickedAt: "2026-10-05T10:00:00.000Z" } } });
  CFC.markQuestionAsked(CFC.load(), 1);
  check(CFC.load().firstPickAt === undefined, "first weeks: a family that had asked before is not given a start date later");
}
{
  const { CFC, calls } = boot({ stored: { ...base, firstPickAt: "2026-10-01T00:00:00.000Z", askedQuestionIds: [4] } });
  await CFC.fetchWeeklyCandidates(CFC.load());
  await CFC.fetchReplacementCandidate(CFC.load(), [1, 2]);
  const sent = calls.filter((c) => c.url === "/api/weekly-candidates");
  check(sent.length === 2 && sent.every((c) => c.body.firstPickAt === "2026-10-01T00:00:00.000Z"), "first weeks: both candidate requests send the start date");
}

// ---- a fresh pick starts empty, even after the pool runs out
{
  // Ages 3–4 have 47 questions, so after ~15 weeks the sampler re-offers
  // old ones. Id 5 was asked months ago and is back in this week's pick.
  const { CFC } = boot({ stored: { ...base, askedQuestionIds: [5, 40, 41, 42], weeklyPick: { questionIds: [40, 41, 42], askedIds: [40, 41, 42], pickedAt: "t0" } } });
  CFC.patch({ weeklyPick: CFC.buildWeeklyPick(CFC.load(), [5, 6, 7], false) });
  const s = CFC.load();
  const next = CFC.nextQuestion(s, [Q(5), Q(6), Q(7)]);
  check(next && next.question.id === 5 && next.index === 0, "pool ran out: a re-offered old question is still this week's first, not skipped");
  check(!CFC.isWeekDone(s) && same(CFC.weekAskedIds(s), []), "…and the new week starts with nothing asked");
  CFC.markQuestionAsked(s, 5);
  check(same(CFC.load().askedQuestionIds, [5, 40, 41, 42, 5]), "…while the all-time list still records every ask, for the sampler");
}

// ---- a pick saved before askedIds existed (families mid-week at deploy)
{
  const { CFC } = boot({ stored: { ...base, askedQuestionIds: [9, 1], weeklyPick: { questionIds: [1, 2, 3], usedCount: 1, pickedAt: "t0" } } });
  const s = CFC.load();
  check(same(CFC.weekAskedIds(s), [1]), "older saved pick: this week's asks are worked out from the all-time list");
  check(CFC.nextQuestion(s, [Q(1), Q(2), Q(3)]).question.id === 2, "…so the next question is still right");
  CFC.markQuestionAsked(s, 2);
  check(same(CFC.load().weeklyPick.askedIds, [1, 2]), "…and the first new ask moves it onto askedIds");
}

// ---- asking the same question twice doesn't double-count the week
{
  const { CFC } = boot({ stored: { ...base, askedQuestionIds: [], weeklyPick: { questionIds: [1, 2, 3], askedIds: [], pickedAt: "t0" } } });
  CFC.markQuestionAsked(CFC.load(), 2);
  CFC.markQuestionAsked(CFC.load(), 2);
  check(same(CFC.load().weeklyPick.askedIds, [2]), "the same question asked twice counts once for the week");
}

// ---- the week summary reports the order questions were actually asked
{
  const { CFC, calls } = boot({ stored: { ...base, askedQuestionIds: [7, 8, 3, 1, 2], weeklyPick: { questionIds: [1, 2, 3], askedIds: [3, 1, 2], pickedAt: "t9" } } });
  CFC.maybeSubmitWeekSummary(CFC.load(), [Q(1), Q(2), Q(3)]);
  const sent = calls.find((c) => c.url === "/api/submit-weeksummary");
  check(sent && same(sent.body.finalOrder.map((q) => q.id), [1, 2, 3]) && same(sent.body.askedOrder.map((q) => q.id), [3, 1, 2]),
    "week summary: final order 1,2,3 next to asked order 3,1,2");
}

// ---- error messages say what actually went wrong
{
  const { CFC } = boot();
  const now = new Date(2026, 8, 28, 14, 0, 0); // 2:00 PM local
  const limited = CFC.failureReason({ status: 429, retryAfter: 3 * 3600 }, now);
  check(/daily limit/.test(limited) && /resets today at/.test(limited) && /switching networks/.test(limited) && !/connection/.test(limited),
    "message: a rate limit says so, when it resets (today), and to switch networks, not 'check your connection'");
  check(/resets tomorrow at/.test(CFC.failureReason({ status: 429, retryAfter: 12 * 3600 }, now)), "message: a reset after midnight says tomorrow");
  check(/later today or tomorrow/.test(CFC.failureReason({ status: 429 }, now)), "message: a rate limit with no Retry-After still reads sensibly");
  check(/server/.test(CFC.failureReason({ status: 502 })), "message: a server failure says so");
  check(/Reloading/.test(CFC.failureReason({ status: 400 })), "message: a rejected request suggests reloading");
  check(/Check your connection/.test(CFC.failureReason(new Error("timed out"))), "message: a timeout or offline still says check your connection");
}

// ---- the storage backup (Safari's 7-day wipe)
{
  const { CFC, calls } = boot({ stored: { ...base, askedQuestionIds: [4, 5, 4, 6, 4] } });
  CFC.patch({ email: "p@example.com" });
  const sent = calls.filter((c) => c.url === "/api/remember-state").pop();
  check(sent && sent.body.name === "Priya" && same(sent.body.askedQuestionIds, [5, 6, 4]),
    "backup: sent on save once there's a name, each asked id once (its most recent ask)");
}
{
  const { calls, CFC } = boot({ stored: { sessionId: SESSION, episode5: true } });
  CFC.patch({ episode5: true });
  check(!calls.some((c) => c.url === "/api/remember-state"), "backup: nothing sent before there's a name");
}
{
  const state = { ...base, email: "", weeklyPick: { questionIds: [1, 2, 3], askedIds: [1], pickedAt: "t0" } };
  const b64 = Buffer.from(JSON.stringify(state)).toString("base64url");
  const { CFC, stored } = boot({ cookie: `other=1; cfc_state=${b64}` });
  const s = CFC.load();
  check(s.sessionId === SESSION && s.name === "Priya" && same(s.weeklyPick.askedIds, [1]), "restore: after a wipe, load() brings the state back from the cookie");
  check(stored() && stored().sessionId === SESSION, "restore: …and writes it back into localStorage");
}
{
  const { CFC } = boot({ cookie: "cfc_state=bm90LWpzb24" }); // base64 of "not-json"
  const s = CFC.load();
  check(s.sessionId && s.sessionId !== SESSION && !s.name, "restore: a damaged cookie is ignored and the app starts fresh");
}

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
