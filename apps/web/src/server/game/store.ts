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
  /** Persist many drops in one write/transaction — syncPlayer uses this (D1: one save per sync). */
  saveDrops(address: string, drops: Drop[]): Promise<void>
  /** `txHash: null` clears the field (used when a mint is rolled back). */
  updateDropStatus(address: string, dropId: string, status: DropStatus, txHash?: string | null): Promise<void>
}

export class JsonFileStore implements GameStore {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly dir: string) {}

  private get file(): string {
    return path.join(this.dir, 'game.json')
  }

  /**
   * Read + minimally validate the db. ENOENT → fresh empty db. Any other read/parse error →
   * move the file aside to `<name>.corrupt-<ts>.bak` and rethrow (D3: a catch-all here would make
   * a corrupted file look empty and the next save would silently wipe every player). Garbage
   * records (no string address) are dropped into the same backup with a warning, good ones kept.
   */
  private async readRaw(): Promise<DbShape> {
    let txt: string
    try {
      txt = await fs.readFile(this.file, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { players: {} }
      await this.backupCorrupt().catch(() => undefined)
      throw new Error(`GAME_DATA_CORRUPT: cannot read ${this.file} (backed up if possible): ${String(err)}`)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(txt)
    } catch (err) {
      await this.backupCorrupt().catch(() => undefined)
      throw new Error(`GAME_DATA_CORRUPT: cannot parse ${this.file} (backed up if possible): ${String(err)}`)
    }
    const raw = parsed && typeof parsed === 'object' && (parsed as DbShape).players ? (parsed as DbShape) : null
    if (!raw) {
      await this.backupCorrupt().catch(() => undefined)
      throw new Error(`GAME_DATA_CORRUPT: ${this.file} is not a valid game db (backed up if possible)`)
    }
    const db: DbShape = { players: {} }
    const bad: Record<string, unknown> = {}
    for (const [addr, rec] of Object.entries(raw.players)) {
      if (rec && typeof rec === 'object' && typeof (rec as Player).address === 'string') {
        db.players[addr] = rec as StoredPlayer
      } else {
        bad[addr] = rec
        console.warn(`[game-store] dropping corrupt player record ${addr} (backed up)`)
      }
    }
    if (Object.keys(bad).length > 0) {
      await fs.mkdir(this.dir, { recursive: true })
      await fs.writeFile(`${this.file}.corrupt-${Date.now()}.bak`, JSON.stringify({ players: bad }, null, 2))
    }
    return db
  }

  /** Move the (unreadable) data file aside so the next save can't overwrite the evidence. */
  private async backupCorrupt(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true })
    await fs.rename(this.file, `${this.file}.corrupt-${Date.now()}.bak`)
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
    await this.saveDrops(address, [drop])
  }

  async saveDrops(address: string, drops: Drop[]): Promise<void> {
    if (drops.length === 0) return
    await this.transact(async (db) => {
      const rec = db.players[address]
      if (!rec) throw new Error('PLAYER_NOT_FOUND')
      rec.drops = [...rec.drops, ...drops]
      await this.writeRaw(db) // ONE write for the whole batch (D1)
    })
  }

  async updateDropStatus(address: string, dropId: string, status: DropStatus, txHash?: string | null): Promise<void> {
    await this.transact(async (db) => {
      const rec = db.players[address]
      const drop = rec?.drops.find((d) => d.dropId === dropId)
      if (!drop) throw new Error('DROP_NOT_FOUND')
      drop.status = status
      if (txHash === null) delete drop.txHash
      else if (txHash !== undefined) drop.txHash = txHash
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
