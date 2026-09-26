// Combat juice on the 1920×1080 frame: hit-stop, pooled damage numbers, the slash
// arc, afterimages, particle bursts, loot arcs/vacuums, light pillars, text slams
// and the level-up / jackpot ceremonies. Everything is pooled or created once
// (emitters, the slash Graphics, 16 Text objects, 3 afterimages) so the hot path
// never allocates. Under prefers-reduced-motion: no shake, no slow-mo, half the
// particles, hit-stop at half duration with no jitter.

import Phaser from 'phaser'
import { FX, RARITY_COLORS, tintedTexture, isRiversideArtProfile } from './art'
import { INK, JUICE, LAYOUT as L, TYPE, fmt } from './juice'
import type { Rarity } from '../types'
import type { VisibleRect } from './ui-scene'

export type DamageKind = 'trainer' | 'crit' | 'rooster'

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter

const TEXT_POOL = 16
const AFTERIMAGES = 2
const RIVERSIDE_THEME = isRiversideArtProfile()

export class Fx {
  private readonly scene: Phaser.Scene
  private readonly font: string
  readonly reduced: boolean
  private mobileProfile: boolean

  private readonly pool: Phaser.GameObjects.Text[] = []
  private poolIdx = 0
  private dmgStack = 0
  private lastDmgAt = -99999
  private lastExp: { text: Phaser.GameObjects.Text; value: number; at: number; y: number } | null = null
  private slamActive = false
  private readonly slamQueue: Array<{ text: string; sub?: string; y: number; color: string }> = []
  private readonly ghosts: Phaser.GameObjects.Image[] = []
  private ghostIdx = 0
  private readonly slashG: Phaser.GameObjects.Graphics
  private slashTween: Phaser.Tweens.Tween | null = null
  private readonly dimRect: Phaser.GameObjects.Rectangle

  private readonly stars: Emitter
  private readonly dust: Emitter
  private readonly coins: Emitter
  private readonly confetti: Emitter
  private readonly fountain: Emitter
  private readonly feathers: Emitter

  // time control (hit-stop + slow-mo). Restored by window timers, never by
  // delayedCall — those would be frozen too.
  private freezeEnd = 0
  private slowEnd = 0
  private slowScale = 1
  private freezeTimer = 0
  private slowTimer = 0
  // world-space corner of the UI chip block (numbers stay out of it) and the
  // world camera's resting zoom (punches are relative to it)
  private noSpawnX: number = L.NO_SPAWN_X
  private noSpawnY: number = L.NO_SPAWN_Y
  private baseZoom = 1
  private visibleStage: VisibleRect = { x0: 0, y0: 0, x1: L.W, y1: L.H }
  private readonly visibleBounds = new Phaser.Geom.Rectangle()
  private readonly viewStart = new Phaser.Math.Vector2()
  private readonly viewEnd = new Phaser.Math.Vector2()

  constructor(scene: Phaser.Scene, font: string, reduced: boolean, mobile = false) {
    this.scene = scene
    this.font = font
    this.reduced = reduced
    this.mobileProfile = mobile

    for (let i = 0; i < TEXT_POOL; i++) {
      const t = scene.add
        .text(0, 0, '', { fontFamily: font, fontSize: '48px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0.5, 1)
        .setDepth(52)
        .setVisible(false)
      this.pool.push(t)
    }
    for (let i = 0; i < AFTERIMAGES; i++) {
      this.ghosts.push(scene.add.image(0, 0, FX.glow).setOrigin(0.5, 1).setDepth(24).setVisible(false))
    }
    this.slashG = scene.add.graphics().setDepth(36)
    this.dimRect = scene.add.rectangle(960, 540, 1920, 1080, INK.dim, 1).setDepth(45).setAlpha(0)

    this.stars = scene.add
      .particles(0, 0, FX.star, {
        speed: { min: 180, max: 420 },
        angle: { min: 200, max: 340 },
        gravityY: 700,
        lifespan: { min: 420, max: 640 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        rotate: { min: -180, max: 180 },
        emitting: false,
      })
      .setDepth(41)
    this.dust = scene.add
      .particles(0, 0, FX.dust, {
        speed: { min: 80, max: 220 },
        angle: { min: 200, max: 340 },
        gravityY: 260,
        lifespan: { min: 320, max: 520 },
        scale: { start: 0.7, end: 1.6 },
        alpha: { start: 0.75, end: 0 },
        tint: 0xcaa273,
        emitting: false,
      })
      .setDepth(19)
    this.coins = scene.add
      .particles(0, 0, FX.coin, {
        speed: { min: 260, max: 520 },
        angle: { min: 225, max: 315 },
        gravityY: 1200,
        lifespan: 760,
        scale: { start: 1, end: 0.5 },
        alpha: { start: 1, end: 0 },
        rotate: { min: -90, max: 90 },
        emitting: false,
      })
      .setDepth(31)
    this.confetti = scene.add
      .particles(0, 0, FX.confetti, {
        speed: { min: 300, max: 800 },
        angle: { min: 200, max: 340 },
        gravityY: 900,
        lifespan: { min: 900, max: 1400 },
        scale: { start: 1.6, end: 0.4 },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 720 },
        tint: Object.values(RARITY_COLORS),
        emitting: false,
      })
      .setDepth(47)
    this.fountain = scene.add
      .particles(0, 0, FX.star, {
        speed: { min: 420, max: 760 },
        angle: { min: 250, max: 290 },
        gravityY: 600,
        lifespan: { min: 900, max: 1300 },
        scale: { start: 1.1, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [INK.gold, INK.goldSoft, 0xffffff],
        emitting: false,
      })
      .setDepth(44)
    this.feathers = scene.add
      .particles(0, 0, FX.feather, {
        speed: { min: 120, max: 320 },
        angle: { min: 200, max: 340 },
        gravityY: 220,
        lifespan: { min: 700, max: 1100 },
        scale: { start: 1, end: 0.6 },
        alpha: { start: 1, end: 0 },
        rotate: { min: -60, max: 60 },
        accelerationX: { min: -40, max: 40 },
        emitting: false,
      })
      .setDepth(26)
  }

  setNoSpawn(x: number, y: number): void {
    this.noSpawnX = x
    this.noSpawnY = y
  }

  setMobileProfile(mobile: boolean): void {
    this.mobileProfile = mobile
  }

  private mobileSize(size: number): number {
    return this.mobileProfile ? Math.round(size * Math.sqrt(L.WORLD_ZOOM / this.baseZoom)) : size
  }

  setBaseZoom(z: number): void {
    // An in-flight punch must not restore the previous orientation's zoom after
    // the layout camera has already fitted the new viewport.
    if (Math.abs(z - this.baseZoom) > 0.0001) {
      this.scene.tweens.killTweensOf(this.scene.cameras.main)
    }
    this.baseZoom = z
  }

  setVisibleStage(rect: VisibleRect): void {
    this.visibleStage = { ...rect }
  }

  visibleWorld(): Phaser.Geom.Rectangle {
    const camera = this.scene.cameras.main
    const a = camera.getWorldPoint(this.visibleStage.x0, this.visibleStage.y0, this.viewStart)
    const b = camera.getWorldPoint(this.visibleStage.x1, this.visibleStage.y1, this.viewEnd)
    return this.visibleBounds.setTo(a.x, a.y, b.x - a.x, b.y - a.y)
  }

  /** Clear timers and restore time — call from the scene's shutdown. */
  dispose(): void {
    window.clearTimeout(this.freezeTimer)
    window.clearTimeout(this.slowTimer)
    this.freezeEnd = 0
    this.slowEnd = 0
    this.applyTimeScale()
  }

  private count(n: number): number {
    return this.reduced ? Math.max(1, Math.round(n / 2)) : n
  }

  // ------------------------------------------------------------ time control

  private applyTimeScale(): void {
    const now = performance.now()
    const s = now < this.freezeEnd ? JUICE.FREEZE_SCALE : now < this.slowEnd ? this.slowScale : 1
    if (this.scene.tweens.timeScale !== s) {
      this.scene.tweens.timeScale = s
      this.scene.time.timeScale = s
    }
  }

  /** Called every frame by the scene: a timer that fired a hair early can never leave the world stuck. */
  syncTime(): void {
    this.applyTimeScale()
  }

  /** Near-freeze for `ms` (half under reduced motion). Overlapping stops merge. */
  hitStop(ms: number): void {
    const dur = this.reduced ? ms / 2 : ms
    const now = performance.now()
    if (now + dur <= this.freezeEnd) return
    this.freezeEnd = now + dur
    this.applyTimeScale()
    window.clearTimeout(this.freezeTimer)
    this.freezeTimer = window.setTimeout(() => {
      this.freezeEnd = 0
      this.applyTimeScale()
    }, dur + 1)
  }

  get frozen(): boolean {
    return performance.now() < this.freezeEnd
  }

  /** Slow the world (tweens + clock) for `ms`. Skipped under reduced motion. */
  slowMo(scale: number, ms: number): void {
    if (this.reduced) return
    const now = performance.now()
    this.slowScale = scale
    this.slowEnd = now + ms
    this.applyTimeScale()
    window.clearTimeout(this.slowTimer)
    this.slowTimer = window.setTimeout(() => {
      this.slowEnd = 0
      this.applyTimeScale()
    }, ms + 1)
  }

  // ----------------------------------------------------------- text objects

  private acquire(): Phaser.GameObjects.Text {
    const t = this.pool[this.poolIdx++ % this.pool.length]
    this.scene.tweens.killTweensOf(t)
    t.setVisible(true).setAlpha(1).setScale(1).setAngle(0)
    return t
  }

  /**
   * Damage number AT the hit point: 64/56px (crits 1.4× with a ★), x-jittered,
   * stacked in short lanes when hits land within 700ms, drifting up and fading in
   * ~600ms. White = trainer, orange = rooster, gold = crit. Never rises into the
   * top-right chip block.
   */
  damage(x: number, y: number, value: number, kind: DamageKind): void {
    const crit = kind === 'crit'
    const miss = value <= 0
    const rawSize = this.mobileSize(crit ? Math.round(TYPE.dmgTrainer * TYPE.dmgCritMult) : kind === 'trainer' ? TYPE.dmgTrainer : TYPE.dmgRooster)
    const size = Math.round(rawSize * (RIVERSIDE_THEME && !this.mobileProfile ? 0.72 : 1))
    const color = miss ? '#aebec4' : crit ? (RIVERSIDE_THEME ? '#ffd58a' : INK.crit) : RIVERSIDE_THEME ? (kind === 'trainer' ? '#f4e6c7' : '#f2b45b') : kind === 'trainer' ? INK.trainer : INK.rooster
    const now = performance.now()
    this.dmgStack = now - this.lastDmgAt < JUICE.DMG_STACK_WINDOW ? (this.dmgStack + 1) % JUICE.DMG_STACK_MAX : 0
    this.lastDmgAt = now
    const t = this.acquire()
    t.setStyle({ fontSize: `${size}px`, color, stroke: RIVERSIDE_THEME ? '#102b43' : INK.stroke, strokeThickness: crit ? 10 : 8 })
    t.setShadow(3, 4, '#000000', 6, true, true)
    t.setText(miss ? 'MISS' : crit ? `★ ${fmt(value)}` : fmt(value))
    const view = this.visibleWorld()
    const maxTextWidth = Math.max(32, view.width - 64)
    const fit = Math.min(1, maxTextWidth / Math.max(1, t.width))
    const rise = Phaser.Math.Between(JUICE.DMG_RISE_MIN, JUICE.DMG_RISE_MAX)
    let sx = x + Phaser.Math.Between(-JUICE.DMG_JITTER_X, JUICE.DMG_JITTER_X)
    let sy = y - this.dmgStack * Math.round(size * 0.85)
    const initialScale = Math.min(fit * (crit ? 1.8 : 1.25), maxTextWidth / Math.max(1, t.width))
    const halfText = (t.width * initialScale) / 2
    sx = Phaser.Math.Clamp(sx, view.x + 32 + halfText, view.x + view.width - 32 - halfText)
    if (sx > this.noSpawnX - 80 && sy - rise - size < this.noSpawnY) {
      sx = Math.min(sx, this.noSpawnX - 80)
      sy = Math.max(sy, this.noSpawnY + rise + size)
    }
    sy = Phaser.Math.Clamp(sy, view.top + rise + size * initialScale + 16, view.bottom - 32)
    t.setPosition(sx, sy).setDepth(52).setScale(initialScale)
    if (crit) {
      this.scene.tweens.add({ targets: t, scale: fit, duration: 160, ease: 'Back.easeOut' })
      this.shake(JUICE.SHAKE_CRIT)
      this.stars.setParticleTint(INK.gold)
      this.stars.explode(this.count(6), x, y)
    } else {
      this.scene.tweens.add({ targets: t, scale: fit, duration: 120, ease: 'Back.easeOut' })
    }
    this.scene.tweens.add({ targets: t, y: sy - rise, duration: JUICE.DMG_MS, ease: 'Sine.easeOut' })
    this.scene.tweens.add({
      targets: t,
      alpha: 0,
      delay: JUICE.DMG_MS * 0.5,
      duration: JUICE.DMG_MS * 0.5,
      ease: 'Sine.easeIn',
      onComplete: () => t.setVisible(false),
    })
  }

  /**
   * "+44K EXP" in gold with a heavy outline over the killed enemy — the server's
   * credited amount. A second credit inside 600ms merges into the rising label
   * (the sum stays exact), so two kills never print a ghosted duplicate.
   */
  expPop(x: number, y: number, exp: number): void {
    const now = performance.now()
    const last = this.lastExp
    if (last && now - last.at < 600 && last.text.visible) {
      last.value += exp
      last.at = now
      const t = last.text
      this.scene.tweens.killTweensOf(t)
      t.setText(`+${fmt(last.value)} EXP`).setAlpha(1).setScale(1.3)
      this.scene.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' })
      this.scene.tweens.add({ targets: t, y: last.y - 120, duration: 900, ease: 'Sine.easeOut' })
      this.scene.tweens.add({ targets: t, alpha: 0, delay: 650, duration: 350, ease: 'Sine.easeIn', onComplete: () => t.setVisible(false) })
      return
    }
    const t = this.acquire()
    t.setStyle({ fontSize: `${this.mobileSize(TYPE.exp)}px`, color: RIVERSIDE_THEME ? '#f2b45b' : INK.exp, stroke: RIVERSIDE_THEME ? '#102b43' : INK.stroke, strokeThickness: 10 })
    t.setShadow(3, 5, '#000000', 6, true, true)
    t.setText(`+${fmt(exp)} EXP`)
    const sy = y + Phaser.Math.Between(-20, 20)
    t.setPosition(x + Phaser.Math.Between(-30, 30), sy).setDepth(53).setScale(0.7)
    this.lastExp = { text: t, value: exp, at: now, y: sy }
    this.scene.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' })
    this.scene.tweens.add({ targets: t, y: sy - 120, duration: 900, ease: 'Sine.easeOut' })
    this.scene.tweens.add({
      targets: t,
      alpha: 0,
      delay: 650,
      duration: 350,
      ease: 'Sine.easeIn',
      onComplete: () => t.setVisible(false),
    })
  }

  /** Small floating label, e.g. "+1 Paddy Rice" next to the Harvest chip. */
  tick(x: number, y: number, label: string, color: string, size: number = TYPE.lootTick): void {
    const t = this.acquire()
    t.setStyle({ fontSize: `${this.mobileSize(size)}px`, color, stroke: RIVERSIDE_THEME ? '#102b43' : INK.stroke, strokeThickness: 5 })
    t.setText(label)
    t.setPosition(x, y).setDepth(56).setScale(0.8)
    this.scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' })
    this.scene.tweens.add({ targets: t, y: y - 44, duration: 640, ease: 'Sine.easeOut' })
    this.scene.tweens.add({
      targets: t,
      alpha: 0,
      delay: 380,
      duration: 260,
      onComplete: () => t.setVisible(false),
    })
  }

  /** Big centred text slam: scale 2.4 → 1 (Back), hold, then fade while rising. */
  slam(text: string, sub?: string, y = 320, color: string = INK.cream): void {
    if (this.slamActive) {
      this.slamQueue.push({ text, sub, y, color })
      return
    }
    this.showSlam(text, sub, y, color)
  }

  private showSlam(text: string, sub: string | undefined, y: number, color: string): void {
    this.slamActive = true
    const view = this.visibleWorld()
    // Keep the ceremony in the open sky, above both hero nameplates. Use the
    // visible crop rather than the canvas edges under portrait ENVELOP scaling.
    if (RIVERSIDE_THEME) y = Math.min(300, view.top + Math.max(100, view.height * 0.22))
    const centerX = RIVERSIDE_THEME ? view.centerX : L.W / 2
    const t = this.acquire()
    t.setStyle({ fontSize: `${this.mobileSize(RIVERSIDE_THEME ? 60 : TYPE.slam)}px`, color: RIVERSIDE_THEME && color === INK.crit ? '#ffd58a' : color, stroke: RIVERSIDE_THEME ? '#102b43' : INK.stroke, strokeThickness: RIVERSIDE_THEME ? 8 : 12 })
    t.setText(text)
    const maxWidth = Math.max(180, view.width - 96)
    const fit = Math.min(1, maxWidth / Math.max(1, t.width))
    // Keep the overshoot inside the same viewport fit at every animation frame;
    // scaling only the resting state still clips long labels at the first pop.
    const startScale = this.reduced ? fit : Math.min(fit * 2.4, maxWidth / Math.max(1, t.width))
    t.setPosition(centerX, y).setDepth(70).setScale(startScale)
    this.scene.tweens.chain({
      targets: t,
      tweens: [
        { scale: fit, duration: 280, ease: 'Back.easeOut' },
        { y: y - 6, duration: 700 },
        { alpha: 0, y: y - 30, duration: 320 },
      ],
      onComplete: () => {
        t.setVisible(false)
        const next = this.slamQueue.shift()
        if (next) this.scene.time.delayedCall(100, () => this.showSlam(next.text, next.sub, next.y, next.color))
        else this.slamActive = false
      },
    })
    if (sub) {
      const s = this.acquire()
      const subSize = RIVERSIDE_THEME ? (this.mobileProfile ? 44 : 28) : TYPE.slamSub
      const subOffset = RIVERSIDE_THEME && this.mobileProfile ? 84 : 58
      s.setStyle({ fontSize: `${this.mobileSize(subSize)}px`, color: '#fff8ec', stroke: RIVERSIDE_THEME ? '#102b43' : INK.stroke, strokeThickness: RIVERSIDE_THEME ? 5 : 7 })
      s.setText(sub)
      const subFit = Math.min(1, maxWidth / Math.max(1, s.width))
      s.setPosition(centerX, y + subOffset).setDepth(70).setAlpha(0).setScale(subFit)
      this.scene.tweens.chain({
        targets: s,
        tweens: [
          { alpha: 1, duration: 200, delay: 180 },
          { y: y + subOffset - 6, duration: 620 },
          { alpha: 0, y: y + subOffset - 28, duration: 320 },
        ],
        onComplete: () => s.setVisible(false),
      })
    }
  }

  // ---------------------------------------------------------------- impacts

  /**
   * Orange slash arc (~120°, growing to r≈190) with a white core. One reusable
   * Graphics object; a new swing restarts it. `dir` 1 = swings to the right.
   */
  slash(x: number, y: number, dir = 1, scale = 1, edge = 0xff8a2a): void {
    const slashEdge = RIVERSIDE_THEME ? 0xf2b45b : edge
    this.slashTween?.remove()
    const g = this.slashG
    const half = Phaser.Math.DegToRad(JUICE.SLASH_ARC_DEG / 2)
    const a0 = dir > 0 ? -half : Math.PI - half
    const a1 = dir > 0 ? half : Math.PI + half
    this.slashTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: JUICE.SLASH_MS,
      ease: 'Cubic.easeOut',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 1
        const r = Phaser.Math.Linear(JUICE.SLASH_R0, JUICE.SLASH_R1, t) * scale
        const lw = Phaser.Math.Linear(22, 4, t) * scale
        const alpha = 1 - t * 0.85
        g.clear()
        g.lineStyle(lw + 10, slashEdge, alpha * 0.9)
        g.beginPath()
        g.arc(x, y, r, a0, a1)
        g.strokePath()
        g.lineStyle(lw, 0xffffff, alpha)
        g.beginPath()
        g.arc(x, y, r, a0, a1)
        g.strokePath()
        g.lineStyle(Math.max(2, lw * 0.4), RIVERSIDE_THEME ? 0xb8d4d4 : 0xffd24a, alpha * 0.8)
        g.beginPath()
        g.arc(x, y, r * 0.72, a0 * 0.8, a1 * 0.8)
        g.strokePath()
      },
      onComplete: () => g.clear(),
    })
  }

  /** White impact starburst on the target: snaps to ~220px, holds, then fades (~320ms total). */
  impactStar(x: number, y: number, scale = 1, tint = 0xffffff): void {
    const flash = this.scene.add.image(x, y, FX.glow).setTint(tint).setDepth(36).setScale(2 * scale).setAlpha(0.9)
    const star = this.scene.add.image(x, y, FX.star).setTint(tint).setDepth(37).setScale(1.2 * scale)
    this.scene.tweens.add({ targets: flash, scale: 6 * scale, alpha: 0, duration: JUICE.IMPACT_MS, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() })
    this.scene.tweens.chain({
      targets: star,
      tweens: [
        { scale: 4.6 * scale, angle: 45, duration: 90, ease: 'Back.easeOut' },
        { scale: 4.2 * scale, angle: 60, duration: JUICE.IMPACT_MS - 90 },
        { alpha: 0, scale: 3 * scale, angle: 90, duration: 110 },
      ],
      onComplete: () => star.destroy(),
    })
  }

  /** Dirt specks kicked up at the feet. */
  dustKick(x: number, y: number, n = 4): void {
    if (this.reduced && n > 2) n = 2
    this.dust.explode(n, x, y)
  }

  /** Two crisp afterimages in palette colours (gold, then clay) along the dash path. */
  afterimages(key: string, x0: number, y0: number, x1: number, y1: number, displayH: number, flipX = false): void {
    if (this.reduced) return
    const alphas = [0.55, 0.3]
    const keys = [tintedTexture(this.scene, key, 0xffd24a), tintedTexture(this.scene, key, 0xe08a4a)]
    for (let i = 0; i < AFTERIMAGES; i++) {
      const g = this.ghosts[this.ghostIdx++ % AFTERIMAGES]
      this.scene.tweens.killTweensOf(g)
      const t = (i + 1) / (AFTERIMAGES + 1)
      g.setTexture(keys[i])
        .setDisplaySize(displayH, displayH)
        .setPosition(Phaser.Math.Linear(x0, x1, 1 - t), Phaser.Math.Linear(y0, y1, 1 - t))
        .clearTint()
        .setAlpha(alphas[i])
        .setFlipX(flipX)
        .setVisible(true)
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 140, delay: i * 30, onComplete: () => g.setVisible(false) })
    }
  }

  /** The trainer's ranged attack: a spinning seed bag arcs to the target, then `onHit`. */
  throwBag(x0: number, y0: number, x1: number, y1: number, onHit: () => void): void {
    const bag = this.scene.add.image(x0, y0, FX.bag).setDepth(35).setScale(1.2)
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(x0, y0),
      new Phaser.Math.Vector2((x0 + x1) / 2, Math.min(y0, y1) - 160),
      new Phaser.Math.Vector2(x1, y1),
    )
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: JUICE.THROW_MS,
      ease: 'Sine.easeIn',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 1
        const p = curve.getPoint(t)
        bag.setPosition(p.x, p.y).setAngle(t * 540)
      },
      onComplete: () => {
        bag.destroy()
        this.dust.explode(this.count(4), x1, y1)
        onHit()
      },
    })
  }

  // ------------------------------------------------------------------ death

  /** Cartoon poof (no blood, ever) plus a star burst. */
  poof(x: number, y: number, size = 1): void {
    const cloud = this.scene.add.image(x, y, FX.poof).setDepth(34).setScale(0.8 * size).setAlpha(0.95)
    this.scene.tweens.add({
      targets: cloud,
      scale: 3.2 * size,
      alpha: 0,
      duration: 330,
      ease: 'Cubic.easeOut',
      onComplete: () => cloud.destroy(),
    })
    this.stars.setParticleTint(INK.goldSoft)
    this.stars.explode(this.count(10), x, y)
  }

  /** Flattened ground ring expanding from the feet (`size` ≈ final diameter px). */
  groundRing(x: number, y: number, tint: number = INK.gold, size = 520, ms = 320): void {
    const ring = this.scene.add.image(x, y, FX.ring).setTint(tint).setDepth(18).setScale(0.3, 0.3 * 0.35).setAlpha(0.95)
    const s = size / 72
    this.scene.tweens.add({
      targets: ring,
      scaleX: s,
      scaleY: s * 0.35,
      alpha: 0,
      duration: ms,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    })
  }

  /** Decorative coin sparkle on a kill (no currency exists; it is glitter). */
  coinSparkle(x: number, y: number, n = 3): void {
    this.coins.explode(this.count(n), x, y)
  }

  // ------------------------------------------------------------------- loot

  /**
   * Icon arcs out of the body to a rest point, waits (the "admire" pause), then
   * curves into the Harvest chip. Caller creates the icon and handles arrival.
   */
  lootArc(icon: Phaser.GameObjects.Image, x1: number, y1: number, onRest: () => void): void {
    const x0 = icon.x
    const y0 = icon.y
    const apex = Math.min(y0, y1) - Phaser.Math.Between(JUICE.LOOT_ARC_MIN, JUICE.LOOT_ARC_MAX) * 0.6
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(x0, y0),
      new Phaser.Math.Vector2((x0 + x1) / 2, apex),
      new Phaser.Math.Vector2(x1, y1),
    )
    const spin = Phaser.Math.Between(-200, 200)
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: JUICE.LOOT_ARC_MS,
      ease: 'Sine.easeOut',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 1
        const p = curve.getPoint(t)
        icon.setPosition(p.x, p.y).setAngle(spin * (1 - t))
      },
      onComplete: () => {
        icon.setAngle(0)
        // a tiny settle bounce so the rest reads as a landing
        this.scene.tweens.add({ targets: icon, y: y1 - 14, duration: 110, yoyo: true, ease: 'Quad.easeOut' })
        onRest()
      },
    })
  }

  /** Fly an object along a curve into (tx, ty), shrinking to 0.45, then call back. */
  vacuum(obj: Phaser.GameObjects.Image, tx: number, ty: number, onArrive: () => void, delay = 0): void {
    const x0 = obj.x
    const y0 = obj.y
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(x0, y0),
      new Phaser.Math.Vector2((x0 + tx) / 2 + Phaser.Math.Between(-120, 120), Math.min(y0, ty) - 200),
      new Phaser.Math.Vector2(tx, ty),
    )
    const s0 = obj.scaleX
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: JUICE.LOOT_FLY,
      delay,
      ease: 'Cubic.easeIn',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 1
        const p = curve.getPoint(t)
        obj.setPosition(p.x, p.y).setScale(Phaser.Math.Linear(s0, s0 * 0.45, t))
      },
      onComplete: () => {
        obj.destroy()
        onArrive()
      },
    })
  }

  // ----------------------------------------------------------- personality

  /** A few cream feathers on the idle ruffle — grooming, kept small. */
  featherPuff(x: number, y: number, n = 2): void {
    this.feathers.explode(this.count(n), x, y)
  }

  /** Golden sparkle burst (rooster crits, chirps, crows) — flair, never shed feathers. */
  sparkle(x: number, y: number, n = 6, tint: number = INK.gold): void {
    this.stars.setParticleTint(tint)
    this.stars.explode(this.count(n), x, y)
  }

  /** Emote glyph (♪ ! ♥ ✦) that pops above a head, holds, then fades. */
  emote(x: number, y: number, glyph: string, color: string = INK.cream): void {
    const t = this.acquire()
    t.setStyle({ fontSize: '64px', color, stroke: RIVERSIDE_THEME ? '#102b43' : INK.stroke, strokeThickness: 8 })
    t.setText(glyph)
    t.setPosition(x, y).setDepth(53).setScale(0)
    this.scene.tweens.chain({
      targets: t,
      tweens: [
        { scale: 1, duration: 160, ease: 'Back.easeOut' },
        { y: y - 16, duration: 700 },
        { alpha: 0, y: y - 40, duration: 240 },
      ],
      onComplete: () => t.setVisible(false),
    })
  }

  /** Speech bubble ("Cock-a-doodle-doo!") with three sound-wave arcs from the beak. */
  speech(x: number, y: number, text: string, ms = 1400): void {
    const bubble = this.scene.add.container(x, y).setDepth(53).setScale(0)
    const back = this.scene.add.image(0, 0, FX.bubble).setOrigin(0.15, 1)
    const label = this.scene.add
      .text(back.x + 240 * 0.35, -66, text, {
        fontFamily: this.font,
        fontSize: '30px',
        fontStyle: 'bold',
        color: INK.stroke,
      })
      .setOrigin(0.5, 0.5)
    const w = Math.max(240, label.width + 48)
    back.setDisplaySize(w, 120)
    label.setX(w * 0.35)
    bubble.add([back, label])
    this.scene.tweens.chain({
      targets: bubble,
      tweens: [
        { scale: 1, duration: 200, ease: 'Back.easeOut' },
        { y: y - 8, duration: ms },
        { alpha: 0, scale: 0.8, duration: 200, ease: 'Cubic.easeIn' },
      ],
      onComplete: () => bubble.destroy(),
    })
    if (this.reduced) return
    const g = this.scene.add.graphics().setDepth(52)
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 900,
      repeat: 1,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0
        g.clear()
        for (let i = 0; i < 3; i++) {
          const r = 30 + i * 26 + t * 40
          g.lineStyle(6 - i, 0xffffff, (1 - t) * (0.9 - i * 0.2))
          g.beginPath()
          g.arc(x + 40, y + 30, r, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(40))
          g.strokePath()
        }
      },
      onComplete: () => g.destroy(),
    })
  }

  // ------------------------------------------------------------- ceremonies

  /** Vertical light pillar rising from the feet (tinted). Additive on WebGL. */
  pillar(x: number, feetY: number, tint: number = INK.gold, height = 1080, ms: number = JUICE.PILLAR_MS): void {
    const p = this.scene.add
      .image(x, feetY + 10, FX.pillar)
      .setOrigin(0.5, 1)
      .setTint(tint)
      .setDepth(40)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(200, height)
      .setAlpha(0)
    const sx = p.scaleX
    p.setScale(sx * 0.2, p.scaleY)
    this.scene.tweens.chain({
      targets: p,
      tweens: [
        { scaleX: sx, alpha: 0.85, duration: ms * 0.3, ease: 'Cubic.easeOut' },
        { scaleX: sx * 1.1, alpha: 0.7, duration: ms * 0.35 },
        { scaleX: 0, alpha: 0, duration: ms * 0.35, ease: 'Cubic.easeIn' },
      ],
      onComplete: () => p.destroy(),
    })
  }

  /** Dim overlay (depth 45) to `alpha` over `ms`. */
  dim(alpha: number, ms: number): void {
    this.scene.tweens.killTweensOf(this.dimRect)
    this.scene.tweens.add({ targets: this.dimRect, alpha, duration: ms })
  }

  flash(ms = 250, r = 255, g = 240, b = 200): void {
    this.scene.cameras.main.flash(this.reduced ? ms / 2 : ms, r, g, b)
  }

  shake(spec: readonly [number, number]): void {
    if (this.reduced) return
    this.scene.cameras.main.shake(spec[0], spec[1])
  }

  /**
   * Camera zoom punch as a yoyo tween on camera.zoom. (A zoomTo whose callback
   * nested a second zoomTo left the camera stuck at 1.08 — the outer effect's
   * completion reset the inner one — which cropped every edge of the stage.)
   */
  zoomPunch(zoom = 1.06, inMs = 180, outMs = 420): void {
    if (this.reduced) return
    const cam = this.scene.cameras.main
    const base = this.baseZoom
    this.scene.tweens.killTweensOf(cam)
    cam.setZoom(base)
    this.scene.tweens.chain({
      targets: cam,
      tweens: [
        { zoom: base * zoom, duration: inMs, ease: 'Sine.easeOut' },
        { zoom: base, duration: outMs, ease: 'Sine.easeInOut' },
      ],
      onComplete: () => cam.setZoom(base),
    })
  }

  confettiBurst(x: number, y: number, n = 40): void {
    this.confetti.explode(this.count(n), x, y)
  }

  /**
   * Level-up ceremony at the actor's feet: slow-mo, a gold light pillar, two
   * staggered rings, an upward gold fountain and the "LEVEL UP!" slam.
   */
  levelUp(x: number, feetY: number, label: string, sub?: string, small = false): void {
    this.slowMo(JUICE.LEVELUP_SLOWMO, JUICE.LEVELUP_SLOWMO_MS)
    this.pillar(x, feetY, INK.gold, small ? 760 : 1080)
    this.groundRing(x, feetY, INK.gold, small ? 420 : 560)
    this.scene.time.delayedCall(120, () => this.groundRing(x, feetY, INK.goldSoft, small ? 520 : 720, 420))
    this.fountain.explode(this.count(small ? 16 : 24), x, feetY - 40)
    this.slam(label, sub, small ? 460 : 420, INK.crit)
    this.shake(JUICE.SHAKE_KILL)
    this.zoomPunch(1.06, 300, 420)
  }

  /**
   * Mintable-drop jackpot at the kill spot: ~1s slow-mo, dim, a pillar in the
   * rarity colour, a ground ring and the item rising in a glow. No card flip, no
   * pack — the React toast carries the words.
   */
  jackpot(x: number, feetY: number, itemKey: string, rarity: Rarity, flyTo?: { x: number; y: number; onArrive: () => void }): void {
    const color: number = RARITY_COLORS[rarity] ?? INK.gold
    this.slowMo(JUICE.JACKPOT_SLOWMO, JUICE.JACKPOT_SLOWMO_MS)
    this.dim(0.3, 200) // a light dim only: the playfield stays readable under the beam
    this.pillar(x, feetY, color, 1080, 1400)
    this.groundRing(x, feetY, color, 640, 420)
    this.flash(200, 255, 245, 220)
    this.shake(JUICE.SHAKE_KILL)

    const glow = this.scene.add.image(x, feetY - 120, FX.glow).setTint(color).setAlpha(0).setDepth(46).setScale(3)
    const icon = this.scene.add.image(x, feetY - 120, itemKey).setDepth(47)
    const s = 140 / icon.width // display the item at 140px
    icon.setScale(0)
    this.scene.tweens.add({ targets: glow, alpha: 0.8, scale: 6, duration: 420, ease: 'Cubic.easeOut' })
    this.scene.tweens.add({ targets: glow, angle: 360, duration: 4000, repeat: -1 })
    // pops out of the enemy, holds a beat under the beam, then flies to the HUD's
    // Rare drops button (screen edge) — or fades if no target was given
    this.scene.tweens.chain({
      targets: icon,
      tweens: [
        { scale: s, y: feetY - 360, duration: 480, ease: 'Back.easeOut' },
        { y: feetY - 380, duration: 900, ease: 'Sine.easeInOut' },
      ],
      onComplete: () => {
        glow.destroy()
        if (flyTo) {
          this.vacuum(icon, flyTo.x, flyTo.y, flyTo.onArrive)
        } else {
          this.scene.tweens.add({ targets: icon, scale: s * 0.3, y: feetY - 520, alpha: 0, duration: 420, ease: 'Cubic.easeIn', onComplete: () => icon.destroy() })
        }
      },
    })
    this.scene.tweens.add({ targets: glow, alpha: 0, delay: 1400, duration: 420 })
    this.stars.setParticleTint(color)
    this.stars.explode(this.count(14), x, feetY - 200)
    this.scene.time.delayedCall(1000, () => this.dim(0, 300))
  }
}
