# App v1 — build handoff

Produced in a Cowork planning session (Sept 1, 2026), stored here so a Claude Code session working
in the `conditions-for-curiosity` repo has a spec to build from.

## Read this first

- **`app-v1-spec-2026-09-01.md`** — the spec. Ownership, device/accounts/infrastructure, the
  four-stage core loop (onboarding → weekly pick → the move → circle-back), the skill-tagging plan,
  audience, and explicit non-goals.
- **The mockup** — nine mobile screens (Claude Design canvas), published as an Artifact:
  https://claude.ai/code/artifact/edd968ac-f982-469f-b85e-ebca280d7a96
  Screen order: episode-5 confirmation → name/email/age capture → three-variable comprehension check
  → weekly question picker → nightly loop (open → the move → reveal → circle-back → done). Static
  mockup, not a clickable prototype — real bank questions were used, not placeholder text. This is
  the concrete visual reference (copy, colors, layout); the spec is *why* each screen is shaped that
  way.

## Where the supporting content already lives in this vault

Nothing below was re-copied here — it was already in the HQ from the Aug 23 research session, so the
spec just points at it instead of duplicating it:

- `../../../Context/engineering-curiosity/product/early-math-curiosity-question-bank.md` — all 165
  candidate questions, tagged by anchor type (Raw / Found / Prepared / Situational / Retrospective),
  domain, and age band. v1 only uses Raw and Found (86 questions) — see spec §3c. (This is the fuller,
  final version of the bank; `product/question-bank-product-working-doc.md` next to it is the earlier
  working draft.)
- `../../../Context/engineering-curiosity/product/counting-principles-blurbs-takeaways.md` — short
  adult-facing blurbs for the five Gelman & Gallistel counting principles, for the "tag, don't
  diagnose" skill layer (spec §4).
- `../../../Context/engineering-curiosity/positioning-memo.md` — the research argument underneath the
  product (why reciprocal disclosure, why not priming, the three-variable model). Background for
  *why*, not needed to build the screens.
- `../../../Context/engineering-curiosity/thesis-and-research.md` — the Aug 23 research session
  record this spec builds on (same document referenced elsewhere as "session-record-2026-08-23").

## Suggested first prompt for Claude Code

Something like:

> Read `app-v1-spec-2026-09-01.md` in this folder — that's the spec for a new app going under `/app`
> in the `conditions-for-curiosity` repo, alongside the existing podcast site (`index.html`,
> `model.html`). Also read `early-math-curiosity-question-bank.md` (bring it into the repo, or point
> me at its path) for the actual question content. The design reference is a published mockup at
> https://claude.ai/code/artifact/edd968ac-f982-469f-b85e-ebca280d7a96 (9 mobile screens) — match its
> copy, colors (navy `#050C16`, gold `#EDC160`, the existing site's Playfair Display / Karla type
> pairing), and layout.
>
> Start with the onboarding flow only (episode-5 gate → name/email/age capture → three-variable
> check), built as static mobile-first pages with no backend yet. Propose a plan for the rest (weekly
> pick, the nightly loop, the circle-back backend, the founder-facing digest) before building further.

## Known open decision

Whether the friends-of-friends / podcast-listener rollout is self-serve (a public link) or founder-
invited. Doesn't block starting the onboarding build, but matters before circle-back data collection
goes live beyond the small warm test group — worth deciding with Claude Code once the basic
infrastructure choice (which lightweight backend) is on the table.
