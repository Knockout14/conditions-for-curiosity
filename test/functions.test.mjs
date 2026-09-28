// Offline tests for the two question-bank Functions: no network, no
// Netlify account. The Blobs store is swapped for a fake 40-question bank
// and the rate limiter for a stub, both at bundle time.
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

const stubs = {
  name: "stubs",
  setup(build) {
    build.onResolve({ filter: /rate-limit\.mjs$/ }, () => ({ path: "rate-limit", namespace: "stub" }));
    build.onResolve({ filter: /^@netlify\/blobs$/ }, () => ({ path: "blobs", namespace: "stub" }));
    build.onLoad({ filter: /^rate-limit$/, namespace: "stub" }, () => ({
      contents: "export async function checkRateLimit(){ return true; }",
    }));
    build.onLoad({ filter: /^blobs$/, namespace: "stub" }, () => ({
      contents: "export const getStore = () => ({ get: async () => globalThis.__TEST_BANK });",
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

fs.rmSync(out, { recursive: true, force: true });
console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
