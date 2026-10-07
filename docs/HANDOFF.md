# Handoff: Conditions for Curiosity engineering sessions (Sep 28 – Oct 7, 2026)

A compressed record of a long working chat, so a new session can pick up without re-deriving
anything. **Read with [`STATUS.md`](STATUS.md)**, which holds the current state, the decision
table, and next steps. This file adds how we work, how things are built and verified, and the
traps already hit.

## The two projects

| | Main | Counting games pilot |
|---|---|---|
| Repo | `C:\Users\konei\code\conditions-for-curiosity` (GitHub `Knockout14/conditions-for-curiosity`, **public**, a portfolio) | `C:\Users\konei\code\counting-games` (GitHub `Knockout14/counting-games`, private) |
| Live | https://conditionsforcuriosity.netlify.app (site + question app at `/app/`) | https://counting-conditionsforcuriosity.netlify.app |
| Netlify site id | `572736e1-b8ce-464c-9adc-88f6f34d755a` (linked locally) | `93d6124d-9985-46a5-992b-a29c745adc26` (not linked; use `NETLIFY_SITE_ID=…` with the CLI) |
| Stack | Static HTML/CSS/vanilla JS in `site/` (the only published folder); 6 Netlify Functions | One React file `src/app.jsx` built by `build.js` (esbuild bundles React; Tailwind compiled to `public/styles.css`; both outputs gitignored); 4 Functions |
| Tests | `npm test` (110 checks: `test/functions.test.mjs`, `test/app-state.test.mjs` runs `site/app/app.js` in a vm sandbox) | `npm test` (109 checks: `test/functions.test.mjs`, `test/invites.test.mjs`) |
| Other | `npm run limits` (rate-limit refusals, both sites); `README.md`; `DESIGN.md` (visual system; it wins over generic design advice); `docs/status-2026-09-01.md` (long engineering log) | `npm run invite -- --family F003 --adult Mom [--access log] [--last-day 2026-10-18]`; `SHEET-SETUP.md` (Sheet tabs, incl. section 5 for invites) |

**Shared backend:** one Google Sheet via one service account (both apps), plus Netlify Blobs per
site. Tabs: `Sheet1`, `Circle-back`, `Week Summary` (question app); `Counting nights` (A–AI, the app
writes A–R; Kevin's review S–Z; shadow drafts AA–AI); `Codes`; and **`Invites` (A–H) and `Devices`
(A–E), which KO still has to create by Oct 15.** Blobs: `question-bank` (key `all`, 165 questions,
only Raw/Found = 86 are ever served), `rate-limits`, `rate-limit-stats`.

## What happened, in order

1. **Sep 28, system review** (a shared Claude doc, "Conditions for Curiosity — System Review"):
   architecture, security, bugs, UX, and a phased evaluation plan (Phase 0 hardening → Phase 1
   experience → Phase 2 "you go first" experiment → Phase 3 counting signal).
2. **Phase 0, all done and live:** only `site/` published (internal docs had been public); docs
   scrubbed for the public repo; question-bank endpoints capped (3 per call, Raw/Found only); write
   endpoints bounded (UUID session, field caps, 30/day/IP); Safari 7-day storage-wipe backup via
   server-set cookies (both apps; counting games restores nights from the Sheet); pick bugs fixed
   (per-week `askedIds`, one swap per week, same three candidates until confirmed); error messages
   by cause (429 says when it resets and to switch networks); refusals logged and counted (no IPs);
   counting games loads no outside scripts (React bundled, Tailwind compiled); gold links; README;
   brand icons to `brand/`.
3. **The counting-games invite gate, deployed Oct 7** (`counting-games` 651fd97, privacy 3b89f7d).
4. **Highlights, deployed Oct 7** (`counting-games` 6179ee9).

## The invite model (counting games)

- **An invite code points to a family; it isn't the family.** One invite per adult. Invites tab
  columns: Code, Family (KO's id, e.g. `F003`), Adult (label shown to families), **Access** (blank or
  `full`; `log only`; anything unrecognized = log only), Last day (through midnight US Eastern),
  Revoked (`yes`), Created, Notes.
- A phone redeems a code (`/api/redeem-invite`) → one Devices row (Redeemed at, Session ID, Family,
  Adult, Code). **Family and adult are always read through the invite**, so the Invites tab is the
  one source of truth (renames, moves and revocations carry through).
- **Gate:** `GATE_FROM` = Oct 16 2026 00:00 EDT (`netlify/functions/_lib/invites.mjs`). Before it,
  everyone may use the app (and `submit-night` reads nothing extra). After it, a phone needs a live
  invite or a night logged before the gate (grandfathered). A revoked or expired invite beats
  grandfathering.
- **Access:** full phones see the whole family's nights and Kevin's notes, each with "logged by".
  **Log-only** phones (babysitter, relative) see only their own nights and notes on them, plus the
  family's child labels; never the family's history (it could sway what they notice). Their nights
  still reach the parents.
- App side: `?invite=` is read, redeemed and cleared from the address bar; "Have an invite code?"
  box; invite-only screen (blocked phones find out on load, before setup; waits for a pending link
  redemption so there's no flash); a refused Save keeps the text and says why.
- Missing tabs read as empty (`readTabs`), so the code is safe before KO creates them: every code
  is "unknown" and every phone sees just its own nights.

## Working agreements with KO (follow these)

- **Review like an experienced tech lead:** correctness, existing patterns, accessibility,
  security. **Surface judgment calls as explicit questions** instead of deciding silently.
- **Foundational decisions** (identity, data models): give the long-term view first — what path it
  lays down, what it supports or blocks, where it forces rework.
- **Deploy budget (~50/month, shared):** commit and push only finished, verified work, and only
  after KO says so ("commit and push", "deploy it"). Commits that don't touch the published site
  use `[skip netlify]` in the message (no deploy). Keep local commits until approval.
- **Public repo stays public** (portfolio): no private details (key locations, personal email,
  vault paths). Mitigate exposure; don't hide the repo.
- **Never write production data** (`netlify blobs:set`, the Sheet) unless KO explicitly asks.
  Read-only checks are fine (print counts, not content). Production probes must not write rows.
- **Public copy** (privacy page, site claims) needs KO's approval of the exact wording; keep it
  consistent with the pitch materials and honest about the product's stage.
- **History exposure principle:** show highlights first and the full record only on request; no
  charts, per-principle counts or progress views by default.
- **IP rate limits are a stopgap until login**; then they come out. Raise the shared-network
  (school Wi-Fi) trade-off whenever limits, login or groups come up.
- **Keep `docs/STATUS.md` current** at the end of each piece of work (commit with `[skip netlify]`).
- When explaining a protection, be precise about what it does and doesn't cover.

## How to verify (what worked)

- `npm test` in the repo you changed; `netlify build --offline` for a local build (no deploy).
- **Browser checks without live Functions:** copy the built files to the scratchpad, add a
  **separate `stub.js`** that replaces `window.fetch` with canned API answers (inline stubs broke
  on escaping), add a temporary entry to `.claude/launch.json` (python `http.server`), run it with
  the browser preview tool, then **remove that entry** (the committed `launch.json` has only
  `netlify-dev` and `static-site`).
- `netlify dev` via the preview tool is unreliable; KO can run it in their own terminal if live
  Functions are needed.
- **Production checks that write nothing:** GET → 405; bad session → 400; a random UUID to
  `get-notes`; HEAD/curl of served files. Wait for a deploy with
  `netlify api listSiteDeploys --data '{"site_id":"…","per_page":1}'` until `ready <commit>`.
- Before claiming a bug is fixed, reproduce it on the old code (`git show HEAD:path` into the
  scratchpad); before claiming parity, compare (e.g. computed styles, identical Sheet rows).

## Traps already hit

- **Escaping in `node - <<'EOF'` scripts** (`\t`, nested quotes) fails silently-ish: use the Edit
  tool for anything with escapes.
- **Never pre-fill empty rows of Counting nights** (checkboxes, formulas): Google then appends new
  nights below them. Per-night lookups belong in a separate tab (`SHEET-SETUP.md` §5 "Family view").
- Tests pin a clock before Oct 16 (`_lib/clock.mjs` is stubbed); keep new tests explicit about
  before/after the gate.
- `npm test` stops at the first failing file (`&&`), so a later file's failures can hide.
- Tailwind only compiles classes written as plain strings in `src/app.jsx`.
- Restore shared test fixtures (`sheetRows` etc.) at the end of a test block.
- Commit messages: check counts (one said 94 checks; it was 91).

## Open items (beyond STATUS.md's next steps)

- **KO:** create Invites and Devices tabs by Oct 15; live check with a TEST invite; invite current
  families (one invite per adult, opened on the phone they already use; `--access log` for
  occasional adults). See the highlights card live once a family has a note.
- **Next builds (from STATUS):** Phase 1 experience measurement; a Content Security Policy (now
  possible); client-side tests for counting games.
- **Smaller, from the Sep 28 review, still open:** `site/app/reveal.html` renders `q.citation` but
  `questions-by-ids` never returns it (decide: return it or drop it); the question app's time to
  first question (episode-5 gate → details → quiz → pick); a separate `/research` page for funders;
  a custom domain; counting games has no Reset link; counting-games answer options could be real
  radio buttons; an optional monthly "highlight" note written by Kevin.
