// Canvas overlays that live above the actors: nameplates, HP bars under the feet,
// the MVP boss bar (with a ghost-HP trail), the top chips (map, KILL, Harvest),
// the boss countdown pips and the warning ribbon. All sizes are on the 1920×1080
// frame. The bottom HUD is React-only — nothing here draws near the bottom edge.

import Phaser from 'phaser'
import { INK, TYPE, fmt } from './juice'

const PLATE_BG = INK.plate
const PLATE_ALPHA = 0.86

export interface LabelStyle {
  fontSize?: number
  color?: string
  fontFamily?: string
  depth?: number
}

/** Dark pill with one bold line, e.g. "Verify Guy · Lv.5" or "Field Rat · Lv.2". */
/** Frame tier by real level: 0 bronze (<30), 1 silver (30–69), 2 gold (70+). */
export type Tier = 0 | 1 | 2
export const tierOf = (level: number): Tier => (level >= 70 ? 2 : level >= 30 ? 1 : 0)
const TIER_FRAME: Record<Tier, { color: number; width: number; glyph: string }> = {
  0: { color: 0xb87333, width: 2, glyph: '' },
  1: { color: 0xd6dde6, width: 4, glyph: '★ ' },
  2: { color: 0xffd24a, width: 6, glyph: '♛ ' },
}

export class Nameplate {
  readonly container: Phaser.GameObjects.Container

  private readonly bg: Phaser.GameObjects.Graphics
  private readonly main: Phaser.GameObjects.Text
  private tier: Tier | null = null
  private mainText = ''

  constructor(scene: Phaser.Scene, main: string, style: LabelStyle = {}) {
    this.container = scene.add.container(0, 0).setDepth(style.depth ?? 50)
    this.bg = scene.add.graphics()
    this.main = scene.add
      .text(0, 0, main, {
        fontFamily: style.fontFamily ?? 'Arial',
        fontSize: `${style.fontSize ?? 26}px`,
        fontStyle: 'bold',
        color: style.color ?? '#fff8ec',
      })
      .setOrigin(0.5, 0)
    this.container.add([this.bg, this.main])
    this.redraw()
    this.container.setVisible(false)
  }

  setMain(text: string): void {
    if (this.mainText === text) return
    this.mainText = text
    this.main.setText((this.tier !== null ? TIER_FRAME[this.tier].glyph : '') + text)
    this.redraw()
  }

  get width(): number {
    return this.main.width + 30
  }

  /** Bronze / silver / gold frame from the real level. */
  setTier(tier: Tier): void {
    if (this.tier === tier) return
    this.tier = tier
    const base = this.mainText || this.main.text
    this.mainText = base
    this.main.setText(TIER_FRAME[tier].glyph + base)
    this.main.setColor(tier === 2 ? '#ffe9a8' : this.main.style.color as string)
    this.redraw()
  }

  private redraw(): void {
    const w = this.main.width + 30
    const h = this.main.height + 12
    this.main.setPosition(0, 6)
    this.bg.clear()
    this.bg.fillStyle(PLATE_BG, PLATE_ALPHA)
    this.bg.fillRoundedRect(-w / 2, 0, w, h, 10)
    if (this.tier === null) {
      this.bg.lineStyle(2, 0xf3dfb2, 0.35)
      this.bg.strokeRoundedRect(-w / 2, 0, w, h, 10)
      return
    }
    const f = TIER_FRAME[this.tier]
    this.bg.lineStyle(f.width, f.color, 0.95)
    this.bg.strokeRoundedRect(-w / 2, 0, w, h, 10)
    if (this.tier === 2) {
      this.bg.lineStyle(1.5, 0xfff3d6, 0.7)
      this.bg.strokeRoundedRect(-w / 2 + 5, 5, w - 10, h - 10, 7)
    }
  }

  /** Top-centre anchor. */
  place(x: number, topY: number): void {
    this.container.setPosition(Math.round(x), Math.round(topY))
    this.container.setVisible(true)
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v)
  }

  destroy(): void {
    this.container.destroy()
  }
}

/** Current-HP bar drawn under a pest's feet (160×12 by default). */
export class HpBar {
  readonly container: Phaser.GameObjects.Container

  private readonly g: Phaser.GameObjects.Graphics
  private readonly width: number
  private readonly h: number
  private pct = 1

  constructor(scene: Phaser.Scene, width = 160, height = 12, depth = 50) {
    this.container = scene.add.container(0, 0).setDepth(depth)
    this.g = scene.add.graphics()
    this.width = width
    this.h = height
    this.container.add(this.g)
    this.draw()
    this.container.setVisible(false)
  }

  private draw(): void {
    const { g, width, h, pct } = this
    const w = Math.max(3, (width - 4) * Phaser.Math.Clamp(pct, 0, 1))
    g.clear()
    g.fillStyle(INK.outline, 0.92)
    g.fillRoundedRect(-width / 2, -h / 2, width, h, h / 2)
    g.fillStyle(0x57301f)
    g.fillRoundedRect(-width / 2 + 2, -h / 2 + 2, width - 4, h - 4, (h - 4) / 2)
    g.fillStyle(pct > 0.5 ? 0x62b04e : pct > 0.25 ? 0xe0a93e : 0xe2574c, 1)
    g.fillRoundedRect(-width / 2 + 2, -h / 2 + 2, w, h - 4, (h - 4) / 2)
    g.fillStyle(0xffffff, 0.22)
    g.fillRoundedRect(-width / 2 + 2, -h / 2 + 2, w, (h - 4) / 2.4, (h - 4) / 2.4)
  }

  setPct(pct: number): void {
    this.pct = pct
    this.draw()
  }

  place(x: number, y: number): void {
    this.container.setPosition(Math.round(x), Math.round(y))
    this.container.setVisible(true)
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v)
  }

  destroy(): void {
    this.container.destroy()
  }
}

/** Ornate top-centre boss bar: gold trim, name, compact cur/max and a pale ghost trail. */
export class BossBar {
  readonly container: Phaser.GameObjects.Container

  private readonly scene: Phaser.Scene
  private readonly g: Phaser.GameObjects.Graphics
  private readonly nameText: Phaser.GameObjects.Text
  private readonly hpText: Phaser.GameObjects.Text
  private readonly width = 920
  private readonly height = 64
  private readonly restY = 150
  private pct = 1
  private ghost = 1
  private ghostTween: Phaser.Tweens.Tween | null = null
  private shown = false

  constructor(scene: Phaser.Scene, name: string, fontFamily: string) {
    this.scene = scene
    this.container = scene.add.container(960, -120).setDepth(60).setAlpha(0)
    this.g = scene.add.graphics()
    this.nameText = scene.add
      .text(0, 0, name, {
        fontFamily,
        fontSize: `${TYPE.bossName}px`,
        fontStyle: 'bold',
        color: '#ffe9a8',
        stroke: INK.stroke,
        strokeThickness: 6,
      })
      .setOrigin(0, 0.5)
    this.hpText = scene.add
      .text(0, 0, '', {
        fontFamily,
        fontSize: `${TYPE.bossName}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: INK.stroke,
        strokeThickness: 6,
      })
      .setOrigin(1, 0.5)
    this.container.add([this.g, this.nameText, this.hpText])
    this.draw()
  }

  private draw(): void {
    const w = this.width
    const h = this.height
    const x = -w / 2
    const g = this.g
    g.clear()
    g.fillStyle(0xd9a441)
    g.fillRoundedRect(x - 6, -h / 2 - 6, w + 12, h + 12, 16)
    g.fillStyle(INK.outline, 0.94)
    g.fillRoundedRect(x, -h / 2, w, h, 12)
    const inner = w - 20
    const innerH = h - 20
    g.fillStyle(0x57301f)
    g.fillRoundedRect(x + 10, -h / 2 + 10, inner, innerH, 8)
    // ghost trail (what was just lost), then the live red fill on top
    const ghostW = Math.max(4, inner * Phaser.Math.Clamp(this.ghost, 0, 1))
    g.fillStyle(0xffe9a8, 0.9)
    g.fillRoundedRect(x + 10, -h / 2 + 10, ghostW, innerH, 8)
    const fillW = Math.max(4, inner * Phaser.Math.Clamp(this.pct, 0, 1))
    g.fillStyle(0xe2574c, 1)
    g.fillRoundedRect(x + 10, -h / 2 + 10, fillW, innerH, 8)
    g.fillStyle(0xffffff, 0.18)
    g.fillRoundedRect(x + 10, -h / 2 + 10, fillW, innerH / 2.6, 8)
    this.nameText.setPosition(x + 22, -1)
    this.hpText.setPosition(x + w - 22, -1)
  }

  setHp(cur: number, max: number): void {
    this.hpText.setText(`${fmt(Math.max(0, cur))} / ${fmt(max)}`)
    this.pct = max > 0 ? cur / max : 0
    if (this.ghost < this.pct) this.ghost = this.pct
    this.draw()
    // the pale segment lingers 400ms, then catches up
    this.ghostTween?.remove()
    this.ghostTween = this.scene.tweens.addCounter({
      from: this.ghost,
      to: this.pct,
      delay: 400,
      duration: 350,
      ease: 'Cubic.easeOut',
      onUpdate: (tw) => {
        this.ghost = tw.getValue() ?? this.pct
        this.draw()
      },
    })
  }

  show(reduced: boolean): void {
    if (this.shown) return
    this.shown = true
    this.scene.tweens.killTweensOf(this.container)
    this.container.setAlpha(1)
    this.container.y = -120
    if (reduced) {
      this.container.y = this.restY
      return
    }
    this.scene.tweens.add({ targets: this.container, y: this.restY, duration: 480, ease: 'Back.easeOut' })
  }

  hide(): void {
    if (!this.shown) return
    this.shown = false
    this.ghostTween?.remove()
    this.scene.tweens.add({
      targets: this.container,
      y: -120,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeIn',
      onComplete: () => this.container.destroy(),
    })
  }

  destroy(): void {
    this.ghostTween?.remove()
    this.container.destroy()
  }
}

/** Small dark chip with bold text (and an optional 44px icon on the left). */
export class Chip {
  readonly container: Phaser.GameObjects.Container

  private readonly scene: Phaser.Scene
  private readonly g: Phaser.GameObjects.Graphics
  private readonly text: Phaser.GameObjects.Text
  private readonly icon: Phaser.GameObjects.Image | null
  private readonly accent: number
  private readonly iconSize = 44

  constructor(
    scene: Phaser.Scene,
    label: string,
    opts: { fontSize?: number; accent?: number; fontFamily?: string; iconKey?: string } = {},
  ) {
    this.scene = scene
    this.accent = opts.accent ?? 0xd9a441
    this.container = scene.add.container(0, 0)
    this.g = scene.add.graphics()
    this.text = scene.add
      .text(0, 0, label, {
        fontFamily: opts.fontFamily ?? 'Arial',
        fontSize: `${opts.fontSize ?? TYPE.chip}px`,
        fontStyle: 'bold',
        color: '#fff8ec',
      })
      .setOrigin(0.5, 0.5)
    this.icon = opts.iconKey ? scene.add.image(0, 0, opts.iconKey).setDisplaySize(this.iconSize, this.iconSize) : null
    this.container.add(this.icon ? [this.g, this.icon, this.text] : [this.g, this.text])
    this.redraw()
  }

  setLabel(label: string): void {
    if (this.text.text === label) return
    this.text.setText(label)
    this.redraw()
  }

  /** Current pill width — lets callers pin the chip to a screen corner. */
  get boxWidth(): number {
    return this.text.width + 40 + (this.icon ? this.iconSize + 8 : 0)
  }

  get boxHeight(): number {
    return Math.max(this.text.height, this.icon ? this.iconSize : 0) + 16
  }

  /** Centre of the icon (or the chip) in world space — the loot flight target. */
  get anchor(): { x: number; y: number } {
    const w = this.boxWidth
    return {
      x: this.container.x - w / 2 + 20 + (this.icon ? this.iconSize / 2 : w / 2 - 20),
      y: this.container.y,
    }
  }

  pop(): void {
    this.scene.tweens.killTweensOf(this.container)
    this.container.setScale(1.18)
    this.scene.tweens.add({ targets: this.container, scale: 1, duration: 180, ease: 'Back.easeOut' })
  }

  /** Big squash-and-bounce when a reward lands in the chip (the tick must be seen). */
  bounce(): void {
    this.scene.tweens.killTweensOf(this.container)
    const y = this.container.y
    this.container.setScale(1.45, 0.7)
    this.scene.tweens.add({ targets: this.container, scaleX: 1, scaleY: 1, duration: 360, ease: 'Back.easeOut' })
    this.scene.tweens.add({ targets: this.container, y: y - 14, duration: 120, yoyo: true, ease: 'Quad.easeOut' })
  }

  private redraw(): void {
    const w = this.boxWidth
    const h = this.boxHeight
    this.g.clear()
    this.g.fillStyle(PLATE_BG, PLATE_ALPHA)
    this.g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2)
    this.g.lineStyle(3, this.accent, 0.9)
    this.g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2)
    if (this.icon) {
      this.icon.setPosition(-w / 2 + 20 + this.iconSize / 2, 0)
      this.text.setPosition(this.iconSize / 2 + 4, 0)
    } else {
      this.text.setPosition(0, 0)
    }
  }

  destroy(): void {
    this.container.destroy()
  }
}

/** Countdown pips toward the next boss (8 in demo mode) with "BOSS IN N" beside them; the last one pulses red. */
export class BossPips {
  readonly container: Phaser.GameObjects.Container

  private readonly scene: Phaser.Scene
  private readonly g: Phaser.GameObjects.Graphics
  private readonly label: Phaser.GameObjects.Text
  private total: number
  private filled = 0
  private pulse: Phaser.Tweens.Tween | null = null

  constructor(scene: Phaser.Scene, total: number, fontFamily: string) {
    this.scene = scene
    this.total = total
    this.container = scene.add.container(0, 0).setDepth(54)
    this.g = scene.add.graphics()
    // 26px with letter spacing: at 20px the FIT-scaled label misread as "MOOB INFO"
    this.label = scene.add
      .text(0, 0, '', {
        fontFamily,
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffe9a8',
        stroke: INK.stroke,
        strokeThickness: 5,
      })
      .setLetterSpacing(1.5)
      .setOrigin(1, 0.5)
    this.container.add([this.g, this.label])
    this.draw()
  }

  /** Right-aligned at (rightX, y). */
  place(rightX: number, y: number): void {
    this.container.setPosition(rightX, y)
  }

  set(filled: number, total: number): void {
    this.total = total
    this.filled = Phaser.Math.Clamp(filled, 0, total)
    this.draw()
    const oneLeft = this.filled === this.total - 1
    if (oneLeft && !this.pulse) {
      this.pulse = this.scene.tweens.add({
        targets: this.container,
        alpha: { from: 1, to: 0.45 },
        duration: 400,
        yoyo: true,
        repeat: -1,
      })
    } else if (!oneLeft && this.pulse) {
      this.pulse.remove()
      this.pulse = null
      this.container.setAlpha(1)
    }
  }

  private draw(): void {
    const g = this.g
    g.clear()
    const pipW = 22
    const gap = 8
    const n = Math.min(this.total, 12)
    const totalW = n * pipW + (n - 1) * gap
    const oneLeft = this.filled === this.total - 1
    for (let i = 0; i < n; i++) {
      const x = -totalW + i * (pipW + gap)
      const on = i < this.filled
      g.fillStyle(on ? (oneLeft ? 0xe2574c : 0xffd24a) : 0x57301f, on ? 1 : 0.85)
      g.fillRoundedRect(x, -7, pipW, 14, 5)
      g.lineStyle(2, INK.outline, 0.9)
      g.strokeRoundedRect(x, -7, pipW, 14, 5)
    }
    const left = this.total - this.filled
    this.label.setText(left <= 1 ? 'BOSS NEXT' : `BOSS IN ${left}`)
    this.label.setColor(left <= 1 ? '#ff8a7a' : '#ffe9a8')
    this.label.setPosition(-totalW - 16, 0)
  }

  destroy(): void {
    this.pulse?.remove()
    this.container.destroy()
  }
}

/** Full-width warning ribbon ("BOSS APPROACHING") that slides in from the left. */
export class Ribbon {
  readonly container: Phaser.GameObjects.Container
  private readonly scene: Phaser.Scene

  constructor(scene: Phaser.Scene, text: string, fontFamily: string, y = 250, color: number = INK.warn) {
    this.scene = scene
    this.container = scene.add.container(-1200, y).setDepth(66)
    const g = scene.add.graphics()
    g.fillStyle(color, 0.94)
    g.fillRect(-560, -44, 1120, 88)
    g.fillStyle(0xffe9a8, 0.9)
    g.fillRect(-560, -44, 1120, 5)
    g.fillRect(-560, 39, 1120, 5)
    const t = scene.add
      .text(0, 0, text, {
        fontFamily,
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#fff3d6',
        stroke: INK.stroke,
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0.5)
    this.container.add([g, t])
  }

  /** Slide in (300ms Back), hold, slide out right, then destroy. */
  play(holdMs: number, reduced: boolean): void {
    if (reduced) {
      this.container.setX(960)
      this.scene.time.delayedCall(holdMs + 300, () => this.container.destroy())
      return
    }
    this.scene.tweens.chain({
      targets: this.container,
      tweens: [
        { x: 960, duration: 300, ease: 'Back.easeOut' },
        { x: 960, duration: holdMs },
        { x: 3200, duration: 320, ease: 'Cubic.easeIn' },
      ],
      onComplete: () => this.container.destroy(),
    })
  }
}
