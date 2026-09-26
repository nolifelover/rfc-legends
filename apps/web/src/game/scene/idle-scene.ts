// The Home Fields idle combat scene — 960×540, Phaser 3.
//
// Cosmetic combat loop: trainer + rooster whittle a monster that cycles through
// the THUNG_NA roster (MVP ราชาหนูนา every 8th kill in demo mode / 25th
// otherwise). Server truth arrives every few seconds via applyState() and
// drives level-up bursts, rare-drop meteors and the KILL counter; the numbers
// on screen are plausible renderings, the engine stays authoritative.

import Phaser from 'phaser'
import {
  ART,
  CLOUD_KEYS,
  FX,
  MONSTER_KEYS,
  ROOSTER_KEYS,
  TRAINER_KEY,
  ensureFallbacks,
  itemKey,
  makeFxTextures,
} from './art'
import { BossBar, Chip, MiniHpBar, Nameplate } from './overlays'
import { Fx } from './fx'
import type { SceneBridge, SceneMountOptions } from './scene-bridge'
import { THUNG_NA } from '@/game/data/maps'
import type { Drop, MonsterDef, Player, Rarity } from '@/game/types'
import { aspdOf, atkOf, critChance, roosterAspd, roosterAtk, roosterCrit } from '@/server/game/stats'

const W = 960
const H = 540
const FEET_Y = 486 // actors' feet line (inside the warm ground lane)
const TRAINER_X = 282
const ROOSTER_X = 362
const MONSTER_X = 664
const LOOT_Y = 508 // where dropped icons come to rest

const EN_NAMES: Record<string, string> = {
  'nu-na': 'Field Rat',
  'takka-taen-yak': 'Giant Locust',
  'pu-na': 'Rice Crab',
  'raja-nu-na': 'Rat King',
}

/** Display heights on the 960×540 stage (boss ≈ 1.8× a regular mob). */
const DISPLAY_H: Record<string, number> = {
  'nu-na': 84,
  'takka-taen-yak': 94,
  'pu-na': 74,
  'raja-nu-na': 152,
}

const MINTABLE: readonly Rarity[] = ['legendary', 'monster_card', 'mvp_card']

interface ActiveMonster {
  def: MonsterDef
  hp: number
  maxHp: number
  container: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Image
  plate: Nameplate
  bar: MiniHpBar
  topY: number
  baseX: number
  /** false while the entrance tween is still moving the container. */
  ready: boolean
}

export class IdleScene extends Phaser.Scene {
  private bridge!: SceneBridge
  private opts!: SceneMountOptions
  private fx!: Fx
  private font = 'Arial'
  private reduced = false

  private player!: Player
  private dropIds = new Set<string>()
  private demoMode = false

  private killServer = 0
  private killLocal = 0
  private killsTowardBoss = 0
  private lastSparkleAt = 0

  private killChip!: Chip
  private trainer!: Phaser.GameObjects.Image
  private trainerPlate!: Nameplate
  private rooster!: Phaser.GameObjects.Image
  private roosterPlate!: Nameplate

  private monster: ActiveMonster | null = null
  private bossBar: BossBar | null = null
  private respawnAt: number | null = 0

  private trainerCd = 900
  private roosterCd = 1100
  private nextTrainerAt = 0
  private nextRoosterAt = 0
  private nextBossAt = 0
  private trainerLunge: Phaser.Tweens.Tween | null = null
  private roosterLunge: Phaser.Tweens.Tween | null = null
  /** Combined cosmetic DPS — monster visual HP is derived from it for pacing. */
  private visualDps = 40
  private lastMeteorAt = -99999

  private groundLoot: Phaser.GameObjects.Image[] = []
  private motes: Array<{ img: Phaser.GameObjects.Image; ax: number; ay: number; phase: number; speed: number }> = []

  constructor() {
    super('idle')
  }

  init(data: { bridge: SceneBridge; opts: SceneMountOptions }): void {
    this.bridge = data.bridge
    this.opts = data.opts
  }

  preload(): void {
    for (const spec of ART) this.load.svg(spec.key, spec.url, { width: spec.w, height: spec.h })
  }

  create(): void {
    this.font = this.opts.fontFamily
    this.reduced = this.opts.reducedMotion
    this.demoMode = this.opts.demoMode
    this.player = this.opts.player
    for (const d of this.opts.drops) this.dropIds.add(d.dropId)
    this.killServer = this.player.killCount
    this.fx = new Fx(this, this.font, this.reduced)

    ensureFallbacks(this)
    makeFxTextures(this)
    this.buildBackground()
    this.buildActors()
    this.buildChips()
    this.buildMotes()
    this.scheduleBird()

    // Combat cadence from live stats, clamped so the scene always looks alive.
    this.tuneCadence()

    this.bridge.sceneReady({
      updateState: (player, drops, demoMode) => this.applyState(player, drops, demoMode),
      destroy: () => this.game.destroy(true),
    })
  }

  // ---------------------------------------------------------------- background

  private buildBackground(): void {
    this.add.image(0, 0, 'art-sky').setOrigin(0, 0).setDepth(0)

    // drifting clouds (art lane's variants) — parallax at different speeds/altitudes
    // (rasters are 2×, so scale ~0.6-0.8 shows clouds at slightly over design size)
    const clouds: Array<[string, number, number, number, number, number]> = [
      // key, x, y, scale, alpha, duration(ms per crossing)
      [CLOUD_KEYS.stratus, -180, 46, 0.62, 0.8, 112000],
      [CLOUD_KEYS.puffy, 360, 100, 0.7, 0.92, 80000],
      [CLOUD_KEYS.tower, 740, 60, 0.7, 0.78, 94000],
    ]
    for (const [key, x, y, s, a, dur] of clouds) {
      const cloud = this.add.image(x, y, key).setOrigin(0, 0.5).setDepth(2).setScale(s).setAlpha(a)
      this.tweens.add({
        targets: cloud,
        x: W + 80,
        duration: dur,
        repeat: -1,
        onRepeat: () => cloud.setX(-260 + Phaser.Math.Between(-40, 40)),
      })
    }

    // hills → paddy → ground bands, back to front (art-QA verified composite)
    this.add.image(0, 240, 'art-hills').setOrigin(0, 0).setDepth(4)
    this.add.image(0, 360, 'art-paddy').setOrigin(0, 0).setDepth(6)

    // water shimmer: alternating alpha tweens on soft highlight rects
    const shimmers: Array<[number, number, number, number]> = [
      [130, 376, 1.4, 0],
      [420, 392, 1.1, 400],
      [700, 372, 1.6, 800],
      [250, 404, 1.2, 200],
    ]
    for (const [x, y, s, delay] of shimmers) {
      const sh = this.add.image(x, y, FX.shimmer).setDepth(7).setScale(s, s * 0.9).setAlpha(0)
      this.tweens.add({
        targets: sh,
        alpha: { from: 0, to: 0.75 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        delay,
        ease: 'Sine.easeInOut',
      })
    }

    this.add.image(0, 420, 'art-ground').setOrigin(0, 0).setDepth(10)

    // props: paddy-edge first, then ground-lane
    this.add.image(508, 398, 'art-prop-scarecrow').setOrigin(0.5, 1).setDepth(8).setScale(1.05)
    this.add.image(158, 400, 'art-prop-rice-bundle').setOrigin(0.5, 1).setDepth(8)
    this.add.image(626, 404, 'art-prop-fence').setOrigin(0.5, 1).setDepth(8).setScale(0.85)
    this.add.image(96, 512, 'art-prop-hay-bale').setOrigin(0.5, 1).setDepth(12).setScale(1.15)
    this.add.image(884, 514, 'art-prop-water-jar').setOrigin(0.5, 1).setDepth(12).setScale(1.1)
  }

  private buildMotes(): void {
    for (let i = 0; i < 3; i++) {
      const img = this.add
        .image(0, 0, FX.glow)
        .setTint(0xffe9a8)
        .setDepth(16)
        .setScale(0.22 + i * 0.06)
        .setAlpha(0.4)
      this.motes.push({
        img,
        ax: 180 + i * 260,
        ay: 330 + (i % 2) * 90,
        phase: i * 2.1,
        speed: 0.00042 + i * 0.00013,
      })
    }
  }

  private scheduleBird(): void {
    this.time.addEvent({
      delay: Phaser.Math.Between(14000, 22000),
      callback: () => {
        const y = Phaser.Math.Between(60, 130)
        const bird = this.add.image(-50, y, FX.bird).setDepth(3).setScale(1.4).setAlpha(0.8)
        this.tweens.add({ targets: bird, scaleY: { from: 1.4, to: 0.6 }, duration: 170, yoyo: true, repeat: 60 })
        this.tweens.add({
          targets: bird,
          x: W + 60,
          y: y + Phaser.Math.Between(-30, 30),
          duration: Phaser.Math.Between(8000, 11000),
          ease: 'Sine.easeInOut',
          onComplete: () => {
            bird.destroy()
            this.scheduleBird()
          },
        })
      },
    })
  }

  // ------------------------------------------------------------------- actors

  private buildActors(): void {
    this.trainer = this.add.image(TRAINER_X, FEET_Y, TRAINER_KEY).setOrigin(0.5, 1).setDepth(20).setDisplaySize(116, 116)
    this.trainerPlate = new Nameplate(this, this.trainerLabel(), { fontFamily: this.font })
    this.trainerPlate.placeAbove(TRAINER_X, FEET_Y - 116 - 34)
    this.tweens.add({
      targets: this.trainer,
      y: FEET_Y - 5,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    const roosterKey = ROOSTER_KEYS[this.player.rooster.sireLine] ?? ROOSTER_KEYS.thepbut
    this.rooster = this.add.image(ROOSTER_X, FEET_Y, roosterKey).setOrigin(0.5, 1).setDepth(21).setDisplaySize(88, 88)
    this.roosterPlate = new Nameplate(this, this.roosterLabel(), { fontFamily: this.font, fontSize: 13 })
    this.roosterPlate.placeAbove(ROOSTER_X, FEET_Y - 88 - 30)
    this.tweens.add({
      targets: this.rooster,
      y: FEET_Y - 4,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private buildChips(): void {
    const mapChip = new Chip(this, `${THUNG_NA.name} · Home Fields`, { fontFamily: this.font, fontSize: 14 })
    mapChip.container.setDepth(54).setPosition(14 + mapChip.boxWidth / 2, 26)

    this.killChip = new Chip(this, this.killLabel(), { fontSize: 16, accent: 0xe0a93e })
    this.killChip.container.setDepth(54)
    this.pinKillChip()
  }

  private pinKillChip(): void {
    this.killChip.container.setPosition(W - 14 - this.killChip.boxWidth / 2, 26)
  }

  private trainerLabel(): string {
    return `${this.player.name} · Lv.${this.player.baseLevel}`
  }

  private roosterLabel(): string {
    return `${this.player.rooster.name} · Lv.${this.player.rooster.level}`
  }

  private killLabel(): string {
    return `KILL ${(this.killServer + this.killLocal).toLocaleString('en-US')}`
  }

  // ------------------------------------------------------------------ combat

  private tuneCadence(): void {
    const tAspd = Phaser.Math.Clamp(aspdOf(this.player), 0.6, 1.4)
    const rAspd = Phaser.Math.Clamp(roosterAspd(this.player.rooster), 0.6, 1.4)
    this.trainerCd = Math.round(1000 / tAspd)
    this.roosterCd = Math.round(1000 / rAspd)
    const tAtk = atkOf(this.player) + this.player.baseLevel * 2
    const rAtk = roosterAtk(this.player.rooster) + this.player.rooster.level * 1.5
    this.visualDps = Math.max(8, tAtk * tAspd + rAtk * rAspd)
  }

  /**
   * Visual HP: sized from DPS so a regular mob dies in ~4.5s and the MVP in
   * ~14s at ANY player level — the fight always reads as busy, and the boss
   * bar always shows chunky plausible numbers (server numbers stay the truth).
   */
  private visualHp(def: MonsterDef): number {
    return Math.max(def.stats.hp, Math.round(this.visualDps * (def.isMvp ? 14 : 4.5)))
  }

  private pickMonster(): MonsterDef {
    const total = THUNG_NA.monsters.reduce((sum, s) => sum + s.weight, 0)
    let roll = Math.random() * total
    for (const s of THUNG_NA.monsters) {
      roll -= s.weight
      if (roll <= 0) return s.monster
    }
    return THUNG_NA.monsters[0].monster
  }

  private spawnMonster(time: number): void {
    const bossDue = this.killsTowardBoss >= (this.demoMode ? 8 : 25)
    const def = bossDue && THUNG_NA.mvp ? THUNG_NA.mvp : this.pickMonster()
    const displayH = DISPLAY_H[def.id] ?? 84
    const key = MONSTER_KEYS[def.id] ?? MONSTER_KEYS['nu-na']
    const isBoss = !!def.isMvp
    const baseX = MONSTER_X + (isBoss ? -10 : 0)

    const container = this.add.container(1040, FEET_Y).setDepth(22)
    // sprite bottom sits on the feet line
    const sprite = this.add.image(0, -displayH / 2, key).setDisplaySize(displayH, displayH)
    container.add(sprite)

    // idle wobble
    this.tweens.add({
      targets: sprite,
      scaleX: { from: sprite.scaleX, to: sprite.scaleX * 1.035 },
      scaleY: { from: sprite.scaleY, to: sprite.scaleY * 0.965 },
      duration: isBoss ? 900 : 640,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // enter from the right with a little hop
    this.tweens.add({ targets: container, x: baseX, duration: 460, ease: 'Sine.easeOut' })
    this.tweens.add({
      targets: container,
      y: FEET_Y - (isBoss ? 30 : 18),
      duration: 210,
      yoyo: true,
      ease: 'Quad.easeOut',
    })

    const en = EN_NAMES[def.id] ?? def.id
    const plate = new Nameplate(
      this,
      `${en} (${def.name})`,
      {
        fontFamily: this.font,
        fontSize: isBoss ? 16 : 14,
        color: isBoss ? '#ffe9a8' : '#fff8ec',
        sub: isBoss ? `MVP · Lv.${def.level}` : `Lv.${def.level}`,
      },
    )
    const bar = new MiniHpBar(this, isBoss ? 72 : 58)
    const topY = FEET_Y - displayH

    const hp = this.visualHp(def)
    this.monster = {
      def,
      hp,
      maxHp: hp,
      container,
      sprite,
      plate,
      bar,
      topY,
      baseX,
      ready: false,
    }
    this.time.delayedCall(540, () => {
      if (this.monster?.container !== container) return
      this.monster.ready = true
      plate.placeAbove(baseX, topY - 60)
      bar.placeAbove(baseX, topY - 16)
    })

    if (isBoss) {
      this.killsTowardBoss = 0
      this.bossEntrance(def, time)
    }
  }

  private bossEntrance(def: MonsterDef, time: number): void {
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xfff3c9, 0.5).setDepth(70)
    this.tweens.add({ targets: flash, alpha: 0, duration: 420, onComplete: () => flash.destroy() })

    if (!this.reduced) {
      const cam = this.cameras.main
      this.tweens.chain({
        targets: cam,
        tweens: [
          { zoom: 1.05, duration: 150, ease: 'Sine.easeOut' },
          { zoom: 1, duration: 300, ease: 'Sine.easeInOut' },
        ],
      })
    }

    this.bossBar = new BossBar(this, `Rat King ${THUNG_NA.mvp?.name ?? def.name}`, this.font)
    const hp = this.monster?.maxHp ?? this.visualHp(def)
    this.bossBar.setHp(hp, hp)
    this.bossBar.show(this.reduced)
    this.fx.burst(MONSTER_X, FEET_Y - 80, 0xffd24a, this.reduced ? 4 : 8, 70)
    this.nextBossAt = time + 2000
    this.bridge.emit('boss-spawn', { name: def.name })
  }

  private trainerAttack(time: number): void {
    this.nextTrainerAt = time + this.trainerCd
    const m = this.monster
    if (!m || m.hp <= 0) return
    this.trainerLunge?.remove()
    this.trainer.x = TRAINER_X
    this.trainerLunge = this.tweens.add({
      targets: this.trainer,
      x: TRAINER_X + 24,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
    })

    const atk = atkOf(this.player) + this.player.baseLevel * 2 // cosmetic weapon scaling
    // visual crit floor: real critChance is ~1-3% at low LUK, which would read
    // as "no crits ever" on camera — 8% keeps the gold numbers part of the loop
    const crit = Math.random() < Math.max(critChance(this.player), 0.08)
    const value = Math.max(4, Math.round(atk * (0.95 + Math.random() * 0.1) * (crit ? 1.5 : 1)))
    this.time.delayedCall(90, () => {
      if (this.monster !== m || m.hp <= 0) return
      this.fx.slash(m.container.x - 34, m.container.y - m.sprite.displayHeight * 0.55)
      this.fx.impactStar(m.container.x - 8, m.container.y - 34)
      this.hitMonster(m, value, crit ? 'crit' : 'trainer', time)
    })
  }

  private roosterAttack(time: number): void {
    this.nextRoosterAt = time + this.roosterCd
    const m = this.monster
    if (!m || m.hp <= 0) return
    this.roosterLunge?.remove()
    this.rooster.x = ROOSTER_X
    this.roosterLunge = this.tweens.add({
      targets: this.rooster,
      x: ROOSTER_X + 32,
      duration: 130,
      yoyo: true,
      ease: 'Quad.easeOut',
    })

    const atk = roosterAtk(this.player.rooster) + this.player.rooster.level * 1.5
    const crit = Math.random() < roosterCrit(this.player.rooster)
    const value = Math.max(3, Math.round(atk * (0.95 + Math.random() * 0.1) * (crit ? 1.5 : 1)))
    this.time.delayedCall(100, () => {
      if (this.monster !== m || m.hp <= 0) return
      this.fx.impactStar(m.container.x - 20, m.container.y - 26, 0.8, 0xfff3d6)
      this.hitMonster(m, value, crit ? 'crit' : 'rooster', time)
    })
  }

  private hitMonster(m: ActiveMonster, value: number, kind: 'trainer' | 'crit' | 'rooster', time: number): void {
    if (m.hp <= 0) return
    m.hp = Math.max(0, m.hp - value)
    // damage column rises beside the nameplate/bar, not through them
    this.fx.damage(m.container.x + 26, m.topY - 4, value, kind)
    this.fx.dustKick(m.container.x, FEET_Y - 4)
    m.bar.setPct(m.hp / m.maxHp)
    this.bossBar?.setHp(m.hp, m.maxHp)

    // white flash + knockback + squash
    m.sprite.setTintFill(0xffffff)
    this.time.delayedCall(70, () => m.sprite.clearTint())
    this.tweens.killTweensOf(m.container)
    m.container.x = m.baseX
    this.tweens.add({ targets: m.container, x: m.baseX + 8, duration: 70, yoyo: true, ease: 'Quad.easeOut' })
    this.tweens.add({
      targets: m.sprite,
      scaleX: m.sprite.scaleX * 0.92,
      scaleY: m.sprite.scaleY * 1.06,
      duration: 80,
      yoyo: true,
    })

    if (m.hp <= 0) this.killMonster(m, time)
  }

  private killMonster(m: ActiveMonster, time: number): void {
    this.killLocal += 1
    this.killsTowardBoss += 1
    this.killChip.setLabel(this.killLabel())
    this.pinKillChip()
    this.killChip.pop()

    const boss = !!m.def.isMvp
    this.fx.poof(m.container.x, m.container.y - (boss ? 70 : 40), boss)
    this.fx.expPop(m.container.x + 4, m.topY - 30, m.def.exp)

    // loot: ~35% of kills leave the monster's material on the ground
    if (m.def.materialItemId && Math.random() < 0.35) {
      this.dropGroundLoot(itemKey(m.def.materialItemId), m.container.x)
    }

    if (boss) {
      this.bossVictory(m)
      this.bridge.emit('boss-kill', { name: m.def.name })
    }

    m.plate.destroy()
    m.bar.destroy()
    m.container.destroy()
    this.monster = null
    this.respawnAt = time + 800
  }

  private bossVictory(m: ActiveMonster): void {
    this.bossBar?.hide()
    this.bossBar = null

    // framed card flies out toward the camera — the demo's money shot
    const card = this.add.container(m.container.x, m.container.y - 70).setDepth(46).setScale(0.5)
    const rays = this.add.image(0, 0, FX.glow).setTint(0xffd24a).setAlpha(0.7).setScale(2.6)
    const frame = this.add.image(0, 0, FX.card).setScale(0.8)
    const icon = this.add.image(0, 2, itemKey(m.def.cardId ?? 3001)).setDisplaySize(30, 30)
    card.add([rays, frame, icon])
    this.tweens.chain({
      targets: card,
      tweens: [
        { scale: 2.3, angle: 720, duration: 640, ease: 'Cubic.easeOut' },
        { alpha: 0, y: card.y - 30, duration: 320 },
      ],
      onComplete: () => card.destroy(),
    })
    this.fx.shake(0.003, 160)
  }

  private bossAttack(time: number): void {
    this.nextBossAt = time + Phaser.Math.Between(2200, 3000)
    const m = this.monster
    if (!m) return
    this.tweens.killTweensOf(m.container)
    m.container.x = m.baseX
    this.tweens.add({ targets: m.container, x: m.baseX - 44, duration: 150, yoyo: true, ease: 'Quad.easeIn' })
    this.time.delayedCall(140, () => {
      this.fx.slash(TRAINER_X + 40, FEET_Y - 60)
      this.fx.impactStar(TRAINER_X + 26, FEET_Y - 66, 1, 0xffb0a0)
      this.fx.shake(0.0022, 90)
    })
  }

  private dropGroundLoot(key: string, nearX: number): void {
    const x = Phaser.Math.Clamp(nearX + Phaser.Math.Between(-44, 30), 420, 940)
    const icon = this.add
      .image(x, LOOT_Y - 110, key)
      .setDepth(14)
      .setDisplaySize(38, 38)
      .setAngle(Phaser.Math.Between(-14, 14))
    this.groundLoot.push(icon)
    this.tweens.add({ targets: icon, y: LOOT_Y, duration: 520, ease: 'Bounce.easeOut' })
    // gentle shine so ground loot reads as loot, not scenery
    this.tweens.add({
      targets: icon,
      alpha: { from: 1, to: 0.72 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    if (this.groundLoot.length > 12) {
      const oldest = this.groundLoot.shift()
      if (oldest) {
        this.tweens.killTweensOf(oldest)
        this.tweens.add({ targets: oldest, alpha: 0, duration: 600, onComplete: () => oldest.destroy() })
      }
    }
  }

  // ------------------------------------------------------- server truth sync

  private applyState(player: Player, drops: Drop[], demoMode: boolean): void {
    const prev = this.player
    this.player = player
    this.demoMode = demoMode
    this.tuneCadence()

    this.trainerPlate.setMain(this.trainerLabel())
    this.roosterPlate.setMain(this.roosterLabel())

    if (player.baseLevel > prev.baseLevel) {
      this.fx.levelUp(TRAINER_X, FEET_Y - 70, `LEVEL UP! Lv.${player.baseLevel}`)
      this.bridge.emit('levelup', { level: player.baseLevel })
    }
    if (player.rooster.level > prev.rooster.level) {
      this.fx.levelUp(ROOSTER_X, FEET_Y - 56, `ROOSTER LEVEL UP! Lv.${player.rooster.level}`)
      this.bridge.emit('rooster-levelup', { level: player.rooster.level })
    }
    if (
      player.baseLevel === prev.baseLevel &&
      player.exp > prev.exp &&
      this.time.now - this.lastSparkleAt > 2200
    ) {
      this.lastSparkleAt = this.time.now
      this.fx.sparkleTrail(TRAINER_X, FEET_Y - 80)
    }

    // Server truth is the floor; the local counter only ever climbs (visual
    // kills land faster than the 4s syncs, and a counter that dips reads broken).
    if (player.killCount > this.killServer + this.killLocal) {
      this.killServer = player.killCount
      this.killLocal = 0
      this.killChip.setLabel(this.killLabel())
      this.pinKillChip()
      this.killChip.pop()
    } else {
      this.killServer = player.killCount
    }

    for (const drop of drops) {
      if (this.dropIds.has(drop.dropId)) continue
      this.dropIds.add(drop.dropId)
      if (!MINTABLE.includes(drop.rarity)) continue
      this.bridge.emit('drop', { dropId: drop.dropId, itemId: drop.itemId, rarity: drop.rarity })
      // demo syncs can confirm several drops per poll — celebrate at most one
      // meteor every 8s so the sky isn't pure falling gold
      if (this.time.now - this.lastMeteorAt < 8000) continue
      this.lastMeteorAt = this.time.now
      const landX = Phaser.Math.Between(380, 600)
      const key = itemKey(drop.itemId)
      this.fx.meteor(landX, LOOT_Y - 16, () => {
        this.fx.framedDrop(landX, LOOT_Y - 22, key, drop.rarity)
      })
    }
  }

  // -------------------------------------------------------------------- loop

  update(time: number): void {
    // pollen motes on sine paths
    for (const m of this.motes) {
      const t = time * m.speed + m.phase
      m.img.x = m.ax + Math.sin(t) * 90
      m.img.y = m.ay + Math.cos(t * 0.8) * 34
      m.img.alpha = 0.3 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2.4))
    }

    if (!this.monster && this.respawnAt !== null && time >= this.respawnAt) {
      this.respawnAt = null
      this.spawnMonster(time)
      return
    }

    const m = this.monster
    if (!m || !m.ready) return
    if (time >= this.nextTrainerAt) this.trainerAttack(time)
    if (this.monster && time >= this.nextRoosterAt) this.roosterAttack(time)
    if (this.monster?.def.isMvp && time >= this.nextBossAt) this.bossAttack(time)
  }
}

// ------------------------------------------------------------------ bootstrap

/** Create the Phaser game bound to a DOM container. Called by the bridge. */
export function createIdleGame(
  container: HTMLElement,
  opts: SceneMountOptions,
  bridge: SceneBridge,
): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: W,
    height: H,
    backgroundColor: '#fbe6b3',
    banner: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })
  game.scene.add('idle', IdleScene, true, { bridge, opts })
  return game
}
