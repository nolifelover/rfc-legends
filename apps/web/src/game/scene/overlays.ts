// Canvas overlays that live above the actors: nameplates, monster mini HP
// bars, the MVP boss bar and the small top chips (map banner, kill counter).
// The bottom HUD is React-only — nothing here draws near the bottom edge.

import Phaser from 'phaser'

const PLATE_BG = 0x3d2817
const PLATE_ALPHA = 0.86

export interface LabelStyle {
  fontSize?: number
  color?: string
  sub?: string
  subColor?: string
  fontFamily?: string
}

/**
 * Dark pill with one bold line (and an optional smaller second line), e.g.
 * "Verify Guy · Lv.5" over the trainer or "Field Rat (หนูนา)" over a monster.
 */
export class Nameplate {
  readonly container: Phaser.GameObjects.Container

  private readonly scene: Phaser.Scene
  private readonly bg: Phaser.GameObjects.Graphics
  private readonly main: Phaser.GameObjects.Text
  private readonly sub: Phaser.GameObjects.Text
  private subGiven = false

  constructor(scene: Phaser.Scene, main: string, style: LabelStyle = {}) {
    this.scene = scene
    this.container = scene.add.container(0, 0).setDepth(50)
    this.bg = scene.add.graphics()
    this.main = scene.add
      .text(0, 0, main, {
        fontFamily: style.fontFamily ?? 'Arial',
        fontSize: `${style.fontSize ?? 15}px`,
        fontStyle: 'bold',
        color: style.color ?? '#fff8ec',
      })
      .setResolution(2)
      .setOrigin(0.5, 0)
    this.sub = scene.add
      .text(0, 0, style.sub ?? '', {
        fontFamily: style.fontFamily ?? 'Arial',
        fontSize: '12px',
        fontStyle: 'bold',
        color: style.subColor ?? '#f3dfb2',
      })
      .setResolution(2)
      .setOrigin(0.5, 0)
    this.subGiven = !!style.sub
    this.container.add([this.bg, this.main, this.sub])
    this.redraw()
    this.container.setVisible(false)
  }

  setMain(text: string): void {
    this.main.setText(text)
    this.redraw()
  }

  setSub(text: string): void {
    this.sub.setText(text)
    this.subGiven = text.length > 0
    this.redraw()
  }

  private redraw(): void {
    const w = Math.max(this.main.width, this.subGiven ? this.sub.width : 0) + 18
    const mainH = this.main.height
    const subH = this.subGiven ? this.sub.height + 1 : 0
    const h = mainH + subH + 8
    this.main.setPosition(0, 4)
    this.sub.setPosition(0, 4 + mainH + 1)
    this.bg.clear()
    this.bg.fillStyle(PLATE_BG, PLATE_ALPHA)
    this.bg.fillRoundedRect(-w / 2, 0, w, h, 7)
    this.bg.lineStyle(1.5, 0xf3dfb2, 0.35)
    this.bg.strokeRoundedRect(-w / 2, 0, w, h, 7)
  }

  /** Attach above a sprite of the given on-screen height, centered on x. */
  placeAbove(x: number, topY: number): void {
    this.container.setPosition(Math.round(x), Math.round(topY))
    this.container.setVisible(true)
  }

  destroy(): void {
    this.container.destroy()
  }
}

/** Current-HP bar floating over a monster (exact numbers live on the boss bar). */
export class MiniHpBar {
  readonly container: Phaser.GameObjects.Container

  private readonly bg: Phaser.GameObjects.Graphics
  private readonly width: number
  private readonly h = 14

  constructor(scene: Phaser.Scene, width = 58) {
    this.container = scene.add.container(0, 0).setDepth(50)
    this.bg = scene.add.graphics()
    this.width = width
    this.container.add(this.bg)
    this.drawFill(1)
    this.container.setVisible(false)
  }

  private drawFill(pct: number): void {
    const { bg, width, h } = this
    const w = Math.max(4, (width - 4) * Phaser.Math.Clamp(pct, 0, 1))
    bg.clear()
    bg.fillStyle(0x2b1b12, 0.92)
    bg.fillRoundedRect(-width / 2, -h / 2, width, h, 6)
    bg.fillStyle(0x57301f)
    bg.fillRoundedRect(-width / 2 + 2, -h / 2 + 2, width - 4, h - 4, 4)
    bg.fillStyle(pct > 0.5 ? 0x62b04e : pct > 0.25 ? 0xe0a93e : 0xe2574c, 1)
    bg.fillRoundedRect(-width / 2 + 2, -h / 2 + 2, w, h - 4, 4)
    bg.fillStyle(0xffffff, 0.22)
    bg.fillRoundedRect(-width / 2 + 2, -h / 2 + 2, w, (h - 4) / 2.4, 4)
    bg.lineStyle(1.5, 0xfff8ec, 0.4)
    bg.strokeRoundedRect(-width / 2, -h / 2, width, h, 6)
  }

  setPct(pct: number): void {
    this.drawFill(pct)
  }

  placeAbove(x: number, topY: number): void {
    this.container.setPosition(Math.round(x), Math.round(topY))
    this.container.setVisible(true)
  }

  destroy(): void {
    this.container.destroy()
  }
}

/** Ornate top-center boss bar: gold-trimmed, big name + current/max HP text. */
export class BossBar {
  readonly container: Phaser.GameObjects.Container

  private readonly scene: Phaser.Scene
  private readonly g: Phaser.GameObjects.Graphics
  private readonly nameText: Phaser.GameObjects.Text
  private readonly hpText: Phaser.GameObjects.Text
  private readonly width = 460
  private readonly height = 40
  private shown = false

  constructor(scene: Phaser.Scene, name: string, fontFamily: string) {
    this.scene = scene
    this.container = scene.add.container(480, -70).setDepth(60).setAlpha(0)
    this.g = scene.add.graphics()
    this.nameText = scene.add
      .text(0, 0, name, {
        fontFamily,
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffe9a8',
        stroke: '#2b1b12',
        strokeThickness: 4,
      })
      .setResolution(2)
      .setOrigin(0, 0.5)
    this.hpText = scene.add
      .text(0, 0, '', {
        fontFamily,
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#2b1b12',
        strokeThickness: 4,
      })
      .setResolution(2)
      .setOrigin(1, 0.5)
    this.container.add([this.g, this.nameText, this.hpText])
    this.draw(1)
  }

  private draw(pct: number): void {
    const w = this.width
    const h = this.height
    const x = -w / 2
    const g = this.g
    g.clear()
    // outer gold frame + dark plate
    g.fillStyle(0xd9a441)
    g.fillRoundedRect(x - 4, -h / 2 - 4, w + 8, h + 8, 10)
    g.fillStyle(0x2b1b12, 0.94)
    g.fillRoundedRect(x, -h / 2, w, h, 8)
    // HP fill
    const inner = w - 12
    g.fillStyle(0x57301f)
    g.fillRoundedRect(x + 6, -h / 2 + 6, inner, h - 12, 5)
    const fillW = Math.max(4, inner * Phaser.Math.Clamp(pct, 0, 1))
    g.fillStyle(0xe2574c, 1)
    g.fillRoundedRect(x + 6, -h / 2 + 6, fillW, h - 12, 5)
    g.fillStyle(0xffffff, 0.18)
    g.fillRoundedRect(x + 6, -h / 2 + 6, fillW, (h - 12) / 2.6, 5)
    this.nameText.setPosition(x + 12, -2)
    this.hpText.setPosition(x + w - 12, -2)
  }

  setHp(cur: number, max: number): void {
    this.hpText.setText(`${Math.max(0, Math.round(cur))} / ${Math.round(max)}`)
    this.draw(max > 0 ? cur / max : 0)
  }

  show(reduced: boolean): void {
    if (this.shown) return
    this.shown = true
    this.scene.tweens.killTweensOf(this.container)
    this.container.setAlpha(1)
    this.container.y = -70
    if (reduced) {
      this.container.y = 34
      return
    }
    this.scene.tweens.add({
      targets: this.container,
      y: 34,
      duration: 480,
      ease: 'Back.easeOut',
    })
  }

  hide(): void {
    if (!this.shown) return
    this.shown = false
    const tween = this.scene.tweens.add({
      targets: this.container,
      y: -70,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeIn',
    })
    this.scene.time.delayedCall(tween.duration ?? 320, () => this.container.destroy())
  }

  destroy(): void {
    this.container.destroy()
  }
}

/** Small dark chip with bold text — map banner (top-left) and KILL counter (top-right). */
export class Chip {
  readonly container: Phaser.GameObjects.Container

  private readonly scene: Phaser.Scene
  private readonly g: Phaser.GameObjects.Graphics
  private readonly text: Phaser.GameObjects.Text
  private accent = 0xd9a441

  constructor(
    scene: Phaser.Scene,
    label: string,
    opts: { fontSize?: number; accent?: number; fontFamily?: string } = {},
  ) {
    this.scene = scene
    this.accent = opts.accent ?? 0xd9a441
    this.container = scene.add.container(0, 0)
    this.g = scene.add.graphics()
    this.text = scene.add
      .text(0, 0, label, {
        fontFamily: opts.fontFamily ?? 'Arial',
        fontSize: `${opts.fontSize ?? 15}px`,
        fontStyle: 'bold',
        color: '#fff8ec',
      })
      .setResolution(2)
      .setOrigin(0.5, 0.5)
    this.container.add([this.g, this.text])
    this.redraw()
  }

  setLabel(label: string): void {
    this.text.setText(label)
    this.redraw()
  }

  /** Current pill width — lets callers pin the chip to a screen corner. */
  get boxWidth(): number {
    return this.text.width + 26
  }

  pop(): void {
    this.scene.tweens.killTweensOf(this.container)
    this.container.setScale(1.18)
    this.scene.tweens.add({ targets: this.container, scale: 1, duration: 180, ease: 'Back.easeOut' })
  }

  private redraw(): void {
    const w = this.text.width + 26
    const h = this.text.height + 12
    this.g.clear()
    this.g.fillStyle(PLATE_BG, PLATE_ALPHA)
    this.g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2)
    this.g.lineStyle(2, this.accent, 0.9)
    this.g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2)
  }

  destroy(): void {
    this.container.destroy()
  }
}
