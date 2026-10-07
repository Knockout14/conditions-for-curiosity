// How many networks hit a daily rate limit, per day and endpoint, per site.
// Run: npm run limits            (last 30 days)
//      npm run limits -- --days 90
//
// Reads the "rate-limit-stats" Blobs store that _lib/rate-limit.mjs writes
// to (one entry per network refused, per endpoint per day; no IPs), through
// the Netlify CLI, so it needs `netlify login` and nothing else. Read-only.
//
// What to look for: a steady trickle on the write endpoints (submit-*) means
// real families, not scrapers, are being turned away. That's the signal to
// raise a limit, or to prioritize login, after which the IP limits come out.
import { execSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

// This repo's own site. Other sites (a private pilot) are listed in
// scripts/limits.local.json, which is gitignored so their ids stay out of
// this public repo: { "Counting games": "<netlify site id>" }.
const LOCAL_SITES = fileURLToPath(new URL("./limits.local.json", import.meta.url));
export const SITES = [{ name: "Question app", siteId: "572736e1-b8ce-464c-9adc-88f6f34d755a" }];
try {
  for (const [name, siteId] of Object.entries(JSON.parse(fs.readFileSync(LOCAL_SITES, "utf8")))) SITES.push({ name, siteId });
} catch (e) {
  // No local file: just this site.
}
const STORE = "rate-limit-stats";
const KEY = /^(\d{4}-\d{2}-\d{2})\/([a-z0-9-]+)\/[0-9a-f-]{36}$/;

// Keys in, rows out: [{ day, bucket, networks }], newest day first, only
// days on or after `since` (a YYYY-MM-DD string). Unrecognized keys are
// skipped.
export function summarize(keys, since = "") {
  const counts = new Map();
  for (const key of keys) {
    const m = KEY.exec(key);
    if (!m || m[1] < since) continue;
    const id = `${m[1]}|${m[2]}`;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return [...counts]
    .map(([id, networks]) => {
      const [day, bucket] = id.split("|");
      return { day, bucket, networks };
    })
    .sort((a, b) => b.day.localeCompare(a.day) || a.bucket.localeCompare(b.bucket));
}

export function formatReport(siteName, rows, days) {
  if (!rows.length) return `${siteName}: no networks hit a limit in the last ${days} days.`;
  const total = rows.reduce((n, r) => n + r.networks, 0);
  const lines = rows.map((r) => `  ${r.day}  ${r.bucket.padEnd(20)} ${r.networks} ${r.networks === 1 ? "network" : "networks"}`);
  return [`${siteName}: ${total} refused ${total === 1 ? "network" : "networks"} in the last ${days} days`, ...lines].join("\n");
}

function listKeys(siteId) {
  // A fixed command string (no user input in it): netlify is a .cmd shim on
  // Windows, which needs a shell to run.
  const out = execSync(`netlify blobs:list ${STORE} --json`, {
    env: { ...process.env, NETLIFY_SITE_ID: siteId },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(out).blobs.map((b) => b.key);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf("--days");
  const days = i > -1 ? Math.max(1, parseInt(process.argv[i + 1], 10) || 30) : 30;
  const since = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
  for (const site of SITES) {
    try {
      console.log(formatReport(site.name, summarize(listKeys(site.siteId), since), days));
    } catch (e) {
      console.log(`${site.name}: couldn't read the stats (is \`netlify login\` done?): ${e.message.split("\n")[0]}`);
    }
  }
}
