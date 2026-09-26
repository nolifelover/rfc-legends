# Manual controls and corner HUD

The user requested the arrangement in `ref/mapple-story-m.jpg` and then explicitly chose real movement and attacks with an Auto toggle. This extends the earlier visual-only redesign. All work remains on `thai-riverside-redesign`; nothing is merged or deployed.

## Playing

- Profile, HP, SP and EXP are at the upper left. Game actions and site navigation are at the upper right.
- The lower-left stick moves the trainer horizontally. A/D and the left/right arrow keys also work.
- Hold Attack or Space to attack. The server enforces range and both companions' existing attack cooldowns.
- Walking or attacking switches Auto to Manual. Auto restores the existing automatic battle behavior. A release command never turns Auto off.
- The tonic button shows the actual quantity of item 101. It consumes one tonic and restores up to 40% of maximum HP. Full HP, no stock, and a knocked-out player prevent use. Bag opens the existing inventory and drop drawer.
- Releasing input, losing focus, hiding the page, or opening a menu/dialog stops held controls. Touch controls support moving and attacking together.

Auto is the default for existing and new players. Its combat formulas, drop rates, demo pity, zone progression, and offline settlement remain unchanged. Manual mode advances enemy attacks, cooldowns and recovery, but grants no automatic hero attacks or offline rewards. Manual healing uses the explicit tonic button.

## Authority and persistence

`POST /api/game/action` accepts an address, the exact next sequence number, and one intent:

```ts
{ type: 'mode', mode: 'auto' | 'manual' }
{ type: 'move', direction: -1 | 0 | 1 }
{ type: 'attack' }
{ type: 'potion' }
```

The client never supplies damage, rewards, distance, or elapsed time. The response contains the authoritative player, drop list, mode and action result. Requests share the existing per-address lock with sync and allocation. Retries and stale sequences return current state without replaying the action.

Movement uses 400 world units per second within x=190–1390. The target is at x=1150; both sides need a distance of at most 300 to attack. Direction commands have a 650ms lease, refreshed every 250ms while held. Losing a stop packet therefore cannot leave the player walking indefinitely. Mode changes preserve position, HP, active monster and cooldowns.

The optional `Player.control` object fits the existing player JSON record. No database migration or dependency is required. Final browser QA uses the worktree's own JSON store at `apps/web/.data/manual-qa`, selected through its untracked `.env.local`; it does not modify shared PocketBase game records.

## Implementation

- `game/manual-controls.ts`: command and response types, movement constants.
- `server/game/combat.ts`, `index.ts`, `manual.ts`: authoritative simulation, intent validation, serialization and persistence.
- `components/game/use-game-controls.ts`: bounded, ordered input queue and stale-response handling.
- `components/game/game-input-controls.tsx`: touch, keyboard, cancellation and action buttons.
- `components/game/game-hud-overlay.tsx`: corner layout and live player information.
- `game/scene/scene-bridge.ts`, `idle-scene.ts`, `manual-scene-state.ts`: movement prediction and server-confirmed combat feedback.

See `docs/qa/riverside-art.md` for screenshots, verification results and browser-test limits.
