import { describe, expect, it, vi } from "vitest"
import { GameAudioController, RIVERSIDE_BACKGROUND_URL } from "./game-audio-controller"

describe("GameAudioController lifecycle", () => {
  it("starts after unlock, pauses immediately, suspends while hidden, and releases resources", async () => {
    const play = vi.fn(async () => undefined)
    const pause = vi.fn()
    const removeAttribute = vi.fn()
    const load = vi.fn()
    const audio = {
      loop: false,
      preload: "",
      volume: 1,
      paused: false,
      play,
      pause,
      removeAttribute,
      load,
      addEventListener: vi.fn(),
    } as unknown as HTMLAudioElement

    const gain = {
      value: 1,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
    }
    const gainNode = {
      gain,
      connect: vi.fn(),
      disconnect: vi.fn(),
    }
    const context = {
      state: "running",
      currentTime: 1,
      destination: {},
      createGain: () => gainNode,
      suspend: vi.fn(async () => undefined),
      resume: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    } as unknown as AudioContext
    const createAudio = vi.fn(() => audio)
    const controller = new GameAudioController(
      { backgroundEnabled: true, effectsEnabled: true },
      { createAudio, createContext: () => context, now: () => 100 },
    )

    controller.setEnabled(true)
    expect(play).not.toHaveBeenCalled()
    await controller.unlock()
    expect(createAudio).toHaveBeenCalledWith(RIVERSIDE_BACKGROUND_URL)
    expect(play).toHaveBeenCalledOnce()

    controller.setPreferences({ backgroundEnabled: false, effectsEnabled: false })
    expect(pause).toHaveBeenCalled()
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0, 1)

    controller.setVisible(false)
    await vi.waitFor(() => expect(context.suspend).toHaveBeenCalled())

    controller.dispose()
    expect(removeAttribute).toHaveBeenCalledWith("src")
    expect(load).toHaveBeenCalled()
    expect(context.close).toHaveBeenCalled()
  })

  it("does not consume the unlock gesture when the audio context cannot resume", async () => {
    let state: AudioContextState = "suspended"
    const context = {
      get state() { return state },
      currentTime: 1,
      destination: {},
      createGain: () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }),
      resume: vi.fn(async () => undefined),
      suspend: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    } as unknown as AudioContext
    const audio = {
      paused: true,
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
      removeAttribute: vi.fn(),
      load: vi.fn(),
      addEventListener: vi.fn(),
    } as unknown as HTMLAudioElement
    const controller = new GameAudioController(
      { backgroundEnabled: false, effectsEnabled: true },
      { createAudio: () => audio, createContext: () => context, now: () => 100 },
    )
    controller.setEnabled(true)

    expect(await controller.unlock()).toBe(false)
    expect(controller.isUnlocked).toBe(false)
    state = "running"
    expect(await controller.unlock()).toBe(true)
    expect(controller.isUnlocked).toBe(true)
    controller.dispose()
  })

  it("does not restart background audio when the page hides during a pending resume", async () => {
    let state: AudioContextState = "running"
    let finishResume: (() => void) | undefined
    const resume = vi.fn(() => new Promise<void>((resolve) => {
      finishResume = () => {
        state = "running"
        resolve()
      }
    }))
    const suspend = vi.fn(async () => { state = "suspended" })
    const context = {
      get state() { return state },
      currentTime: 1,
      destination: {},
      createGain: () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }),
      resume,
      suspend,
      close: vi.fn(async () => undefined),
    } as unknown as AudioContext
    const play = vi.fn(async () => undefined)
    const audio = {
      paused: false,
      play,
      pause: vi.fn(),
      removeAttribute: vi.fn(),
      load: vi.fn(),
      addEventListener: vi.fn(),
    } as unknown as HTMLAudioElement
    const controller = new GameAudioController(
      { backgroundEnabled: true, effectsEnabled: true },
      { createAudio: () => audio, createContext: () => context, now: () => 100 },
    )
    controller.setEnabled(true)
    expect(await controller.unlock()).toBe(true)
    expect(play).toHaveBeenCalledOnce()

    controller.setVisible(false)
    await vi.waitFor(() => expect(suspend).toHaveBeenCalled())
    controller.setVisible(true)
    await vi.waitFor(() => expect(resume).toHaveBeenCalled())
    controller.setVisible(false)
    finishResume?.()
    await Promise.resolve()
    await Promise.resolve()

    expect(play).toHaveBeenCalledOnce()
    expect(audio.pause).toHaveBeenCalled()
    controller.dispose()
  })

  it("keeps synthesized effects available when the background file cannot play", async () => {
    const start = vi.fn()
    const oscillator = {
      type: "sine",
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start,
      stop: vi.fn(),
      onended: null,
    }
    const audioParam = {
      value: 1,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    }
    const context = {
      state: "running",
      currentTime: 1,
      destination: {},
      createGain: () => ({ gain: audioParam, connect: vi.fn(), disconnect: vi.fn() }),
      createOscillator: vi.fn(() => oscillator),
      suspend: vi.fn(async () => undefined),
      resume: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    } as unknown as AudioContext
    const audio = {
      paused: true,
      play: vi.fn(async () => { throw new Error("missing audio") }),
      pause: vi.fn(),
      removeAttribute: vi.fn(),
      load: vi.fn(),
      addEventListener: vi.fn(),
    } as unknown as HTMLAudioElement
    const controller = new GameAudioController(
      { backgroundEnabled: true, effectsEnabled: true },
      { createAudio: () => audio, createContext: () => context, now: () => 100 },
    )
    controller.setEnabled(true)

    expect(await controller.unlock()).toBe(true)
    controller.play("hit")
    expect(context.createOscillator).toHaveBeenCalledOnce()
    expect(start).toHaveBeenCalledOnce()
    controller.dispose()
  })

  it("keeps background music available when Web Audio is unavailable", async () => {
    const audio = {
      paused: false,
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
      removeAttribute: vi.fn(),
      load: vi.fn(),
      addEventListener: vi.fn(),
    } as unknown as HTMLAudioElement
    const controller = new GameAudioController(
      { backgroundEnabled: true, effectsEnabled: true },
      {
        createAudio: () => audio,
        createContext: () => { throw new Error("Web Audio unavailable") },
        now: () => 100,
      },
    )
    controller.setEnabled(true)

    expect(await controller.unlock()).toBe(true)
    expect(audio.play).toHaveBeenCalledOnce()
    controller.dispose()
  })

  it("settles with both channels muted and can start music from a later settings gesture", async () => {
    const audio = {
      paused: false,
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
      removeAttribute: vi.fn(),
      load: vi.fn(),
      addEventListener: vi.fn(),
    } as unknown as HTMLAudioElement
    const createAudio = vi.fn(() => audio)
    const controller = new GameAudioController(
      { backgroundEnabled: false, effectsEnabled: false },
      {
        createAudio,
        createContext: () => { throw new Error("Web Audio unavailable") },
        now: () => 100,
      },
    )
    controller.setEnabled(true)

    expect(await controller.unlock()).toBe(true)
    expect(createAudio).not.toHaveBeenCalled()
    controller.setPreferences({ backgroundEnabled: true, effectsEnabled: false })
    await vi.waitFor(() => expect(audio.play).toHaveBeenCalledOnce())
    controller.dispose()
  })
})
