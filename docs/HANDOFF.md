# Handoff: Conditions for Curiosity engineering sessions (Sep 28 – Oct 7, 2026)

A compressed record of a long working chat, so a new session can pick up without re-deriving
anything. **Read with [`STATUS.md`](STATUS.md)** (current state, decisions, next steps). This file
adds how we work, how things are built and verified, and the traps already hit.

**The counting-games pilot** lives in a separate private repo with its own `docs/HANDOFF.md` and
`docs/STATUS.md`. Read those too when the work touches the pilot. Pilot specifics (its address,
setup, workflow) stay in that repo, never in this public one.

## This project

| | |
|---|---|
| Repo | `C:\Users\konei\code\conditions-for-curiosity` (GitHub `Knockout14/conditions-for-curiosity`, **public**, a portfolio) |
| Live | https://conditionsforcuriosity.netlify.app (site + question app at `/app/`) |
| Netlify site id | `572736e1-b8ce-464c-9adc-88f6f34d755a` (linked locally) |
| Stack | Static HTML/CSS/vanilla JS in `site/` (the only published folder); 6 Netlify Functions in `netlify/functions/` (shared rules in `_lib/`) |
| Tests | `npm test` (110 checks: `test/functions.test.mjs`; `test/app-state.test.mjs` runs `site/app/app.js` in a vm sandbox) |
| Also | `npm run limits` (rate-limit refusals per site; other sites' ids come from the gitignored `scripts/limits.local.json`); `README.md`; `DESIGN.md` (the visual system; it wins over generic design advice); `docs/status-2026-09-01.md` (the long engineering log) |

**Backend:** a private Google Sheet via one service account (shared with the pilot), plus Netlify
Blobs: `question-bank` (key `all`, 165 questions; only Raw/Found, 86, are ever served),
`rate-limits`, `rate-limit-stats`.

## What happened, in order

1. **Sep 28, system review** (a shared Claude doc, "Conditions for Curiosity — System Review"):
   architecture, security, bugs, UX, and a phased evaluation plan (Phase 0 hardening → Phase 1
   experience → Phase 2 "you go first" experiment → Phase 3 counting signal).
2. **Phase 0, all done and live:** only `site/` published (internal docs had been public); docs
   scrubbed for the public repo; question-bank endpoints capped; write endpoints bounded; Safari
   7-day storage-wipe backup via server-set cookies; pick bugs fixed (per-week `askedIds`, one swap
   per week, same three candidates until confirmed); error messages by cause (a 429 says when it
   resets and to switch networks); refusals logged and counted (no IPs); README; brand icons to
   `brand/`. The pilot got its own hardening, an invite gate and a highlights screen (see its repo).
3. **Oct 7:** pilot specifics moved out of this public repo into the pilot's private repo.

## Working agreements with KO (follow these)

- **Review like an experienced tech lead:** correctness, existing patterns, accessibility,
  security. **Surface judgment calls as explicit questions** instead of deciding silently.
- **Foundational decisions** (identity, data models): give the long-term view first: what path it
  lays down, what it supports or blocks, where it forces rework.
- **Deploy budget (~50/month, shared by both sites):** commit and push only finished, verified
  work, and only after KO says so ("commit and push", "deploy it"). Commits that don't touch the
  published site use `[skip netlify]` (no deploy). Keep local commits until approval.
- **This repo stays public** (a portfolio): no private details (key locations, personal email,
  vault paths), and **no pilot specifics**. Mitigate exposure; don't hide the repo.
- **Never write production data** (`netlify blobs:set`, the Sheet) unless KO explicitly asks.
  Read-only checks are fine (print counts, not content). Production probes must not write rows.
- **Public copy** (privacy page, site claims) needs KO's approval of the exact wording; keep it
  consistent with the pitch materials and honest about the product's stage.
- **History exposure principle:** show highlights first and the full record only on request; no
  charts, per-principle counts or progress views by default.
- **IP rate limits are a stopgap until login**; then they come out. Raise the shared-network
  (school Wi-Fi) trade-off whenever limits, login or groups come up.
- **Keep `docs/STATUS.md` current** (and the pilot's, when it changes) at the end of each piece of
  work, committed with `[skip netlify]`.
- When explaining a protection, be precise about what it does and doesn't cover.

## How to verify (what worked)

- `npm test`; `netlify build --offline` for a local build (no deploy).
- **Browser checks without live Functions:** copy the built files to the scratchpad, add a
  **separate `stub.js`** that replaces `window.fetch` with canned API answers (inline stubs broke on
  escaping), add a temporary entry to `.claude/launch.json` (python `http.server`), run it with the
  browser preview tool, then **remove that entry** (the committed `launch.json` has only
  `netlify-dev` and `static-site`).
- `netlify dev` via the preview tool is unreliable; KO can run it in their own terminal if live
  Functions are needed.
- **Production checks that write nothing:** GET → 405; bad session → 400; HEAD/curl of served files.
  Wait for a deploy with `netlify api listSiteDeploys --data '{"site_id":"…","per_page":1}'` until
  `ready <commit>`.
- Before claiming a bug is fixed, reproduce it on the old code (`git show HEAD:path` into the
  scratchpad); before claiming parity, compare (computed styles, identical Sheet rows).

## Traps already hit

- **Escaping in `node - <<'EOF'` scripts** (`\t`, nested quotes) breaks easily: use the Edit tool for
  anything with escapes.
- `npm test` stops at the first failing file (`&&`), so a later file's failures can hide.
- Restore shared test fixtures at the end of a test block.
- Check counts and facts in commit messages and docs before committing (one said 94 checks; it was
  91; a README said "about 12 pages"; it was 10).
- Public docs: before writing anything about the pilot, ask whether it belongs in the private repo.
