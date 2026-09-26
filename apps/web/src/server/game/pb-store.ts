// PocketBase-backed GameStore — interfaces.md §5b. Collections: players, drops (superuser-locked),
// with the whole Player/Drop object stored in a `data` JSON field.
//
// IMPORTANT: ../pb imports 'server-only' (a Next-only alias, not a real package), which cannot
// resolve under vitest or plain node. So pb.ts is loaded lazily INSIDE methods — never at module
// top level — and this module itself stays importable everywhere.

import type { Drop, DropStatus, Player } from '../../game/types'
import type { GameStore } from './store'

type Pb = import('pocketbase').default

async function pb(): Promise<Pb> {
  const { getPb } = await import('../pb')
  return getPb()
}

/** PocketBase SDK throws ClientResponseError with status 404 on missing records. */
function isNotFound(err: unknown): boolean {
  const e = err as { status?: number; response?: { status?: number } }
  return e?.status === 404 || e?.response?.status === 404
}

/**
 * dropIds are bytes32 hex; the engine mints them lowercase but callers (worldid lane, contracts)
 * may pass mixed case. Normalized to lowercase on BOTH write and read so lookups always match.
 */
function normDropId(dropId: string): string {
  return dropId.toLowerCase()
}

/** Re-throw store-contract error codes for the not-found cases (parity with JsonFileStore). */
function notFound(err: unknown, code: 'PLAYER_NOT_FOUND' | 'DROP_NOT_FOUND'): never {
  if (isNotFound(err)) throw new Error(code)
  throw err
}

export class PbGameStore implements GameStore {
  async getPlayer(address: string): Promise<Player | null> {
    const client = await pb()
    try {
      const rec = await client.collection('players').getFirstListItem(`address = "${address}"`)
      return rec.data as Player
    } catch (err) {
      if (isNotFound(err)) return null
      throw err
    }
  }

  async savePlayer(player: Player): Promise<void> {
    const client = await pb()
    const col = client.collection('players')
    try {
      const rec = await col.getFirstListItem(`address = "${player.address}"`)
      await col.update(rec.id, { address: player.address, data: player })
    } catch (err) {
      if (!isNotFound(err)) throw err
      await col.create({ address: player.address, data: player })
    }
  }

  async listDrops(address: string): Promise<Drop[]> {
    const client = await pb()
    const recs = await client.collection('drops').getFullList({
      filter: `address = "${address}"`,
      sort: 'created,id', // stable insertion order, matching the JSON store
    })
    return recs.map((r) => r.data as Drop)
  }

  async saveDrop(address: string, drop: Drop): Promise<void> {
    await this.saveDrops(address, [drop])
  }

  async saveDrops(address: string, drops: Drop[]): Promise<void> {
    if (drops.length === 0) return
    const client = await pb()
    await client
      .collection('players')
      .getFirstListItem(`address = "${address}"`)
      .catch((err: unknown) => notFound(err, 'PLAYER_NOT_FOUND'))
    // one batch transaction for the whole sync (D1) instead of N sequential creates
    const batch = client.createBatch()
    for (const drop of drops) {
      const dropId = normDropId(drop.dropId)
      batch.collection('drops').create({ address, dropId, data: { ...drop, dropId } })
    }
    await batch.send()
  }

  async updateDropStatus(
    address: string,
    dropId: string,
    status: DropStatus,
    txHash?: string | null,
  ): Promise<void> {
    const client = await pb()
    const id = normDropId(dropId)
    const rec = await client
      .collection('drops')
      .getFirstListItem(`address = "${address}" && dropId = "${id}"`)
      .catch((err: unknown) => notFound(err, 'DROP_NOT_FOUND'))
    const data = rec.data as Drop
    data.status = status
    if (txHash === null) delete data.txHash
    else if (txHash !== undefined) data.txHash = txHash
    await client.collection('drops').update(rec.id, { dropId: id, data })
  }
}
