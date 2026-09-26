// Overlay scene with its own camera. The in-canvas UI (chips, pips, boss bar,
// ribbons) is created in this scene, so the world camera's shake and zoom never
// move it. It also measures the VISIBLE rect of the stage: with ENVELOP scaling
// the container crops the 1920×1080 stage, and the idle scene pins its chips to
// the visible edges rather than the stage edges.

import Phaser from 'phaser'
import { cssInsetToStageUnits, isMobileProfile, LAYOUT as L } from './juice'

export interface VisibleRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export class UiScene extends Phaser.Scene {
  /** Visible part of the stage in stage units (full stage until measured). */
  rect: VisibleRect = { x0: 0, y0: 0, x1: L.W, y1: L.H }
  mobileProfile = false
  topInset = 0
  bottomInset = 0
  private listeners: Array<(r: VisibleRect, mobile: boolean) => void> = []

  constructor() {
    super('ui')
  }

  create(): void {
    this.cameras.main.setRoundPixels(true)
    this.measure()
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.measure())
  }

  /** Called with the visible rect now and after every re-fit. */
  onLayout(fn: (r: VisibleRect, mobile: boolean) => void): void {
    this.listeners.push(fn)
    fn(this.rect, this.mobileProfile)
  }

  private measure(): void {
    const sc = this.scale
    const f = sc.displaySize.width > 0 ? sc.displaySize.width / L.W : 1
    const pw = sc.parentSize.width > 0 ? sc.parentSize.width : sc.displaySize.width
    const ph = sc.parentSize.height > 0 ? sc.parentSize.height : sc.displaySize.height
    const cssWidth = typeof window !== 'undefined' ? window.innerWidth : pw
    const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    this.mobileProfile = isMobileProfile(cssWidth, coarse)
    const frame = this.game.canvas.parentElement?.parentElement ?? this.game.canvas.parentElement
    const styles = frame ? getComputedStyle(frame) : null
    const topInsetPx = styles ? Number.parseFloat(styles.getPropertyValue('--game-top-inset')) || 0 : 0
    const bottomInsetPx = styles ? Number.parseFloat(styles.getPropertyValue('--game-bottom-inset')) || 0 : 0
    this.topInset = cssInsetToStageUnits(topInsetPx, f)
    this.bottomInset = cssInsetToStageUnits(bottomInsetPx, f)
    const visW = Math.min(L.W, pw / f)
    const visH = Math.min(L.H, ph / f)
    this.rect = {
      x0: Math.round((L.W - visW) / 2),
      y0: Math.round((L.H - visH) / 2),
      x1: Math.round((L.W + visW) / 2),
      y1: Math.round((L.H + visH) / 2),
    }
    for (const fn of this.listeners) fn(this.rect, this.mobileProfile)
  }
}
