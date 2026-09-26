export type GameAudioCue = "hit" | "critical" | "drop" | "levelup" | "boss-spawn" | "boss-kill"

const MIN_INTERVAL_MS: Record<GameAudioCue, number> = {
  hit: 70,
  critical: 110,
  drop: 180,
  levelup: 350,
  "boss-spawn": 450,
  "boss-kill": 450,
}

/** Keeps rapid combat ticks from creating an unbounded Web Audio graph. */
export class EffectLimiter {
  private readonly lastPlayed = new Map<GameAudioCue, number>()
  private active = 0

  constructor(private readonly maxActive = 4) {}

  acquire(cue: GameAudioCue, now: number): boolean {
    if (this.active >= this.maxActive) return false
    const last = this.lastPlayed.get(cue)
    if (last !== undefined && now - last < MIN_INTERVAL_MS[cue]) return false
    this.lastPlayed.set(cue, now)
    this.active += 1
    return true
  }

  release(): void {
    this.active = Math.max(0, this.active - 1)
  }

  reset(): void {
    this.active = 0
    this.lastPlayed.clear()
  }
}
