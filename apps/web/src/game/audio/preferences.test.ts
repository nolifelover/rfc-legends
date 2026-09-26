import { describe, expect, it } from "vitest"
import { EffectLimiter } from "./effect-limiter"
import {
  DEFAULT_GAME_AUDIO_PREFERENCES,
  GAME_AUDIO_STORAGE_KEY,
  loadGameAudioPreferences,
  saveGameAudioPreferences,
} from "./preferences"

function memoryStorage(initial?: string) {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(GAME_AUDIO_STORAGE_KEY, initial)
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    value: () => values.get(GAME_AUDIO_STORAGE_KEY),
  }
}

describe("game audio preferences", () => {
  it("defaults both channels on when storage is absent or malformed", () => {
    expect(loadGameAudioPreferences()).toEqual(DEFAULT_GAME_AUDIO_PREFERENCES)
    expect(loadGameAudioPreferences(memoryStorage("not-json"))).toEqual(DEFAULT_GAME_AUDIO_PREFERENCES)
  })

  it("loads and persists background and effects independently", () => {
    const storage = memoryStorage('{"backgroundEnabled":false,"effectsEnabled":true}')
    expect(loadGameAudioPreferences(storage)).toEqual({ backgroundEnabled: false, effectsEnabled: true })
    saveGameAudioPreferences(storage, { backgroundEnabled: true, effectsEnabled: false })
    expect(JSON.parse(storage.value() ?? "null")).toEqual({ backgroundEnabled: true, effectsEnabled: false })
  })
})

describe("effect limiter", () => {
  it("throttles repeated cues and caps concurrent effects", () => {
    const limiter = new EffectLimiter(2)
    expect(limiter.acquire("hit", 100)).toBe(true)
    expect(limiter.acquire("hit", 150)).toBe(false)
    expect(limiter.acquire("drop", 150)).toBe(true)
    expect(limiter.acquire("critical", 150)).toBe(false)
    limiter.release()
    expect(limiter.acquire("hit", 171)).toBe(true)
  })
})
