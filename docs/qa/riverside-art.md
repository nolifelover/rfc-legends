# Thai riverside art review

Branch: `thai-riverside-redesign` in `/home/dev/eth-tokyo-riverside`.
Reference: `ref/thai-riverside-concept-v2.png` in the main worktree.
Status: accepted. Static art, continuous traveling background, corner HUD, and live manual controls pass the checks below. This branch has not been merged, pushed, or deployed.

## Scope

The new theme covers `/game` at every screen size, as requested by the user. The original art pass preserved gameplay rules and handlers. The later user-approved manual-control extension adds real movement, attacks, a tonic button, and an Auto toggle. Existing Auto rules, API-owned values, item identifiers, drop rates and route actions remain unchanged. The later MapleStory M request moves HUD panels to the screen corners and frees the bottom of the viewport. Auto keeps the original actor anchors; Manual moves the trainer and rooster while framing the authoritative enemy. Mobile framing keeps all three visible.

The environment uses separate original sky, houses, water/boardwalk, and corridor images. The concept reference is not shipped as a flattened background. Characters retain collectible proportions and Thai styling. Combat feedback, nameplates, boss bars, item icons, onboarding, and the game HUD use indigo, rice-paper, and warm brass colors.

Shared `SireLineArt` defaults to its original art and fallback; only the `/game` creation form and HUD opt into the riverside images. `/market` and `/roosters` route code is unchanged.

## Corner HUD and manual controls

The user supplied `ref/mapple-story-m.jpg` and explicitly selected real movement and attacks with Auto. Profile and live meters sit at the upper left, menus at the upper right, horizontal movement at the lower left, and Attack/Auto/tonic/Bag at the lower right. See [manual-controls.md](../manual-controls.md) for the input and server contract. Final validation of this extension is recorded separately from the art-only checkpoint.

Final acceptance covers all five requested viewports, portrait menus, rotation during a level-up zoom, forced asset failures, and software WebGL at 390×844 and 1920×1080. No document overflow, page errors, or unexpected HTTP failures remained. Follow-up captures verify separate Manual character silhouettes and nameplates, readable hints above controls, desktop nameplate clearance, and Auto-to-Manual boss cleanup. Client, server, and Phaser source reviews passed. The final production build and TypeScript pass; Vitest reports 188 passed and 8 skipped across 19 files.

## Traveling background

The user subsequently requested a background that keeps moving as the team travels to gain levels. The subsequent 2D side-scrolling platform clarification adds a continuous teak deck beneath all existing combat lanes. The deck, foreground props, water/lotus, houses, and distant corridor move at different speeds while the sky and moon remain fixed. This preserves actor/UI anchors and server-owned zones, respects reduced motion, and slows for boss focus. The controller reuses 12 containers and the same textures; only ten duplicate image objects, two deck graphics and a duplicated rice-bank graphic are added. There are no per-frame allocations or texture rebuilds. Motion acceptance passes Canvas at 390×844, 844×390 and 1920×1080 plus WebGL at 390×844. A 400-second wrap simulation retains exactly 75 objects and 117 textures, with continuous platform panels. Reduced motion stays exactly stationary. An actual ready boss with a visible HP bar eases the journey to zero and holds. A 12.28-second preview video is in `journey-qa/mobile-journey-short.webm`. No physical-device frame-rate claim is made.

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
- `maple-hud-qa/`: corner-HUD geometry and real manual-control acceptance. `MANUAL-CONTROLS-REPORT.md` summarizes the live checks; `manual-in-range-combat.png` shows an alive trainer and server-confirmed damage.
- `maple-final-viewports/`: five corner-HUD viewports, portrait menus, rotation, blocked assets, and Canvas/software-WebGL checks. Follow-up captures record final scene corrections.

`acceptance-final/` records the art/journey checkpoint before the new corner HUD. Earlier `after-all-screens/` captures predate the rotation and visual corrections.

The final visual report is `maple-final-viewports/VISUAL-REPORT.md`; the live input report is `maple-hud-qa/MANUAL-CONTROLS-REPORT.md`. For the latest representative images, open `maple-final-viewports/final-390-manual-silhouettes.png` and `maple-final-viewports/final-1920-auto.png`. The five original before-images remain under `baseline/full-*.png`.

Implementation checkpoints: `6e09426` (authoritative manual commands), `af44c2d` (HUD and touch controls), `9e23b87` (manual scene and overlays), and `ef0dc42` (final visual separation). Earlier art and travel checkpoints remain in the branch history.

## Live control checks

A fresh local stub wallet created a player through the real UI/API. Bag, Drops, Guild, and Sync worked with no page errors or failed local HTTP responses. Spending one STR increment changed STR from 1 to 2 and available points from 48 to 46; the mutation response, UI, and follow-up state request agreed. Sync returned HTTP 200 and displayed its feedback.

A separate high-level state fixture verified item labels/counts and the exact Rare Market and “Mint & sell” links. No signing or blockchain transaction was performed. Fixture screenshots validate rendering; they do not substitute for the live API/control checks.

The manual-control pass used fresh random wallets and the worktree-local JSON store. At 390×844 and 844×390, holding the joystick moved the server position from 290 to 649.6 and 712.8 respectively; releasing it stopped movement. Far attacks were rejected without damage or rewards. In-range attacks reduced server HP, cooldown and duplicate requests caused no extra rewards, and a kill was persisted once with its EXP. The tonic button healed and consumed exactly one item (10→9); use at full HP kept stock unchanged. Simultaneous touch emitted movement and attack. Bag, menus and dialogs blocked game input, Guild text entry remained usable, Stats handled Escape and focus return, and Sync returned HTTP 200. No page errors or unexpected HTTP failures were observed.

## Static art verification

The five viewport checks passed at 390×844, 360×800, 844×390, 1280×720, and 1920×1080. The integrated run also passed active-zoom rotation, Canvas and WebGL rendering, blocked-asset fallbacks, and a visible crocodile boss fixture. No page errors or failed local HTTP responses were observed. A follow-up verified readable mobile level-up subtitles at all three mobile sizes.

TypeScript, targeted ESLint, and the existing Vitest suite passed (162 passed, 8 skipped). Independent source and visual reviews accepted the corrections. The added traveling-background tests also pass: final Vitest result is 167 passed and 8 skipped across 16 files. The production build, including TypeScript and static-page generation, passes. After the manual-control extension, the full suite passes with 188 tests and 8 skipped across 19 files. Backend review approves the command sequence, movement lease, range, cooldown, reward and potion behavior. Targeted ESLint and `git diff --check` pass.

## Limits

Browser checks use Chromium viewport/touch emulation. Canvas and software WebGL rendering are covered; physical-device frame rates and mobile Safari have not been measured. The live browser pass did not exhaust all ten tonics; a server test covers empty stock. Dead-player tonic rejection was not retained as final browser evidence. Eight existing tests remain skipped. A separate lint run of `game-client.tsx` reports the pre-existing `react-hooks/set-state-in-effect` error at the unchanged `setBooted(true)` effect; all other edited source files pass targeted ESLint.

Coordination and reviews are recorded in `.omx/coordination/codex-eth-lead-7ac7f6478025.md` in the main worktree. Integration remains outside this task.
