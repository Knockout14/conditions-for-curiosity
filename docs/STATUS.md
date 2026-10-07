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

**Deployed Oct 7** (`counting-games` 651fd97; privacy page 3b89f7d). Built and tested: the
invite rules, `redeem-invite`, the gate in `submit-night` and `get-notes`, the invite link and the
"Have an invite code?" box, the invite-only screen, "logged by" on shared nights, **log-only invites**
for occasional adults, `npm run invite`, and `SHEET-SETUP.md` section 5. Checked live: unknown codes
are refused, the address bar is cleared, existing families are unaffected.

**What's left, and it's KO's:**
1. **By Oct 15:** create the **Invites** tab (A–H: Code, Family, Adult, Access, Last day, Revoked,
   Created, Notes) and the **Devices** tab (A–E), as in `counting-games/SHEET-SETUP.md` section 5.
   Until they exist, every code reads as unknown, and after the 16th no new phone could get in.
2. **Then a live check:** `npm run invite -- --family TEST --adult Tester`, open the link on a
   phone, log one night with a "test" child label, and delete the test rows from all three tabs.
3. **Invite current families:** one invite per adult, the same Family id per household, opened on
   the phone they already use; `--access log` for babysitters and relatives.

**Highlights: deployed Oct 7** (`counting-games` 6179ee9, local). The home screen leads with the
most recently sent note from Kevin (three lines, "Read more"), a "note on its way" line, and one line
of rhythm ("2 nights this week"); the full list sits behind "See all nights (N)". No charts,
per-principle counts or progress views. Live in `6179ee9`; seen with real notes once families have them.

## Decisions and their impact

| Date | Decision | Why | Impact |
|---|---|---|---|
| Oct 7 | **Log-only invites** for adults who see a child once or twice (babysitter, relative): they log nights, see only their own plus the family's child labels, never the family's history. Built (`651fd97`). | They can add real observations but don't need the history, and it could sway what they notice. | Wider set of observers without biasing them; parents still see everything logged. Raised a broader question: highlights first, full history on request (proposal pending). |
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

## Phase 0 (hardening): done

- [x] Only `site/` published; status doc scrubbed of private details
- [x] Question-bank endpoints capped (3 per call, Raw/Found only)
- [x] Write endpoints bounded (rate limits, session check, field caps)
- [x] Storage-wipe backup (question app and counting games)
- [x] Pick bugs (per-week tracking, swap per week, same three until confirmed)
- [x] Error messages say what went wrong; refusals logged and counted
- [x] Counting games: no outside scripts; gold links
- [x] Counting games invite gate (deployed Oct 7; KO creates the Sheet tabs by Oct 15)

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
- **Resume:** `git status` in both repos. Both repos are in sync with GitHub.
