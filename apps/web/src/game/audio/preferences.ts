export const GAME_AUDIO_STORAGE_KEY = "rfcl:game-audio:v1"

export interface GameAudioPreferences {
  backgroundEnabled: boolean
  effectsEnabled: boolean
}

export const DEFAULT_GAME_AUDIO_PREFERENCES: GameAudioPreferences = {
  backgroundEnabled: true,
  effectsEnabled: true,
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function loadGameAudioPreferences(storage?: StorageLike | null): GameAudioPreferences {
  if (!storage) return DEFAULT_GAME_AUDIO_PREFERENCES

  try {
    const stored = JSON.parse(storage.getItem(GAME_AUDIO_STORAGE_KEY) ?? "null") as Partial<GameAudioPreferences> | null
    if (!stored) return DEFAULT_GAME_AUDIO_PREFERENCES
    return {
      backgroundEnabled: stored.backgroundEnabled !== false,
      effectsEnabled: stored.effectsEnabled !== false,
    }
  } catch {
    return DEFAULT_GAME_AUDIO_PREFERENCES
  }
}

export function saveGameAudioPreferences(
  storage: StorageLike | null | undefined,
  preferences: GameAudioPreferences,
): void {
  if (!storage) return
  try {
    storage.setItem(GAME_AUDIO_STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // Storage may be unavailable in private browsing. Audio still works for
    // the current page; only preference persistence is skipped.
  }
}
