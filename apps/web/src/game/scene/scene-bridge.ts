// Typed React ↔ Phaser bridge. This module must stay Phaser-free so the React
// tree never pulls the Phaser bundle until `mount()` dynamically loads the scene.
// React holds one SceneBridge; the scene registers itself once booted.

import type { Drop, Player, Rarity } from '../types'
import type { GameActionResult, MovementDirection } from '../manual-controls'

/** Events the scene emits for React-side celebrations (G5 hooks). */
export type SceneEventMap = {
  levelup: { level: number }
  'rooster-levelup': { level: number }
  drop: { dropId: string; itemId: number; rarity: Rarity }
  'boss-spawn': { name: string }
  'boss-kill': { name: string }
}

export interface SceneMountOptions {
  player: Player
  drops: Drop[]
  demoMode: boolean
  reducedMotion: boolean
  /** Page font stack — canvas text should match the app (Noto Sans Thai first). */
  fontFamily: string
}

/** What the running game exposes back to the bridge. */
export interface SceneHandle {
  updateState(player: Player, drops: Drop[], demoMode: boolean): void
  setMovement(direction: MovementDirection): void
  pauseManualMovement(): void
  showActionResult(result: GameActionResult): void
  destroy(): void
}

export interface SceneStatePacket {
  player: Player
  drops: Drop[]
  demoMode: boolean
}

type Handler<K extends keyof SceneEventMap> = (payload: SceneEventMap[K]) => void

export class SceneBridge {
  private readonly handlers: { [K in keyof SceneEventMap]: Set<Handler<K>> } = {
    levelup: new Set(),
    'rooster-levelup': new Set(),
    drop: new Set(),
    'boss-spawn': new Set(),
    'boss-kill': new Set(),
  }
  private handle: SceneHandle | null = null
  private destroyed = false
  private latest: SceneStatePacket | null = null
  /** Kills the Phaser game if the scene never reached `create()`. */
  private disposer: (() => void) | null = null

  on<K extends keyof SceneEventMap>(event: K, handler: Handler<K>): () => void {
    this.handlers[event].add(handler)
    return () => {
      this.handlers[event].delete(handler)
    }
  }

  /** Scene-side only: fan an event out to React listeners. */
  emit<K extends keyof SceneEventMap>(event: K, payload: SceneEventMap[K]): void {
    for (const handler of this.handlers[event]) handler(payload)
  }

  /** Scene-side only: the scene calls this from `create()` to drain queued state. */
  sceneReady(handle: SceneHandle): void {
    if (this.destroyed) return
    this.handle = handle
    this.disposer = null // the handle's destroy() tears down the game now
    if (this.latest) handle.updateState(this.latest.player, this.latest.drops, this.latest.demoMode)
  }

  async mount(container: HTMLElement, opts: SceneMountOptions): Promise<void> {
    if (this.destroyed) return
    this.latest = { player: opts.player, drops: opts.drops, demoMode: opts.demoMode }
    const { createIdleGame } = await import('./idle-scene')
    if (this.destroyed) return // unmounted while the chunk loaded
    const game = createIdleGame(container, opts, this)
    this.disposer = () => game.destroy(true)
  }

  updateState(player: Player, drops: Drop[], demoMode: boolean): void {
    this.latest = { player, drops, demoMode }
    this.handle?.updateState(player, drops, demoMode)
  }

  /** Predict movement immediately while the server validates the same input. */
  setMovement(direction: MovementDirection): void {
    this.handle?.setMovement(direction)
  }

  /** Stop predicted motion on blur, pointer cancellation, or an opened modal. */
  pauseManualMovement(): void {
    this.handle?.pauseManualMovement()
  }

  /** Play combat feedback only from the authoritative action response. */
  showActionResult(result: GameActionResult): void {
    this.handle?.showActionResult(result)
  }

  destroy(): void {
    this.destroyed = true
    if (this.handle) this.handle.destroy()
    else this.disposer?.()
    this.handle = null
    this.disposer = null
    for (const set of Object.values(this.handlers)) set.clear()
  }
}
