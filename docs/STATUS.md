# Status: Conditions for Curiosity

**As of October 6, 2026.** The short, current picture across both apps: where things stand,
what was decided and why, and what's next. Kept up to date at the end of each work session.
The decision-by-decision history lives in [`status-2026-09-01.md`](status-2026-09-01.md); the
system review that started this phase is the "Conditions for Curiosity — System Review" doc
(Sept 28).

| | Repo | Live at | Visibility |
|---|---|---|---|
| Podcast site + question app | `conditions-for-curiosity` | conditionsforcuriosity.netlify.app | Public (portfolio) |
| Counting games pilot | `counting-games` | counting-conditionsforcuriosity.netlify.app | Private |

## Deadline: the invite gate goes live Oct 16

From **Oct 16, midnight US Eastern**, the counting games need an invite. Until then they stay open,
so new families can join through the plain URL. Families who log a night before the 16th are
grandfathered and never need a code. The question app is not gated.

**Built and tested, not deployed** (`counting-games`, local commits, shipping together):
- Server side: `redeem-invite`, and the gate in `submit-night` and `get-notes` (`9d16b79`).
- App: the invite link is read, redeemed and cleared from the address bar; "You're in as Mom" or a plain reason it didn't work; a network failure retries on the next visit (`7e1203c`).

**Still to do, in order:**
1. **App side, the rest** (`counting-games/src/app.jsx`): ~~"have a code?" box~~ done (`ef546fa`); ~~invite-only screen~~ done (`80363bf`: a refused phone finds out on arrival, not at Save); ~~"logged by" on shared nights~~ done (`c471363`). **The app side is complete.**
   (The code isn't stored on the phone once redeemed: the link lives server-side against the
   session id, which the backup cookie restores after a Safari wipe.)
2. **`SHEET-SETUP.md`**: steps for the **Invites** tab (Code, Family, Adult, Last day, Revoked,
   Created, Notes) and the **Devices** tab (Redeemed at, Session ID, Family, Adult, Code), a lookup
   formula to show family / logged-by beside each night, and a small local command that generates
   a code and its link.
3. **Privacy page wording** for invites, linked phones and the adult label. Needs KO's approval.
4. **Deploy and a live check** with a TEST invite row (KO deletes the test rows afterward).
5. **KO, by Oct 15:** create the two tabs and add an invite row per adult already in the pilot
   who should be linked to a family.

Deploying the server side early is safe: until the tabs exist, every phone sees just its own
nights, as today, and every code reads as unknown.

## Decisions and their impact

| Date | Decision | Why | Impact |
|---|---|---|---|
| Oct 6 | **An invite code points to a family; it isn't the family.** One invite per adult (label, optional last day, revocable); phones map to the invite they redeemed; the Invites tab is the one source of truth. | A shared family code can't expire for one person, can't tell adults apart, and has no path to real login. | Babysitter or grandparent access for a day or a week; revoke one person without touching others; every night records which adult logged it (the research needs this: the adult is the variable); a later login slots in without reworking identity. |
| Oct 6 | Gate from **Oct 16, US Eastern**; grandfather families with a night before then; Sheet holds the code list. | Keep the pilot open for the next week and a half of invitations. | No one currently playing is disrupted; adding or revoking a family is a Sheet edit, no deploy. |
| Oct 6 | Counting games load **no scripts from other sites** (React bundled, Tailwind compiled at build). | Outside scripts could run on the page where parents enter names and child details. | Same look (verified property by property); less to download on phones; a strict security policy is now possible. |
| Oct 6 | Links in counting games are **gold with a thin underline**, per `DESIGN.md`. | The page's link color had never applied; color alone doesn't mark an inline link. | Consistent with the main site; accessible. |
| Oct 6 | Keep `.claude/launch.json` committed; ignore `.claude/settings.local.json`; icons moved to `brand/`. | Shared preview setup, no secrets; personal settings stay local. | Any Claude Code session gets the same previews. |
| Oct 1 | Count rate-limit refusals in Blobs (no IPs); `npm run limits` reports both sites. | Function logs expire quickly. | A lasting signal for when to raise limits or prioritize login. |
| Sep 28 | **IP rate limits are a stopgap until login**; they come out once users log in. | A group on one Wi-Fi shares one budget. | Accepted for the pilot; refusals now explain themselves and are counted. |
| Sep 28 | Repo stays **public as a portfolio**; mitigate rather than hide. | KO is applying to roles. | Private ops details scrubbed from docs; README added; no secrets in history (checked). |
| Sep 28 | Only `site/` is published. | Internal docs and Function source were being served. | Fixed and verified on production. |
| Sep 28 | One swap per week; unconfirmed picks keep the same three. | Reloading was a full reroll. | Matches the spec's "one swap." |
| Sep 28 | Survive Safari's 7-day storage wipe with a server-set backup cookie (both apps). | One skipped week could reset a family. | Families keep their place and their notes. |

## Phase 0 (hardening): done except the invite gate

- [x] Only `site/` published; status doc scrubbed of private details
- [x] Question-bank endpoints capped (3 per call, Raw/Found only)
- [x] Write endpoints bounded (rate limits, session check, field caps)
- [x] Storage-wipe backup (question app and counting games)
- [x] Pick bugs (per-week tracking, swap per week, same three until confirmed)
- [x] Error messages say what went wrong; refusals logged and counted
- [x] Counting games: no outside scripts; gold links
- [ ] **Counting games invite gate** (server done; app, setup, privacy, deploy remain)

## After Phase 0

From the system review's evaluation plan:
- **Phase 1, experience:** a per-family funnel from the Sheet (pick, circle-backs, week-2 return);
  anonymous "step reached" counts for drop-off before the first save; 3 to 5 parent sessions.
- **Phase 2, the mechanism:** randomize "you go first" vs "ask, then answer" and compare
  question-back rates (needs consent language).
- **Phase 3, counting signal:** agreement between Kevin's codes and the form, later the local
  model; each child's movement across P1–P5.

## Security posture (as of Oct 6)

- **Script injection (XSS):** counting games renders everything through React, which treats data
  as text; it uses no raw-HTML insertion (checked). Invite codes are checked against a strict
  pattern in the app and again on the server, and a rejected code is never displayed. The question
  app builds HTML by hand with an escaping helper: correct everywhere reviewed, but it relies on
  remembering to use it.
- **The Sheet:** every write is RAW, so a value starting with `=` stays text.
- **Still to add:** a Content Security Policy (only run scripts from our own site), now possible
  since counting games loads no outside scripts. Client-side tests for counting games (today only
  its server functions are tested; the app is checked in a browser).
- **By design:** an invite link works for whoever holds it; the protection is revoking that one
  invite.

## Smaller open items

- Guest invites limited to logging nights only (no notes or history): a column on Invites, later.
- The question app has no family concept; if both apps ever share one, the invite model covers it.
- The Sheet as the code list is fine for dozens of families; past a few hundred, move it to a data
  store (a storage move, not an identity change).

## Housekeeping

- **Deploys:** about 50 a month, shared by both sites. Commit and push only finished, reviewed
  work. Changes outside `site/` use `[skip netlify]` in the commit message so they cost no deploy.
- **Tests:** `npm test` in each repo (110 checks here, 91 in counting games). All pass.
- **Resume:** `git status` in both repos. `counting-games` is 5 commits ahead of GitHub
  (the invite gate so far), deliberately unpushed until the app side is ready.
