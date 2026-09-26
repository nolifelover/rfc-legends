# Game UX research: why RFC Legends isn't fun yet, and what to change

**For:** the builder agent (Phaser 3.90 + Next.js 16) who implements the scene polish.
**Budget:** 3–5 hours. Tier A is about 3h, Tier B about 2h, and Tier C is stretch work.
**Written against:** `main` @ `3300fc5` plus the uncommitted working-tree diff in `apps/web/src/game/scene/*` and `apps/web/src/components/game/*` (another lane is editing these files). Run `git status` before you start. This doc names functions (`hitMonster`, `spawnMonster`, `bossEntrance`, `dropGroundLoot`, `HudStrip`/`Bar`) and never line numbers, so the references survive rebases.

**Evidence (all captured 26 Sep from the live dev server, demo mode, test player "Verify Guy" Lv 67):**
- `docs/research/game-ux/ours-canvas-c03.jpg`: one canvas frame
- `docs/research/game-ux/ours-burst-sheet.jpg`: 12 canvas frames ~0.7 s apart, laid out row-major as c00 to c11 (3 per row)
- `docs/research/game-ux/ours-fullpage.jpg`: the whole /game page at 1920×1080
- `docs/research/game-ux/ours-hud-rooster-exp-overflow.png`: a HUD bug crop
- `docs/research/game-ux/ours-number-plate-collisions.png`: damage numbers on top of nameplates (6 crops)
- `docs/research/game-ux/burst.py`: the capture script. Run `python3 docs/research/game-ux/burst.py <outdir> 5000 12 700` (it stubs `window.ethereum` and writes `full.png` + `c00..c11.png`).
- Idleon references: `docs/bar/idleon/*.jpg` and `docs/bar/idleon/combat-sheet.jpg` (a sheet of steam-02/03/08/15/17/13). **These are git-ignored because they're copyrighted Steam images. Keep them out of commits.**
- The older stills in `docs/bar/ours/*.png` are stale. They show faded gray damage numbers that the working tree has since replaced with gold ones. Don't diagnose from them.

**Non-negotiables for every item below:**
- Cartoon only: no blood and no injury. Defeated pests go "poof".
- The rooster **guards the rice field from pests** (rats, locusts, crabs). It never fights another rooster.
- No gambling framing and no random payouts behind a tap.
- No Ragnarok names, art or music.
- English-first UI.
- The server stays authoritative. Any number drawn on screen must either be backed by `Player` state (`inventory`, `killCount`, `exp`, `dropCounter`) or be clearly cosmetic (no exact figure the server would contradict).
- Every effect degrades under `prefers-reduced-motion`: no shake, no slow-mo, half the particles.

---

## 1. Why ours isn't fun yet

### 1.0 The blind rubric says we're close, and that is the clue

I ran the 8-question rubric from `docs/bar/idleon/README.md` on `ours-fullpage.jpg` + `ours-canvas-c03.jpg` (A) against `steam-02.jpg` (B):

| # | Question | Ours (A) | Idleon steam-02 (B) | Verdict |
|---|---|---|---|---|
| 1 | Level + XP % readable in 2 s | "Lv.67" is on the in-canvas nameplate, but XP % only appears in the React HUD *below* the canvas, at 12 px | "LV.1371 … (39.42%)" in the strip | tie |
| 2 | Numbers readable at thumbnail size | 38–60 px on a 540 px stage (7–11 %) | ~5–7 % of height, color-coded | tie |
| 3 | Exact `cur/max` HP/MP/XP | `676 / 676`, `158 / 158`, `107,268 / 11,269,392` | `3.52B/3.52B`… | tie (but our HP **never moves**) |
| 4 | ≥3 things moving at once | c03: a rooster streak and some coins. Most frames show bobbing and clouds only | 7+ fish, wings, projectiles, 6 numbers | **B** |
| 5 | Dark outline on every sprite | yes (`#2B1B12` stroke on every SVG) | yes | tie |
| 6 | One dominant saturated hue per zone | three equal pastel bands: pale sky (~45 %), green paddy, terracotta ground | committed cyan/teal | **B** |
| 7 | Loot visible in the world | coins on the ground | loot on the ground | tie |
| 8 | HUD confined to one thin edge | nav bar + demo banner + chips + stat row + 128 px HUD + footer. The canvas is ~66 % of viewport height inside a rounded card | full-bleed art with an 11–12 % strip | **B** |

**Result: 0 A, 5 tie, 3 B.** On stills alone we're not far off. The owner still says it "doesn't look fun to play", and that gap is the diagnosis. **Most of what's wrong happens over time, not within a frame:** cadence, escalation, where rewards go, and ceremony. A still can't show any of those. So most of the spec below is written in milliseconds, not pixels.

### 1.1 Twelve specific diagnoses

**D1. Rewards have nowhere to go.** `Fx.coinBurst` throws 6–8 coins per kill. They land on the ground lane and fade after 2 200 ms into nothing. There is no gold, no counter and no bag, and the engine has no gold field at all (`Player` has `inventory`, not currency). `dropGroundLoot` shows a material icon only 40 % of the time, and it also just fades after 20 s. *Idleon:* steam-13 keeps a `35,833` skull-currency counter on screen, and steam-15 litters coins, pizza slices and cards along the lane under a visible total. In Idleon a kill pays into something. In ours a kill pays into the floor.

**D2. Our numbers undersell what is actually happening.** `Fx.expPop` prints `+${m.def.exp} EXP`, e.g. **"+55 EXP"**. In demo mode the server multiplies by `DEMO_EXP_MULT = 800` (`server/game/combat.ts`), so the player really earns about **+44,000** per kill (the live sim computes `gain = m.exp * opts.expMult` per kill). We're hiding the biggest dopamine number the game has. Damage sits flat at 104–141 for minutes (burst sheet, every frame), with no suffixes and no growth. *Idleon:* `89030 / 728M / 2826T` (steam-02/03), color-coded by source. Idle games *are* numbers going up (Machinations).

**D3. The progress bar lives outside the game and moves only on the 4 s poll.** The EXP bar is React (`HudStrip` → `Bar`), below the canvas, and it updates when `useQuery` refetches every 4 000 ms. At Lv 67 it reads **1.0 %** and looks empty. A kill in the canvas moves nothing on screen that you'd call progress. *Idleon:* XP `(39.42%)` sits in the strip that touches the scene, and steam-17 floats `KILL 148` mid-frame.

**D4. One monster and a metronome.** There is exactly one mob on stage (`this.monster`). The trainer and rooster alternate at `trainerCd`/`roosterCd` (~0.7–1.7 s). Each mob's `visualHp` is sized to die in ~4.5 s, then comes an 800 ms empty stage (`respawnAt`) and a 460 ms walk-in. The same loop repeats forever: no streaks, no skills, no waves, no rhythm breaks. *Idleon:* 5–15 mobs on parallel lanes (steam-02, 14, 15, 17), so the eye reads "swarm" instantly.

**D5. Hits are small and weightless.** The lunge is 34 px (trainer) and 40 px (rooster), with no wind-up. `Fx.slash` is a radius-30 arc that lives 130 ms. The reaction is an 80 ms white flash plus an 8 px knockback. There are **zero hit-stop frames** and no anticipation pose, even though `public/assets/sprites/trainer-walk.svg`, a stride pose, already exists and is never loaded. *Idleon:* effects are drawn at player scale or larger: a full-height lightning column (steam-17), a screen-wide tornado (steam-15), long meteor trails (README point 12). *Theory:* hit-stop "gives the eyes a few frames to register" and makes impact read as force (critpoints). Juicy Breakout ships a freeze slider from 0 to 320 ms.

**D6. The top ~45 % of the frame is empty sky.** Actors' heads start around y≈316 on the 540 px stage (`FEET_Y 492 − 176`), and everything above that is clouds (c03). *Idleon:* every combat frame fills the height with stacked platforms, enemies on the upper tier, and a quest banner (steam-08, 14, 15).

**D7. The fight lane is cluttered, and numbers collide with nameplates.** The scarecrow (x 508) and fence (x 626) sit directly behind the monster (x 648) in the one strip that should read clean. The monster `Nameplate` is placed at `topY − 72`, exactly where `Fx.damage` stacks its column (`topY − 4`, rising by `size + 6`). In 5 of 12 burst frames (c01, c06, c07, c08, c10; crop in `game-ux/ours-number-plate-collisions.png`), the plate is buried under the numbers, e.g. "Giant Locust" under `108/141`. In c08 the trainer and rooster numbers also overprint each other (`137` on `108`), and the fence runs straight through the monster. *Idleon:* name tags sit **under** the feet (README point 8), which leaves the air above heads free for numbers.

**D8. The boss is not an event.** `killsTowardBoss` counts to 8 (demo) but is never shown, so the boss arrives unannounced. `bossEntrance` is a 420 ms flash plus a 1.05 zoom. The boss is drawn at 218 px against the trainer's 176 px, only **1.24×**. *Idleon* bosses are 2–4× the player (steam-01, 05, 13). Boss attacks have no stakes: the HUD HP bar says `676 / 676` forever.

**D9. Rare drops feel cheap.** The HUD says "Drops 267 · ✨ Rare drops (267)" next to "Kills 359" (`ours-hud-rooster-exp-overflow.png`). The in-canvas celebration (`Fx.meteor` → `framedDrop`) is a 26 px icon in a small frame that never stops the scene, and the React toast fires on its own timer, unsynced with the canvas. The demo's money shot (GDD demo beat 2:30–3:30) gets the same weight as a coin.

**D10. The rooster companion has no personality.** It gets a 700 ms bob and a 40 px dash, and nothing else. It never looks at the trainer, never reacts to a kill, a level-up or a drop, and never idles like a bird. Juicy Breakout's "Personality" block (paddle face, look at ball, smile) and game-creator's "Expression usage" audit (score 1 if expressions never change) both put this squarely in scope. The companion is our Thai-breeds pitch, and on screen it's a prop.

**D11. It reads as a website hosting a canvas, not a game.** A site nav (64 px), the demo banner (38 px), a rounded, bordered card, a "Stat points: 656 ▸" pill row, a 128 px HUD and a footer all sit around the scene. The canvas gets ~66 % of the viewport. The **656 unspent stat points**, the player's only agency lever, are hidden behind a small pill. *Idleon:* full-bleed art, one strip at 11–12 % height, and 8 labeled verb buttons (AUTO/ATTACKS/ITEMS/TALENTS/CODEX/MAP/PLAYERS/MENU).

**D12. The HUD has visible bugs and dead weight.** The rooster EXP text `1,664,227 / 7,450…` collides with `(22.3%)` inside a ~150 px bar (crop PNG). The HP and SP bars always show full, so they're decoration. Both EXP bars use the same orange gradient, so the trainer's EXP isn't the hero element.

---

## 2. Principles (short, cited)

1. **Every action gets disproportionate, cascading feedback.** A juicy game "feels alive and responds to everything you do, tons of cascading action and response for minimal user input" (Jonasson & Purho, *Juice it or lose it*, GDC Europe 2012). Their canonical toggles (`Settings.as`): tween-in, squash/stretch, particles, screen shake, **freeze 0–320 ms with fade-in/out**, and **personality** (face, look-at, smile).
2. **Sell impact with time: hit-stop, knockback, permanence, camera.** Nijman's *Art of Screenshake* stacks impact effects, hit animation, enemy knockback, permanence, camera kick, screenshake, and "sleep" (a few frozen frames on hit or kill). Hit-stop "freezes the characters at the point of collision… gives the eyes a few frames to register"; in Smash, characters **vibrate** during it (critpoints). One frame is 16.7 ms at 60 fps.
3. **A reward must travel to a destination and match the count.** "Show the currency directly entering the wallet UI location"; "the currency pauses, mid-animation, ensuring players admire it"; "the amount of currency… is the exact amount added" (Game Economist Consulting).
4. **Numbers go up, visibly, at a steady cadence.** "People like games in which the numbers go up, and idle games provide the purest version"; "too few rewards… no impetus; too many… devalued" (Machinations).
5. **Coming back must pay.** "The player should always return to the game to find that they have earned some kind of reward" (Machinations). AFK Arena's chest visibly changes at the 10/60/360/600-minute marks (AFK Arena wiki).
6. **Design for the silent thumbnail.** "Every frame must have motion", "Effects visible at thumbnail size", "Frequency over subtlety", "Silent communication: text slams, scaling numbers" (game-creator `game-designer` skill). Our demo video is 720p and judged fast, so this applies directly.
7. **Clear hierarchy beats more stuff.** A thin HUD strip, dark outlines, one dominant hue per zone, and backgrounds slightly desaturated so actors pop (Idleon README points 1, 6, 7).
8. **Close the loop visually.** "Take a screenshot of the result and compare it to the original. List differences and fix them" (Claude Code best practices). Claude's default output converges to "on distribution" generic choices unless it's steered by specific dimensions and explicit avoid-lists (Anthropic, frontend aesthetics).

---

## 3. The spec, ordered by fun-per-hour

Put every timing and color below into **one constants block**, `export const JUICE` + `export const INK` in `apps/web/src/game/scene/fx.ts` (or a new `juice.ts`), so tuning takes one edit:

```ts
export const JUICE = {
  // hit-stop (ms of near-freeze). Juicy Breakout's slider range is 0–320.
  STOP_HIT: 45, STOP_CRIT: 85, STOP_KILL: 110, STOP_BOSS_LAND: 120, STOP_BOSS_KILL: 260,
  FREEZE_SCALE: 0.02,
  // camera.shake(duration, intensity). Intensity is a fraction of the view: 0.005 ≈ 5 px on 960.
  SHAKE_CRIT: [110, 0.004], SHAKE_KILL: [140, 0.005], SHAKE_BOSS_LAND: [260, 0.01], SHAKE_BOSS_KILL: [420, 0.012],
  KNOCK: 18, KNOCK_CRIT: 30,
  WINDUP: 90, STRIKE: 80, RECOVER: 220,          // attack phases (ms)
  LOOT_REST: 350, LOOT_FLY: 450, LOOT_STAGGER: 60,
} as const
export const INK = {
  dmg: '#ffcc4d', rooster: '#ffffff', crit: '#ff5fd2', exp: '#7ee0ff', loot: '#b6f07a', hurt: '#ff6b5b',
  stroke: '#2b1b12', gold: 0xffd24a, plate: 0x3d2817,
} as const
```

Use `ParticleEmitter`s created once in `create()` and fired with `.explode(n, x, y)`, not create-and-destroy tween particles (game-creator's performance note caps those at 15–20 per burst).

### Tier A (about 3 h). Do these first.

#### 0. Dev triggers for every ceremony (15 min, a prerequisite)
- **WHAT:** In non-production builds only (`process.env.NODE_ENV !== 'production'`), key `B` spawns the boss next, `L` plays the level-up ceremony, `J` plays the rare-drop jackpot with item 1001 (Monster Card art), `W` opens the welcome-back modal with fixture data, and `K` forces a kill. These triggers must **never** create server drops; they only call the scene FX. That keeps the demo honest and makes every other item screenshot-able on demand.
- **WHERE:** `IdleScene.create()` → `this.input.keyboard?.on('keydown-B', …)`.

#### 1. Hit weight: anticipation, attack pose, hit-stop, knockback (45 min)
- **WHAT (trainer):** Replace the 34 px yoyo lunge with a three-phase chain:
  1. **Wind-up:** `x −10`, `scaleX ×1.06`, `scaleY ×0.94`, 90 ms, `Quad.easeOut`, with the texture swapped to `trainer-walk.svg`.
  2. **Strike:** `x +64`, `scaleX ×0.94`, `scaleY ×1.06`, 80 ms, `Expo.easeIn`.
  3. **Recover:** back to base, 220 ms, `Back.easeOut`, with the texture swapped back.
  
  The hit resolves at the end of the strike (170 ms), not at the current `delayedCall(90)`. The slash arc grows from r 30 to **r 64**, `lineWidth 9 → 2`, white core with a gold `#ffd24a` edge, 150 ms.
- **WHAT (rooster):** Crouch (`scaleY 0.9`, 70 ms), then dash `+70` px, then recover. Keep the existing streak, but make it 3 afterimages (the rooster texture tinted `#fff3d6`, alpha 0.5/0.35/0.2, 160 ms fade).
- **WHAT (victim):** Hit-stop: `STOP_HIT` 45 ms on a normal hit, `STOP_CRIT` 85, `STOP_KILL` 110. During the freeze, hold `setTintFill(0xffffff)` and **vibrate the victim ±3 px horizontally every frame** (the Smash trick). After the freeze, knock back `KNOCK` 18 px (30 on a crit) and return over 180 ms with `Back.easeOut`, squashing to `0.86 / 1.12` (currently 0.92/1.06).
- **WHERE:** `IdleScene.trainerAttack`, `roosterAttack`, `hitMonster`, `update`. Add `Fx.hitStop`. Add `trainer-walk` to `ART` in `art.ts` (192×192, same fallback as the trainer).
- **API and the pitfall that matters:** don't set `time.timeScale = 0` and restore it with `delayedCall`, because the restore would be frozen too. `update()` also receives *unscaled* time, so the attack timers would keep firing during the freeze. Do this instead:
  ```ts
  // Fx
  private frozenUntil = 0; private unfreeze = 0
  hitStop(ms: number): void {
    const now = performance.now(); if (now + ms <= this.frozenUntil) return
    this.frozenUntil = now + ms
    this.scene.tweens.timeScale = JUICE.FREEZE_SCALE
    this.scene.time.timeScale = JUICE.FREEZE_SCALE          // Phaser.Time.Clock#timeScale
    window.clearTimeout(this.unfreeze)
    this.unfreeze = window.setTimeout(() => { this.scene.tweens.timeScale = 1; this.scene.time.timeScale = 1 }, ms)
  }
  get frozen(): boolean { return performance.now() < this.frozenUntil }
  // IdleScene.update(time, delta): if (this.fx.frozen) { this.nextTrainerAt += delta; this.nextRoosterAt += delta; this.nextBossAt += delta; jitter victim; return }
  ```
  Clear the timeout on scene shutdown. Under reduced motion, keep hit-stop at half duration (it isn't motion) but skip the jitter and shake.
- **DONE WHEN:** the burst shows the wind-up pose in at least one frame, and a crit visibly holds before the number rises.

#### 2. Rewards travel: loot flies into a Harvest counter that ticks (45 min)
- **Truth rule (every icon that flies is a real server gain):**
  - In `applyState`, diff `player.inventory` against the previous `Player` and push one entry per gained unit into a `pendingLoot: number[]` queue (item IDs). That covers the materials 102 Paddy Rice / 103 Soft Feather / 104 Crab Shell, plus any non-mintable rare/epic equipment, which gives the loot variety for free.
  - Cap the queue at 30. On overflow, fold the excess into one "+N" batch icon.
  - The server rolls a common material on 25 % of its kills (`COMMON_MATERIAL_CHANCE` in `server/game/drops.ts`) and its sim usually runs ahead of the visual scene, so the queue is normally stocked.
  - Each visual kill drains **one** queued item. When the queue is empty, the kill drops only the coin sparkles.
  - The chip count starts at `Σ player.inventory[id]` and rises by exactly one per arrival. Show exact amounts; that's the Game Economist Consulting rule.
- **WHAT (on a kill that drains an item):** drop that item's icon (`itemKey(id)`, 40 px) plus 3 coin sparkles (the existing `coinBurst`, trimmed, decorative only).
  1. The icon arcs out and lands **in the lane between rooster and monster** (x 440–590, y `LOOT_Y`), not under the monster's feet where its plate sits. That's the existing 480 ms arc, re-aimed.
  2. It then **rests `LOOT_REST` 350 ms**. This is the "admire" pause.
  3. It flies along a curve to a new **Harvest chip** pinned top-right under the KILL chip: `LOOT_FLY` 450 ms, `Cubic.easeIn`, staggered 60 ms, scaling 1 → 0.45. Coins fly with it as sparkle.
  4. On arrival the chip pops (`scale 1.18 → 1`, 180 ms, `Back.easeOut`), a green `+1 Paddy Rice` (18 px, `INK.loot`) floats up 16 px, and the count ticks by one.
- **WHERE:** `IdleScene.applyState` (inventory diff → queue), `killMonster` (replaces the 40 % `dropGroundLoot` roll with a queue drain), `buildChips` (new `harvestChip: Chip` with a 20 px `itemKey(102)` icon), and a new `Fx.vacuum(objs, tx, ty, onArrive)`.
- **API:**
  ```ts
  const curve = new Phaser.Curves.QuadraticBezier(
    new Phaser.Math.Vector2(x0, y0),
    new Phaser.Math.Vector2((x0 + tx) / 2 + Phaser.Math.Between(-80, 80), Math.min(y0, ty) - 120),
    new Phaser.Math.Vector2(tx, ty))
  this.tweens.addCounter({ from: 0, to: 1, duration: JUICE.LOOT_FLY, delay: i * JUICE.LOOT_STAGGER, ease: 'Cubic.easeIn',
    onUpdate: (tw) => { const t = tw.getValue(); const p = curve.getPoint(t); icon.setPosition(p.x, p.y).setScale(Phaser.Math.Linear(1, 0.45, t)) },
    onComplete: () => { icon.destroy(); onArrive() } })
  ```
- **DONE WHEN:** in a 12-frame burst, some reward is in flight toward the chip in ≥4 frames, and the chip value differs between frame 0 and frame 11.

#### 3. Honest big numbers and a color language (25 min)
- **WHAT:**
  - **EXP pop:** show the real per-kill amount, `def.exp × (demoMode ? DEMO_EXP_MULT : 1)`. `combat.ts` is a pure module, so importing is fine; alternatively pass the multiplier through `SceneMountOptions`. Render at 28 px in `INK.exp` cyan with a 5 px stroke, 900 ms rise.
  - **Compact format:** at ≥ 100 000, use `new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })` → `44K`, `3.2M`. Use it for damage, EXP, the boss bar and the harvest count.
  - **Color = source:**

    | Source | Style |
    |---|---|
    | Trainer | gold `#ffcc4d`, 48 px |
    | Rooster | white, 38 px |
    | **Crit** | **magenta `#ff5fd2`**, 60 px, stroke 7, with a small procedural crown glyph on the left (Idleon's crit convention, README point 5). This replaces the gold "CRIT!" |
    | EXP | cyan |
    | Loot | green |
    | Damage taken (boss fights only) | red `#ff6b5b` |

  - **Placement:** trainer numbers spawn 24 px left of the monster's center line and rooster numbers 24 px right, so the two streams never overprint.
  - **Pooling:** pool 12 `Text` objects in `Fx` and reuse them with `setText`/`setVisible`. Creating stroked text at `resolution 2` on every hit is the most expensive thing the scene does.
- **WHERE:** `Fx.damage`, `Fx.expPop`, `BossBar.setHp`.

#### 4. Composition quick wins (25 min, cheap, big visual payoff)
- **Clear the fight lane:** move the scarecrow to x ≈ 150 (behind the rice bundle, depth 8) and delete the fence (or move it to x ≈ 40). The hay bale and water jar stay as frame edges.
- **Monster nameplate under its feet** (Idleon's convention), and only the monster's, because it's the only sprite with a damage column over it.
  - Make it a single line, "Field Rat · Lv.2" (~30 px tall; drop the `sub` row; the boss keeps "MVP" in its top `BossBar`), at `FEET_Y + 6`. The stage is 540 px, so that fits with room to spare.
  - Keep the `MiniHpBar` over the head at `topY − 12`, and spawn the damage column from `topY − 28`, so numbers start *above* the bar instead of on it (c06 shows `108` sitting on the bar today).
  - Trainer and rooster plates stay above their heads; item 5 hangs EXP bars inside them.
  - Loot rests left of the monster (item 2), so it never hides under the plate. This fixes D7.
- **Grade the background, not the actors:** add a full-width rect at **depth 11**, above the ground (10) and below the actors (20), filled `#ffcf8a` at alpha 0.14. This warms and flattens the backdrop into one dominant "golden rice at harvest" hue while the actors keep full saturation (README point 7). Optionally, on WebGL, apply `preFX?.addColorMatrix().saturate(-0.2)` to the sky, hills and paddy images, always with `?.` because preFX is null on Canvas.
- **HUD overflow fix (D12):** in `HudStrip`, give the rooster EXP `Bar` a full-width row. When a bar is under 200 px, show only `(22.3%)` inside it and move `cur / max` into `title`/`aria-label`.
- **WHERE:** `IdleScene.buildBackground`, `buildActors`, `spawnMonster` (plate placement), `hud-strip.tsx`.

#### 5. In-canvas EXP bars that move on every kill (40 min)
- **WHAT:** Give `Nameplate` an optional **progress row** under its text: a **120×8 px** bar with a `#2b1b12` frame, cyan fill `#38c6f4 → #7ee0ff`, and `73.6%` right-aligned in 11 px bold on top of it. The trainer plate then reads "Verify Guy · Lv.67" over the bar. Raise the trainer plate by the extra row height (~14 px: `placeAbove(TRAINER_X, FEET_Y − 176 − 54)`); there is empty sky above it. The rooster plate gets a 90×6 px row the same way. The bars live inside the existing above-head plates, never near the bottom edge, which stays clear for the React HUD (see the `overlays.ts` header).
  - On kill, a cyan orb (`FX.glow`, tint `0x7ee0ff`, scale 0.5, with a 4-point trail) flies from the monster to the bar: 420 ms, `Sine.easeInOut`. On arrival the fill tweens by the estimated per-kill fraction (300 ms, `Cubic.easeOut`) and the bar flashes white for 80 ms.
  - **Truth rule:** `applyState` snaps to the server's `exp / expToNext(level)` (250 ms tween). The estimate never passes 99 % until the server confirms a level-up, which then plays item 9.
- **WHERE:** `Nameplate.setProgress(pct, label)` in `overlays.ts` (reuse `MiniHpBar`'s drawing), `buildActors`, `killMonster`, `applyState`. `expToNext` is already exported from `@/server/game/stats`.
- **Why:** progress becomes visible *inside* the frame every ~5 s, not every 4 s poll below the fold (D3).

> **If the demo video is being recorded before Tier B lands, do items 6 and 7 before item 5.** They carry the demo beat.

### Tier B (about 2 h)

#### 6. The boss is an event: countdown → warning → drop-in → stakes → victory (60 min)
- **Countdown pips:** 8 pips (demo) under the KILL chip, filling one per kill (`killsTowardBoss`). Outside demo mode, use a `BOSS 17/25` bar. With one kill left, the pips pulse red (`#e2574c`, 400 ms yoyo).
- **Warning (1 200 ms before spawn):**
  - A red edge vignette pulses twice. Use `cameras.main.postFX?.addVignette(0.5, 0.5, 0.9, 0.35)` animated, or 4 edge gradient rects on Canvas.
  - A **"⚠ BOSS APPROACHING"** ribbon (30 px, cream on `#7a1f14`) slides in from the left (300 ms `Back.easeOut`), holds 700 ms, then exits right.
  - The background darkens with a `#2b1b12` overlay tweening to alpha 0.22 over 400 ms at depth 11, kept for the whole fight.
- **Drop-in:** the boss falls from y −320 to the feet line in 520 ms with `Bounce.easeOut`. On first contact: `STOP_BOSS_LAND`, `SHAKE_BOSS_LAND`, a dust ring (`FX.ring` at `scaleY 0.35`, growing 0.3 → 2.4 over 320 ms), and `cameras.main.zoomTo(1.08, 180)` then back over 420 ms. A name card **"RAT KING · MVP Lv.12"** slams from scale 2.2 → 1 (260 ms `Back.easeOut`) at center, then tweens into the `BossBar` slot.
- **Size:** display the boss at **300 px** (1.7× the trainer, currently 218). Raise its raster in `ART` from 288 to **450** so it stays crisp when the canvas is upscaled.
- **Ghost HP trail:** in `BossBar`, add a pale `#ffe9a8` segment that trails the red fill by 400 ms and catches up over 350 ms `Cubic.easeOut`. HP text uses the compact format.
- **Stakes (cosmetic, no numbers):** each `bossAttack` knocks the trainer back 20 px with a 60 ms `#ff6b5b` tint and dips a **number-less** 60×6 px bar under the trainer by 8–15 %. That bar regenerates to full within 2 s after victory. The server sim models damage too; we just don't print an HP figure it would contradict.
- **Victory:** `STOP_BOSS_KILL` 260 ms, `cameras.main.flash(250, 255, 240, 200)`, `SHAKE_BOSS_KILL`, and a 40-particle confetti `explode` in `RARITY_COLORS`. **"MVP DEFEATED!"** slams at 56 px. The existing card fly-out stays.
- **WHERE:** `spawnMonster`, `bossEntrance`, `bossAttack`, `bossVictory`, plus `BossBar` and a new `BossPips` in `overlays.ts`.

#### 7. Rare-drop jackpot: stop the world (45 min, the demo's money shot)
For mintable rarities only (legendary / monster_card / mvp_card), keeping the existing 1-per-8 s throttle in `applyState`:

| t (ms) | Beat |
|---|---|
| 0 | `tweens.timeScale = 0.25` for 1 200 ms (slow-mo, skipped under reduced motion). A dim overlay `#120b06` tweens 0 → 0.55 over 200 ms at depth 45. |
| 0–620 | The meteor (existing) is drawn in `RARITY_COLORS[rarity]` with a longer 12-point trail. A **loot beam** (60 px wide, rarity color, alpha pulsing 0.4 ↔ 0.75) marks the landing spot. |
| 620 | The card bursts to center (480, 230) with scale 0 → 1.6 (360 ms `Back.easeOut`). Fake a Y-flip (scaleX 1 → 0 → 1 over 300 ms, swapping the card back for the face). Two rotating ray layers (`FX.glow` + `FX.star`, ±30°/s) sit behind it, plus `card.preFX?.addShine(0.6, 0.4, 3)`. The label **"MONSTER CARD!"** appears at 40 px in the rarity color with an 8 px stroke. |
| 2 000 | The card shrinks and flies to the bottom-right corner (500 ms `Cubic.easeIn`). Time scale returns to 1 and the overlay clears. |
| 2 400 | **Only now** does the React "Mint & sell →" toast appear. Give `DropToasts` a `delayMs={2400}` while the scene is mounted, so the canvas hands off to the UI. |

- The rooster jumps and gets big eyes at t=620 (see item 11).
- The HUD pill shows **"✨ 3 new"** (unminted drops that arrived this session) instead of the lifetime 267. The lifetime total can live on /market.
- **WHERE:** `applyState` drop loop, `Fx.meteor` / `Fx.framedDrop` → `Fx.jackpot`, `drop-toasts.tsx`, `hud-strip.tsx`.

#### 8. Kill cascade and milestone slams (25 min)
- **Kill, 0–600 ms:**
  1. `STOP_KILL`.
  2. The monster pops (scale ×1.25 in 60 ms, then to 0 with a 180° spin, 180 ms `Back.easeIn`).
  3. `poof` at 1.6×.
  4. 10 stars `explode` (speed 120–260, angle 200–340°, `gravityY` 420, lifespan 520).
  5. A ground shockwave ring (`FX.ring`, `scaleY 0.35`, 0.3 → 2.2 over 320 ms).
  6. Item 2's loot fountain and item 5's EXP orb.
  7. The KILL chip pops.
- **Milestones:** every 10th kill, slam **"10 PESTS CLEARED!"** (then 20, 30…) at 44 px, cream with a 7 px stroke, centered at y 150 (which also fills the empty sky). It goes scale 2.4 → 1, 280 ms `Back.easeOut`, holds 500 ms, then fades while rising 20 px, with `SHAKE_KILL`. That's roughly one "event" a minute in the idle flow (game-creator's streak pattern).
- **WHERE:** `killMonster`, `Fx.poof`, new `Fx.shockwave` and `Fx.slam`.

#### 9. Level-up ceremony (30 min)
- **WHAT (on a server level-up in `applyState`):**
  - Slow-mo at 0.3 for 400 ms.
  - A **light pillar** at the trainer's x: a 90×540 rect with a gold → transparent vertical gradient (generate the texture once), scaleX 0.2 → 1 → 0 and alpha 0 → 0.85 → 0 over 900 ms.
  - Two rings staggered by 120 ms.
  - A 24-particle upward gold fountain (`gravityY 300`).
  - The trainer hops (y −40, 260 ms `Quad.easeOut` yoyo) and squashes 1.1/0.9 on landing.
  - **"LEVEL UP!"** slams at 44 px (scale 2.4 → 1, 280 ms `Back.easeOut`) with the subline **"Lv 67 → 68 · +5 stat points"** at 20 px.
  - `cameras.main.zoomTo(1.06, 300)` then back.
  - Several levels in one poll show **"LEVEL UP ×3!"** once, never stacked banners.
- **React:** `IdleCanvas` gains an `onSceneEvent` prop that subscribes to `bridge.on('levelup' | 'rooster-levelup' | 'drop' | …)`. Today the bridge emits but nothing listens. `game-client.tsx` uses it to pulse the Stat points button (a 3× scale pulse plus a gold ring). A rooster level-up gets the smaller version plus the rooster's crow (item 11).
- **WHERE:** `Fx.levelUp` (rewrite), `applyState`, `idle-canvas.tsx`, `game-client.tsx`, `stat-panel.tsx`.

#### 10. Welcome-back summary (45 min)
- **Route (about 3 lines):** `app/api/game/state/route.ts` currently discards the sync aggregates. Change it to `const { player, live, offline } = await syncPlayer(address)` and return `{ player, drops, demoMode, live, offline }`.
  - The poll pauses while the tab is hidden (`refetchIntervalInBackground` defaults to false), so the first poll after a return carries the whole absence. The modal therefore works on tab refocus as well as on reload.
- **Client:** in `game-client.tsx`, when a state response arrives with `away = (live?.ticks ?? 0) + (offline?.seconds ?? 0) ≥ 120`, show a new `components/game/welcome-back.tsx` modal over the scene, once per absence.
  - **Title:** "Welcome back, {name}!"
  - **Subtitle:** "Your rooster guarded the fields for 3h 12m". Add "(max 12h)" when the cap applied.
  - **Four count-up tiles** (900 ms ease-out-cubic, staggered 150 ms): Pests cleared (`kills`), EXP (`expGained`, plus "+N levels"), Harvest (per-item icons from `inventory`), and Rare finds (rarity chips from `drops`). Add a footnote rate: "≈ {killRatePerMin}/min".
  - **Collect** button: the tile icons fly (CSS `transform` transition, 500 ms) toward the HUD strip, the modal closes, and any gained levels then play item 9.
- **WHERE:** `route.ts`, `game-client.tsx`, `welcome-back.tsx`. Types come from `CombatAggregates` / `OfflineAggregates` in `server/game/combat.ts`.

### Tier C (stretch, pick by taste)

#### 11. Rooster personality (45 min)
- **Idle micro-behaviors** (every 3–6 s at random, only if no attack lands in the next 600 ms):
  - peck: rotate +18° about the feet, 120 ms ×2 yoyo
  - head tilt: −8°, hold 400 ms
  - wing flutter: scaleX 0.92, ×3 at 90 ms
  - look at the trainer: `flipX` for 700 ms
- **Reactions:**
  - On kill, a 25 % chance of an emote bubble (procedural textures: ♪, !, ♥) that pops 0 → 1 over 160 ms `Back.easeOut`, holds 700 ms, then fades.
  - On a trainer level-up, two hops and a speech bubble **"Cock-a-doodle-doo!"** with 3 sound-wave arcs from the beak.
  - On a rare drop, eyes wide (sprite scale 1.1) and a jump.
  - On a rooster crit, a puff of cream feather particles (no blood).
- **"Cheer" tap:** clicking the rooster (`setInteractive({ useHandCursor: true })`) plays a crow and makes the next 3 rooster attacks 1.5× faster *cosmetically*, with a 20 s cooldown ring. It's deterministic and doesn't change the economy, so it adds agency without any gambling shape.
- **WHERE:** `buildActors`, a new `scheduleRoosterIdle()`, and a new `Fx.emote`. Emote textures go in `makeFxTextures`.

#### 12. Swarm-lite: three pests on stage (45 min)
- **WHAT:** The active target stays at `MONSTER_X`. Two queued pests wait at x 790 / 890 (y +8 / −6, scale 0.9 / 0.8, depth 21 / 20), wobbling, with only a small `Lv` chip each.
  - When the target dies, the next pest hops forward (380 ms `Quad.easeOut`, 24 px arc) and a new pest walks in from the right.
  - This removes the 800 ms empty stage and reads as a wave.
  - Each pest still has one cosmetic HP pool. No AI.
- **WHERE:** `spawnMonster` becomes queue-based (`ActiveMonster` + `queued: ActiveMonster[]`), `killMonster`, `update`.

#### 13. Skills at player scale (40 min)
- **Sickle Sweep:** every 4th trainer attack. A 180 ms wind-up with the trainer glowing (`trainer.preFX?.addGlow(0xffd24a, 4)`), then a crescent arc (r 130, lineWidth 14 → 2, gold with a white core) sweeping −60° → +60° over 160 ms across the target **and** the queued pests. Each target takes a stacked number, with `shake(120, 0.004)`.
- **Spur Dash:** every ~6 s the rooster dashes *through* the target to `MONSTER_X + 60` and back, leaving 3 afterimages, 240 ms.
- Both are cosmetic flourishes on the same damage formula. Together they break the metronome (D4) and put effects at player scale (README point 12).
- **WHERE:** `trainerAttack` / `roosterAttack` counters, plus `Fx.sweep` and `Fx.afterimage`.

#### 14. A living scene that fills the sky (40 min)
- **Kite (ว่าว):** a procedural diamond with a tail at x ~720, y 90–140, swaying ±8° and ±10 px over 3.2 s `Sine.easeInOut`, with its string drawn to the horizon.
- **Birds:** flocks of 3–5 every 8–12 s instead of one bird every 14–22 s.
- **Pollen:** 3 hand-tweened motes become one `ParticleEmitter` of 14 (lifespan 6 000, speedX 8–20, alpha 0.2 → 0.6 → 0).
- **Breathing parallax:** hills drift ±6 px and paddy ±3 px on an 8 s sine.
- **Time of day:** cycle over **6 real minutes**: morning `#fff1d6` @ 0.10 → noon (none) → golden `#ffb36b` @ 0.18 → dusk `#6d5ba8` @ 0.22 with 10 fireflies, cross-faded over 20 s. Reuse item 4's depth-11 grade rect so only the backdrop tints.
- Items 6, 8 and 15 put the boss bar, milestone slams and quest ribbon into the top band, which also fills the frame.
- **WHERE:** `buildBackground`, `buildMotes`, `scheduleBird`. The kite texture goes in `makeFxTextures`.

#### 15. Next-goal ribbon (20 min)
- **WHAT:** A top-center ribbon when no boss is up: **"Clear the pests 6/8 → Rat King"** with the item 6 pips, and a second line **"Next level in ~4m"**. The ETA is `(expToNext − exp) / recentExpRate`, where the rate is measured across the last 3 syncs in `applyState`.
- While unspent stat points ≥ 1, a gold chip **"+656 stat points · tap to spend"** pulses every 8 s. Tapping it opens `StatPanel` through a new bridge callback.
- *Idleon:* steam-08's "QUEST: Defeat 100 Mutant Mushrooms".
- **WHERE:** `overlays.ts` (a `Ribbon` class), `buildChips`, `applyState`.

#### 16. Game-mode layout and HUD hierarchy (45 min)
- On `/game`, slim the site nav to a 40 px bar (logo + wallet) and move the demo badge into the scene frame's corner as a small chip.
- The scene frame goes full-bleed: no rounded card border, height `calc(100dvh − 40px − HUD)`.
- The HUD strip stays at ≤ 12 % of viewport height (Idleon README point 1).
- **EXP becomes the hero bar:** 18 px tall, a glowing leading edge, and a shine sweep every 4 s. HP and SP shrink to 8 px and dim to 70 % opacity, because they're static.
- Add a 4th HUD zone of three labeled icon buttons that **exist today**: STATS (with a badge showing the unspent count), CARDS (→ /market), ROOSTERS (→ /roosters). Don't add buttons for features that don't exist; judges check.
- **WHERE:** `game-client.tsx`, `hud-strip.tsx`, `scene-frame.tsx`, `nav-bar.tsx`, `app/layout.tsx` (demo badge placement).

#### 17. Sound hooks, silent-safe (30 min, optional)
- **WHAT:** A `sfx(name)` helper in a new `apps/web/src/game/scene/sfx.ts`, **OFF by default**, toggled by a speaker icon in the HUD. It synthesizes with WebAudio, so there are no audio files and no licensing questions.

  | Sound | Recipe |
  |---|---|
  | hit | square 220 → 110 Hz, 60 ms |
  | crit | hit plus a 30 ms noise burst |
  | loot tick | sine 880 Hz, 40 ms, **+1 semitone per pickup within 1 s** (a pitch ladder), resetting after |
  | level-up | C-E-G-C arpeggio, 4 × 70 ms |
  | boss warning | 80 Hz saw, 2 × 200 ms |
  | jackpot | bell chord |

  **No music:** the demo video needs clear voice audio.
- **WHERE:** hook it at `hitMonster`, `Fx.vacuum` arrival, `Fx.levelUp`, `bossEntrance` and `Fx.jackpot`.

### Temporal rubric (use with the stills rubric; it measures "fun over time")
Run `burst.py <dir> 5000 12 700` and judge the 12 frames:
- **T1 Motion density:** ≥3 distinct moving elements in ≥10 of 12 frames.
- **T2 Reward in flight:** loot or an EXP orb travelling toward a counter in ≥4 of 12 frames.
- **T3 Counter change:** the Harvest count or the in-canvas EXP bar differs between frame 0 and frame 11.
- **T4 Legibility:** zero frames where a damage number overlaps a nameplate or bar.
- **T5 Escalation:** in a 60 s capture (`burst.py <dir> 3000 60 1000`), at least one milestone slam, skill, or boss warning appears.
- **T6 Thumbnail:** downscaled to 320×180, the newest damage number and the trainer EXP % are still readable.

Today's scene: T1 fail, T2 fail (only coin arcs), T3 fail, T4 fail (5/12 frames: c01, c06, c07, c08, c10), T5 fail, T6 partial.

---

## 4. Claude Code prompt pack

These patterns come from what worked in the sources:
- **Art direction first, as named dimensions plus an explicit avoid-list.** This is Anthropic's frontend-aesthetics method: Claude "tend[s] to converge toward generic, 'on distribution' outputs".
- **A quantified juice checklist with a pass threshold.** game-creator's 1–5 audit table: "any area scoring below 4 MUST be improved".
- **Constants in one place.** game-creator: "All new values go in Constants.js".
- **A screenshot loop against a reference, graded by a separate reviewer.** Claude Code best practices: "take a screenshot of the result and compare it to the original. list differences and fix them"; "a fresh context improves code review".

Paste the prompts one at a time, in order.

### Prompt 1: lock the art direction (10 min, no gameplay code)
```text
You're the art director and game-feel engineer for RFC Legends, a cartoon idle RPG in Phaser 3.90
(apps/web/src/game/scene/*) with a React HUD (apps/web/src/components/game/*). Read
docs/research/game-ux.md sections 1–3 first. Before writing any gameplay code, create
apps/web/src/game/scene/juice.ts exporting JUICE (timings in ms, shake tuples, knockback px) and INK
(the color-by-source language) exactly as section 3 specifies, plus a ≤25-line header comment that
is the art direction. The rest of the code must follow it.

<game_art_direction>
You tend to converge toward generic, "on distribution" game output: tiny effects, linear easing,
every timing 200–300 ms, pastel on pastel, rewards that vanish. Avoid this. Commit to:
- Zone hue: golden rice field at harvest. The backdrop is warm and slightly flattened; actors are
  full saturation with the #2B1B12 outline.
- Motion vocabulary: anticipation → strike → overshoot recovery (Back.easeOut). Hit-stop on impact.
  Nothing moves linearly. Durations vary by weight (45 ms hit-stop … 2 s jackpot).
- Scale: effects at player scale or larger. Text slams for events. Numbers readable at 320×180.
- Every reward travels to a visible counter and the counter visibly changes.
- Personality: the rooster reacts to everything (look, peck, emote, crow).
Hard rules: cartoon only, no blood or injury; the rooster guards the rice field from pests and never
fights a rooster; no gambling framing or random tap payouts; no Ragnarok names/art/music;
English-first UI; the server is authoritative (no on-screen number the server would contradict).
</game_art_direction>

Don't touch gameplay yet. Show me juice.ts and stop.
```

### Prompt 2: the juice pass, Tier A, with a checklist
```text
Implement docs/research/game-ux.md items 0–5 in order, one commit per item (the repo needs
frequent, incremental commits). Use only JUICE/INK from juice.ts; no inline magic numbers. Follow
the hit-stop implementation in item 1 exactly (tweens.timeScale + time.timeScale restored by
window.setTimeout, and shift nextTrainerAt/nextRoosterAt/nextBossAt by delta while frozen), because
delayedCall-based restores freeze too. Create ParticleEmitters once in create() and fire them with
.explode(); no create/destroy tween particles in hot paths. Pool damage Text objects.
Guard WebGL-only calls with ?. (preFX/postFX are null on Canvas). Honor reducedMotion as the
spec says.

Juice checklist. Score each 1–5 from real screenshots, and anything below 4 must be fixed before
you move on:
1 anticipation before every attack   2 hit-stop + victim jitter   3 knockback + squash
4 slash/impact at player scale       5 loot rests, then flies to the Harvest chip, which ticks
6 EXP pop shows the real multiplied amount, color-coded, compact-formatted
7 no number/nameplate overlap        8 in-canvas EXP bar moves on every kill

After each item: cd apps/web && npx tsc --noEmit && npm run lint && npm test, then
python3 ../../docs/research/game-ux/burst.py /tmp/juice 5000 12 700 (dev server on :3000). Look at
the frames yourself, paste the checklist scores with the frame numbers as evidence, and say which
temporal-rubric checks (T1–T6 in section 3) now pass.
```

### Prompt 3: screenshot-compare loop against Idleon (separate critic)
```text
Run a visual gauntlet on the /game scene. Builder: capture a burst with
python3 docs/research/game-ux/burst.py /tmp/r1 5000 12 700 and make a 3×4 contact sheet.
Then spawn a SEPARATE reviewer subagent (fresh context; the builder never grades its own work).
Give it only: the contact sheet, docs/bar/idleon/steam-02.jpg, steam-08.jpg, steam-17.jpg, the
8-question blind rubric from docs/bar/idleon/README.md, and T1–T6 from docs/research/game-ux.md.
It must answer each question A/B/tie with the frame numbers as evidence, then list the 5 biggest
visible differences, ranked by how much they'd change a 3-second silent impression. It reports
gaps, not style preferences.
Builder: fix the top 3 differences that stay within the hard rules and the server-truth rule, then
re-capture and re-judge. Stop after 3 rounds or when the rubric has no B left on questions 2, 4, 6, 7
and T1–T4 all pass. Print the before/after table each round.
```

### Prompt 4: the ceremonies (boss, jackpot, level-up)
```text
Implement docs/research/game-ux.md items 6, 7, 8 and 9. Treat each ceremony as a timeline: before
coding, write the beat table (t in ms → what happens → which API) as a comment above the
function, then implement it exactly. Use the dev triggers from item 0 (B / J / L keys, non-production
only, never creating server drops) to fire each ceremony on demand.
For each ceremony, capture 8 frames at 150 ms intervals starting at the trigger (adapt burst.py:
first_wait 0, gap 150) and check that every beat in your table is visible in at least one frame.
The jackpot must hand off to the React toast: add delayMs to DropToasts so "Mint & sell →" appears
at t=2400 ms, exactly as the canvas card leaves. Nothing in these ceremonies may imply wagering or
random purchase; drops come only from defeating pests and bosses.
One commit per ceremony, with the tsc/lint/test gate each time.
```

### Prompt 5: React side (welcome back, HUD hierarchy, game mode)
```text
Implement docs/research/game-ux.md items 10 and 16, plus the item 4 HUD overflow fix if it isn't
done yet. Read apps/web/AGENTS.md first: this Next.js version has breaking changes, so check
node_modules/next/dist/docs before using any Next API. The state route change is additive (return
live + offline from syncPlayer); add a vitest case that a sync after a 2-hour gap returns
offline.seconds > 0 (see server/game/sync.test.ts for the pattern). The modal shows once per
absence, counts up with CSS transitions, and must not block the canvas from rendering underneath.
In the HUD, only add buttons for features that exist today (STATS, CARDS → /market,
ROOSTERS → /roosters). Verify at 1920×1080 and 390×844 with Playwright screenshots, and paste both.
One commit per item.
```

---

## 5. Sources
- Martin Jonasson & Petri Purho, *Juice it or lose it*, GDC Europe 2012. Talk: https://www.youtube.com/watch?v=Fy0aCDmgnxg. Effect toggles (freeze 0–320 ms, fade in/out, personality): https://github.com/grapefrukt/juicy-breakout/blob/master/src/com/grapefrukt/games/juicy/Settings.as
- Jan Willem Nijman, *The Art of Screenshake*, INDIGO 2013: https://www.youtube.com/watch?v=AJdEqssNZ-U. Experiments with its tips (sleep, shake, kickback, knockback): https://www.bluetengu.com/2014/12/12/art-of-screenshake-experiments/
- Celia Wagar, "Hitstop/Hitfreeze/Hitlag…" (definition, SF2 ~10 frames, Smash vibration): https://critpoints.net/2017/05/17/hitstophitfreezehitlaghitpausehitshit/
- Game Economist Consulting, "The Best Currency Animations of All-Time": https://www.gameeconomistconsulting.com/the-best-currency-animations-of-all-time/
- Machinations, "How to design idle games": https://machinations.io/articles/idle-games-and-how-to-design-them
- AFK Arena wiki, AFK Rewards Chest (visual states at 10/60/360/600 min): https://afk-arena.fandom.com/wiki/AFK_Rewards_Chest
- Legends of Idleon Steam screenshots and rubric (local, git-ignored): `docs/bar/idleon/README.md`
- OpusGameLabs `game-creator`, `game-designer` skill ("Every frame must have motion", "Frequency over subtlety", the 1–5 audit with a <4 threshold, "Hit Freeze Frame 60ms", tween-particle caps): https://github.com/OpusGameLabs/game-creator/blob/main/skills/game-designer/SKILL.md
- Anthropic, "Improving frontend design through Skills" (distributional convergence; direct attention to dimensions; avoid-lists): https://claude.com/blog/improving-frontend-design-through-skills
- Anthropic, Prompting best practices, the `<frontend_aesthetics>` snippet: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Anthropic, Claude Code best practices ("Verify UI changes visually… take a screenshot of the result and compare it to the original. list differences and fix them"; Writer/Reviewer; adversarial review subagent): https://code.claude.com/docs/en/best-practices
- Phaser, *Build a 2D Space Shooter with Phaser and Claude Code* (spec-first with AskUserQuestion, milestone builds): https://phaser.io/news/2026/02/phaser-claude-code-tutorial
- Phaser 3.90 API (verified in `node_modules/phaser/src`): `Time.Clock#timeScale`, `Tweens.TweenManager#timeScale`, `ParticleEmitter#explode`, `preFX`/`postFX` (Glow, Shine, Vignette, ColorMatrix); time concepts: https://docs.phaser.io/phaser/concepts/time; TweenManager: https://docs.phaser.io/api-documentation/class/tweens-tweenmanager
