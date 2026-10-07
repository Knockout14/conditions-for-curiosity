# Status: Conditions for Curiosity

**As of October 7, 2026.** The short, current picture for the podcast site and the question app:
where things stand, what was decided and why, and what's next. Kept up to date at the end of each
work session. The decision-by-decision history lives in [`status-2026-09-01.md`](status-2026-09-01.md);
the system review that started this phase is the "Conditions for Curiosity — System Review" doc
(Sept 28). See also [`HANDOFF.md`](HANDOFF.md).

**The counting-games pilot** is tracked in its own private repo (`counting-games/docs/STATUS.md`).
Pilot specifics stay there, not here.

| | Repo | Live at | Visibility |
|---|---|---|---|
| Podcast site + question app | `conditions-for-curiosity` | conditionsforcuriosity.netlify.app | Public (portfolio) |

## Where things stand

Phase 0 (hardening) is done and live for both apps. Both repos are in sync with GitHub. The pilot's
next milestones and KO's to-dos for them are in the pilot's own status doc.

## Decisions and their impact

| Date | Decision | Why | Impact |
|---|---|---|---|
| Oct 7 | **Pilot specifics live in the private pilot repo**; this public repo only points there. | Its address and internals had gone into these docs. | Moved; this repo stays a clean portfolio of the public project. |
| Oct 7 | **Highlights first, full history on request** (a product principle, applied first in the pilot). | A long history, or anything like a trajectory, can overwhelm parents and sway what they look for. | Applies to any future screen that shows history in either app. |
| Oct 6 | Keep `.claude/launch.json` committed; ignore `.claude/settings.local.json`; icons moved to `brand/`. | Shared preview setup, no secrets; personal settings stay local. | Any Claude Code session gets the same previews. |
| Oct 1 | Count rate-limit refusals in Blobs (no IPs); `npm run limits` reports them per site. | Function logs expire quickly. | A lasting signal for when to raise limits or prioritize login. |
| Sep 28 | **IP rate limits are a stopgap until login**; they come out once users log in. | A group on one Wi-Fi shares one budget. | Accepted for now; refusals explain themselves and are counted. |
| Sep 28 | Repo stays **public as a portfolio**; mitigate rather than hide. | KO is applying to roles. | Private ops details scrubbed from docs; README added; no secrets in history (checked). |
| Sep 28 | Only `site/` is published. | Internal docs and Function source were being served. | Fixed and verified on production. |
| Sep 28 | One swap per week; unconfirmed picks keep the same three. | Reloading was a full reroll. | Matches the spec's "one swap." |
| Sep 28 | Survive Safari's 7-day storage wipe with a server-set backup cookie (both apps). | One skipped week could reset a family. | Families keep their place. |

## Phase 0 (hardening): done

- [x] Only `site/` published; status doc scrubbed of private details
- [x] Question-bank endpoints capped (3 per call, Raw/Found only)
- [x] Write endpoints bounded (rate limits, session check, field caps)
- [x] Storage-wipe backup
- [x] Pick bugs (per-week tracking, swap per week, same three until confirmed)
- [x] Error messages say what went wrong; refusals logged and counted
- [x] Counting-games hardening (tracked in its repo)

## After Phase 0

From the system review's evaluation plan:
- **Phase 1, experience:** a per-family funnel from the Sheet (pick, circle-backs, week-2 return);
  anonymous "step reached" counts for drop-off before the first save; 3 to 5 parent sessions.
- **Phase 2, the mechanism:** randomize "you go first" vs "ask, then answer" and compare
  question-back rates (needs consent language).
- **Phase 3, the counting signal:** tracked in the pilot repo.

## Security posture (as of Oct 7)

- **Script injection (XSS):** the question app builds HTML by hand with an escaping helper: correct
  everywhere reviewed, but it relies on remembering to use it.
- **The Sheet:** every write is RAW, so a value starting with `=` stays text.
- **Still to add:** a Content Security Policy (only run scripts from our own site).

## Smaller open items

- `site/app/reveal.html` renders `q.citation`, but `questions-by-ids` never returns it: return it or
  drop the dead code.
- The question app's time to first question (episode-5 gate, details, quiz, pick) is long.
- A separate `/research` page for funders; a custom domain.
- The question app has no family concept; if it ever needs one, the pilot's invite model is the
  template.

## Housekeeping

- **Deploys:** about 50 a month, shared by both sites. Commit and push only finished, reviewed
  work. Changes outside `site/` use `[skip netlify]` in the commit message so they cost no deploy.
- **Tests:** `npm test` (110 checks). All pass.
- **`npm run limits`** also reads other sites' ids from `scripts/limits.local.json` (gitignored).
