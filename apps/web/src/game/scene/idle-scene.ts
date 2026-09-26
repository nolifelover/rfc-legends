// The Home Fields idle combat scene — 1920×1080, Phaser 3.
//
// Presentation of the server-authoritative fight: packs of 5–8 cartoon pests
// advance from the right on two depth rows, the trainer and the rooster alternate
// swings (a hit lands every 0.5–0.8s, a kill every ~1s in demo mode), and the
// MVP Rat King arrives with a ceremony every 8th kill (25th outside demo mode).
//
// Truth rules (nothing on screen invents a server number):
// - Every sync turns the server's kill delta and EXP delta into kill credits (one
//   per server kill, the EXP split evenly across them; a backlog folds into one).
//   A visual kill that finds a credit ticks the KILL chip, prints that credit's
//   EXP and drains one loot icon; a visual kill without credit only poofs. So the
//   KILL chip is ≤ killCount and the EXP pops sum to the real EXP gained.
// - Harvest chip: Σ non-consumable inventory. Every icon that flies into it is one
//   unit the server actually granted (inventory diff between syncs).
// - The boss appears when the server is fighting it (killCount % 8 === 7 in demo
//   mode) and dies when the server's count crosses the boss kill — so the rare-card
//   toast lands on the boss's death, not on a random pest.
// - Level-ups and rare-drop jackpots fire only on server state changes. Dev keys
//   (non-production) trigger FX only and never a server drop.

import Phaser from 'phaser'
import {
  ART,
  CLOUD_KEYS,
  FX,
  MONSTER_KEYS,
  RARITY_COLORS,
  ROOSTER_KEYS,
  TRAINER_KEY,
  TRAINER_WALK_KEY,
  PENDING_SVG,
  ensureFallbacks,
  itemKey,
  makeFxTextures,
  tintedTexture,
} from './art'
import { BossBar, BossPips, Chip, HpBar, Nameplate, Ribbon, tierOf } from './overlays'
import type { Tier } from './overlays'
import { Fx } from './fx'
import type { DamageKind } from './fx'
import { INK, JUICE, LAYOUT as L, SIRE_TINT, TYPE, zoneOf } from './juice'
import type { ZoneSpec } from './juice'
import type { SceneBridge, SceneMountOptions } from './scene-bridge'
import { MAPS, THUNG_NA } from '@/game/data/maps'
import type { MapDef } from '@/game/types'
import { getItem } from '@/game/data/items'
import type { Drop, MonsterDef, Player, Rarity } from '@/game/types'
import { aspdOf, atkOf, critChance, expToNext, roosterAspd, roosterAtk, roosterCrit } from '@/server/game/stats'

const MINTABLE: readonly Rarity[] = ['legendary', 'monster_card', 'mvp_card']
const DEV = process.env.NODE_ENV !== 'production'

type Row = 0 | 1 | 2 // 0 = back lane (smallest, behind), 1 = middle, 2 = front

interface Pest {
  def: MonsterDef
  row: Row
  slot: number
  hp: number
  maxHp: number
  container: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Image
  plate: Nameplate
  bar: HpBar
  /** display height (front-row size; the container scale handles the back row) */
  h: number
  baseX: number
  feetY: number
  ready: boolean
  boss: boolean
  dead: boolean
  walk: Phaser.Tweens.Tween | null
  hop: Phaser.Tweens.Tween | null
  knock: Phaser.Tweens.Tween | Phaser.Tweens.TweenChain | null
  squash: Phaser.Tweens.Tween | null
}

interface LootEntry {
  id: number
  n: number
}

const ROWS: readonly Row[] = [0, 1, 2]
const ROW_FEET: Record<Row, number> = { 0: L.FEET_BACK, 1: L.FEET_MID, 2: L.FEET_FRONT }
const ROW_ENGAGE: Record<Row, number> = { 0: L.ENGAGE_BACK_X, 1: L.ENGAGE_MID_X, 2: L.ENGAGE_FRONT_X }
const ROW_SCALE: Record<Row, number> = { 0: L.BACK_SCALE, 1: L.MID_SCALE, 2: 1 }
const ROW_DEPTH: Record<Row, number> = { 0: 21, 1: 22, 2: 23 }

export class IdleScene extends Phaser.Scene {
  private bridge!: SceneBridge
  private opts!: SceneMountOptions
  private fx!: Fx
  private font = 'Arial'
  private reduced = false

  private player!: Player
  private dropIds = new Set<string>()
  private demoMode = false
  /** the server's current map and its visual variant */
  private map: MapDef = THUNG_NA
  private zone: ZoneSpec = zoneOf(THUNG_NA.id)
  private zoneArt: {
    sky?: Phaser.GameObjects.Image
    hills?: Phaser.GameObjects.Image
    paddy?: Phaser.GameObjects.Image
    ground?: Phaser.GameObjects.Image
    grade?: Phaser.GameObjects.Rectangle
    lotus: Phaser.GameObjects.Image[]
    walkway: Phaser.GameObjects.Image[]
    shimmers: Phaser.GameObjects.Image[]
  } = { lotus: [], walkway: [], shimmers: [] }

  // kill credits (server kills not yet shown; EXP is the server's real delta)
  private killServer = 0
  private killShown = 0
  private credits: Array<{ exp: number; kills: number; coins: number }> = []
  private syncLog: Array<{ t: number; kills: number }> = []
  private forceBoss = false

  // chips
  private killChip!: Chip
  private harvestChip!: Chip
  /** เบี้ย (coins) — shown only once the server state carries a `coins` field. */
  private coinChip!: Chip
  private coinsShown = 0
  private coinsKnown = false
  private pips!: BossPips
  private harvestShown = 0
  private pendingLoot: LootEntry[] = []
  /** units drained from the queue but not yet arrived at the chip */
  private lootFlying = 0

  // heroes
  private trainer!: Phaser.GameObjects.Container
  /** inner body: the sprite plus its tier gear, so lunges, swings and flips carry the gear */
  private trainerBody!: Phaser.GameObjects.Container
  private trainerSprite!: Phaser.GameObjects.Image
  private trainerPlate!: Nameplate
  private trainerBob: Phaser.Tweens.Tween | null = null
  private trainerChain: Phaser.Tweens.TweenChain | null = null
  private trainerLook = false
  private rooster!: Phaser.GameObjects.Container
  private roosterBody!: Phaser.GameObjects.Container
  private roosterSprite!: Phaser.GameObjects.Image
  private roosterKey = ROOSTER_KEYS.thepbut
  private roosterPlate!: Nameplate
  private roosterAura!: Phaser.GameObjects.Image
  private roosterBob: Phaser.Tweens.Tween | null = null
  private roosterChain: Phaser.Tweens.TweenChain | null = null
  private roosterPulse: Phaser.Tweens.Tween | null = null
  private roosterHot = false
  private roosterIdle: Phaser.Tweens.Tween | Phaser.Tweens.TweenChain | null = null
  /** level-tiered power overlays (rebuilt when a tier changes) */
  private roosterPower: Phaser.GameObjects.GameObject[] = []
  private trainerPower: Phaser.GameObjects.GameObject[] = []
  private roosterTier: Tier | null = null
  private trainerTier: Tier | null = null
  /** "Cheer" tap: the next 3 rooster swings come 1.5× faster (cosmetic), 20s cooldown. */
  private cheerBoostLeft = 0
  private cheerReadyAt = 0

  // pack
  private pests: Pest[] = []
  private packTarget: number = L.PACK_MIN
  private nextSpawnAt = 0
  private nextPackRollAt = 0
  private victim: Pest | null = null
  /** the pest whose plate and HP bar are shown — the one being attacked right now */
  private focus: Pest | null = null
  private bossShadow: Phaser.GameObjects.Image | null = null
  private lastKillX: number = L.ENGAGE_FRONT_X
  private lastKillY: number = L.FEET_FRONT

  // living scene
  private dayTint!: Phaser.GameObjects.Rectangle
  private fireflies: Phaser.GameObjects.Particles.ParticleEmitter | null = null

  // boss — driven by the server: kill #8 (demo) / #25 is the MVP, so the server is
  // fighting the boss while killCount % every === every − 1
  private bossActive = false
  private bossServerDead = false
  private bossBar: BossBar | null = null
  private bossDim!: Phaser.GameObjects.Rectangle
  private nextBossAt = 0

  // cadence
  private trainerCd = 1300
  private roosterCd = 1300
  private nextTrainerAt = 0
  private nextRoosterAt = 0
  private hitsToKill = 2
  private lastJackpotAt = -99999
  private lastSparkleAt = 0

  constructor() {
    super('idle')
  }

  init(data: { bridge: SceneBridge; opts: SceneMountOptions }): void {
    this.bridge = data.bridge
    this.opts = data.opts
  }

  preload(): void {
    for (const spec of ART) {
      if (PENDING_SVG.has(spec.key)) continue // drawn fallback, no 404 in the console
      this.load.svg(spec.key, spec.url, { width: spec.w, height: spec.h })
    }
  }

  create(): void {
    this.font = this.opts.fontFamily
    this.reduced = this.opts.reducedMotion
    this.demoMode = this.opts.demoMode
    this.player = this.opts.player
    this.map = MAPS[this.player.mapId] ?? THUNG_NA
    this.zone = zoneOf(this.map.id)
    for (const d of this.opts.drops) this.dropIds.add(d.dropId)
    this.killServer = this.player.killCount
    this.killShown = this.player.killCount
    this.harvestShown = this.countInventory(this.player)

    ensureFallbacks(this)
    makeFxTextures(this) // before Fx: its emitters bind these textures
    this.fx = new Fx(this, this.font, this.reduced)
    this.buildBackground()
    this.buildAmbient()
    this.buildActors()
    this.buildChips()
    this.tuneCadence()
    if (DEV) this.bindDevKeys()

    this.packTarget = Phaser.Math.Between(L.PACK_MIN, L.PACK_MAX)
    this.nextPackRollAt = this.time.now + 20000
    // seed the stage: pests already mid-walk so the first frame is a fight
    for (let i = 0; i < 5; i++) this.spawnPest(ROWS[i % 3], 700 + i * 220)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.fx.dispose())
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.fx.dispose())

    this.bridge.sceneReady({
      updateState: (player, drops, demoMode) => this.applyState(player, drops, demoMode),
      destroy: () => this.game.destroy(true),
    })
  }

  // ---------------------------------------------------------------- background

  private buildBackground(): void {
    this.zoneArt.sky = this.add.image(0, 0, 'art-sky').setOrigin(0, 0).setDepth(0)

    const clouds: Array<[string, number, number, number, number, number]> = [
      [CLOUD_KEYS.stratus, -300, 70, 1.1, 0.8, 120000],
      [CLOUD_KEYS.puffy, 700, 110, 1.2, 0.9, 88000],
      [CLOUD_KEYS.tower, 1500, 60, 0.95, 0.75, 100000],
      [CLOUD_KEYS.puffy, 1100, 40, 0.8, 0.7, 140000],
    ]
    for (const [key, x, y, s, a, dur] of clouds) {
      const cloud = this.add.image(x, y, key).setOrigin(0, 0.5).setDepth(2).setScale(s).setAlpha(a)
      this.tweens.add({
        targets: cloud,
        x: L.W + 120,
        duration: dur,
        repeat: -1,
        onRepeat: () => cloud.setX(-520 + Phaser.Math.Between(-60, 60)),
      })
    }

    // hills → paddy → ground, back to front. The camera sits low: sky ≤ 20%,
    // horizon at 35%, and the clay lane owns the bottom 40% of the frame.
    // hills drawn 1.2x tall so their ridges climb into the sky band
    const hills = this.add.image(0, L.HORIZON_Y - 400, 'art-hills').setOrigin(0, 0).setDepth(4).setDisplaySize(L.W, 480)
    const paddy = this.add.image(0, L.HORIZON_Y, 'art-paddy').setOrigin(0, 0).setDepth(6)
    this.zoneArt.hills = hills
    this.zoneArt.paddy = paddy
    // breathing parallax: the far layers drift a few px on an 8s sine
    if (!this.reduced) {
      this.tweens.add({ targets: hills, x: -6, duration: 8000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.tweens.add({ targets: paddy, x: -3, duration: 8000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 2000 })
    }

    const shimmers: Array<[number, number, number, number]> = [
      [260, L.HORIZON_Y + 34, 2.6, 0],
      [840, L.HORIZON_Y + 60, 2.2, 400],
      [1400, L.HORIZON_Y + 30, 3, 800],
      [520, L.HORIZON_Y + 80, 2.4, 200],
      [1750, L.HORIZON_Y + 70, 2.2, 600],
      [1100, L.HORIZON_Y + 24, 2.8, 1000],
      [80, L.HORIZON_Y + 66, 2, 300],
      [1600, L.HORIZON_Y + 52, 2.4, 1300],
    ]
    for (const [x, y, s, delay] of shimmers) {
      const sh = this.add.image(x, y, FX.shimmer).setDepth(7).setScale(s, s * 0.9).setAlpha(0)
      this.zoneArt.shimmers.push(sh)
      this.tweens.add({
        targets: sh,
        alpha: { from: 0, to: 0.85 },
        x: x + 50,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        delay,
        ease: 'Sine.easeInOut',
      })
    }

    // props on the paddy edge (out of the fight lane, left side only)
    this.add.image(300, L.GROUND_Y + 8, 'art-prop-scarecrow').setOrigin(0.5, 1).setDepth(8).setScale(1.05)
    this.add.image(150, L.GROUND_Y + 4, 'art-prop-rice-bundle').setOrigin(0.5, 1).setDepth(8)

    const ground = this.add.image(0, L.GROUND_Y, 'art-ground').setOrigin(0, 0).setDepth(10)
    ground.setDisplaySize(L.W, 300)
    this.zoneArt.ground = ground
    this.add.rectangle(0, L.GROUND_Y + 298, L.W, L.H - L.GROUND_Y - 298 + 2, 0xb96f44).setOrigin(0, 0).setDepth(10)
    this.add.rectangle(0, L.H - 46, L.W, 46, 0x9c5a35, 0.55).setOrigin(0, 0).setDepth(10)

    // one warm grade over the whole backdrop; actors above it keep full saturation
    this.zoneArt.grade = this.add.rectangle(0, 0, L.W, L.H, INK.grade, 0.14).setOrigin(0, 0).setDepth(11)
    // time of day: morning → noon → golden hour → dusk over 6 real minutes (backdrop only)
    this.dayTint = this.add.rectangle(0, 0, L.W, L.H, 0xfff1d6, 0.1).setOrigin(0, 0).setDepth(11)
    // boss-fight darkening lives just above the grade and below every actor
    this.bossDim = this.add.rectangle(0, 0, L.W, L.H, INK.outline, 1).setOrigin(0, 0).setDepth(12).setAlpha(0)

    // frame-edge props in the lane, behind the actors
    this.add.image(150, L.H - 40, 'art-prop-hay-bale').setOrigin(0.5, 1).setDepth(13).setScale(1.15)
    this.add.image(1800, L.H - 32, 'art-prop-water-jar').setOrigin(0.5, 1).setDepth(13).setScale(1.1)
  }

  /** Ambient life in the dead band: swaying rice, bird flocks, pollen. */
  private buildAmbient(): void {
    for (let i = 0; i < 14; i++) {
      const x = 40 + i * 140 + Phaser.Math.Between(-30, 30)
      const tuft = this.add
        .image(x, L.GROUND_Y + 14, FX.tuft)
        .setOrigin(0.5, 1)
        .setDepth(9)
        .setScale(0.9 + Math.random() * 0.4)
      this.tweens.add({
        targets: tuft,
        angle: { from: -6, to: 6 },
        duration: Phaser.Math.Between(1800, 2600),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1200),
        ease: 'Sine.easeInOut',
      })
    }
    // far row of tufts on the bund line, smaller
    for (let i = 0; i < 12; i++) {
      const x = 90 + i * 165
      const tuft = this.add.image(x, L.HORIZON_Y + 176, FX.tuft).setOrigin(0.5, 1).setDepth(7).setScale(0.55)
      this.tweens.add({
        targets: tuft,
        angle: { from: 5, to: -5 },
        duration: Phaser.Math.Between(2000, 2800),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1400),
        ease: 'Sine.easeInOut',
      })
    }

    // pollen motes drifting across the paddy band
    this.add
      .particles(0, 0, FX.glow, {
        x: { min: 0, max: L.W },
        y: { min: L.HORIZON_Y + 40, max: L.GROUND_Y + 60 },
        lifespan: 6000,
        speedX: { min: 8, max: 26 },
        speedY: { min: -8, max: 8 },
        scale: { start: 0.25, end: 0.45 },
        alpha: { start: 0, end: 0.55, ease: 'Sine.easeInOut' },
        tint: INK.goldSoft,
        frequency: this.reduced ? 900 : 450,
        maxAliveParticles: this.reduced ? 7 : 14,
      })
      .setDepth(16)

    this.scheduleFlock()
    this.buildKite()
    this.startDayCycle()
    this.buildForeground()
    this.buildButterflies()
    // lotus pads (pink and white) on the water band, and a wooden walkway along
    // the pond's edge (บึงบัวหลวง only)
    for (let i = 0; i < 9; i++) {
      const lotus = this.add
        .image(90 + i * 215 + Phaser.Math.Between(-40, 40), L.HORIZON_Y + 36 + (i % 2) * 44, i % 3 === 1 ? FX.lotusWhite : FX.lotus)
        .setDepth(7)
        .setScale(0.75 + (i % 3) * 0.12)
        .setVisible(false)
      this.tweens.add({ targets: lotus, y: lotus.y - 4, duration: 2200 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.zoneArt.lotus.push(lotus)
    }
    for (let i = 0; i < 9; i++) {
      const plank = this.add.image(i * 240, L.GROUND_Y + 22, FX.walkway).setOrigin(0, 0.5).setDepth(9).setVisible(false)
      this.zoneArt.walkway.push(plank)
    }
    this.applyZone()
  }

  /** Tint the backdrop and toggle props for the server's current zone. */
  private applyZone(): void {
    const z = this.zone
    const a = this.zoneArt
    // baked tints (not setTint) so the palette shows on the Canvas renderer too
    a.sky?.setTexture(tintedTexture(this, 'art-sky', z.skyTint))
    a.hills?.setTexture(tintedTexture(this, 'art-hills', z.hillsTint)).setDisplaySize(L.W, 480)
    a.paddy?.setTexture(tintedTexture(this, 'art-paddy', z.paddyTint))
    a.ground?.setTexture(tintedTexture(this, 'art-ground', z.groundTint)).setDisplaySize(L.W, 300)
    a.grade?.setFillStyle(z.grade, z.gradeAlpha)
    for (const l of a.lotus) l.setVisible(z.lotus)
    for (const w of a.walkway) w.setVisible(z.walkway)
    for (const s of a.shimmers) s.setTexture(tintedTexture(this, FX.shimmer, z.glint))
  }

  /** Foreground rice stalks along the bottom edge (in front of the lane, below the plates) and drifting chaff. */
  private buildForeground(): void {
    const xs = [30, 120, 210, 330, 470, 620, 790, 980, 1160, 1340, 1500, 1640, 1760, 1860]
    xs.forEach((x, i) => {
      const edge = x < 500 || x > 1450
      const tuft = this.add
        .image(x + Phaser.Math.Between(-20, 20), L.H + 14, FX.tuft)
        .setOrigin(0.5, 1)
        .setDepth(27)
        .setScale(edge ? Phaser.Math.FloatBetween(2.6, 3.2) : Phaser.Math.FloatBetween(1.8, 2.2))
        .setAlpha(edge ? 1 : 0.92)
        .setFlipX(i % 2 === 0)
      this.tweens.add({
        targets: tuft,
        angle: { from: -4, to: 4 },
        duration: Phaser.Math.Between(2200, 3200),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1500),
        ease: 'Sine.easeInOut',
      })
    })
    this.add
      .particles(0, 0, FX.chaff, {
        x: { min: -40, max: L.W },
        y: { min: L.HORIZON_Y, max: L.H },
        lifespan: 7000,
        speedX: { min: 24, max: 70 },
        speedY: { min: 4, max: 26 },
        scale: { min: 0.6, max: 1.1 },
        alpha: { start: 0, end: 0.55, ease: 'Sine.easeInOut' },
        rotate: { min: 0, max: 360 },
        tint: 0xe9d29a,
        frequency: this.reduced ? 700 : 320,
        maxAliveParticles: this.reduced ? 10 : 22,
      })
      .setDepth(28)
  }

  /** Two butterflies wander the paddy band, flapping. */
  private buildButterflies(): void {
    for (let i = 0; i < 2; i++) {
      const b = this.add
        .image(Phaser.Math.Between(200, 1700), Phaser.Math.Between(L.HORIZON_Y + 60, L.GROUND_Y - 20), FX.butterfly)
        .setDepth(16)
        .setScale(1.3)
      this.tweens.add({ targets: b, scaleX: { from: 1.3, to: 0.35 }, duration: 130, yoyo: true, repeat: -1, delay: i * 60 })
      const wander = (): void => {
        this.tweens.add({
          targets: b,
          x: Phaser.Math.Clamp(b.x + Phaser.Math.Between(-320, 320), 160, 1760),
          y: Phaser.Math.Clamp(b.y + Phaser.Math.Between(-90, 90), L.HORIZON_Y + 50, L.GROUND_Y + 40),
          duration: Phaser.Math.Between(2200, 3800),
          ease: 'Sine.easeInOut',
          onComplete: wander,
        })
      }
      wander()
    }
  }

  /** A kite sways in the upper band, its string running down to the horizon. */
  private buildKite(): void {
    // top-left band: clear of the boss bar (centre) and the chips (right)
    const kx = 250
    const ky = 150
    const kite = this.add.image(kx, ky, FX.kite).setDepth(3).setScale(0.9)
    const string = this.add.graphics().setDepth(3)
    const drawString = (): void => {
      string.clear()
      string.lineStyle(2, 0x5a4636, 0.7)
      string.beginPath()
      string.moveTo(kite.x - 8, kite.y + 60)
      string.lineTo(560, L.HORIZON_Y + 40)
      string.strokePath()
    }
    drawString()
    if (this.reduced) return
    this.tweens.add({
      targets: kite,
      angle: { from: -8, to: 8 },
      x: { from: kx - 10, to: kx + 10 },
      y: { from: ky + 6, to: ky - 6 },
      duration: 3200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: drawString,
    })
  }

  /**
   * Backdrop light over 6 real minutes: morning cream → clear noon → golden hour →
   * violet dusk with fireflies, cross-faded through the depth-11 tint rect.
   */
  private startDayCycle(): void {
    const keys: Array<{ at: number; color: number; alpha: number }> = [
      { at: 0, color: 0xfff1d6, alpha: 0.1 },
      { at: 0.25, color: 0xfff1d6, alpha: 0 },
      { at: 0.55, color: 0xffb36b, alpha: 0.18 },
      { at: 0.8, color: 0x6d5ba8, alpha: 0.22 },
      { at: 1, color: 0xfff1d6, alpha: 0.1 },
    ]
    this.fireflies = this.add
      .particles(0, 0, FX.glow, {
        x: { min: 200, max: L.W - 200 },
        y: { min: L.HORIZON_Y + 60, max: L.GROUND_Y + 120 },
        lifespan: 3200,
        speedX: { min: -20, max: 20 },
        speedY: { min: -24, max: 6 },
        scale: { start: 0.18, end: 0.3 },
        alpha: { start: 0, end: 0.9, ease: 'Sine.easeInOut' },
        tint: 0xd9f27a,
        frequency: 380,
        maxAliveParticles: 10,
        emitting: false,
      })
      .setDepth(17)
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 360000,
      repeat: -1,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0
        let i = 0
        while (i < keys.length - 2 && t > keys[i + 1].at) i++
        const a = keys[i]
        const b = keys[i + 1]
        const f = Phaser.Math.Clamp((t - a.at) / (b.at - a.at), 0, 1)
        const ca = Phaser.Display.Color.IntegerToColor(a.color)
        const cb = Phaser.Display.Color.IntegerToColor(b.color)
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, f * 100)
        this.dayTint.setFillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), Phaser.Math.Linear(a.alpha, b.alpha, f))
        const dusk = t > 0.7 && t < 0.95
        if (this.fireflies && this.fireflies.emitting !== dusk) this.fireflies.emitting = dusk
      },
    })
  }

  private scheduleFlock(): void {
    this.time.addEvent({
      delay: Phaser.Math.Between(8000, 12000),
      callback: () => {
        const n = Phaser.Math.Between(3, 5)
        const y = Phaser.Math.Between(70, 200)
        const dur = Phaser.Math.Between(9000, 13000)
        for (let i = 0; i < n; i++) {
          const off = i - (n - 1) / 2
          const bird = this.add
            .image(-120 - Math.abs(off) * 50, y + Math.abs(off) * 26, FX.bird)
            .setDepth(3)
            .setScale(2.2)
            .setAlpha(0.85)
          this.tweens.add({ targets: bird, scaleY: { from: 2.2, to: 1 }, duration: 170, yoyo: true, repeat: -1, delay: i * 40 })
          this.tweens.add({
            targets: bird,
            x: L.W + 140,
            y: bird.y + Phaser.Math.Between(-40, 40),
            duration: dur,
            ease: 'Sine.easeInOut',
            onComplete: () => bird.destroy(),
          })
        }
        this.scheduleFlock()
      },
    })
  }

  // ------------------------------------------------------------------- actors

  private buildActors(): void {
    // trainer: container at the feet, sprite inside so attack tweens are relative
    this.trainer = this.add.container(L.TRAINER_X, L.TRAINER_FEET).setDepth(24)
    this.trainerBody = this.add.container(0, 0)
    this.trainerSprite = this.add.image(0, 0, TRAINER_KEY).setOrigin(0.5, 1).setDisplaySize(L.TRAINER_H, L.TRAINER_H)
    this.trainerBody.add(this.trainerSprite)
    this.trainer.add(this.trainerBody)
    this.trainerPlate = new Nameplate(this, this.trainerLabel(), { fontFamily: this.font, fontSize: TYPE.plateTrainer })
    this.trainerPlate.place(L.TRAINER_X, L.TRAINER_FEET - L.TRAINER_H - 64)
    this.startTrainerBob()
    // breathing on the container (origin at the feet) never fights the sprite's attack tweens
    this.tweens.add({ targets: this.trainer, scaleY: 1.025, scaleX: 0.99, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.scheduleTrainerLook()

    // rooster: the hero — 1.2× the trainer, bloodline aura, in front
    this.roosterKey = ROOSTER_KEYS[this.player.rooster.sireLine] ?? ROOSTER_KEYS.thepbut
    this.roosterAura = this.add
      .image(L.ROOSTER_X, L.ROOSTER_FEET - 4, FX.aura)
      .setTint(SIRE_TINT[this.player.rooster.sireLine] ?? INK.gold)
      .setDepth(22)
      .setAlpha(0.7)
    this.tweens.add({
      targets: this.roosterAura,
      scaleX: { from: 1, to: 1.08 },
      scaleY: { from: 1, to: 1.12 },
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    this.rooster = this.add.container(L.ROOSTER_X, L.ROOSTER_FEET).setDepth(25)
    this.roosterBody = this.add.container(0, 0)
    this.roosterSprite = this.add.image(0, 0, this.roosterKey).setOrigin(0.5, 1).setDisplaySize(L.ROOSTER_H, L.ROOSTER_H)
    this.roosterBody.add(this.roosterSprite)
    this.rooster.add(this.roosterBody)
    this.tweens.add({ targets: this.rooster, scaleY: 1.03, scaleX: 0.985, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300 })
    this.roosterPlate = new Nameplate(this, this.roosterLabel(), {
      fontFamily: this.font,
      fontSize: TYPE.plateRooster,
      color: '#ffe9a8',
    })
    this.roosterPlate.place(L.ROOSTER_X, L.ROOSTER_FEET - L.ROOSTER_H - 58)
    this.startRoosterBob()
    this.updateRoosterPulse()
    this.applyPowerTiers()
    this.scheduleRoosterIdle()
    this.roosterSprite.setInteractive({ useHandCursor: true })
    this.roosterSprite.on('pointerdown', () => this.cheerTap())
  }

  /** The trainer glances back over his shoulder every 4–8s when no swing is due. */
  private scheduleTrainerLook(): void {
    this.time.addEvent({
      delay: Phaser.Math.Between(4000, 8000),
      callback: () => {
        const busy = this.trainerChain?.isPlaying() || this.nextTrainerAt - this.time.now < 800
        if (!busy && !this.trainerLook) {
          this.trainerLook = true
          this.trainerBody.setScale(-1, 1)
          this.time.delayedCall(600, () => {
            if (!this.trainerChain?.isPlaying()) this.trainerBody.setScale(1, 1)
            this.trainerLook = false
          })
        }
        this.scheduleTrainerLook()
      },
    })
  }

  // ----------------------------------------------------------- power tiers

  /**
   * Visible character power from real levels (tier 0 <30, 1 30–69, 2 70+):
   * rooster comb/tail glow colour, glowing spurs and a bigger aura at high tiers;
   * trainer hat trim and hoe glow; bronze / silver / gold nameplate frames.
   */
  private applyPowerTiers(): void {
    const rt = tierOf(this.player.rooster.level)
    const tt = tierOf(this.player.baseLevel)
    this.roosterPlate.setTier(rt)
    this.trainerPlate.setTier(tt)
    if (rt !== this.roosterTier) {
      this.roosterTier = rt
      for (const o of this.roosterPower) o.destroy()
      this.roosterPower = []
      const H = L.ROOSTER_H
      const keep = (o: Phaser.GameObjects.GameObject): void => {
        this.roosterPower.push(o)
      }
      // aura tier: size and strength under the feet
      this.roosterAura.setAlpha(rt === 2 ? 0.95 : rt === 1 ? 0.75 : 0.45).setScale(rt === 2 ? 1.2 : rt === 1 ? 1.05 : 0.9)
      if (rt >= 1) {
        // sickle tail plume behind the body (teal/silver at tier 1, four-colour at tier 2)
        const plume = this.add.image(-0.26 * H, -0.42 * H, rt === 2 ? FX.plume2 : FX.plume1).setOrigin(0.92, 0.94).setScale(rt === 2 ? 0.85 : 0.7)
        this.roosterBody.add(plume)
        this.roosterBody.sendToBack(plume)
        keep(plume)
        if (!this.reduced) this.tweens.add({ targets: plume, angle: { from: -4, to: 4 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        // gold comb on the head, with a glow
        // the SVG's head top sits at about -0.83H (the raster has headroom)
        const glow = this.add.image(0.19 * H, -0.85 * H, FX.glow).setTint(rt === 2 ? 0xffd24a : 0xdfe6ee).setScale(rt === 2 ? 3 : 2).setAlpha(0.6)
        const comb = this.add.image(0.19 * H, -0.86 * H, FX.comb).setScale(rt === 2 ? 0.95 : 0.75).setTint(rt === 2 ? 0xffffff : 0xdfe6ee)
        this.roosterBody.add([glow, comb])
        keep(glow)
        keep(comb)
        if (!this.reduced) this.tweens.add({ targets: glow, alpha: 0.3, scale: glow.scale * 1.2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        // medal on the sash
        const medal = this.add.image(0.04 * H, -0.2 * H, FX.medal).setScale(rt === 2 ? 0.8 : 0.6).setTint(rt === 2 ? 0xffffff : 0xdfe6ee)
        this.roosterBody.add(medal)
        keep(medal)
      }
      if (rt === 2) {
        // bright gold ring and rising sparkles under the feet
        const ring = this.add.image(0, -4, FX.ring).setTint(0xffd24a).setScale(3.8, 1.2).setAlpha(0.9)
        this.rooster.add(ring)
        this.rooster.sendToBack(ring)
        keep(ring)
        this.tweens.add({ targets: ring, angle: 360, duration: 6000, repeat: -1 })
        const rise = this.add
          .particles(L.ROOSTER_X, L.ROOSTER_FEET - 10, FX.star, {
            x: { min: -150, max: 150 },
            lifespan: 1400,
            speedY: { min: -140, max: -60 },
            speedX: { min: -10, max: 10 },
            scale: { start: 0.55, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: [0xffd24a, 0xfff3d6],
            frequency: this.reduced ? 700 : 260,
            maxAliveParticles: 8,
          })
          .setDepth(26)
        keep(rise)
      }
    }
    if (tt !== this.trainerTier) {
      this.trainerTier = tt
      for (const o of this.trainerPower) o.destroy()
      this.trainerPower = []
      const H = L.TRAINER_H
      if (tt >= 1) {
        // cape (tier 2, crimson with a gold hem) or scarf (tier 1, teal) behind the shoulders
        const cloth = this.add.image(-0.1 * H, -0.55 * H, tt === 2 ? FX.cape : FX.scarf).setOrigin(0.5, 0.05).setScale(tt === 2 ? 0.8 : 0.7)
        this.trainerBody.add(cloth)
        this.trainerBody.sendToBack(cloth)
        this.trainerPower.push(cloth)
        if (!this.reduced) this.tweens.add({ targets: cloth, scaleX: cloth.scaleX * 0.9, angle: tt === 2 ? -6 : -3, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        // hat band (silver, then gold with a tassel)
        // the hat brim sits at about -0.68H on the raster
        const band = this.add.image(0.0 * H, -0.7 * H, tt === 2 ? FX.hatBand2 : FX.hatBand1).setOrigin(0.5, 0.35).setScale(0.95)
        this.trainerBody.add(band)
        this.trainerPower.push(band)
        // glowing tool head with a sparkle trail
        const hoe = this.add
          .image(0.31 * H, -0.8 * H, FX.glow)
          .setTint(tt === 2 ? 0xffd24a : 0x7ee0ff)
          .setScale(tt === 2 ? 2.8 : 2)
          .setAlpha(tt === 2 ? 0.85 : 0.6)
        this.trainerBody.add(hoe)
        this.trainerPower.push(hoe)
        if (!this.reduced) this.tweens.add({ targets: hoe, alpha: 0.4, scale: hoe.scale * 1.2, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        const trail = this.add
          .particles(L.TRAINER_X + 0.31 * H, L.TRAINER_FEET - 0.8 * H, FX.star, {
            lifespan: 700,
            speed: { min: 10, max: 40 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.9, end: 0 },
            tint: tt === 2 ? 0xffd24a : 0x7ee0ff,
            frequency: this.reduced ? 600 : 220,
            maxAliveParticles: 6,
          })
          .setDepth(26)
        this.trainerPower.push(trail)
      }
    }
  }

  // ------------------------------------------------------ rooster personality

  /** Bird idles every 3–6s when no swing is imminent: peck, head tilt, ruffle, look at the trainer. */
  private scheduleRoosterIdle(): void {
    this.time.addEvent({
      delay: Phaser.Math.Between(3000, 6000),
      callback: () => {
        const busy = this.roosterChain?.isPlaying() || this.nextRoosterAt - this.time.now < 700
        if (!busy) this.roosterIdleOnce()
        this.scheduleRoosterIdle()
      },
    })
  }

  private resetRoosterPose(): void {
    this.killTween(this.roosterIdle)
    this.roosterIdle = null
    this.roosterBody.setAngle(0).setScale(1, 1)
  }

  private roosterIdleOnce(): void {
    this.resetRoosterPose()
    const body = this.roosterBody
    switch (Phaser.Math.Between(0, 3)) {
      case 0: // peck: rotate about the feet, twice
        this.roosterIdle = this.tweens.add({ targets: body, angle: 18, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.easeOut' })
        break
      case 1: // head tilt, hold, back
        this.roosterIdle = this.tweens.chain({
          targets: body,
          tweens: [
            { angle: -8, duration: 160, ease: 'Sine.easeOut' },
            { angle: -8, duration: 400 },
            { angle: 0, duration: 200, ease: 'Sine.easeInOut' },
          ],
        })
        break
      case 2: // feather ruffle
        this.roosterIdle = this.tweens.add({ targets: body, scaleX: 0.92, duration: 90, yoyo: true, repeat: 2 })
        this.fx.featherPuff(L.ROOSTER_X, L.ROOSTER_FEET - L.ROOSTER_H * 0.6, 2)
        break
      default: // look back at the trainer (mirror the whole body, gear included)
        body.setScale(-1, 1)
        this.time.delayedCall(700, () => {
          if (!this.roosterChain?.isPlaying()) body.setScale(1, 1)
        })
    }
  }

  /** A kill makes the rooster hop and chirp (about one kill in four). */
  private roosterReactKill(): void {
    if (Math.random() > 0.25 || this.roosterChain?.isPlaying()) return
    this.fx.emote(L.ROOSTER_X + 60, L.ROOSTER_FEET - L.ROOSTER_H - 20, Phaser.Utils.Array.GetRandom(['♪', '!', '♥', '✦']))
    this.fx.sparkle(L.ROOSTER_X + 40, L.ROOSTER_FEET - L.ROOSTER_H * 0.6, 4)
    this.roosterBob?.remove()
    this.roosterBob = null
    this.rooster.setPosition(L.ROOSTER_X, L.ROOSTER_FEET)
    this.tweens.add({
      targets: this.rooster,
      y: L.ROOSTER_FEET - 34,
      duration: 160,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => this.startRoosterBob(),
    })
  }

  /** Wings flap wide and the rooster crows — trainer level-ups and the cheer tap. */
  private roosterCrow(): void {
    this.resetRoosterPose()
    this.roosterIdle = this.tweens.add({ targets: this.roosterBody, scaleX: 1.14, scaleY: 0.94, duration: 90, yoyo: true, repeat: 3 })
    this.fx.speech(L.ROOSTER_X + 120, L.ROOSTER_FEET - L.ROOSTER_H - 10, 'Cock-a-doodle-doo!')
    this.fx.sparkle(L.ROOSTER_X, L.ROOSTER_FEET - L.ROOSTER_H * 0.6, 10)
    this.roosterCheer()
  }

  /** Tapping the rooster: a crow, and the next 3 swings come 1.5× faster (20s cooldown). */
  private cheerTap(): void {
    const now = this.time.now
    if (now < this.cheerReadyAt) {
      this.fx.emote(L.ROOSTER_X + 60, L.ROOSTER_FEET - L.ROOSTER_H - 20, '♥')
      return
    }
    this.cheerReadyAt = now + 20000
    this.cheerBoostLeft = 3
    this.roosterCrow()
  }

  private startTrainerBob(): void {
    this.trainerBob?.remove()
    this.trainer.y = L.TRAINER_FEET
    this.trainerBob = this.tweens.add({
      targets: this.trainer,
      y: L.TRAINER_FEET - 8,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private startRoosterBob(): void {
    this.roosterBob?.remove()
    this.rooster.setPosition(L.ROOSTER_X, L.ROOSTER_FEET)
    this.roosterBob = this.tweens.add({
      targets: this.rooster,
      y: L.ROOSTER_FEET - 8,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private buildChips(): void {
    // zone pill: the HUD shows the zone too, so this one fades out after 3s
    const mapChip = new Chip(this, `${this.map.name} · ${this.zone.en}`, { fontFamily: this.font, fontSize: 24 })
    mapChip.container.setDepth(54).setPosition(L.SAFE + mapChip.boxWidth / 2, L.SAFE)
    this.tweens.add({ targets: mapChip.container, alpha: 0, delay: 3000, duration: 600, onComplete: () => mapChip.destroy() })

    this.killChip = new Chip(this, this.killLabel(), { fontFamily: this.font, accent: 0xe0a93e })
    this.killChip.container.setDepth(54)
    this.harvestChip = new Chip(this, this.harvestLabel(), { fontFamily: this.font, accent: 0x9ccc65, iconKey: itemKey(102) })
    this.harvestChip.container.setDepth(54)
    this.coinChip = new Chip(this, '0', { fontFamily: this.font, accent: 0xf2c14e, iconKey: FX.coin })
    this.coinChip.container.setDepth(54).setVisible(false)
    this.pips = new BossPips(this, this.bossEvery(), this.font)
    this.readCoins(this.player)
    this.pinChips()
  }

  /** Server เบี้ย (additive field: undefined until the engine has credited any). */
  private serverCoins(p: Player): number | null {
    return typeof p.coins === 'number' && Number.isFinite(p.coins) ? p.coins : null
  }

  private readCoins(p: Player): void {
    const c = this.serverCoins(p)
    if (c === null) return
    this.coinsKnown = true
    this.coinsShown = c
    this.coinChip.setLabel(this.coinsShown.toLocaleString('en-US'))
    this.coinChip.container.setVisible(true)
  }

  private pinChips(): void {
    this.killChip.container.setPosition(L.W - L.SAFE - this.killChip.boxWidth / 2, L.SAFE)
    this.harvestChip.container.setPosition(L.W - L.SAFE - this.harvestChip.boxWidth / 2, L.SAFE + 70)
    const coinRow = this.coinsKnown ? 70 : 0
    this.coinChip.container.setPosition(L.W - L.SAFE - this.coinChip.boxWidth / 2, L.SAFE + 140)
    this.pips.place(L.W - L.SAFE, L.SAFE + 132 + coinRow)
    this.pips.set(this.killServer % this.bossEvery(), this.bossEvery())
  }

  private trainerLabel(): string {
    return `${this.player.name} · Lv.${this.player.baseLevel}`
  }

  private roosterLabel(): string {
    return `${this.player.rooster.name} · Lv.${this.player.rooster.level}`
  }

  private killLabel(): string {
    return `KILL ${this.killShown.toLocaleString('en-US')}`
  }

  private harvestLabel(): string {
    return `${this.harvestShown.toLocaleString('en-US')}`
  }

  private bossEvery(): number {
    return this.demoMode ? JUICE.BOSS_EVERY_DEMO : JUICE.BOSS_EVERY
  }

  private countInventory(p: Player): number {
    let n = 0
    for (const [id, count] of Object.entries(p.inventory)) {
      if (getItem(Number(id))?.slot === 'consumable') continue
      n += count
    }
    return n
  }

  // ---------------------------------------------------------------- dev keys

  /** FX-only triggers for screenshots and rehearsal. Never touch server state. */
  private bindDevKeys(): void {
    const kb = this.input.keyboard
    if (!kb) return
    kb.on('keydown-B', () => {
      this.forceBoss = true
    })
    kb.on('keydown-L', () => {
      this.playLevelUp(this.player.baseLevel, this.player.baseLevel + 1, 1)
    })
    kb.on('keydown-M', () => {
      this.playLevelUp(29, 30, 1) // preview the Lv 30 "Rare drops unlocked" ceremony
    })
    kb.on('keydown-Z', () => {
      // preview the zone transition (FX only; the next sync snaps back to the server's map)
      const other = this.map.id === THUNG_NA.id ? 'bueng-bua' : THUNG_NA.id
      if (MAPS[other]) this.changeZone(MAPS[other])
    })
    kb.on('keydown-J', () => {
      this.playDropMoment(1001, 'monster_card')
    })
    kb.on('keydown-K', () => {
      const t = this.leaderIn([2, 1, 0])
      if (t) this.killPest(t, this.time.now)
    })
  }

  // ------------------------------------------------------------------ cadence

  private tuneCadence(): void {
    const tAspd = Phaser.Math.Clamp(aspdOf(this.player), 0.6, 1.4)
    const rAspd = Phaser.Math.Clamp(roosterAspd(this.player.rooster), 0.6, 1.4)
    this.trainerCd = Phaser.Math.Clamp(Math.round(1150 / tAspd), JUICE.ATTACK_MIN, JUICE.ATTACK_MAX)
    this.roosterCd = Phaser.Math.Clamp(Math.round(1150 / rAspd), JUICE.ATTACK_MIN, JUICE.ATTACK_MAX)

    // visual kill pace follows the server's measured kill rate
    const rate = this.serverKillRate()
    const [lo, hi] = this.demoMode ? [600, 1000] : [1500, 4000]
    const killMs = rate > 0 ? Phaser.Math.Clamp(1000 / rate, lo, hi) : this.demoMode ? 800 : 2500
    const swingMs = (this.trainerCd + this.roosterCd) / 4 // two attackers alternate
    this.hitsToKill = Phaser.Math.Clamp(Math.round(killMs / swingMs), 1, 4)
  }

  /** Kills per second seen across the last syncs (0 when unknown). */
  private serverKillRate(): number {
    const log = this.syncLog
    if (log.length < 2) return 0
    const a = log[0]
    const b = log[log.length - 1]
    const dt = (b.t - a.t) / 1000
    if (dt < 3) return 0
    return Math.max(0, b.kills - a.kills) / dt
  }

  private trainerHit(): { value: number; crit: boolean } {
    const atk = atkOf(this.player) + this.player.baseLevel * 2
    // real critChance is ~1–3% at low LUK, which reads as "never" on camera
    const crit = Math.random() < Math.max(critChance(this.player), 0.08)
    return { value: Math.max(4, Math.round(atk * (0.95 + Math.random() * 0.1) * (crit ? 1.5 : 1))), crit }
  }

  private roosterHit(): { value: number; crit: boolean } {
    const atk = roosterAtk(this.player.rooster) + this.player.rooster.level * 1.5
    const crit = Math.random() < Math.max(roosterCrit(this.player.rooster), 0.06)
    return { value: Math.max(3, Math.round(atk * (0.95 + Math.random() * 0.1) * (crit ? 1.5 : 1))), crit }
  }

  private avgHit(): number {
    const t = atkOf(this.player) + this.player.baseLevel * 2
    const r = roosterAtk(this.player.rooster) + this.player.rooster.level * 1.5
    return (t + r) / 2
  }

  // --------------------------------------------------------------------- pack

  private rowPests(row: Row): Pest[] {
    return this.pests.filter((p) => p.row === row).sort((a, b) => a.slot - b.slot)
  }

  private leader(row: Row): Pest | null {
    const p = this.rowPests(row)[0]
    return p && p.ready && !p.dead ? p : null
  }

  /** First hittable leader in lane order (front-first for the trainer, back-first for the rooster). */
  private leaderIn(order: readonly Row[]): Pest | null {
    for (const r of order) {
      const p = this.leader(r)
      if (p) return p
    }
    return null
  }

  /** Only the pest under attack shows its plate and HP bar (the pile stays readable). */
  private setFocus(p: Pest): void {
    if (this.focus === p) return
    if (this.focus && !this.focus.dead) {
      this.focus.plate.setVisible(false)
      this.focus.bar.setVisible(false)
    }
    this.focus = p
    const s = ROW_SCALE[p.row]
    // above every lane, so a front-lane body never covers a back-lane target's plate
    p.bar.container.setDepth(30)
    p.plate.container.setDepth(30)
    p.bar.place(p.baseX, p.feetY + 12 * s)
    p.plate.place(p.baseX, p.feetY + 20 * s)
  }

  private pickMonster(): MonsterDef {
    const total = this.map.monsters.reduce((sum, s) => sum + s.weight, 0)
    let roll = Math.random() * total
    for (const s of this.map.monsters) {
      roll -= s.weight
      if (roll <= 0) return s.monster
    }
    return this.map.monsters[0].monster
  }

  private slotX(row: Row, slot: number): number {
    return ROW_ENGAGE[row] + slot * L.PACK_GAP
  }

  /** Spawn a regular pest at the back of a row's queue, walking in from the right. */
  private spawnPest(row: Row, startX: number = L.SPAWN_X): Pest {
    const def = this.pickMonster()
    const slot = this.rowPests(row).length
    const pest = this.makePest(def, row, slot, Math.max(startX, this.slotX(row, slot) + 40), false)
    this.walkTo(pest, pest.baseX, true)
    return pest
  }

  private makePest(def: MonsterDef, row: Row, slot: number, startX: number, boss: boolean): Pest {
    const skin = this.zone.skins[def.id]
    const h = Math.round((skin?.h ?? L.PEST_H[def.id] ?? 240) * (boss ? 1 : Phaser.Math.FloatBetween(0.9, 1.15)))
    const baseKey = skin?.key ?? MONSTER_KEYS[def.id] ?? MONSTER_KEYS['nu-na']
    const key = skin?.tint !== undefined ? tintedTexture(this, baseKey, skin.tint) : baseKey
    const feetY = ROW_FEET[row]
    const container = this.add.container(startX, feetY).setDepth(ROW_DEPTH[row]).setScale(ROW_SCALE[row])
    const sprite = this.add.image(0, 0, key).setOrigin(0.5, 1).setDisplaySize(h, h)
    container.add(sprite)
    const en = this.zone.names[def.id] ?? def.id
    const plate = new Nameplate(this, `${en} · Lv.${def.level}`, {
      fontFamily: this.font,
      fontSize: TYPE.platePest,
      color: boss ? '#ffe9a8' : '#fff8ec',
      depth: ROW_DEPTH[row] + 0.5,
    })
    const bar = new HpBar(this, boss ? 220 : 160, 12, ROW_DEPTH[row] + 0.5)
    const maxHp = boss
      ? Math.round(this.avgHit() * (this.demoMode ? 20 : 30))
      : Math.max(1, Math.round(this.avgHit() * this.hitsToKill * (0.9 + Math.random() * 0.2)))
    const pest: Pest = {
      def,
      row,
      slot,
      hp: maxHp,
      maxHp,
      container,
      sprite,
      plate,
      bar,
      h,
      baseX: this.slotX(row, slot) + (boss ? 40 : Phaser.Math.Between(-10, 10)),
      feetY,
      ready: false,
      boss,
      dead: false,
      walk: null,
      hop: null,
      knock: null,
      squash: null,
    }
    this.pests.push(pest)
    return pest
  }

  /** Walk (or hop) a pest to x; the row leader becomes hittable on arrival. */
  private walkTo(pest: Pest, x: number, walkIn: boolean): void {
    pest.walk?.remove()
    pest.hop?.remove()
    pest.ready = false
    pest.plate.setVisible(false)
    pest.bar.setVisible(false)
    const dist = Math.abs(pest.container.x - x)
    const dur = walkIn ? Math.max(200, (dist / L.WALK_SPEED) * 1000) : 380
    pest.hop = this.tweens.add({
      targets: pest.container,
      y: pest.feetY - (walkIn ? 14 : 24),
      duration: walkIn ? 190 : 190,
      yoyo: true,
      repeat: walkIn ? -1 : 0,
      ease: 'Quad.easeOut',
    })
    pest.walk = this.tweens.add({
      targets: pest.container,
      x,
      duration: dur,
      ease: walkIn ? 'Linear' : 'Quad.easeOut',
      onComplete: () => {
        pest.hop?.remove()
        pest.hop = null
        pest.container.y = pest.feetY
        pest.walk = null
        if (pest.slot === 0 && !pest.dead) this.engage(pest)
      },
    })
  }

  private engage(pest: Pest): void {
    pest.ready = true
    pest.baseX = pest.container.x
    this.fx.dustKick(pest.baseX, pest.feetY, 3)
    if (pest.boss) this.setFocus(pest)
  }

  /** Re-number a row after a death; everyone steps up one slot. */
  private reslot(row: Row): void {
    const rowPests = this.rowPests(row)
    rowPests.forEach((p, i) => {
      if (p.slot === i) return
      p.slot = i
      p.baseX = this.slotX(row, i) + Phaser.Math.Between(-16, 16)
      this.walkTo(p, p.baseX, false)
    })
  }

  private removePest(pest: Pest): void {
    if (this.focus === pest) this.focus = null
    this.pests = this.pests.filter((p) => p !== pest)
    pest.walk?.remove()
    pest.hop?.remove()
    this.killTween(pest.knock)
    pest.squash?.remove()
    pest.plate.destroy()
    pest.bar.destroy()
  }

  /** TweenChain.remove(tween) has a different meaning, so chains go through the manager. */
  private killTween(t: Phaser.Tweens.Tween | Phaser.Tweens.TweenChain | null): void {
    if (t) this.tweens.remove(t as Phaser.Tweens.Tween)
  }

  /** Clear the hit flash (the zone skin's tint is baked into its texture). */
  private restoreSkin(p: Pest): void {
    p.sprite.clearTint()
  }

  private topYOf(pest: Pest): number {
    return pest.container.y - pest.h * ROW_SCALE[pest.row]
  }

  // ------------------------------------------------------------------ attacks

  private trainerAttack(time: number): void {
    const target = this.leaderIn([2, 1, 0])
    if (!target) {
      this.nextTrainerAt = time + 120
      return
    }
    this.setFocus(target)
    this.nextTrainerAt = time + this.trainerCd
    const { value, crit } = this.trainerHit()
    const sp = this.trainerSprite
    const body = this.trainerBody
    this.killTween(this.trainerChain)
    body.setPosition(0, 0).setScale(1, 1).setAngle(0)
    this.trainerLook = false
    // four distinct poses (the sprite pivots at the feet): wind-up leaning back on
    // the stride texture → swing forward → held impact → follow-through → overshoot
    // recovery. The hit lands at the end of the swing.
    this.trainerChain = this.tweens.chain({
      targets: body,
      tweens: [
        {
          x: -24,
          angle: -14,
          scaleX: 1.06,
          scaleY: 0.94,
          duration: JUICE.WINDUP,
          ease: 'Quad.easeOut',
          onStart: () => sp.setTexture(TRAINER_WALK_KEY),
        },
        {
          x: JUICE.STRIKE_DX,
          angle: 22,
          scaleX: 0.94,
          scaleY: 1.06,
          duration: JUICE.STRIKE,
          ease: 'Expo.easeIn',
          onStart: () => sp.setTexture(TRAINER_KEY),
          onComplete: () => {
            if (target.dead) return
            // the trainer's own attack: a teal hoe sweep at the hand, then a seed bag
            // that arcs to the target and lands the hit
            const hx = L.TRAINER_X + JUICE.STRIKE_DX + 60
            const hy = L.TRAINER_FEET - L.TRAINER_H * 0.55
            this.fx.slash(hx, hy, 1, 0.8, 0x3fb8c9)
            this.fx.dustKick(L.TRAINER_X + JUICE.STRIKE_DX, L.TRAINER_FEET, 3)
            const tx = target.container.x
            const rsz = target.h * ROW_SCALE[target.row]
            const ty = this.topYOf(target) + rsz * 0.55
            this.fx.throwBag(hx, hy - 40, tx - rsz * 0.3, ty, () => {
              if (target.dead) return
              // burst on the hit side of the body, low, never on the face
              this.fx.impactStar(tx - rsz * 0.42, ty + rsz * 0.12, target.boss ? 1.1 : 0.7, 0xbff2ff)
              this.hitPest(target, value, crit ? 'crit' : 'trainer', time)
            })
          },
        },
        { x: JUICE.STRIKE_DX + 6, angle: 26, scaleX: 0.94, scaleY: 1.06, duration: JUICE.HOLD },
        { x: JUICE.STRIKE_DX - 50, angle: 8, scaleX: 1, scaleY: 1, duration: 130, ease: 'Sine.easeOut' },
        { x: 0, angle: 0, scaleX: 1, scaleY: 1, duration: JUICE.RECOVER, ease: 'Back.easeOut' },
      ],
    })
  }

  private roosterAttack(time: number): void {
    const target = this.leaderIn([0, 1, 2])
    if (!target) {
      this.nextRoosterAt = time + 120
      return
    }
    this.setFocus(target)
    let cd = this.roosterCd
    if (this.cheerBoostLeft > 0) {
      this.cheerBoostLeft -= 1
      cd = Math.round(cd / 1.5)
    }
    this.nextRoosterAt = time + cd
    const { value, crit } = this.roosterHit()
    const body = this.roosterBody
    const rs = ROW_SCALE[target.row]
    this.resetRoosterPose()
    const dashX = target.container.x - (target.boss ? 300 : 120 + target.h * rs * 0.45)
    const dashY = target.feetY + (target.row === 0 ? 10 : 6)
    this.killTween(this.roosterChain)
    this.roosterBob?.remove()
    this.roosterBob = null
    body.setScale(1, 1)
    this.rooster.setPosition(L.ROOSTER_X, L.ROOSTER_FEET)
    // crouch → dash (afterimages) → peck lands → spring back
    this.roosterChain = this.tweens.chain({
      tweens: [
        { targets: body, scaleY: 0.88, scaleX: 1.08, duration: JUICE.CROUCH, ease: 'Quad.easeOut' },
        {
          targets: this.rooster,
          x: dashX,
          y: dashY,
          duration: JUICE.DASH,
          ease: 'Expo.easeIn',
          onStart: () => {
            body.setScale(1.04, 0.96)
            this.fx.dustKick(L.ROOSTER_X - 20, L.ROOSTER_FEET, 4)
          },
          onComplete: () => {
            this.fx.afterimages(this.roosterKey, L.ROOSTER_X, L.ROOSTER_FEET, dashX, dashY, L.ROOSTER_H)
            if (target.dead) return
            const tx = target.container.x
            const ty = this.topYOf(target) + target.h * rs * 0.45
            // the peck is its own small directional arc plus a low burst on the hit side
            this.fx.slash(tx - 60, ty + 10, 1, target.boss ? 0.9 : 0.55)
            this.fx.impactStar(tx - target.h * rs * 0.42, ty + target.h * rs * 0.2, target.boss ? 1 : 0.6, 0xffd8a8)
            if (crit) this.fx.sparkle(dashX + 40, dashY - L.ROOSTER_H * 0.55, 8)
            this.hitPest(target, value, crit ? 'crit' : 'rooster', time)
          },
        },
        { targets: this.rooster, x: dashX + 8, y: dashY, duration: JUICE.HOLD },
        {
          targets: this.rooster,
          x: L.ROOSTER_X,
          y: L.ROOSTER_FEET,
          duration: JUICE.DASH_BACK,
          ease: 'Back.easeOut',
          onStart: () => body.setScale(1, 1),
          onComplete: () => this.startRoosterBob(),
        },
      ],
    })
  }

  private hitPest(p: Pest, value: number, kind: DamageKind, time: number): void {
    if (p.dead) return
    // the boss only dies when the server says so; cosmetic hits stop at 1 HP
    p.hp = Math.max(p.boss && !this.bossServerDead ? 1 : 0, p.hp - value)
    const lethal = p.hp <= 0
    // the number spawns at the hit point on the struck side of the body
    const rsz = p.h * ROW_SCALE[p.row]
    this.fx.damage(p.container.x - rsz * 0.2, this.topYOf(p) + rsz * (p.boss ? 0.55 : 0.4), value, kind)
    p.bar.setPct(p.hp / p.maxHp)
    if (p.boss) this.bossBar?.setHp(p.hp, p.maxHp)

    // freeze on contact (victim vibrates in update), then knock back and squash
    p.sprite.setTintFill(0xffffff)
    this.time.delayedCall(JUICE.FLINCH_MS, () => this.restoreSkin(p))
    this.fx.hitStop(lethal ? (p.boss ? JUICE.STOP_BOSS_KILL : JUICE.STOP_KILL) : kind === 'crit' ? JUICE.STOP_CRIT : JUICE.STOP_HIT)
    this.victim = p

    const knock = (kind === 'crit' ? JUICE.KNOCK_CRIT : JUICE.KNOCK) * (p.boss ? 0.5 : 1)
    this.killTween(p.knock)
    p.knock = this.tweens.chain({
      targets: p.container,
      tweens: [
        { x: p.baseX + knock, duration: 60, ease: 'Quad.easeOut' },
        { x: p.baseX, duration: 180, ease: 'Back.easeOut' },
      ],
    })
    p.squash?.remove()
    const ss = p.sprite.scaleX
    p.squash = this.tweens.add({
      targets: p.sprite,
      scaleX: ss * 0.86,
      scaleY: ss * 1.12,
      angle: kind === 'rooster' ? -7 : 7,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    })

    if (lethal) this.killPest(p, time)
  }

  private killPest(p: Pest, time: number): void {
    if (p.dead) return
    p.dead = true
    p.ready = false
    const x = p.container.x
    const rs = ROW_SCALE[p.row]
    const midY = p.feetY - (p.h * rs) / 2
    this.lastKillX = x
    this.lastKillY = p.feetY
    const boss = p.boss

    // pop + spin out, then poof (no blood, ever)
    this.killTween(p.knock)
    p.squash?.remove()
    const ss = p.sprite.scaleX
    p.plate.setVisible(false)
    p.bar.setVisible(false)
    this.tweens.chain({
      targets: p.sprite,
      tweens: [
        { scaleX: ss * 1.25, scaleY: ss * 1.25, duration: 60, ease: 'Quad.easeOut' },
        { scaleX: 0, scaleY: 0, angle: 180, duration: 180, ease: 'Back.easeIn' },
      ],
      onComplete: () => p.container.destroy(),
    })
    this.fx.poof(x, midY, boss ? 2.2 : 1)
    this.fx.groundRing(x, p.feetY, INK.goldSoft, boss ? 900 : 380)
    this.fx.shake(boss ? JUICE.SHAKE_BOSS_KILL : JUICE.SHAKE_KILL)
    this.roosterReactKill()

    // rewards only with a server credit: the KILL tick, the credit's real EXP and
    // one loot icon. A kill without credit is presentation and stays silent.
    const credit = this.credits.shift()
    if (credit) {
      this.killShown += credit.kills
      this.killChip.setLabel(this.killLabel())
      this.pinChips()
      this.killChip.pop()
      this.burstCoins(x, midY, p.feetY, credit.coins, boss)
      if (credit.exp > 0) this.fx.expPop(x + 120, this.topYOf(p) - 250, credit.exp)
      this.drainLoot(x, midY, p.feetY)
    }
    this.removePest(p)
    if (boss) {
      this.bossVictory(p, time)
    } else {
      this.reslot(p.row)
      this.nextSpawnAt = Math.min(this.nextSpawnAt, time + 300)
    }
  }

  // --------------------------------------------------------------------- loot

  /** One queued server-granted item leaves the body, rests, then flies to the chip. */
  private drainLoot(x: number, y: number, feetY: number): void {
    const entry = this.pendingLoot.shift()
    if (!entry) return
    const item = getItem(entry.id)
    const rarity = item?.rarity ?? 'common'
    const tier = rarity === 'rare' || rarity === 'epic'
    if (tier) {
      // rare / epic gain: a coloured beam to the sky and a ground ring
      this.fx.pillar(x, feetY, RARITY_COLORS[rarity], 1080, 1100)
      this.fx.groundRing(x, feetY, RARITY_COLORS[rarity], 640, 480)
    }
    const icon = this.add.image(x, y, itemKey(entry.id)).setDisplaySize(entry.n > 1 ? 80 : 64, entry.n > 1 ? 80 : 64).setDepth(30)
    const restX = Phaser.Math.Clamp(x - Phaser.Math.Between(JUICE.LOOT_ARC_MIN, JUICE.LOOT_ARC_MAX), 900, 1600)
    const restY = L.LOOT_REST_Y + Phaser.Math.Between(-10, 10)
    const label = entry.n > 1 ? `+${entry.n}` : '+1'
    this.lootFlying += entry.n
    this.fx.lootArc(icon, restX, restY, () => {
      // the item rests on the ground (longer under a rare beam) so stills catch loot on the floor
      this.time.delayedCall(tier ? JUICE.LOOT_REST_RARE : JUICE.LOOT_REST, () => {
        const a = this.harvestChip.anchor
        this.fx.vacuum(icon, a.x, a.y, () => {
          this.lootFlying -= entry.n
          this.harvestShown += entry.n
          this.harvestChip.setLabel(this.harvestLabel())
          this.pinChips()
          this.harvestChip.bounce()
          this.fx.tick(this.harvestChip.container.x, this.harvestChip.container.y + 62, label, INK.loot)
        })
      })
    })
  }

  /**
   * 2–5 coins burst from the body, scatter on the ground, then arc into the coin
   * chip (or the Harvest chip while the server has no coin field). The coin chip
   * ticks only by the server's credited delta.
   */
  private burstCoins(x: number, y: number, feetY: number, coinDelta: number, boss: boolean): void {
    const n = Phaser.Math.Clamp(coinDelta > 0 ? 2 + Math.round(coinDelta / 3) : Phaser.Math.Between(JUICE.COINS_MIN, JUICE.COINS_MAX), JUICE.COINS_MIN, boss ? 8 : JUICE.COINS_MAX)
    const target = this.coinsKnown ? this.coinChip : this.harvestChip
    let ticked = false
    for (let i = 0; i < n; i++) {
      const coin = this.add.image(x, y, FX.coin).setDepth(30).setScale(1.15)
      const restX = Phaser.Math.Clamp(x + Phaser.Math.Between(-220, 160), 880, 1700)
      const restY = L.LOOT_REST_Y + Phaser.Math.Between(-16, 16)
      this.fx.lootArc(coin, restX, restY, () => {
        this.time.delayedCall(JUICE.COIN_REST + i * 40, () => {
          const a = target.anchor
          this.fx.vacuum(coin, a.x, a.y, () => {
            if (!ticked && this.coinsKnown && coinDelta > 0) {
              ticked = true
              this.coinsShown += coinDelta
              this.coinChip.setLabel(this.coinsShown.toLocaleString('en-US'))
              this.pinChips()
              this.coinChip.bounce()
              this.fx.tick(this.coinChip.container.x, this.coinChip.container.y + 62, `+${coinDelta}`, INK.crit)
            } else if (!this.coinsKnown && i === 0) {
              target.pop()
            }
          }, i * JUICE.LOOT_STAGGER)
        })
      })
    }
  }

  private queueLoot(prev: Player, next: Player): void {
    for (const [idStr, count] of Object.entries(next.inventory)) {
      const id = Number(idStr)
      if (getItem(id)?.slot === 'consumable') continue
      const gained = count - (prev.inventory[id] ?? 0)
      if (gained <= 0) continue
      for (let i = 0; i < gained; i++) {
        const last = this.pendingLoot[this.pendingLoot.length - 1]
        if (this.pendingLoot.length >= JUICE.LOOT_QUEUE_CAP && last) {
          // overflow folds into a "+N" batch icon
          if (last.id === id) last.n += 1
          else this.pendingLoot.push({ id, n: 1 })
        } else {
          this.pendingLoot.push({ id, n: 1 })
        }
      }
    }
    // the chip shows Σ inventory minus what is still in flight
    const inFlight = this.pendingLoot.reduce((s, e) => s + e.n, 0) + this.lootFlying
    this.harvestShown = Math.max(0, this.countInventory(next) - inFlight)
    this.harvestChip.setLabel(this.harvestLabel())
    this.pinChips()
  }

  // --------------------------------------------------------------------- boss

  /**
   * Boss ceremony (demo: every 8th kill):
   *   t=0      "BOSS APPROACHING" ribbon, backdrop darkens, vignette pulses, pests flee
   *   t=1200   Rat King drops from the sky (Bounce)
   *   land     hit-stop 120, shake, dust ring, zoom punch, name slam, boss bar in
   *   fight    boss lunges at the trainer every 2.2–3s (cosmetic knockback)
   *   victory  hit-stop 260, flash, confetti, "MVP DEFEATED!", card fly-out
   */
  private startBoss(pendingKill: boolean): void {
    this.bossActive = true
    this.bossServerDead = false
    this.forceBoss = false
    this.updateBossShadow()
    new Ribbon(this, 'BOSS APPROACHING', this.font).play(700, this.reduced)
    if (!this.reduced) {
      const vig = this.cameras.main.postFX?.addVignette(0.5, 0.5, 0.9, 0)
      if (vig) {
        this.tweens.add({
          targets: vig,
          strength: 0.55,
          duration: 300,
          yoyo: true,
          repeat: 1,
          onComplete: () => this.cameras.main.postFX?.remove(vig),
        })
      }
    }
    // the pack scatters
    for (const p of this.pests) {
      p.dead = true
      p.walk?.remove()
      p.hop?.remove()
      p.plate.setVisible(false)
      p.bar.setVisible(false)
      this.tweens.add({
        targets: p.container,
        x: p.container.x + 1400,
        duration: 520,
        ease: 'Cubic.easeIn',
        onComplete: () => p.container.destroy(),
      })
      this.tweens.add({ targets: p.container, y: p.feetY - 30, duration: 130, yoyo: true, repeat: 3 })
    }
    for (const p of [...this.pests]) this.removePest(p)

    const def = this.map.mvp
    if (!def) {
      this.bossActive = false
      return
    }
    this.time.delayedCall(JUICE.BOSS_WARN_MS, () => this.dropBoss(def, pendingKill))
  }

  private dropBoss(def: MonsterDef, pendingKill: boolean): void {
    const boss = this.makePest(def, 2, 0, L.ENGAGE_FRONT_X + 220, true)
    boss.baseX = L.ENGAGE_FRONT_X + 220
    boss.container.setPosition(boss.baseX, -520)
    this.tweens.add({
      targets: boss.container,
      y: boss.feetY,
      duration: JUICE.BOSS_DROP_MS,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        this.fx.hitStop(JUICE.STOP_BOSS_LAND)
        this.fx.shake(JUICE.SHAKE_BOSS_LAND)
        this.fx.groundRing(boss.baseX, boss.feetY, 0xcaa273, 1100, 380)
        this.fx.dustKick(boss.baseX, boss.feetY, 14)
        this.fx.zoomPunch(1.08, 180, 420)
        // one boss label only: the top bar plus the plate under its feet
        this.engage(boss)
        // heroes recoil a step
        this.tweens.add({ targets: [this.trainer, this.rooster], x: '-=30', duration: 120, yoyo: true, ease: 'Quad.easeOut' })
        this.bossBar = new BossBar(this, `${this.zone.names[def.id] ?? def.id} · ${def.name}`, this.font)
        this.bossBar.setHp(boss.maxHp, boss.maxHp)
        this.bossBar.show(this.reduced)
        this.nextBossAt = this.time.now + 2000
        this.bridge.emit('boss-spawn', { name: def.name })
        // the server already crossed this boss kill (fast fight or dev key): a short
        // brawl, then the victory beat
        if (pendingKill) this.time.delayedCall(2600, () => this.slayBoss())
      },
    })
  }

  /** Two kills before the boss, a dark Rat King silhouette looms behind the far fields. */
  private updateBossShadow(): void {
    const every = this.bossEvery()
    const near = !this.bossActive && this.killServer % every >= every - 2
    if (near && !this.bossShadow) {
      const key = this.zone.skins[this.zone.bossId]?.key ?? MONSTER_KEYS['raja-nu-na'] ?? MONSTER_KEYS['nu-na']
      // feet sunk behind the paddy (depth 5 < 6) so the head looms in the sky
      const sh = this.add
        .image(1300, L.HORIZON_Y + 220, tintedTexture(this, key, INK.outline))
        .setOrigin(0.5, 1)
        .setDisplaySize(560, 560)
        .setAlpha(0)
        .setDepth(5)
      this.tweens.add({ targets: sh, alpha: 0.32, duration: 1200 })
      this.tweens.add({ targets: sh, y: L.HORIZON_Y + 206, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.bossShadow = sh
    } else if (!near && this.bossShadow) {
      const sh = this.bossShadow
      this.bossShadow = null
      this.tweens.add({ targets: sh, alpha: 0, duration: 600, onComplete: () => sh.destroy() })
    }
  }

  private bossPest(): Pest | null {
    return this.pests.find((p) => p.boss && !p.dead) ?? null
  }

  /** The server confirmed the boss kill: let the next hit (or this call) finish it. */
  private slayBoss(): void {
    this.bossServerDead = true
    const b = this.bossPest()
    if (!b) return
    if (!b.ready) {
      this.time.delayedCall(600, () => this.slayBoss())
      return
    }
    // no invented damage number at the money shot: flash, freeze, and fall
    b.sprite.setTintFill(0xffffff)
    this.time.delayedCall(20, () => this.restoreSkin(b))
    this.fx.hitStop(JUICE.STOP_BOSS_KILL)
    b.hp = 0
    b.bar.setPct(0)
    this.bossBar?.setHp(0, b.maxHp)
    this.killPest(b, this.time.now)
  }

  /** Mirror the server's boss HP when a sync carries the live fight. */
  private mirrorBossHp(player: Player): void {
    const b = this.bossPest()
    const c = player.combat
    if (!b || !c || c.monsterId !== b.def.id || b.def.stats.hp <= 0) return
    const pct = Phaser.Math.Clamp(c.monsterHp / b.def.stats.hp, 0, 1)
    b.hp = Math.max(1, Math.min(b.hp, Math.round(b.maxHp * pct)))
    b.bar.setPct(b.hp / b.maxHp)
    this.bossBar?.setHp(b.hp, b.maxHp)
  }

  private bossAttack(time: number): void {
    this.nextBossAt = time + Phaser.Math.Between(2200, 3000)
    const b = this.pests.find((p) => p.boss && p.ready && !p.dead)
    if (!b) return
    this.killTween(b.knock)
    b.knock = this.tweens.chain({
      targets: b.container,
      tweens: [
        { x: b.baseX + 60, duration: 220, ease: 'Quad.easeOut' },
        { x: b.baseX - 220, duration: 130, ease: 'Expo.easeIn' },
        { x: b.baseX, duration: 320, ease: 'Back.easeOut' },
      ],
    })
    this.time.delayedCall(340, () => {
      this.fx.slash(L.TRAINER_X + 120, L.TRAINER_FEET - L.TRAINER_H * 0.5, -1, 1.2)
      this.fx.impactStar(L.TRAINER_X + 60, L.TRAINER_FEET - L.TRAINER_H * 0.55, 1.1, 0xffb0a0)
      this.fx.shake([90, 0.0022])
      this.fx.dustKick(L.TRAINER_X, L.TRAINER_FEET, 4)
      this.trainerSprite.setTint(0xff6b5b)
      this.time.delayedCall(60, () => this.trainerSprite.clearTint())
      this.tweens.add({ targets: this.trainerBody, x: -40, duration: 90, yoyo: true, ease: 'Quad.easeOut' })
    })
  }

  private bossVictory(p: Pest, time: number): void {
    this.bossBar?.hide()
    this.bossBar = null
    this.bossActive = false
    this.tweens.add({ targets: this.bossDim, alpha: 0, duration: 500 })
    this.fx.flash(250, 255, 240, 200)
    this.fx.confettiBurst(p.container.x, p.feetY - 300, 40)
    this.fx.slam('MVP DEFEATED!', undefined, 300, INK.crit)
    this.roosterCheer()
    // no card fly-out here: a card only rises (fx.jackpot) when the server's drop
    // list confirms one on this same poll — ~55% of boss kills in demo mode
    this.bridge.emit('boss-kill', { name: p.def.name })
    this.packTarget = Phaser.Math.Between(L.PACK_MIN, L.PACK_MAX)
    this.nextSpawnAt = time + 900
  }

  // ------------------------------------------------------------- ceremonies

  private playLevelUp(from: number, to: number, n: number): void {
    // Base Lv 10/20/30 are server milestones; 30 unlocks minting in the Rare Market
    const crossed = [30, 20, 10].find((m) => from < m && to >= m)
    const label =
      crossed === 30 ? 'RARE DROPS UNLOCKED!' : crossed ? `LEVEL ${crossed}!` : n > 1 ? `LEVEL UP ×${n}!` : 'LEVEL UP!'
    const sub = crossed === 30 ? `Lv ${from} → ${to} · mint & sell in the Rare Market` : `Lv ${from} → ${to}`
    this.fx.levelUp(L.TRAINER_X, L.TRAINER_FEET, label, sub)
    if (crossed === 30) this.fx.confettiBurst(L.TRAINER_X, L.TRAINER_FEET - L.TRAINER_H, 40)
    this.time.delayedCall(1300, () => this.roosterCrow()) // after the slam sub-line fades
    this.trainerBob?.remove()
    this.trainerBob = null
    this.tweens.chain({
      targets: this.trainer,
      tweens: [
        { y: L.TRAINER_FEET - 60, duration: 260, ease: 'Quad.easeOut', yoyo: true },
      ],
      onComplete: () => {
        this.tweens.add({
          targets: this.trainerBody,
          scaleX: 1.1,
          scaleY: 0.9,
          duration: 90,
          yoyo: true,
          onComplete: () => this.startTrainerBob(),
        })
      },
    })
  }

  private playRoosterLevelUp(from: number, to: number): void {
    this.fx.levelUp(L.ROOSTER_X, L.ROOSTER_FEET, 'ROOSTER LEVEL UP!', `${this.player.rooster.name} · Lv ${from} → ${to}`, true)
    this.roosterCheer()
  }

  /** Two quick hops — the rooster reacts to good news. */
  private roosterCheer(): void {
    if (this.roosterChain?.isPlaying()) return
    this.roosterBob?.remove()
    this.roosterBob = null
    this.rooster.setPosition(L.ROOSTER_X, L.ROOSTER_FEET)
    this.tweens.chain({
      targets: this.rooster,
      tweens: [
        { y: L.ROOSTER_FEET - 70, duration: 200, ease: 'Quad.easeOut', yoyo: true },
        { y: L.ROOSTER_FEET - 50, duration: 170, ease: 'Quad.easeOut', yoyo: true },
      ],
      onComplete: () => this.startRoosterBob(),
    })
  }

  /** Above 90% of the rooster's level, the aura pulses hard. */
  private updateRoosterPulse(): void {
    const r = this.player.rooster
    const hot = r.exp / Math.max(1, expToNext(r.level)) >= 0.9
    if (hot === this.roosterHot) return
    this.roosterHot = hot
    this.roosterPulse?.remove()
    this.roosterPulse = null
    if (hot) {
      this.roosterPulse = this.tweens.add({
        targets: this.roosterAura,
        alpha: { from: 0.7, to: 1 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      })
    } else {
      this.roosterAura.setAlpha(0.7)
    }
  }

  // ------------------------------------------------------- server truth sync

  /** Base EXP the server granted between two states (level-ups reset `exp`). */
  private expGain(prev: Player, next: Player): number {
    let gain = next.exp - prev.exp
    for (let lv = prev.baseLevel; lv < next.baseLevel; lv++) gain += expToNext(lv)
    return Math.max(0, gain)
  }

  /**
   * One credit per server kill, EXP split evenly (remainder on the last). A backlog
   * longer than KILL_SNAP_LAG folds its oldest credits into one, so the KILL chip
   * catches up on the next visual kill and the pops still sum to the real delta.
   */
  private pushCredits(kills: number, exp: number, coins: number): void {
    if (kills <= 0) {
      // EXP / coins without a kill (should not happen) ride along with the next credit
      if (exp > 0 || coins > 0) this.credits.push({ exp, kills: 0, coins })
      return
    }
    const each = Math.floor(exp / kills)
    const eachCoin = Math.floor(coins / kills)
    for (let i = 0; i < kills; i++) {
      const last = i === kills - 1
      this.credits.push({
        exp: last ? exp - each * (kills - 1) : each,
        kills: 1,
        coins: last ? coins - eachCoin * (kills - 1) : eachCoin,
      })
    }
    const pending = this.credits.reduce((n, c) => n + c.kills, 0)
    if (pending > JUICE.KILL_SNAP_LAG) {
      let fold = { exp: 0, kills: 0, coins: 0 }
      while (this.credits.length > 0 && pending - fold.kills > JUICE.KILL_SNAP_LAG) {
        const c = this.credits.shift()
        if (!c) break
        fold = { exp: fold.exp + c.exp, kills: fold.kills + c.kills, coins: fold.coins + c.coins }
      }
      this.credits.unshift(fold)
    }
  }

  private applyState(player: Player, drops: Drop[], demoMode: boolean): void {
    const prev = this.player
    this.player = player
    this.demoMode = demoMode
    this.syncLog.push({ t: this.time.now, kills: player.killCount })
    if (this.syncLog.length > 8) this.syncLog.shift()
    this.tuneCadence()

    this.trainerPlate.setMain(this.trainerLabel())
    this.roosterPlate.setMain(this.roosterLabel())
    this.applyPowerTiers()
    if (player.mapId !== this.map.id && MAPS[player.mapId]) {
      // the zone banner is a strong beat: it follows the RARE DROPS UNLOCKED! slam
      const next = MAPS[player.mapId]
      const wait = player.baseLevel > prev.baseLevel ? 2600 : 0
      this.time.delayedCall(wait, () => this.changeZone(next))
    }

    if (player.baseLevel > prev.baseLevel) {
      this.playLevelUp(prev.baseLevel, player.baseLevel, player.baseLevel - prev.baseLevel)
      this.bridge.emit('levelup', { level: player.baseLevel })
    }
    if (player.rooster.level > prev.rooster.level) {
      this.playRoosterLevelUp(prev.rooster.level, player.rooster.level)
      this.bridge.emit('rooster-levelup', { level: player.rooster.level })
    }
    this.updateRoosterPulse()
    if (player.baseLevel === prev.baseLevel && player.exp > prev.exp && this.time.now - this.lastSparkleAt > 2200) {
      this.lastSparkleAt = this.time.now
    }

    // kill credits: the server's kill delta carries its real EXP delta
    const prevKills = this.killServer
    this.killServer = player.killCount
    const prevCoins = this.serverCoins(prev)
    const nextCoins = this.serverCoins(player)
    const coinGain = prevCoins !== null && nextCoins !== null ? Math.max(0, nextCoins - prevCoins) : 0
    if (nextCoins !== null && !this.coinsKnown) this.readCoins(player)
    this.pushCredits(player.killCount - prevKills, this.expGain(prev, player), coinGain)
    if (this.killShown > this.killServer) {
      this.killShown = this.killServer
      this.killChip.setLabel(this.killLabel())
      this.pinChips()
    }
    this.pips.set(this.killServer % this.bossEvery(), this.bossEvery())
    this.updateBossShadow()

    // every 10th server-confirmed kill gets a slam (after a level-up slam, if any)
    if (Math.floor(this.killServer / 10) > Math.floor(prevKills / 10)) {
      const n = Math.floor(this.killServer / 10) * 10
      const wait = player.baseLevel > prev.baseLevel ? 1700 : 0
      this.time.delayedCall(wait, () => {
        this.fx.slam(`${n.toLocaleString('en-US')} PESTS CLEARED!`, undefined, 300)
        this.fx.shake(JUICE.SHAKE_KILL)
        this.killChip.pop()
      })
    }

    // boss: follow the server's fight
    const every = this.bossEvery()
    const crossed = Math.floor(this.killServer / every) > Math.floor(prevKills / every)
    const fighting = this.killServer % every === every - 1
    if (this.bossActive) {
      if (crossed) this.slayBoss()
      else this.mirrorBossHp(player)
    } else if (this.map.mvp && (fighting || crossed)) {
      this.startBoss(crossed && !fighting)
    }

    this.queueLoot(prev, player)

    for (const drop of drops) {
      if (this.dropIds.has(drop.dropId)) continue
      this.dropIds.add(drop.dropId)
      if (!MINTABLE.includes(drop.rarity)) continue
      this.bridge.emit('drop', { dropId: drop.dropId, itemId: drop.itemId, rarity: drop.rarity })
      // several drops can confirm in one poll — one ceremony per 8s
      if (this.time.now - this.lastJackpotAt < JUICE.JACKPOT_THROTTLE) continue
      this.lastJackpotAt = this.time.now
      this.playDropMoment(drop.itemId, drop.rarity)
    }
  }

  /**
   * Drop moment: the card pops out of the enemy that dropped it under a beam in
   * its rarity colour, holds, then flies to the bottom-right edge (where the HUD's
   * Rare drops button sits) with a tick. Legendary and above also get a full-width
   * in-canvas banner; the React toast stays small and docked.
   */
  private playDropMoment(itemId: number, rarity: Rarity): void {
    const color = RARITY_COLORS[rarity] ?? INK.gold
    const edge = { x: L.W - 200, y: L.H - 40 }
    this.fx.jackpot(this.lastKillX, this.lastKillY, itemKey(itemId), rarity, {
      x: edge.x,
      y: edge.y,
      onArrive: () => {
        this.fx.tick(edge.x, edge.y - 40, '+1 rare drop', INK.crit, 34)
        this.fx.sparkle(edge.x, edge.y - 10, 8, color)
      },
    })
    const label = rarity === 'mvp_card' ? 'MVP CARD DROP!' : rarity === 'monster_card' ? 'MONSTER CARD DROP!' : 'LEGENDARY DROP!'
    new Ribbon(this, label, this.font, 250, color).play(1300, this.reduced)
    this.roosterWide()
  }

  /** Eyes wide (1.1× for a beat) plus the cheer hops — a rare drop just landed. */
  private roosterWide(): void {
    this.resetRoosterPose()
    this.roosterIdle = this.tweens.add({ targets: this.roosterBody, scale: 1.1, duration: 140, yoyo: true, hold: 600, ease: 'Back.easeOut' })
    this.roosterCheer()
  }

  /** The server moved the player to another map: the pack leaves, the backdrop re-tints, new pests walk in. */
  private changeZone(map: MapDef): void {
    // cross-fade: dip to dark, swap the palette underneath, come back up
    this.fx.dim(0.85, 350)
    this.time.delayedCall(380, () => {
      this.applyZone()
      this.fx.dim(0, 700)
    })
    this.map = map
    this.zone = zoneOf(map.id)
    this.pips.set(this.killServer % this.bossEvery(), this.bossEvery())
    for (const p of this.pests) {
      p.dead = true
      p.walk?.remove()
      p.hop?.remove()
      p.plate.setVisible(false)
      p.bar.setVisible(false)
      this.tweens.add({ targets: p.container, x: p.container.x + 1400, duration: 520, ease: 'Cubic.easeIn', onComplete: () => p.container.destroy() })
    }
    for (const p of [...this.pests]) this.removePest(p)
    this.time.delayedCall(400, () => {
      new Ribbon(this, `NEW ZONE: ${map.name} · ${this.zone.en}`, this.font, 250, 0x5a3a8a).play(1600, this.reduced)
      this.fx.slam('NEW ZONE!', `${this.zone.en} · Lv ${map.lvRange[0]}–${map.lvRange[1]}`, 440, INK.crit)
    })
    this.nextSpawnAt = this.time.now + 1300
  }

  // -------------------------------------------------------------------- loop

  update(time: number, delta: number): void {
    this.fx.syncTime()
    if (this.fx.frozen) {
      // hold every timer while the world is stopped; the victim vibrates
      this.nextTrainerAt += delta
      this.nextRoosterAt += delta
      this.nextBossAt += delta
      this.nextSpawnAt += delta
      const v = this.victim
      if (v && !v.dead && !this.reduced) v.container.x = v.baseX + (Math.random() * 2 - 1) * JUICE.JITTER
      return
    }
    this.victim = null

    // keep the pack stocked (never during a boss)
    if (!this.bossActive) {
      if (this.forceBoss && this.map.mvp) {
        this.startBoss(true)
        return
      }
      if (time >= this.nextPackRollAt) {
        this.nextPackRollAt = time + 20000
        this.packTarget = Phaser.Math.Between(L.PACK_MIN, L.PACK_MAX)
      }
      if (this.pests.length < this.packTarget && time >= this.nextSpawnAt) {
        const counts = ROWS.map((r) => this.rowPests(r).length)
        const min = Math.min(...counts)
        const lanes = ROWS.filter((r) => counts[r] === min)
        this.spawnPest(Phaser.Utils.Array.GetRandom(lanes))
        this.nextSpawnAt = time + Phaser.Math.Between(350, 650)
      }
    }

    if (time >= this.nextTrainerAt) this.trainerAttack(time)
    if (time >= this.nextRoosterAt) this.roosterAttack(time)
    if (this.bossActive && time >= this.nextBossAt) this.bossAttack(time)
  }
}

// ------------------------------------------------------------------ bootstrap

/** Create the Phaser game bound to a DOM container. Called by the bridge. */
export function createIdleGame(
  container: HTMLElement,
  opts: SceneMountOptions,
  bridge: SceneBridge,
): Phaser.Game {
  // dev-only: `?renderer=canvas` forces the Canvas renderer (headless capture rigs
  // without a GPU crawl on software WebGL), and the game is exposed for fps probes
  const forceCanvas = DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('renderer') === 'canvas'
  const game = new Phaser.Game({
    type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
    parent: container,
    width: L.W,
    height: L.H,
    backgroundColor: '#fbe6b3',
    banner: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })
  game.scene.add('idle', IdleScene, true, { bridge, opts })
  // Phaser polls the parent size every 500ms; the frame also changes size on its
  // own (the HUD mounts below it after the canvas) and a stale canvas is clipped by
  // the frame's overflow-hidden. Re-fit immediately — read the bounds first, or
  // refresh() computes the FIT from the stale parent size.
  const refit = (): void => {
    if (game.scale.getParentBounds()) game.scale.refresh()
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refit) : null
  ro?.observe(container)
  // belt and braces for the first seconds, while the HUD below the frame settles
  const timers = [300, 1000, 2500, 5000].map((ms) => window.setTimeout(refit, ms))
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    ro?.disconnect()
    for (const t of timers) window.clearTimeout(t)
  })
  if (DEV) (window as unknown as { __rfcGame?: Phaser.Game }).__rfcGame = game
  return game
}
