# Status: Conditions for Curiosity

**As of November 10, 2026.** The short, current picture for the podcast site and the question app:
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
| Nov 10 | **The guide goes one step at a time, with no grading look** (branch `guide-stepper`, not merged). 13 steps, Next and Back, "Step N of 13", the step in the URL hash (`#step-7`) so refresh, the device's Back button and direct links work. A tapped option gets one gold border (no green, red, check or cross); "Right." is gone from the quick check; each choice group says "Tap the others to see what each one does." With JavaScript off it is still one long page. | KO: the long scroll read as a wall of text, and the check/cross icons gave a graded feel that clashes with "any answer counts." Same words otherwise; no study wording touched. Scope: `guide-stepper-scope-2026-11-10.md` (Cowork HQ). | Still saves and sends nothing; tests now cover the 13 steps, neutral taps, the skip link, and that the app's own check keeps its colors. Same day, after KO's phone test: copy trimmed step by step with KO (about 1,800 words to 1,450 counting every feedback line; reading time now "about 5 minutes"; study wording, "What the app keeps" and the working-model lines unchanged), swipe left/right between steps (not inside the sort, not from screen edges), and "Open the question app →" moved into the Next spot on step 13. Still to do: the "7 minutes" mentions on the home, details and done pages; a fresh review before merge. Known: in Instagram's browser a refresh went back to step 1 (not reproduced elsewhere; no fix without on-device storage). Merge is a production deploy (15 credits): on or after Nov 12. |
| Nov 9 | **Families get the native guide (`/guide`, `site/app/guide.html`), not the Storyline course.** All five course links (details screen, done screen, three on the home page) now open the guide in the same tab. | The Articulate trial ended, so the Storyline course (question-night-your-part.netlify.app) can no longer be edited. The guide can, and it is the version future parent feedback will change. Same day, both took the same reviewer-feedback edits (opening, shorter "why" screen, sort criteria). | The guide is the one family version and the only one that changes. The Storyline course is frozen at v06 and lives on as a portfolio piece, linked from kevinoneil.netlify.app. Known difference: the guide's "After the question" ends "Then you're done. Close the app."; the course still has the older no-streak line. |
| Nov 4 | **Home page reworked for a first-time visitor:** hero says who Kevin is and what to do first (episode 1, about 6 min); a "Nothing here takes long" strip; experience lines; the idea; research as three plain bullets with the study table in a fold; what to do next (answer too and go first, then three orientations that are not steps); episode list with minutes from the RSS feed; the model cut to one line. "Who this is for" cut. Footer links get the gold focus ring on all five pages. | A web-builder friend could not tell what the site was ("a lot of things at once"). Structure and copy changed; the visual system did not. | "20 years in education", never "in classrooms". New `try_app_click` label `ways_in` for the app row in the strip. The mobile sticky bar now hides from mid-page on, once the app button has been passed. |
| Nov 3 | **Shorter first run (UX review, option A):** no episode 5 gate and no check before the first question. The details screen carries the one rule ("you answer too, and you go first") with links to the Storyline course and episode 5; the three-question check is offered from the done screen. A new week's pick goes straight to tonight's question. | Five screens before a first question; the gate saved nothing useful and its rule repeats in the question flow; KO doesn't use the check columns now, and the course is the better readiness step. | Path is details, pick, tonight, question. Check columns stay blank until someone takes it (they used to read "no"). `episode5` and `onboardingComplete` are no longer read. Ships in the deploy after Nov 12. |
| Oct 30 | **Optional guide for the adult** at `/guide` (`site/app/guide.html`), linked from the done screen. | Same text as the Articulate course, built natively so families never get a trial-built course. | Deployed. Saves and sends nothing. |
| Oct 30 | **Failed circle-backs are kept on the device and resent** from the next app screen. | The screen promised "your answer isn't lost," but a closed tab lost it. | Deployed. Reset clears anything waiting. |
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
- **Headers (deployed Oct 30):** `site/_headers` sets frame and content-type protection
  for the whole site, and a Content Security Policy on `/app/*` that runs scripts from this site only.
  Inline styles are still allowed. Fonts still come from Google; self-hosting them is next.
- **IP addresses (deployed Oct 30):** rate-limit counters hold a daily keyed hash, and a
  daily function deletes older counters, including the ones from before this change.
- **Login:** planned, see the private review. Until then, anyone can still write to the Sheet within
  the rate limits.

## Smaller open items

- Guide, step 3 sort: option to cut from six cards to four by dropping cards 3 (the sun drank them) and 5
  (faster on sunny days), which overlap most with card 1. Kept for now (Nov 10); revisit if testers find
  the sort long or tiring for what it teaches.

- `site/app/reveal.html` renders `q.citation`, but `questions-by-ids` never returns it: return it or
  drop the dead code.
- The question app's time to first question (episode-5 gate, details, quiz, pick) is long.
- A separate `/research` page for funders; a custom domain.
- The question app has no family concept; if it ever needs one, the pilot's invite model is the
  template.

## Housekeeping

- **Deploys:** about 50 a month, shared by both sites. Commit and push only finished, reviewed
  work. Changes outside `site/` use `[skip netlify]` in the commit message so they cost no deploy.
- **Tests:** `npm test` (169 checks). All pass. CI (`.github/workflows/test.yml`) and the Netlify build
  both run them, so a failing test stops a deploy. Deploy previews and branch deploys don't use the
  deploy budget.
- **`npm run limits`** also reads other sites' ids from `scripts/limits.local.json` (gitignored).
