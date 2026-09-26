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

  update(delta: number, bossFocused: boolean, manualDirection?: -1 | 0 | 1): void {
    if (this.reducedMotion || delta <= 0) return

    // Clamp resumed tabs and orientation changes so the scenery never jumps.
    const seconds = Math.min(delta, 50) / 1000
    // Auto retains the original steady forward travel. Manual mode supplies a
    // signed direction so scenery stops with the player and reverses naturally.
    const target = bossFocused ? 0 : (manualDirection ?? 1)
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
        else if (panel.x >= layer.period) panel.x -= layer.period * layer.panels.length
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
