// Offline tests for all five Functions: no network, no Netlify account, no
// Google credentials. At bundle time the Blobs store is swapped for a fake
// 40-question bank, the rate limiter for a stub, and the Google Sheets
// client for one that records the rows it would have appended.
// Run: npm test
import * as esbuild from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "cfc-test-"));

// Fake bank: every anchor type, a spread of age ranges (varied
// independently of anchor), and alternating domains.
const ANCHORS = ["RAW", "FOUND", "PREPARED", "SITUATIONAL", "RETROSPECTIVE"];
const AGES = ["3-4", "3-6", "5-6", "5-8", "7-8"];
const BANK = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  anchor: ANCHORS[i % 5],
  ages: AGES[Math.floor(i / 5) % 5],
  domain: i % 2 ? "Math" : "General",
  text: `q${i + 1}`,
  bigIdea: "b",
  category: "Notice",
  seed: `seed${i + 1}`,
  prep: `prep${i + 1}`,
}));
globalThis.__TEST_BANK = BANK;
globalThis.__TEST_ROWS = [];
globalThis.__TEST_SHEETS_FAIL = false;

const stubs = {
  name: "stubs",
  setup(build) {
    build.onResolve({ filter: /rate-limit\.mjs$/ }, () => ({ path: "rate-limit", namespace: "stub" }));
    build.onResolve({ filter: /^@netlify\/blobs$/ }, () => ({ path: "blobs", namespace: "stub" }));
    build.onResolve({ filter: /google-sheets\.mjs$/ }, () => ({ path: "sheets", namespace: "stub" }));
    // __TEST_LIMITED switches every endpoint into "rate limit reached". The
    // real module is tested on its own at the end of this file.
    build.onLoad({ filter: /^rate-limit$/, namespace: "stub" }, () => ({
      contents: `export async function checkRateLimit(){ return !globalThis.__TEST_LIMITED; }
        export function tooManyRequests(){ return new Response("Too many requests", { status: 429 }); }`,
    }));
    build.onLoad({ filter: /^blobs$/, namespace: "stub" }, () => ({
      contents: "export const getStore = () => ({ get: async () => globalThis.__TEST_BANK });",
    }));
    build.onLoad({ filter: /^sheets$/, namespace: "stub" }, () => ({
      contents: `export async function appendRow(tab, row) {
        if (globalThis.__TEST_SHEETS_FAIL) throw new Error("sheets append failed: 500 quota");
        globalThis.__TEST_ROWS.push({ tab, row });
      }`,
    }));
  },
};

async function load(name) {
  const file = path.join(out, `${name}.mjs`);
  await esbuild.build({
    entryPoints: [path.join(root, "netlify/functions", `${name}.mjs`)],
    outfile: file, bundle: true, format: "esm", platform: "node", plugins: [stubs], logLevel: "silent",
  });
  return (await import(pathToFileURL(file).href)).default;
}

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failures++; };
const post = (body) => new Request("https://x/api", { method: "POST", body: JSON.stringify(body) });
const get = () => new Request("https://x/api", { method: "GET" });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const servable = (q) => q.anchor === "RAW" || q.anchor === "FOUND";
const byId = new Map(BANK.map((q) => [q.id, q]));
const range = (ages) => ages.split("-").map(Number);

const weeklyCandidates = await load("weekly-candidates");
const questionsByIds = await load("questions-by-ids");

// ---- weekly-candidates
check((await weeklyCandidates(get())).status === 405, "weekly-candidates: GET -> 405");

for (const bad of [undefined, "x", "3-8", { "3-4": 1 }, 34, "__proto__", "toString"]) {
  const res = await weeklyCandidates(post({ ageBand: bad }));
  check(res.status === 400, `weekly-candidates: ageBand ${JSON.stringify(bad)} -> 400`);
}

{
  // Sampling is random, so check many draws per band.
  const problems = [];
  for (let t = 0; t < 50; t++) {
    for (const band of ["3-4", "5-6", "7-8"]) {
      const [lo, hi] = range(band);
      const r = await (await weeklyCandidates(post({ ageBand: band, count: 999 }))).json();
      if (r.length !== 3) problems.push(`${band}: count 999 returned ${r.length}`);
      for (const c of r) {
        const q = byId.get(c.id);
        const [a, b] = range(q.ages);
        if (!servable(q)) problems.push(`${band}: served ${q.anchor} id ${c.id}`);
        if (a > hi || b < lo) problems.push(`${band}: id ${c.id} is ages ${q.ages}`);
        if ("seed" in c || "prep" in c) problems.push(`${band}: candidate carried seed/prep`);
      }
    }
  }
  check(problems.length === 0, `weekly-candidates: count 999 -> 3, Raw/Found only, age-matched, no seed/prep (150 draws)${problems.length ? `: ${problems[0]}` : ""}`);
}

check((await (await weeklyCandidates(post({ ageBand: "5-6", count: 1 }))).json()).length === 1, "weekly-candidates: count 1 -> 1 (a swap)");
check((await (await weeklyCandidates(post({ ageBand: "5-6" }))).json()).length === 3, "weekly-candidates: no count -> 3 (a weekly pick)");

{
  const domains = (await (await weeklyCandidates(post({ ageBand: "7-8" }))).json()).map((c) => byId.get(c.id).domain);
  check(domains.includes("Math") && domains.some((d) => d !== "Math"), "weekly-candidates: a weekly pick mixes Math and General");
}

{
  const pool = BANK.filter((q) => servable(q) && range(q.ages)[1] >= 7).map((q) => q.id);
  const excluded = pool.slice(0, -1);
  const r = await (await weeklyCandidates(post({
    ageBand: "7-8", count: 1, excludeIds: excluded, askedQuestionIds: Array(100000).fill(1),
  }))).json();
  check(r.length === 1 && !excluded.includes(r[0].id), "weekly-candidates: excludeIds respected; a 100k-long asked list is handled");
}

// ---- questions-by-ids
check((await questionsByIds(get())).status === 405, "questions-by-ids: GET -> 405");

{
  const r = await (await questionsByIds(post({ ids: BANK.map((q) => q.id) }))).json();
  check(r.length <= 3, `questions-by-ids: all 40 ids requested -> ${r.length} returned (at most 3)`);
}
{
  const hidden = BANK.filter((q) => !servable(q)).map((q) => q.id).slice(0, 3);
  const r = await (await questionsByIds(post({ ids: hidden }))).json();
  check(r.length === 0, "questions-by-ids: Prepared/Situational/Retrospective ids -> nothing");
}
{
  const ids = BANK.filter(servable).map((q) => q.id).slice(0, 3);
  const r = await (await questionsByIds(post({ ids }))).json();
  check(r.length === 3 && r.every((q, i) => q.id === ids[i] && q.seed && q.prep && q.ages),
    "questions-by-ids: 3 Raw/Found ids -> full fields, in request order");
}
{
  const r = await (await questionsByIds(post({ ids: ["1", 1.5, null, 1] }))).json();
  check(r.length === 1 && r[0].id === 1, "questions-by-ids: non-integer ids ignored");
}

// ---- the three write endpoints
const submitPick = await load("submit-pick");
const submitCircleBack = await load("submit-circleback");
const submitWeekSummary = await load("submit-weeksummary");

const SESSION = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";
const Q = (id) => ({ id, text: `q${id}`, domain: "Math", bigIdea: "Counting", category: "Notice" });
const lastRow = () => globalThis.__TEST_ROWS.at(-1);
const huge = "x".repeat(20000);

// Sends `body` and reports the status plus the row appended, if any.
async function send(fn, body) {
  const before = globalThis.__TEST_ROWS.length;
  const res = await fn(post(body));
  return { status: res.status, row: globalThis.__TEST_ROWS.length > before ? lastRow() : null };
}

for (const [name, fn] of [["submit-pick", submitPick], ["submit-circleback", submitCircleBack], ["submit-weeksummary", submitWeekSummary]]) {
  check((await fn(get())).status === 405, `${name}: GET -> 405`);
  check((await fn(new Request("https://x/api", { method: "POST", body: "{not json" }))).status === 400, `${name}: malformed JSON -> 400`);
  for (const bad of [undefined, "", "test-session-1", 12345, { id: SESSION }, `${SESSION}x`]) {
    const r = await send(fn, { sessionId: bad, name: "A" });
    check(r.status === 400 && !r.row, `${name}: sessionId ${JSON.stringify(bad)} -> 400, nothing written`);
  }
}

{
  // What the app actually sends (app.js submitPick), and the row it has always produced.
  const r = await send(submitPick, {
    sessionId: SESSION, name: "Priya", email: "p@example.com", ageBand: "5-6",
    checkAnswers: { room: { selected: "a", correct: true }, in: "skipped", out: { selected: "b", correct: false } },
    questions: [Q(1), Q(2), Q(6)], isEdit: false,
  });
  const expected = [SESSION, "Priya", "p@example.com", "5-6", "no", "yes", "skipped", "no",
    "q1", "Math · Counting", "q2", "Math · Counting", "q6", "Math · Counting"];
  check(r.status === 200 && r.row.tab === "Sheet1" && JSON.stringify(r.row.row.slice(1)) === JSON.stringify(expected),
    "submit-pick: a real pick -> the same 15-column row as before");
}
{
  const r = await send(submitPick, {
    sessionId: SESSION, name: huge, email: huge, ageBand: "3-99", isEdit: "yes",
    questions: Array.from({ length: 50 }, (_, i) => ({ id: i, text: huge, domain: huge, bigIdea: { x: 1 } })),
  });
  const row = r.row.row;
  check(r.status === 200 && row.length === 15, "submit-pick: oversized input -> still exactly 15 columns");
  check(row[2].length === 60 && row[3].length === 120 && row[4] === "" && row[5] === "no",
    "submit-pick: name capped at 60, email at 120, bad ageBand blank, non-boolean isEdit -> no");
  check(row.slice(9).every((c) => typeof c === "string" && c.length <= 300), "submit-pick: question cells are bounded strings");
}

{
  // What circleback.html sends via app.js submitCircleBack.
  const r = await send(submitCircleBack, {
    sessionId: SESSION, name: "Priya", email: "", ageBand: "7-8",
    question: Q(11), rank: 2, adultAnswer: "Mine was the stairs.", childAskedQuestion: true, note: "Asked why.",
  });
  const expected = [SESSION, "Priya", "", "7-8", 11, "q11", "Math · Counting", 2, "Mine was the stairs.", "yes", "Asked why."];
  check(r.status === 200 && r.row.tab === "Circle-back" && JSON.stringify(r.row.row.slice(1)) === JSON.stringify(expected),
    "submit-circleback: a real circle-back -> the same 12-column row as before");
}
{
  const r = await send(submitCircleBack, {
    sessionId: SESSION, question: "not an object", rank: 99, adultAnswer: huge, childAskedQuestion: "yes", note: { a: huge },
  });
  const row = r.row.row;
  check(r.status === 200 && row.length === 12, "submit-circleback: oversized input -> still exactly 12 columns");
  check(row[5] === "" && row[6] === "" && row[7] === "" && row[8] === "", "submit-circleback: a non-object question and a bad rank -> blank cells");
  check(row[9].length === 4000 && row[10] === "no" && row[11].length <= 4000, "submit-circleback: answer and note capped at 4000; only true counts as yes");
}

{
  // What app.js maybeSubmitWeekSummary sends.
  const r = await send(submitWeekSummary, {
    sessionId: SESSION, name: "Priya", email: "", ageBand: "5-6",
    finalOrder: [Q(1), Q(2), Q(6)], askedOrder: [Q(2), Q(1), Q(6)],
  });
  const expected = [SESSION, "Priya", "", "5-6", "q1", "q2", "q6", "q2", "q1", "q6", "no"];
  check(r.status === 200 && r.row.tab === "Week Summary" && JSON.stringify(r.row.row.slice(1)) === JSON.stringify(expected),
    "submit-weeksummary: a real week -> the same 12-column row as before");
}
{
  const many = Array.from({ length: 50 }, (_, i) => ({ id: i, text: huge }));
  const r = await send(submitWeekSummary, { sessionId: SESSION, finalOrder: many, askedOrder: many });
  check(r.status === 200 && r.row.row.length === 12 && r.row.row[11] === "yes" && r.row.row.slice(5, 11).every((c) => c.length === 300),
    "submit-weeksummary: 50-item orders -> first 3 only, texts capped, still 12 columns");
}

{
  // A Sheets failure: 502 to the app, and a log line that isn't blank.
  const logged = [];
  const realError = console.error;
  console.error = (...a) => logged.push(a.join(" "));
  globalThis.__TEST_SHEETS_FAIL = true;
  const res = await submitCircleBack(post({ sessionId: SESSION }));
  globalThis.__TEST_SHEETS_FAIL = false;
  console.error = realError;
  check(res.status === 502 && logged.length === 1 && logged[0].includes("sheets append failed: 500 quota"),
    "writes: a Sheets failure -> 502, logged as readable text");
}

// ---- remember-state (the Safari-proof backup cookie)
const rememberState = await load("remember-state");
const remember = (body, headers = {}) => rememberState(new Request("https://x/api/remember-state", {
  method: "POST",
  headers: { "content-type": "application/json", "sec-fetch-site": "same-origin", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
}));
// Decodes the cookie exactly the way site/app/app.js readBackup() does.
const decodeCookie = (setCookie) => {
  const value = setCookie.match(/^cfc_state=([^;]+)/)[1];
  const bytes = Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

// A year of weekly use, as app.js sends it (each asked id once).
const yearOfState = {
  sessionId: SESSION, episode5: true, name: "Zoë-Ann Nguyễn", email: "zoe.ann.nguyen@example.com", ageBand: "5-6",
  checkAnswers: {
    room: { selected: "Something left out that invites a question", correct: true },
    in: { selected: "Whether you're actually curious too", correct: true },
    out: "skipped",
  },
  onboardingComplete: true, onboardingCompletedAt: "2026-09-01T19:02:11.123Z",
  weeklyPick: { questionIds: [101, 102, 103], usedCount: 2, pickedAt: "2026-09-27T17:00:00.000Z" },
  askedQuestionIds: Array.from({ length: 86 }, (_, i) => i + 1), // every servable question, once
  weekSummarySentFor: "2026-09-20T17:00:00.000Z",
};

check((await rememberState(get())).status === 405, "remember-state: GET -> 405");
check((await remember(yearOfState, { "sec-fetch-site": "cross-site" })).status === 403, "remember-state: a cross-site request -> 403");
check((await remember(yearOfState, { "content-type": "text/plain" })).status === 403, "remember-state: not JSON (what a form on another site sends) -> 403");
check((await remember("{not json")).status === 400, "remember-state: malformed JSON -> 400");
for (const bad of [[], "text", { name: "no session" }, { sessionId: "test-session-1" }]) {
  check((await remember(bad)).status === 400, `remember-state: ${JSON.stringify(bad)} -> 400`);
}
check((await remember({ sessionId: SESSION, name: huge })).status === 413, "remember-state: oversized state -> 413");
{
  const res = await remember(yearOfState);
  const setCookie = res.headers.get("set-cookie") || "";
  check(res.status === 204, "remember-state: a real state -> 204");
  check(/; Path=\/app; /.test(setCookie) && /Max-Age=34560000/.test(setCookie) && /SameSite=Lax/.test(setCookie) && /Secure/.test(setCookie) && !/HttpOnly/i.test(setCookie),
    "remember-state: cookie is scoped to /app, lasts 400 days, SameSite=Lax, Secure, readable by app.js");
  check(JSON.stringify(decodeCookie(setCookie)) === JSON.stringify(yearOfState), "remember-state: the cookie decodes back to the exact state (including non-ASCII names)");
  check(setCookie.length < 4000, `remember-state: a full year's state fits in one cookie (${setCookie.length} of ~4096 bytes)`);
}
{
  const res = await remember({ sessionId: SESSION, name: "A", note: "</script><img src=x onerror=alert(1)>; Path=/" });
  const setCookie = res.headers.get("set-cookie") || "";
  check(res.status === 204 && !/[\s;,]/.test(setCookie.match(/^cfc_state=([^;]+)/)[1]),
    "remember-state: hostile text can't break out of the cookie value (base64url only)");
}

// ---- rate limits: every limited endpoint answers 429, before touching anything
{
  globalThis.__TEST_LIMITED = true;
  const rowsBefore = globalThis.__TEST_ROWS.length;
  const results = [
    ["weekly-candidates", await weeklyCandidates(post({ ageBand: "5-6" }))],
    ["questions-by-ids", await questionsByIds(post({ ids: [1] }))],
    ["submit-pick", await submitPick(post({ sessionId: SESSION }))],
    ["submit-circleback", await submitCircleBack(post({ sessionId: SESSION }))],
    ["submit-weeksummary", await submitWeekSummary(post({ sessionId: SESSION }))],
  ];
  globalThis.__TEST_LIMITED = false;
  check(results.every(([, r]) => r.status === 429) && globalThis.__TEST_ROWS.length === rowsBefore,
    "rate limit: all five limited endpoints answer 429, and nothing is written");
}

// ---- the real rate limiter, against an in-memory Blobs store
{
  globalThis.__TEST_COUNTERS = new Map();
  const file = path.join(out, "rate-limit-real.mjs");
  await esbuild.build({
    entryPoints: [path.join(root, "netlify/functions/_lib/rate-limit.mjs")],
    outfile: file, bundle: true, format: "esm", platform: "node", logLevel: "silent",
    plugins: [{
      name: "blobs-in-memory",
      setup(build) {
        build.onResolve({ filter: /^@netlify\/blobs$/ }, () => ({ path: "blobs", namespace: "mem" }));
        build.onLoad({ filter: /^blobs$/, namespace: "mem" }, () => ({
          contents: `export const getStore = (name) => ({
            get: async (k) => globalThis.__TEST_COUNTERS.get(name + "::" + k) ?? null,
            set: async (k, v) => { globalThis.__TEST_COUNTERS.set(name + "::" + k, v); },
          });`,
        }));
      },
    }],
  });
  const { checkRateLimit, tooManyRequests } = await import(pathToFileURL(file).href);
  const from = (ip) => new Request("https://x/api", { method: "POST", headers: { "x-nf-client-connection-ip": ip } });

  const warned = [];
  const realWarn = console.warn;
  console.warn = (...a) => warned.push(a.join(" "));
  const allowed = [];
  for (let i = 0; i < 5; i++) allowed.push(await checkRateLimit(from("203.0.113.7"), "submit-pick", 3));
  const otherNetwork = await checkRateLimit(from("198.51.100.2"), "submit-pick", 3);
  console.warn = realWarn;

  check(same(allowed, [true, true, true, false, false]) && otherNetwork, "rate limiter: allows the limit, refuses after it, per network");
  check(warned.length === 1 && warned[0].includes("submit-pick") && !warned.join().includes("203.0.113.7"),
    "rate limiter: logs the first refusal only, with no IP address in the log");

  const today = new Date().toISOString().slice(0, 10);
  const statKeys = [...globalThis.__TEST_COUNTERS.keys()].filter((k) => k.startsWith("rate-limit-stats::"));
  check(statKeys.length === 1 && statKeys[0].startsWith(`rate-limit-stats::${today}/submit-pick/`) && !statKeys[0].includes("203.0.113.7"),
    "rate limiter: records one lasting stats entry per refused network (day/endpoint only, no IP)");

  const res = tooManyRequests();
  const retryAfter = Number(res.headers.get("retry-after"));
  const resetsAt = new Date(Date.now() + retryAfter * 1000);
  check(res.status === 429 && retryAfter > 0 && retryAfter <= 86400 && resetsAt.getUTCHours() === 0 && resetsAt.getUTCMinutes() <= 1,
    `rate limiter: 429 carries Retry-After (${retryAfter}s), which lands on the next UTC midnight`);

  // A second network refused the same day adds its own entry: no shared
  // counter to overwrite.
  for (let i = 0; i < 4; i++) await checkRateLimit(from("198.51.100.2"), "submit-pick", 3);
  const { summarize, formatReport } = await import(pathToFileURL(path.join(root, "scripts/rate-limit-report.mjs")).href);
  const rows = summarize([...globalThis.__TEST_COUNTERS.keys()].filter((k) => k.startsWith("rate-limit-stats::")).map((k) => k.split("::")[1]));
  check(same(rows, [{ day: today, bucket: "submit-pick", networks: 2 }]), "report: two networks refused on one endpoint read as 2");
}

// ---- the report's grouping and wording (scripts/rate-limit-report.mjs)
{
  const { summarize, formatReport } = await import(pathToFileURL(path.join(root, "scripts/rate-limit-report.mjs")).href);
  const u = () => crypto.randomUUID();
  const keys = [
    `2026-09-27/submit-pick/${u()}`, `2026-09-28/weekly-candidates/${u()}`, `2026-09-28/submit-pick/${u()}`,
    `2026-09-28/submit-pick/${u()}`, `2026-08-01/submit-pick/${u()}`, "garbage", `2026-09-28/submit-pick/not-a-uuid`,
  ];
  const rows = summarize(keys, "2026-09-01");
  check(same(rows, [
    { day: "2026-09-28", bucket: "submit-pick", networks: 2 },
    { day: "2026-09-28", bucket: "weekly-candidates", networks: 1 },
    { day: "2026-09-27", bucket: "submit-pick", networks: 1 },
  ]), "report: groups by day and endpoint, newest first, skips old and malformed keys");
  const text = formatReport("Question app", rows, 30);
  check(text.startsWith("Question app: 4 refused networks in the last 30 days") && /submit-pick\s+2 networks$/m.test(text) && /weekly-candidates\s+1 network$/m.test(text),
    "report: totals and singular/plural read right");
  check(formatReport("Counting games", [], 30) === "Counting games: no networks hit a limit in the last 30 days.", "report: an empty store says so plainly");
}

fs.rmSync(out, { recursive: true, force: true });
console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
