// Persistence — interfaces.md §5. JSON file store first (apps/web/.data/game.json), Supabase later.
// All mutations go through a per-instance promise chain so concurrent requests can't lose writes.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Drop, DropStatus, Player } from '../../game/types'
import { PbGameStore } from './pb-store'

interface StoredPlayer extends Player {
  drops: Drop[]
}

interface DbShape {
  players: Record<string, StoredPlayer>
}

export interface GameStore {
  getPlayer(address: string): Promise<Player | null>
  savePlayer(player: Player): Promise<void>
  listDrops(address: string): Promise<Drop[]>
  saveDrop(address: string, drop: Drop): Promise<void>
  updateDropStatus(address: string, dropId: string, status: DropStatus, txHash?: string): Promise<void>
}

export class JsonFileStore implements GameStore {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly dir: string) {}

  private get file(): string {
    return path.join(this.dir, 'game.json')
  }

  private async readRaw(): Promise<DbShape> {
    try {
      const txt = await fs.readFile(this.file, 'utf8')
      const parsed = JSON.parse(txt) as DbShape
      // NB: always return a FRESH empty db — a shared const would get mutated by savePlayer's
      // transact and poison every later "missing file" read.
      return parsed && typeof parsed === 'object' && parsed.players ? parsed : { players: {} }
    } catch {
      return { players: {} }
    }
  }

  private async writeRaw(db: DbShape): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true })
    const tmp = `${this.file}.${process.pid}.tmp`
    await fs.writeFile(tmp, JSON.stringify(db, null, 2))
    await fs.rename(tmp, this.file) // atomic-ish
  }

  /** Serialize mutations through a promise chain (single-process safety). */
  private transact<T>(fn: (db: DbShape) => Promise<T> | T): Promise<T> {
    const run = this.queue.then(async () => fn(await this.readRaw()))
    this.queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async getPlayer(address: string): Promise<Player | null> {
    const db = await this.readRaw()
    const rec = db.players[address]
    if (!rec) return null
    const { drops: _drops, ...player } = rec
    return player
  }

  async savePlayer(player: Player): Promise<void> {
    await this.transact(async (db) => {
      const existing = db.players[player.address]
      db.players[player.address] = { ...player, drops: existing?.drops ?? [] }
      await this.writeRaw(db)
    })
  }

  async listDrops(address: string): Promise<Drop[]> {
    const db = await this.readRaw()
    return db.players[address]?.drops ?? []
  }

  async saveDrop(address: string, drop: Drop): Promise<void> {
    await this.transact(async (db) => {
      const rec = db.players[address]
      if (!rec) throw new Error('PLAYER_NOT_FOUND')
      rec.drops = [...rec.drops, drop]
      await this.writeRaw(db)
    })
  }

  async updateDropStatus(address: string, dropId: string, status: DropStatus, txHash?: string): Promise<void> {
    await this.transact(async (db) => {
      const rec = db.players[address]
      const drop = rec?.drops.find((d) => d.dropId === dropId)
      if (!drop) throw new Error('DROP_NOT_FOUND')
      drop.status = status
      if (txHash !== undefined) drop.txHash = txHash
      await this.writeRaw(db)
    })
  }
}

let cached: { key: string; store: GameStore } | null = null

/**
 * Mirrors pbConfigured() in ../pb (plus the POCKETBASE_URL check) — pb.ts can't be imported here
 * because its 'server-only' import doesn't resolve outside the Next server runtime.
 */
function pbConfigured(): boolean {
  return Boolean(
    process.env.POCKETBASE_URL &&
      process.env.POCKETBASE_SUPERUSER_EMAIL &&
      process.env.POCKETBASE_SUPERUSER_PASSWORD,
  )
}

/**
 * Selects the singleton store (interfaces.md §5b): PocketBase when configured
 * (POCKETBASE_URL + POCKETBASE_SUPERUSER_*) unless GAME_DATA_DIR is pinned (tests pin it to tmp
 * dirs and must keep the JSON store). The PB client is loaded lazily inside PbGameStore, so
 * pb.ts's 'server-only' import never resolves outside the Next server runtime.
 */
export function getStore(): GameStore {
  const jsonDir = process.env.GAME_DATA_DIR ?? path.join(process.cwd(), '.data')
  const usePb = pbConfigured() && !process.env.GAME_DATA_DIR
  const key = usePb ? 'pocketbase' : `json:${jsonDir}`
  if (!cached || cached.key !== key) {
    cached = { key, store: usePb ? new PbGameStore() : new JsonFileStore(jsonDir) }
  }
  return cached.store
}
