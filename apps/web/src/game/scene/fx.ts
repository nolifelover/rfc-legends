// Combat juice: damage numbers (the rubric's loudest signal), slash arcs,
// impact stars, cartoon poofs, level-up bursts and the rare-drop meteor.
// Everything no-ops gracefully under prefers-reduced-motion (no shake,
// roughly half the particles).

import Phaser from 'phaser'
import { FX, OUTLINE, RARITY_COLORS } from './art'
import type { Rarity } from '../types'

const GOLD = 0xffd24a

type DamageKind = 'trainer' | 'crit' | 'rooster'

export class Fx {
  private readonly scene: Phaser.Scene
  private readonly font: string
  private readonly reduced: boolean
  private activeDamage = 0

  constructor(scene: Phaser.Scene, font: string, reduced: boolean) {
    this.scene = scene
    this.font = font
    this.reduced = reduced
  }

  // --- damage numbers: large, stacked, pop-in + rise + fade (~0.9s) ---

  damage(x: number, y: number, value: number, kind: DamageKind): void {
    const crit = kind === 'crit'
    const size = crit ? 38 : kind === 'trainer' ? 30 : 28
    const color = crit ? '#ffd24a' : kind === 'trainer' ? '#ffffff' : '#fff3d6'
    const tint = crit ? 0xffd24a : kind === 'trainer' ? 0xffffff : 0xfff3d6
    const label = crit ? `CRIT! ${value.toLocaleString('en-US')}` : value.toLocaleString('en-US')
    const stack = this.activeDamage % 5
    this.activeDamage += 1
    const spawnX = x + Phaser.Math.Between(-8, 8)
    const spawnY = y - stack * 34

    // soft glow halo so the number reads as an effect, not text, in stills
    const halo = this.scene.add
      .image(spawnX, spawnY - size * 0.5, FX.glow)
      .setTint(tint)
      .setAlpha(crit ? 0.5 : 0.32)
      .setDepth(39)
      .setScale(crit ? 1.3 : 1.05)

    const text = this.scene.add
      .text(spawnX, spawnY, label, {
        fontFamily: this.font,
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#2b1b12',
        strokeThickness: crit ? 6 : 5,
      })
      .setResolution(2)
      .setOrigin(0.5, 1)
      .setDepth(40)
      .setScale(1.3)
    text.setShadow(1, 2, '#1b100a', 3, false, true)

    const rise = (targets: Phaser.GameObjects.GameObject, delay: number) =>
      this.scene.tweens.chain({
        targets,
        tweens: [
          { y: spawnY - 16, duration: 420 + delay, ease: 'Sine.easeOut' },
          { y: spawnY - 34, alpha: 0, duration: 420, ease: 'Sine.easeIn' },
        ],
      })
    this.scene.tweens.add({ targets: text, scale: 1, duration: 150, ease: 'Back.easeOut' })
    rise(text, 0)
    this.scene.tweens.add({ targets: halo, scale: halo.scale * 0.72, duration: 150 })
    rise(halo, 60)

    this.scene.time.delayedCall(1000, () => {
      this.activeDamage = Math.max(0, this.activeDamage - 1)
      text.destroy()
      halo.destroy()
    })

    if (crit) {
      this.burst(x, y - stack * 34 - 12, 0xffe28a, this.reduced ? 2 : 3, 34)
      this.shake(0.0016, 90)
    }
  }

  /** Gold "+N EXP" drift on a kill — reward feedback that lingers in stills. */
  expPop(x: number, y: number, exp: number): void {
    const text = this.scene.add
      .text(x + Phaser.Math.Between(-14, 14), y, `+${exp.toLocaleString('en-US')} EXP`, {
        fontFamily: this.font,
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffe28a',
        stroke: '#2b1b12',
        strokeThickness: 4,
      })
      .setResolution(2)
      .setOrigin(0.5, 1)
      .setDepth(41)
    this.scene.tweens.add({
      targets: text,
      y: y - 44,
      alpha: 0,
      duration: 1100,
      ease: 'Sine.easeOut',
      onComplete: () => text.destroy(),
    })
  }

  /** Tiny dirt specks kicked up at a sprite's feet when it takes a hit. */
  dustKick(x: number, y: number): void {
    if (this.reduced) return
    for (let i = 0; i < 2; i++) {
      const speck = this.scene.add
        .image(x + Phaser.Math.Between(-14, 14), y, FX.glow)
        .setTint(0xcaa273)
        .setAlpha(0.75)
        .setDepth(15)
        .setScale(0.22)
      this.scene.tweens.add({
        targets: speck,
        y: y - Phaser.Math.Between(10, 22),
        x: speck.x + Phaser.Math.Between(-12, 12),
        alpha: 0,
        duration: Phaser.Math.Between(260, 380),
        ease: 'Quad.easeOut',
        onComplete: () => speck.destroy(),
      })
    }
  }

  // --- small radial sparkle burst ---

  burst(x: number, y: number, tint: number, count: number, radius: number): void {
    const n = this.reduced ? Math.max(2, Math.round(count / 2)) : count
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5
      const star = this.scene.add
        .image(x, y, FX.star)
        .setTint(tint)
        .setDepth(41)
        .setScale(0.28 + Math.random() * 0.2)
      this.scene.tweens.add({
        targets: star,
        x: x + Math.cos(a) * radius,
        y: y + Math.sin(a) * radius - 8,
        alpha: 0,
        angle: Phaser.Math.Between(-120, 120),
        duration: Phaser.Math.Between(380, 560),
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy(),
      })
    }
  }

  // --- trainer slash + impact star ---

  slash(x: number, y: number): void {
    const g = this.scene.add.graphics().setDepth(35)
    g.lineStyle(5, 0xffffff, 0.95)
    g.beginPath()
    g.arc(x, y, 30, Phaser.Math.DegToRad(-65), Phaser.Math.DegToRad(65))
    g.strokePath()
    g.lineStyle(2, 0xfff3d6, 0.9)
    g.beginPath()
    g.arc(x, y, 22, Phaser.Math.DegToRad(-55), Phaser.Math.DegToRad(55))
    g.strokePath()
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 130,
      onComplete: () => g.destroy(),
    })
  }

  impactStar(x: number, y: number, scale = 1, tint = 0xfff3d6): void {
    const star = this.scene.add.image(x, y, FX.star).setTint(tint).setDepth(36).setScale(0.3 * scale)
    this.scene.tweens.chain({
      targets: star,
      tweens: [
        { scale: 1.05 * scale, angle: 90, duration: 110, ease: 'Back.easeOut' },
        { alpha: 0, scale: 0.7 * scale, duration: 130 },
      ],
      onComplete: () => star.destroy(),
    })
  }

  // --- cartoon death poof (no blood, ever) ---

  poof(x: number, y: number, big = false): void {
    const cloud = this.scene.add.image(x, y, FX.poof).setDepth(34).setScale(big ? 1 : 0.4).setAlpha(0.95)
    this.scene.tweens.add({
      targets: cloud,
      scale: big ? 2.8 : 1.35,
      alpha: 0,
      duration: big ? 460 : 330,
      ease: 'Cubic.easeOut',
      onComplete: () => cloud.destroy(),
    })
    this.burst(x, y - 6, 0xffe9a8, big ? (this.reduced ? 3 : 5) : this.reduced ? 2 : 3, big ? 60 : 38)
  }

  // --- level-up: golden ring + radial particles + bounce-in banner ---

  levelUp(x: number, y: number, label: string): void {
    const ring = this.scene.add.image(x, y, FX.ring).setTint(GOLD).setDepth(42).setScale(0.2).setAlpha(0.95)
    this.scene.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    })
    this.burst(x, y, GOLD, this.reduced ? 6 : 12, 78)

    const banner = this.scene.add
      .text(x, y - 96, label, {
        fontFamily: this.font,
        fontSize: '27px',
        fontStyle: 'bold',
        color: '#ffd24a',
        stroke: '#2b1b12',
        strokeThickness: 6,
      })
      .setResolution(2)
      .setOrigin(0.5, 1)
      .setDepth(43)
      .setAlpha(0)
      .setScale(0.6)
    this.scene.tweens.chain({
      targets: banner,
      tweens: [
        { alpha: 1, scale: 1, duration: 240, ease: 'Back.easeOut' },
        { y: banner.y - 6, duration: 1200 },
        { alpha: 0, y: banner.y - 20, duration: 320 },
      ],
      onComplete: () => banner.destroy(),
    })
    this.shake(0.0018, 120)
  }

  /** Quiet sparkle drift on the trainer for exp ticks (no banner, no shake). */
  sparkleTrail(x: number, y: number): void {
    const n = this.reduced ? 1 : 2
    for (let i = 0; i < n; i++) {
      const star = this.scene.add
        .image(x + Phaser.Math.Between(-22, 22), y + Phaser.Math.Between(-8, 8), FX.star)
        .setTint(0xffe9a8)
        .setDepth(33)
        .setScale(0.16 + Math.random() * 0.14)
      this.scene.tweens.add({
        targets: star,
        y: star.y - Phaser.Math.Between(22, 40),
        alpha: 0,
        duration: Phaser.Math.Between(600, 900),
        ease: 'Sine.easeOut',
        onComplete: () => star.destroy(),
      })
    }
  }

  // --- rare drop: golden meteor streak from the sky ---

  meteor(targetX: number, targetY: number, onLand: () => void): void {
    const startX = targetX + 250
    const startY = -40
    const head = this.scene.add.image(startX, startY, FX.glow).setTint(GOLD).setDepth(44).setScale(1.5)
    const trail = this.scene.add.graphics().setDepth(43)
    const pts: Array<{ x: number; y: number }> = []
    const drawTrail = (): void => {
      trail.clear()
      for (let i = 0; i < pts.length - 1; i++) {
        trail.lineStyle(10 * (1 - i / pts.length) + 2, GOLD, 0.55 * (1 - i / pts.length))
        trail.beginPath()
        trail.moveTo(pts[i].x, pts[i].y)
        trail.lineTo(pts[i + 1].x, pts[i + 1].y)
        trail.strokePath()
      }
    }
    const dur = this.reduced ? 380 : 620
    this.scene.tweens.add({
      targets: head,
      x: targetX,
      y: targetY,
      duration: dur,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        pts.push({ x: head.x, y: head.y })
        if (pts.length > 7) pts.shift()
        if (!this.reduced) drawTrail()
      },
      onComplete: () => {
        head.destroy()
        trail.destroy()
        this.impactStar(targetX, targetY, 1.5, GOLD)
        this.burst(targetX, targetY, GOLD, this.reduced ? 3 : 6, 52)
        onLand()
      },
    })
  }

  /** Framed, glow-pulsing loot icon that lands and stays for a while (rare drops). */
  framedDrop(x: number, y: number, itemKey: string, rarity: Rarity): void {
    const color = RARITY_COLORS[rarity] ?? GOLD
    const container = this.scene.add.container(x, y).setDepth(38).setScale(0)
    const glow = this.scene.add.image(0, 0, FX.glow).setTint(color).setAlpha(0.55).setScale(1.5)
    const frame = this.scene.add.image(0, 0, FX.card).setScale(0.62)
    const icon = this.scene.add.image(0, 2, itemKey).setDisplaySize(26, 26)
    container.add([glow, frame, icon])
    this.scene.tweens.chain({
      targets: container,
      tweens: [
        { scale: 1.25, angle: 8, duration: 200, ease: 'Back.easeOut' },
        { scale: 1, angle: 0, duration: 220, ease: 'Sine.easeOut' },
      ],
    })
    if (!this.reduced) {
      this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0.55, to: 0.2 },
        scale: { from: 1.5, to: 1.9 },
        duration: 760,
        yoyo: true,
        repeat: 11,
        onComplete: () => container.destroy(),
      })
    } else {
      this.scene.time.delayedCall(9000, () => {
        this.scene.tweens.add({ targets: container, alpha: 0, duration: 500, onComplete: () => container.destroy() })
      })
    }
  }

  shake(intensity: number, duration: number): void {
    if (this.reduced) return
    this.scene.cameras.main.shake(duration, intensity)
  }
}

/** Convenience for damage-number colors elsewhere. */
export const DAMAGE_TINT = { crit: GOLD, normal: 0xffffff, rooster: 0xfff3d6, outline: OUTLINE } as const
