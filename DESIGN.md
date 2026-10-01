# DESIGN.md — Conditions for Curiosity

The visual system for `site/` (podcast site, `model.html`, the `app/` screens). Written down from
what the CSS already does, so changes extend it instead of drifting from it. If a design skill's
general advice conflicts with this file, **this file wins** — it encodes decisions, not defaults.

## The idea in one line

A quiet, editorial page at night: navy paper, one gold thread, serif headlines that read like
spoken sentences. Restraint is the brand. Things should feel *drawn and considered*, never
*generated and decorated*.

## Stack constraints

- Hand-written static HTML + CSS + vanilla JS. No framework, no Tailwind, no build step for `site/`.
- Styles live in a `<style>` block per page (site) or `app/style.css` (app). Tokens are CSS custom
  properties on `:root`.
- No new runtime dependencies without a reason worth the weight. The sphere in `model.html` is
  hand-rolled `<canvas>` — keep 3D/visual work in that spirit, not a library pulled in for one effect.
- Fonts: Google Fonts, `Playfair Display` (400, 500, 600, italic 400) + `Karla` (400, 500, 600), `display=swap`.

## Color tokens

| Token | Value | Use | Contrast on navy |
|---|---|---|---|
| `--navy` | `#050C16` | Page background. Always. | — |
| `--navy-lift` | `#0A1523` | Raised surfaces: model card, sticky CTA, panels | — |
| `--off` | `#F6F5F2` | Headlines, emphasized body, strong | 18:1 |
| `--off-mute` | `rgba(246,245,242,.62)` | Default body copy, instructional text | 7.2:1 (AAA) |
| `--off-faint` | `rgba(246,245,242,.52)` | Secondary chrome only: tags, meta, fine print, bylines | 5.3:1 (AA) — **floor; never go lower** |
| `--gold` | `#EDC160` | The accent: eyebrows, italic emphasis, primary CTA fill, focus rings | 11.6:1 |
| `--warm` | `#FDD284` | Hover state of gold. Only ever as a hover/focus variant. | — |
| `--rule` | `rgba(237,193,96,.22)` | The spine, card borders, table rules | decorative |
| hairline | `rgba(246,245,242,.07–.10)` | Section dividers, list separators | decorative |
| `--error` / `--coral` | `#E38176` / `#E0796E` | Errors, "not quite" feedback | ~7:1 |
| `--green` | `#6EC996` | Positive feedback (app only) | 9.8:1 |

Rules:
- **One accent.** Gold is the only color that carries meaning on marketing pages. Green/coral exist
  for feedback states in the app and the model's "pens" — not for decoration.
- Gold is used *sparingly* so it keeps working as a signal: the last line of a cadence, an italic
  phrase, the one CTA in a section, the hinge episode.
- Text on gold is `--navy` (11.6:1).
- No gradients except the existing faint gold wash on the hinge episode row. No glows, no neon,
  no glassmorphism, no colored shadows.

## Typography

- **Playfair Display** — headlines, the cadence list, pull quotes, episode titles, numbers. Weight
  400 by default (500 for `h3`). Italic + gold is the emphasis move: `h1 em { font-style: italic; color: var(--gold) }`.
- **Karla** — everything else. Body is **400** everywhere (moved from 300 on 2026-10-01 for legibility on dark).
  500 for interactive labels, 600 for labels and buttons. Karla loads 400/500/600 only — no 300, no 700.
- **The label style** (eyebrows, tags, buttons, "Listen"): Karla 600, 10.5–14px, uppercase,
  letter-spacing `.06em` (buttons) → `.24em` (eyebrows). This small tracked-caps voice is the
  counterweight to the serif — keep it consistent rather than inventing new label treatments.

| Role | Size | Notes |
|---|---|---|
| `h1` | `clamp(34px, 5.6vw, 68px)` / 1.14 | `-.015em`; often split into `.line` spans, one phrase per line |
| `h2` | `clamp(26px, 3.4vw, 40px)` / 1.22 | `-.01em` |
| `h3` | 20px / 1.3, weight 500 | |
| Lead | 19px | `--off`, max 56ch |
| Body | 17px (16px ≤820px) / 1.72 | `--off-mute`, max 62ch |
| Small / meta | 13–14.5px | |
| Eyebrow | 11px, 600, `.24em`, uppercase, gold | |
| **Floor** | **11px** | Nothing smaller, anywhere |

- Measure: body paragraphs cap at ~62ch; content column `.inner` caps at 760px.
- Headlines and the cadence list are written to be read **one sentence per line**. Line breaks are
  content decisions — don't let a layout change reflow them into a paragraph.

## Layout

- **The spine.** A fixed 1px vertical rule at `left: var(--gutter)` (100px desktop, 28px ≤820px).
  All content hangs off it via `.bay` (`padding-left: var(--gutter)`). One hard left edge, no
  exceptions — nothing centered on marketing pages, nothing crossing the spine.
- **The arc.** A huge, barely-visible gold circle off the right edge (`.arc`, 7%/4.5% opacity) —
  an echo of the sphere. Hidden ≤820px. Ambient only; never animate it into a feature.
- Sections: `padding: clamp(72px, 10vw, 132px) 0`, separated by a hairline top border.
- Breakpoints: **820px** (main: gutter shrink, arc hidden, sticky CTA, episode grid collapses),
  640px (stat table stacks), 600px (audience grid goes 2-up).
- App screens: single centered column, `max-width: 480px`, `min-height: 100dvh`, framed by a 1px
  `--line` border. The app is the only place things are centered.

## Shape & surface

- **Square corners.** `border-radius: 0` on buttons and inputs; `2px` max on small app controls;
  `50%` only for true circles (the arc, dots).
- Surfaces are flat: `--navy-lift` + 1px `--rule` border. Shadows only where something literally
  floats (the mobile sticky CTA). No card-on-card stacking, no drop-shadow "elevation" system.
- Lines do the structural work: spine, hairlines, left borders on the cadence list and pull quote.

## Components (existing — reuse before inventing)

- **`.cta`** — gold fill, navy text, uppercase Karla 600, `14px 24px`, arrow `<span>→</span>`.
  Hover: `--warm` + `translateX(3px)`. One per section, max.
- **`.follow`** — text link with 1px underline border, gold; `.follow.alt` is the muted variant.
- **`.cadence`** — the claim list: Playfair, left hairline, last item in gold.
- **`.pullquote`** — Playfair italic gold, left border at 40% gold.
- **`.model`** — the one "card" pattern: navy-lift, rule border, generous padding.
- **`.season` episode rows** — 3-column grid (number / title+gloss / action), hover nudges
  `padding-left` and fades in "Listen". `.hinge` marks the turning-point episode.
- **`.stat-table`** — gold uppercase headers, hairline rows, stacks into blocks ≤640px.
- **Form** — transparent input, 1px off/24% border, gold border on focus, gold square button.
- **Inline SVG icons** — 15px, `stroke="currentColor"`, 1.6 stroke, round caps. Hand-drawn,
  matching that weight. Don't import an icon set's default style without restyling to match.

## Motion

Motion here is **settling, not performing**. It confirms an action or eases content into place, then gets out of the way.

- Easing: `cubic-bezier(.2, .7, .3, 1)` for entrances; `ease` for hovers.
- Durations: hovers **140–200ms**; entrances **~780ms**.
- Entrance: `.reveal` — fade + 14px rise, staggered **~60ms** per element, hero only.
  Don't scatter scroll-triggered reveals down the whole page.
- Hover moves are small and directional: `translateX(3px)`, `padding-left` +10px, opacity fades.
  No scaling, bouncing, tilting, or parallax.
- **Reduced motion is mandatory.** Every page that animates must ship the `prefers-reduced-motion`
  block — including forcing `.reveal` to `opacity:1; transform:none`, or the hero stays invisible.
  JS animation (the sphere's auto-spin) must check `matchMedia` too.

## Accessibility floors

- Text contrast ≥ 4.5:1 on navy — `--off-faint` (5.3:1) is the lowest permitted text color.
- Every interactive element has a visible `:focus-visible` ring: 2px gold (1.5px in the app),
  offset 2–3px.
- Decorative elements (`.spine`, `.arc`) get `aria-hidden="true"`.
- Canvas/interactive visuals need an `aria-label` and keyboard control (see `#cv` in `model.html`).
- Tables scroll horizontally on overflow rather than shrinking text.

## Voice (where it touches design)

First person, plain, short declarative sentences. Headlines are claims, not taglines. Labels are
verbs or plain nouns ("Open the model", "Listen", "Start at one") — no "Unlock", "Discover",
"Supercharge". Honest about uncertainty ("a working model, not a finding") — the design should
never look more certain than the writing.

## Don't

- Centered hero with a gradient blob behind it. Purple. Neon. Glassmorphism. Rounded pill buttons.
- Emoji as icons; stock illustration; "trusted by" logo strips; testimonial carousels.
- Three-column feature grids with icon-in-a-circle headers.
- New fonts, new accent colors, or a second button style.
- Animation as decoration: counters ticking up, typewriter text, scroll-jacking, parallax, marquees.
- Breaking the spine.

## Before calling a change done

1. Screenshot at **390px** and **1440px** wide (Playwright, or `python -m http.server 8090 --directory site`).
2. Check with `prefers-reduced-motion: reduce` emulated — is everything still visible?
3. Tab through: every interactive element shows a focus ring.
4. Diff any new color against the token table — no raw hex outside `:root`.

## Known drift (clean up when touching these files)

- Tokens are **duplicated per page** (`index`, `404`, `privacy`, `terms` each redeclare `:root`).
  Candidate fix: a shared `site/tokens.css`.
- `model.html` uses a different vocabulary for the same values (`--paper` = navy, `--ink` = off,
  `--ochre` = gold, `--panel` = navy-lift). `app/style.css` uses `--line` at 14% gold where the site
  uses `--rule` at 22%.
- Two near-identical reds: `--error #E38176` (site) vs `--coral #E0796E` (app/model). Pick one.
- `app/style.css` has no `prefers-reduced-motion` block. `404.html`'s `.cta` hover transform also
  isn't guarded.
