import type Phaser from 'phaser'

interface JourneyPanel {
  x: number
}

interface JourneyLayer {
  panels: JourneyPanel[]
  period: number
  speed: number
}

/**
 * Moves repeated riverside panels from right to left to suggest steady travel.
 * The sky stays outside this controller so its moon and temple silhouette never
 * repeat. Each moving band owns two reusable panels and wraps offscreen.
 */
export class RiversideJourney {
  private readonly layers: JourneyLayer[] = []
  private motion = 1
  private distance = 0

  constructor(private readonly reducedMotion: boolean) {
    if (reducedMotion) this.motion = 0
  }

  addLayer(panels: JourneyPanel[], period: number, speed: number): void {
    this.layers.push({ panels, period, speed })
  }

  update(delta: number, bossFocused: boolean): void {
    if (this.reducedMotion || delta <= 0) return

    // Clamp resumed tabs and orientation changes so the scenery never jumps.
    const seconds = Math.min(delta, 50) / 1000
    const target = bossFocused ? 0 : 1
    const response = bossFocused ? 5 : 2.5
    const previousMotion = this.motion
    const decay = Math.exp(-response * seconds)
    this.motion = target + (previousMotion - target) * decay
    // Integrate the eased speed exactly so 4 × 10ms travels the same distance
    // as 1 × 40ms. Frame pacing therefore cannot change the perceived pace.
    const travelSeconds = target * seconds + (previousMotion - target) * (1 - decay) / response
    if (Math.abs(this.motion - target) < 0.001) this.motion = target
    this.distance += travelSeconds

    for (const layer of this.layers) {
      const step = layer.speed * travelSeconds
      for (const panel of layer.panels) {
        panel.x -= step
        if (panel.x <= -layer.period) panel.x += layer.period * layer.panels.length
      }
    }
  }

  /** Small dev/QA probe; no game state depends on these values. */
  debugState(): { motion: number; distance: number; panelXs: number[][] } {
    return {
      motion: this.motion,
      distance: this.distance,
      panelXs: this.layers.map((layer) => layer.panels.map((panel) => panel.x)),
    }
  }
}

/** A low side-on teak deck that all existing combat lanes can stand on. */
export function riversidePlatform(scene: Phaser.Scene, width: number): Phaser.GameObjects.Graphics {
  const deck = scene.add.graphics()
  const top = 780
  const front = 898
  const fasciaBottom = 954

  deck.fillStyle(0x765039, 1)
  deck.fillRect(0, top, width, front - top)
  const rows = [
    [top, 0x8d6444],
    [810, 0x795039],
    [840, 0x8a5c3e],
    [870, 0x704832],
  ] as const
  for (let row = 0; row < rows.length; row++) {
    const [y, color] = rows[row]
    deck.fillStyle(color, 0.96)
    deck.fillRect(0, y, width, 28)
    deck.lineStyle(2, 0x422b26, 0.72)
    deck.lineBetween(0, y, width, y)
    const offset = row % 2 === 0 ? 0 : 80
    for (let x = offset; x <= width; x += 160) deck.lineBetween(x, y, x, y + 28)
  }
  deck.lineStyle(4, 0xe0a95d, 0.76)
  deck.lineBetween(0, top, width, top)
  deck.lineStyle(5, 0x3e2926, 0.92)
  deck.lineBetween(0, front, width, front)

  deck.fillStyle(0x4b3029, 1)
  deck.fillRect(0, front, width, fasciaBottom - front)
  deck.lineStyle(2, 0x8a5d3d, 0.55)
  for (let x = 0; x <= width; x += 160) {
    deck.lineBetween(x, front, x, fasciaBottom)
    deck.fillStyle(0xd4a153, 0.72)
    deck.fillCircle(x + 18, front + 17, 3)
  }
  deck.lineStyle(3, 0xd09a50, 0.48)
  deck.lineBetween(0, fasciaBottom, width, fasciaBottom)

  // Sparse posts and warm reflections leave most of the river visible below.
  for (let x = 92; x < width; x += 320) {
    deck.fillStyle(0x392a29, 0.92)
    deck.fillRect(x, fasciaBottom, 24, 126)
    deck.lineStyle(4, 0xe1a44f, 0.12)
    deck.lineBetween(x + 30, fasciaBottom + 8, x + 30, fasciaBottom + 68)
    deck.lineStyle(2, 0xe1a44f, 0.08)
    deck.lineBetween(x + 42, fasciaBottom + 18, x + 42, fasciaBottom + 90)
  }
  return deck
}
