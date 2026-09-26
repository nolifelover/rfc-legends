# Game HUD, walking and audio follow-up

This follow-up addresses the user's 27 September screenshots on the isolated
`thai-riverside-redesign` branch. It supersedes the presentation details in the
earlier completion audit. Server gameplay rules and unrelated routes are unchanged.

Source checkpoints: `f4c936b`, `99481ce`, and `8224138`. The final browser capture
and build/test runs include the exact source committed in `8224138`.

## Changes

- One game menu contains navigation, Bag, Guild, Stats, Sync, wallet actions and
  audio settings. Closing it releases game input; opening Stats preserves its portal.
- The game fills the viewport. The profile and touch controls use translucent
  backgrounds. The profile can collapse while keeping HP visible and remembers
  that preference. Its collapse control has a 28 px visible frame and a 44 px
  touch target.
- Drop notices show the latest item near the upper-right menu, use a translucent
  compact layout, and expire after four seconds. State polling cannot reset that
  deadline. All drops remain in Bag with their existing Mint links.
- Trainer, rooster and enemies stand on the illustrated bridge. The redundant
  brown platform below it is removed. Sprite origins account for transparent
  padding under their feet, so the visible artwork touches the deck. The rooster is approximately one
  third of the trainer's visible height, including higher-level decorations.
  Enemy and effect sizes follow the smaller actors.
- Both actors have alternating walking steps. Manual movement stops at release;
  Auto uses the travel cycle. Attacks take priority, and the companion crosses
  sides smoothly near world bounds while leaving space around the enemy.
- The boss HP bar occupies a top row that avoids the profile, menu and drop
  notice. Corner geometry is checked at most every 200 ms during boss encounters.
- Background music is an original Google Lyria 3 Clip Preview generation through
  OpenRouter. The 29-second MP3 is about 454 KB. Short combat and reward effects
  use Web Audio with at most four simultaneous voices.
- Music and effects have independent switches under the menu's Settings section.
  Preferences persist; playback starts after a gesture and pauses while the page
  is hidden. A failed audio channel does not disable the working channel.

No new dependency or client-side API credential is needed. Generation provenance
is in `apps/web/public/assets/game/audio/PROMPTS.md`.

## Browser evidence

Evidence root:
`/home/dev/eth-tokyo/.omx/coordination/riverside-redesign/ux-audio-walk-qa/`.

- `AUDIO-DROP-REPORT.md`: real MP3 playback, independent mute and persistence,
  hidden-page pause/resume, a real attack sound, fixed toast expiry during ten
  500 ms state updates, and preservation of all five injected drops in Bag.
- `TOAST-CORNER-REPORT.md`: 390×844, 360×800, 1280×720 and 1440×660 captures;
  zero overlap with profile, menu and controls; 62% background opacity.
- `VIEWPORT-WALK-REPORT.md`: five requested sizes plus 1440×660, unified menu
  and profile interactions, Auto/Manual walking, boss rotation, bridge contact,
  and matching fallback art with riverside assets blocked.
- `deck-manual-walk.webm`: 10.32 seconds of walking on the illustrated bridge.
- `final-three-report.json`: final landscape Auto/boss and wide Manual checks,
  with zero page errors or failed local requests.

### Final scene captures

Paths below are relative to the evidence root. Earlier screenshots in that folder
document intermediate states; these are the accepted final scene captures.

| Viewport | Capture |
| --- | --- |
| 390×844 | `deck-auto-390x844.png` |
| 360×800 | `framing-auto-360x800.png` |
| 844×390 | `final-auto-844x390.png` |
| 1280×720 | `framing-auto-1280x720.png` |
| 1920×1080 | `framing-auto-1920x1080.png` |
| 1440×660 Manual | `final-manual-1440x660.png` |

`final-boss-844x390.png` shows the final landscape boss bar. The active boss
rotation and fallback checks are in `deck-boss-rotation-390x844.png` and
`deck-fallback-390x844.png`. Original before captures remain in the sibling
`baseline/` folder; the user's follow-up screenshots are in
`/home/dev/eth-tokyo/screenshot/`.

Drop arrivals and higher-level states use labeled browser fixtures. Game action
and audio checks use real local requests and a fresh stub wallet. The worktree's
JSON store is separate from shared PocketBase. No guild message or transaction
was sent.

## Review and limits

The final production build, including TypeScript, passed. The full Vitest suite
passed 213 tests across 24 files, with eight existing skips. Focused ESLint and
`git diff --check` passed; running ESLint over every changed TypeScript file
reports only the existing `game-client.tsx` diagnostic described below.

Independent review found and resolved three issues: failed music suppressing
effects, a stale rooster idle pose after switching modes, and a companion teleport
when changing sides. The reviewed audio and walking code was approved.
The scene review also verified alpha-aware foot origins and the boss bar's
orientation reflow. Final targeted browser QA passed after the landscape label
and companion spacing corrections.

Browser evidence covers Chromium emulation and software rendering. It does not
certify physical-device frame rates or Safari. The existing `setBooted(true)`
effect in `game-client.tsx` retains its pre-existing lint diagnostic. Eight
PocketBase-dependent tests remain skipped because the local binary is absent.

Preview: `http://localhost:3101/game`. This work is for local review on
`thai-riverside-redesign`. No merge, push or deployment is included.
