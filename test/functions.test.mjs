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
    build.onLoad({ filter: /^rate-limit$/, namespace: "stub" }, () => ({
      contents: "export async function checkRateLimit(){ return true; }",
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

fs.rmSync(out, { recursive: true, force: true });
console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
