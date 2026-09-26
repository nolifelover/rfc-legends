import { EffectLimiter, type GameAudioCue } from "./effect-limiter"
import type { GameAudioPreferences } from "./preferences"

export const RIVERSIDE_BACKGROUND_URL = "/assets/game/audio/riverside-night-loop.mp3"

interface AudioRuntimeEnvironment {
  createAudio(url: string): HTMLAudioElement
  createContext(): AudioContext
  now(): number
}

function browserEnvironment(): AudioRuntimeEnvironment {
  return {
    createAudio: (url) => new Audio(url),
    createContext: () => {
      const AudioContextConstructor = window.AudioContext
        ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextConstructor) throw new Error("Web Audio is unavailable")
      return new AudioContextConstructor()
    },
    now: () => performance.now(),
  }
}

const CUE_SHAPES: Record<GameAudioCue, { frequency: number; endFrequency: number; duration: number; volume: number; wave: OscillatorType }> = {
  hit: { frequency: 175, endFrequency: 92, duration: 0.1, volume: 0.16, wave: "triangle" },
  critical: { frequency: 520, endFrequency: 150, duration: 0.2, volume: 0.24, wave: "sawtooth" },
  drop: { frequency: 620, endFrequency: 980, duration: 0.24, volume: 0.16, wave: "sine" },
  levelup: { frequency: 440, endFrequency: 880, duration: 0.42, volume: 0.2, wave: "triangle" },
  "boss-spawn": { frequency: 105, endFrequency: 58, duration: 0.55, volume: 0.22, wave: "sawtooth" },
  "boss-kill": { frequency: 330, endFrequency: 740, duration: 0.5, volume: 0.2, wave: "triangle" },
}

/** Browser-only audio owner. It creates no audio resources until a user gesture unlocks it. */
export class GameAudioController {
  private context: AudioContext | null = null
  private effectsGain: GainNode | null = null
  private background: HTMLAudioElement | null = null
  private backgroundFailed = false
  private unlocked = false
  private enabled = false
  private visible = true
  private disposed = false
  private playbackRevision = 0
  private preferences: GameAudioPreferences
  private readonly limiter = new EffectLimiter(4)
  private readonly environment: AudioRuntimeEnvironment

  constructor(preferences: GameAudioPreferences, environment?: AudioRuntimeEnvironment) {
    this.preferences = preferences
    this.environment = environment ?? browserEnvironment()
  }

  get isUnlocked(): boolean {
    return this.unlocked
  }

  setEnabled(enabled: boolean): void {
    if (this.disposed) return
    this.enabled = enabled
    void this.requestPlaybackReconcile()
  }

  setVisible(visible: boolean): void {
    if (this.disposed || this.visible === visible) return
    this.visible = visible
    void this.requestPlaybackReconcile()
  }

  setPreferences(preferences: GameAudioPreferences): void {
    if (this.disposed) return
    this.preferences = preferences
    if (this.effectsGain && this.context) {
      const value = preferences.effectsEnabled ? 1 : 0
      this.effectsGain.gain.cancelScheduledValues(this.context.currentTime)
      this.effectsGain.gain.setValueAtTime(value, this.context.currentTime)
    }
    const needsEffectsContext = preferences.effectsEnabled && !this.context
    const needsBackgroundElement = preferences.backgroundEnabled && !this.background && !this.backgroundFailed
    if (this.unlocked && (needsEffectsContext || needsBackgroundElement)) void this.unlock()
    else void this.requestPlaybackReconcile()
  }

  async unlock(): Promise<boolean> {
    if (this.disposed || !this.enabled) return false
    if (!this.context) {
      try {
        this.context = this.environment.createContext()
        this.effectsGain = this.context.createGain()
        this.effectsGain.gain.value = this.preferences.effectsEnabled ? 1 : 0
        this.effectsGain.connect(this.context.destination)
      } catch {
        this.context = null
        this.effectsGain = null
      }
    }
    this.unlocked = true
    const revision = ++this.playbackRevision
    await this.reconcilePlayback(revision)
    if (revision !== this.playbackRevision) return this.unlocked
    const wantsEffects = this.preferences.effectsEnabled
    const wantsBackground = this.preferences.backgroundEnabled
    const effectsReady = wantsEffects && this.context?.state === "running"
    const backgroundReady = wantsBackground && Boolean(this.background && !this.background.paused)
    const ready = (!wantsEffects && !wantsBackground) || effectsReady || backgroundReady
    this.unlocked = ready
    return ready
  }

  play(cue: GameAudioCue): void {
    const context = this.context
    const master = this.effectsGain
    if (
      this.disposed
      || !this.enabled
      || !this.visible
      || !this.unlocked
      || !this.preferences.effectsEnabled
      || !context
      || !master
      || context.state !== "running"
      || !this.limiter.acquire(cue, this.environment.now())
    ) return

    const shape = CUE_SHAPES[cue]
    try {
      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      const start = context.currentTime
      oscillator.type = shape.wave
      oscillator.frequency.setValueAtTime(shape.frequency, start)
      oscillator.frequency.exponentialRampToValueAtTime(shape.endFrequency, start + shape.duration)
      envelope.gain.setValueAtTime(0.0001, start)
      envelope.gain.exponentialRampToValueAtTime(shape.volume, start + 0.018)
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + shape.duration)
      oscillator.connect(envelope)
      envelope.connect(master)
      oscillator.onended = () => {
        oscillator.disconnect()
        envelope.disconnect()
        this.limiter.release()
      }
      oscillator.start(start)
      oscillator.stop(start + shape.duration + 0.02)
    } catch {
      this.limiter.release()
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.playbackRevision += 1
    this.background?.pause()
    this.background?.removeAttribute("src")
    this.background?.load()
    this.background = null
    this.effectsGain?.disconnect()
    this.effectsGain = null
    const context = this.context
    this.context = null
    this.limiter.reset()
    if (context && context.state !== "closed") void context.close().catch(() => undefined)
  }

  private ensureBackground(): HTMLAudioElement | null {
    if (this.background || this.backgroundFailed) return this.background
    try {
      const audio = this.environment.createAudio(RIVERSIDE_BACKGROUND_URL)
      audio.loop = true
      audio.preload = "auto"
      audio.volume = 0.26
      audio.addEventListener("error", () => {
        this.backgroundFailed = true
        audio.pause()
      }, { once: true })
      this.background = audio
      return audio
    } catch {
      this.backgroundFailed = true
      return null
    }
  }

  private requestPlaybackReconcile(): Promise<void> {
    const revision = ++this.playbackRevision
    return this.reconcilePlayback(revision)
  }

  private async reconcilePlayback(revision: number): Promise<void> {
    if (this.disposed || revision !== this.playbackRevision) return
    const shouldRun = this.enabled && this.visible && this.unlocked
    if (!shouldRun) {
      this.background?.pause()
      if (this.context?.state === "running") await this.context.suspend().catch(() => undefined)
      return
    }

    if (this.context && this.context.state !== "running" && this.context.state !== "closed") {
      await this.context.resume().catch(() => undefined)
    }
    if (
      this.disposed
      || revision !== this.playbackRevision
      || !this.enabled
      || !this.visible
      || !this.unlocked
    ) return
    if (!this.preferences.backgroundEnabled) {
      this.background?.pause()
      return
    }
    const background = this.ensureBackground()
    if (background) await background.play().catch(() => undefined)
  }
}
