# Conditions for Curiosity

A podcast about curiosity as a property of environments rather than a personality trait, and a
companion app that turns its central idea into a nightly habit: the adult asks their kid one good
question, answers it themselves first, and notes whether the kid asked a question back.

- **Site:** https://conditionsforcuriosity.netlify.app
- **App:** https://conditionsforcuriosity.netlify.app/app/ (built for a phone, for the adult, not the child)

This repo is the site, the app, and the small backend behind them. A separate pilot, the counting
games, lives in its own repo and shares the backend's spreadsheet.

## How it's built

```
site/                     static HTML/CSS/JS, the only folder Netlify publishes
  index.html, model.html  podcast site; model.html is a hand-drawn <canvas> "curiosity sphere"
  app/                    the companion app: plain multi-page HTML + one shared app.js
netlify/functions/        6 Netlify Functions (Node, ESM)
  weekly-candidates       samples this week's 3 candidate questions
  questions-by-ids        full fields for a family's confirmed questions
  submit-pick, submit-circleback, submit-weeksummary
                          append rows to a private Google Sheet
  remember-state          returns the app's state as a server-set cookie (see below)
  _lib/                   shared: input bounds, rate limiting, Sheets client, bank rules
test/                     offline tests (no network, no credentials)
scripts/                  rate-limit-report.mjs (`npm run limits`)
docs/                     the build spec and a running engineering log
DESIGN.md                 the visual system the CSS follows
```

- **No framework, no build step for the site.** Hand-written HTML and CSS; tokens are CSS custom
  properties. The app is 10 small pages sharing one script.
- **No accounts.** A family is a random session id on their device. Progress lives in
  `localStorage`; what the adult chooses to submit goes to a private Google Sheet through the
  Functions, with a hand-signed service-account JWT instead of the `googleapis` package.
- **The question bank never touches this repo.** It lives in Netlify Blobs and reaches the browser
  only through two capped endpoints, three questions at a time.

## Decisions worth a look

- **Only `site/` is published.** Pointing Netlify at the repo root once served internal docs and
  Function source; the fix was structural, not a deny-list.
- **Every write endpoint bounds its input** (field caps, a required UUID session id, a per-network
  daily rate limit) because both apps share one spreadsheet and its API quota.
- **Rate limits explain themselves.** A 429 carries `Retry-After`, and the app says when the limit
  resets in local time instead of "check your connection." Each network's first refusal per day is
  counted (never its IP) so `npm run limits` shows whether real families are hitting the caps. The
  per-IP limits are a stopgap until there's login.
- **Surviving Safari's 7-day storage wipe.** Safari deletes `localStorage` after 7 days of use
  without a visit, a real risk for a weekly app. Every save also round-trips the state through
  `remember-state`, which hands it back as a server-set cookie (Safari doesn't cap those), and the
  app restores from it when storage comes back empty.
- **The week is tracked per pick**, not from an all-time "asked" list, so a mid-week edit or a
  question re-offered after the pool runs out can't throw off which question is next.
- **No analytics in the app.** The podcast pages load Google Analytics only after an explicit
  Accept; declining means no request is ever made.
- **Accessibility as a default:** keyboard reorder instead of drag, visible focus rings, contrast
  floors written into `DESIGN.md`, and reduced-motion handling.

## Running it

```bash
npm install
npm test            # offline tests for every Function and the app's state logic
npm run limits      # networks that hit a rate limit, per day (needs `netlify login`)
```

- **Static preview** (no Functions): `python -m http.server 8090 --directory site`
- **Full preview** with Functions: `netlify dev` (needs the linked Netlify site, its environment
  variables, and its Blobs store)

`.claude/launch.json` defines both previews for Claude Code's built-in browser.

## Tests

`test/functions.test.mjs` bundles each Function with esbuild and swaps Blobs, the rate limiter, and
the Sheets client for in-memory stubs. `test/app-state.test.mjs` runs `site/app/app.js` in a Node
`vm` sandbox with a fake `localStorage`, cookie jar, and `fetch`. Recent bug fixes were reproduced
against the old code before the fix shipped.

## More

- `DESIGN.md`: colors, type, components, and the rules behind them.
- `docs/STATUS.md`: where things stand now, decisions and their impact, and what's next.
- `docs/status-2026-09-01.md`: the engineering log, decision by decision.
- `docs/app-v1-spec-2026-09-01.md`: the original app spec.
- Privacy policy: https://conditionsforcuriosity.netlify.app/privacy.html
