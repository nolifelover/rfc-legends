# Thai riverside art review

Branch: `thai-riverside-redesign` in `/home/dev/eth-tokyo-riverside`.
Reference: `ref/thai-riverside-concept-v2.png` in the main worktree.
Status: static art acceptance passed; the user-requested continuous traveling background is in progress. This branch has not been merged, pushed, or deployed.

## Scope

The new theme covers `/game` at every screen size, as requested by the user. Gameplay rules, API data, item identifiers, labels, values, and control handlers remain unchanged. Desktop keeps the established stage composition and button geometry. Mobile framing keeps the trainer, rooster, and lead enemy visible.

The environment uses separate original sky, houses, water/boardwalk, and corridor images. The concept reference is not shipped as a flattened background. Characters retain collectible proportions and Thai styling. Combat feedback, nameplates, boss bars, item icons, onboarding, and the game HUD use indigo, rice-paper, and warm brass colors.

Shared `SireLineArt` defaults to its original art and fallback; only the `/game` creation form and HUD opt into the riverside images. `/market` and `/roosters` route code is unchanged.

## Traveling background

The user subsequently requested a background that keeps moving as the team travels to gain levels. The subsequent 2D side-scrolling platform clarification adds a continuous teak deck beneath all existing combat lanes. The deck, foreground props, water/lotus, houses, and distant corridor move at different speeds while the sky and moon remain fixed. This preserves actor/UI anchors and server-owned zones, respects reduced motion, and slows for boss focus. The controller reuses 12 containers and the same textures; only ten duplicate image objects, two deck graphics and a duplicated rice-bank graphic are added. There are no per-frame allocations or texture rebuilds. Motion acceptance evidence is recorded alongside the static art checks.

## Assets

All runtime images live under `apps/web/public/assets/game/riverside/`. Each category includes exact generation prompts in `PROMPTS.md`; attribution is recorded in `public/assets/CREDITS.md`.

| Category | Images | Compressed bytes |
| --- | ---: | ---: |
| Environment layers | 5 | 227,102 |
| Trainer poses and five rooster lines | 7 | 109,132 |
| Monsters | 8 | 190,592 |
| Props | 5 | 39,077 |
| Item icons | 23 | 603,830 |
| **Total** | **48** | **1,169,733** |

The image pixels represent approximately 10.6 MiB at four bytes per pixel, before browser/GPU overhead. Two generated sky/water extension textures add approximately 2.3 MiB. Textures are created once; combat text and effects reuse the existing pools and particle limits. No dependency was added.

When image requests fail, Phaser draws new themed silhouettes for the trainer, all rooster lines, monsters, props, and items. Environment fallbacks retain the night palette. React rooster and item fallbacks use inline themed SVGs. Game failure paths do not request legacy art.

## Evidence locations

Evidence is stored in the main worktree at `/home/dev/eth-tokyo/.omx/coordination/riverside-redesign/`:

- `baseline/`: original screenshots at all five required sizes.
- `acceptance-final/`: final viewport, rotation, Canvas/WebGL, asset-failure, pond, and boss evidence; `report.json` records assertions.
- `live-controls-final/`: actual local API/control checks, screenshots, test script, and report.
- `tier-check/`: level 30 and 70 character/decorations checks.
- `rotation-repair/`: exact screenshot/rotation sequence and repeated zoom/rotation regression traces.
- `acceptance-final/subtitle-report.json`: follow-up mobile subtitle sizing, full-opacity rendering, and nameplate separation.
- `journey-qa/`: continuous movement, wrap, reduced-motion, boss focus, and preview video checks.

The current authoritative viewport set is `acceptance-final/` once its complete report is present. Earlier `after-all-screens/` captures predate the rotation and visual corrections.

## Live control checks

A fresh local stub wallet created a player through the real UI/API. Bag, Drops, Guild, and Sync worked with no page errors or failed local HTTP responses. Spending one STR increment changed STR from 1 to 2 and available points from 48 to 46; the mutation response, UI, and follow-up state request agreed. Sync returned HTTP 200 and displayed its feedback.

A separate high-level state fixture verified item labels/counts and the exact Rare Market and “Mint & sell” links. No signing or blockchain transaction was performed. Fixture screenshots validate rendering; they do not substitute for the live API/control checks.

## Static art verification

The five viewport checks passed at 390×844, 360×800, 844×390, 1280×720, and 1920×1080. The integrated run also passed active-zoom rotation, Canvas and WebGL rendering, blocked-asset fallbacks, and a visible crocodile boss fixture. No page errors or failed local HTTP responses were observed. A follow-up verified readable mobile level-up subtitles at all three mobile sizes.

TypeScript, targeted ESLint, and the existing Vitest suite passed (162 passed, 8 skipped). Independent source and visual reviews accepted the corrections. The added traveling-background tests also pass: final Vitest result is 167 passed and 8 skipped across 16 files. The production build, including TypeScript and static-page generation, passes. Targeted ESLint and `git diff --check` pass.

## Limits

Browser checks use Chromium viewport/touch emulation. Canvas and software WebGL rendering are covered; physical-device frame rates and mobile Safari have not been measured. Eight existing tests remain skipped. A separate lint run of `game-client.tsx` reports the pre-existing `react-hooks/set-state-in-effect` error at the unchanged `setBooted(true)` effect; all other edited source files pass targeted ESLint.

Coordination and reviews are recorded in `.omx/coordination/codex-eth-lead-7ac7f6478025.md` in the main worktree. Integration remains outside this task.
