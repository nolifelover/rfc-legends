import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MANUAL_TARGET_X } from '../../game/manual-controls'
import { gameActionBodySchema } from '../../app/api/game/_helpers'
import { POST as postGameAction } from '../../app/api/game/action/route'
import { applyGameAction, createPlayer, getPlayer, listDrops, syncPlayer } from './index'
import { getStore } from './store'

const T0 = 1_700_000_000_000
const A = '0x8888888888888888888888888888888888888888'

beforeEach(async () => {
  process.env.GAME_DATA_DIR = await mkdtemp(path.join(tmpdir(), 'rfcl-action-'))
})

afterEach(() => {
  delete process.env.GAME_DATA_DIR
})

describe('applyGameAction', () => {
  it('persists mode and never gives offline rewards while manual', async () => {
    await createPlayer(A, 'ผู้เล่นแมนนวล', 'kingkong', T0)
    const entered = await applyGameAction(A, 1, { type: 'mode', mode: 'manual' }, T0)
    expect(entered.player.control?.mode).toBe('manual')
    const later = await applyGameAction(A, 2, { type: 'move', direction: 0 }, T0 + 60_000)
    expect(later.player.control?.mode).toBe('manual')
    expect(later.player.killCount).toBe(0)
    expect(later.player.exp).toBe(0)
  })

  it('caps 24h manual catch-up work, skips idle rewards, and advances the server clock', async () => {
    const player = await createPlayer(A, 'ผู้เล่นแมนนวล', 'kingkong', T0)
    player.control = { mode: 'manual', x: 290, direction: 0, moveUntil: T0, updatedAt: T0, sequence: 1 }
    await getStore().savePlayer(player)

    const now = T0 + 24 * 3600 * 1000
    const started = performance.now()
    const synced = await syncPlayer(A, now)
    const elapsed = performance.now() - started

    expect(elapsed).toBeLessThan(2_000)
    expect(synced.player.lastSyncedAt).toBe(now)
    expect(synced.player.killCount).toBe(0)
    expect(synced.player.exp).toBe(0)
    expect(synced.player.coins ?? 0).toBe(0)
    expect(await listDrops(A)).toEqual([])
  })

  it('keeps Auto on joystick release and enters Manual atomically on movement', async () => {
    await createPlayer(A, 'ผู้เล่นแมนนวล', 'kingkong', T0)
    const release = await applyGameAction(A, 1, { type: 'move', direction: 0 }, T0)
    expect(release.player.control?.mode).toBe('auto')
    const move = await applyGameAction(A, 2, { type: 'move', direction: 1 }, T0)
    expect(move.player.control).toMatchObject({ mode: 'manual', direction: 1, sequence: 2 })
  })

  it('preserves x across mode flips', async () => {
    const player = await createPlayer(A, 'ผู้เล่นแมนนวล', 'kingkong', T0)
    player.control = { mode: 'manual', x: 777, direction: 0, moveUntil: T0, updatedAt: T0, sequence: 1 }
    await getStore().savePlayer(player)
    const auto = await applyGameAction(A, 2, { type: 'mode', mode: 'auto' }, T0)
    const manual = await applyGameAction(A, 3, { type: 'mode', mode: 'manual' }, T0)
    expect(auto.player.control?.x).toBe(777)
    expect(manual.player.control?.x).toBe(777)
  })

  it('rejects sequence gaps without bricking the next valid command', async () => {
    await createPlayer(A, 'ผู้เล่นแมนนวล', 'kingkong', T0)
    const jumped = await applyGameAction(A, Number.MAX_SAFE_INTEGER, { type: 'mode', mode: 'manual' }, T0)
    expect(jumped.result).toMatchObject({ accepted: false, reason: 'STALE_SEQUENCE', sequence: 0 })
    expect(jumped.player.control).toBeUndefined()
    const recovered = await applyGameAction(A, 1, { type: 'mode', mode: 'manual' }, T0)
    expect(recovered.result.accepted).toBe(true)
  })

  it('rejects out-of-range attacks and immediate cooldown spam', async () => {
    const player = await createPlayer(A, 'ผู้เล่นแมนนวล', 'kingkong', T0)
    await applyGameAction(A, 1, { type: 'mode', mode: 'manual' }, T0)
    player.control = { mode: 'manual', x: MANUAL_TARGET_X, direction: 0, moveUntil: T0, updatedAt: T0, sequence: 1 }
    player.combat = { monsterId: 'nu-na', monsterHp: 999, playerAtkIn: 0, roosterAtkIn: 0, monsterAtkIn: 99, hp: 118 }
    await getStore().savePlayer(player)

    const first = await applyGameAction(A, 2, { type: 'attack' }, T0)
    expect(first.result.accepted).toBe(true)
    expect(first.result.damage).toBeGreaterThan(0)
    const spam = await applyGameAction(A, 3, { type: 'attack' }, T0)
    expect(spam.result).toMatchObject({ accepted: false, reason: 'COOLDOWN', sequence: 3 })

    const persisted = (await getPlayer(A))!
    persisted.control = { ...persisted.control!, x: 290, sequence: 3 }
    await getStore().savePlayer(persisted)
    const far = await applyGameAction(A, 4, { type: 'attack' }, T0 + 50)
    expect(far.result).toMatchObject({ accepted: false, reason: 'OUT_OF_RANGE', sequence: 4 })
  })

  it('serializes concurrent retries so one command kills exactly once', async () => {
    const player = await createPlayer(A, 'ผู้เล่นแมนนวล', 'raptor', T0)
    player.control = { mode: 'manual', x: MANUAL_TARGET_X, direction: 0, moveUntil: T0, updatedAt: T0, sequence: 1 }
    player.combat = { monsterId: 'nu-na', monsterHp: 1, playerAtkIn: 0, roosterAtkIn: 0, monsterAtkIn: 99, hp: 118 }
    await getStore().savePlayer(player)

    const [a, b] = await Promise.all([
      applyGameAction(A, 2, { type: 'attack' }, T0),
      applyGameAction(A, 2, { type: 'attack' }, T0),
    ])
    expect([a.result.accepted, b.result.accepted].sort()).toEqual([false, true])
    expect([a.result.reason, b.result.reason]).toContain('STALE_SEQUENCE')
    expect((await getPlayer(A))?.killCount).toBe(1)
  })

  it('consumes exactly one tonic, heals authoritatively, and rejects a retry', async () => {
    const player = await createPlayer(A, 'ผู้เล่นแมนนวล', 'thepbut', T0)
    player.control = { mode: 'auto', x: 290, direction: 0, moveUntil: T0, updatedAt: T0, sequence: 1 }
    player.combat = { monsterId: 'nu-na', monsterHp: 84, hp: 20, monsterAtkIn: 99 }
    const before = player.inventory[101]
    await getStore().savePlayer(player)

    const [first, retry] = await Promise.all([
      applyGameAction(A, 2, { type: 'potion' }, T0),
      applyGameAction(A, 2, { type: 'potion' }, T0),
    ])
    expect([first.result.accepted, retry.result.accepted].sort()).toEqual([false, true])
    expect([first.result.reason, retry.result.reason]).toContain('STALE_SEQUENCE')
    const saved = (await getPlayer(A))!
    expect(saved.control?.mode).toBe('auto')
    expect(saved.inventory[101]).toBe(before - 1)
    expect(saved.combat?.hp).toBeGreaterThan(20)
  })

  it('leaves a low-HP tonic untouched during elapsed manual time, then consumes it explicitly', async () => {
    const player = await createPlayer(A, 'ผู้เล่นแมนนวล', 'thepbut', T0)
    player.control = { mode: 'manual', x: MANUAL_TARGET_X, direction: 0, moveUntil: T0, updatedAt: T0, sequence: 1 }
    player.inventory[101] = 1
    player.combat = { monsterId: 'nu-na', monsterHp: 84, hp: 20, monsterAtkIn: 99 }
    await getStore().savePlayer(player)

    const used = await applyGameAction(A, 2, { type: 'potion' }, T0 + 1_000)
    expect(used.result.accepted).toBe(true)
    expect(used.result.healing).toBeGreaterThan(0)
    expect(used.player.inventory[101]).toBe(0)
  })

  it('rejects a tonic at full health or with no stock without consuming inventory', async () => {
    const player = await createPlayer(A, 'ผู้เล่นแมนนวล', 'thepbut', T0)
    player.control = { mode: 'manual', x: 290, direction: 0, moveUntil: T0, updatedAt: T0, sequence: 1 }
    player.combat = { monsterId: 'nu-na', monsterHp: 84, hp: 118, monsterAtkIn: 99 }
    const before = player.inventory[101]
    await getStore().savePlayer(player)

    const full = await applyGameAction(A, 2, { type: 'potion' }, T0)
    expect(full.result).toMatchObject({ accepted: false, reason: 'FULL_HP' })
    expect(full.player.inventory[101]).toBe(before)

    full.player.inventory[101] = 0
    full.player.combat = { ...full.player.combat!, hp: 20 }
    await getStore().savePlayer(full.player)
    const empty = await applyGameAction(A, 3, { type: 'potion' }, T0)
    expect(empty.result).toMatchObject({ accepted: false, reason: 'NO_ITEM' })
    expect(empty.player.inventory[101]).toBe(0)
  })

  it('preserves the active fight and cooldowns when switching back to Auto', async () => {
    const player = await createPlayer(A, 'ผู้เล่นแมนนวล', 'raptor', T0)
    player.control = { mode: 'manual', x: MANUAL_TARGET_X, direction: 0, moveUntil: T0, updatedAt: T0, sequence: 1 }
    player.combat = { monsterId: 'nu-na', monsterHp: 37, hp: 61, playerAtkIn: 0.7, roosterAtkIn: 0.4, monsterAtkIn: 0.9 }
    await getStore().savePlayer(player)

    const auto = await applyGameAction(A, 2, { type: 'mode', mode: 'auto' }, T0)
    expect(auto.player.control?.mode).toBe('auto')
    expect(auto.player.combat).toMatchObject({ monsterId: 'nu-na', monsterHp: 37, hp: 61, playerAtkIn: 0.7, roosterAtkIn: 0.4 })
  })
})

describe('action request validation', () => {
  it('rejects malformed directions, sequences, and extra combat claims', () => {
    expect(gameActionBodySchema.safeParse({ address: A, sequence: 1, action: { type: 'move', direction: 1 } }).success).toBe(true)
    expect(gameActionBodySchema.safeParse({ address: A, sequence: 0, action: { type: 'attack' } }).success).toBe(false)
    expect(gameActionBodySchema.safeParse({ address: A, sequence: 2, action: { type: 'move', direction: 2 } }).success).toBe(false)
    expect(gameActionBodySchema.safeParse({ address: A, sequence: 3, action: { type: 'attack', damage: 999 } }).success).toBe(false)
  })

  it('returns HTTP 400 INVALID_BODY for a malformed action request', async () => {
    const response = await postGameAction(new Request('http://localhost/api/game/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: A, sequence: 1, action: { type: 'move', direction: 9 } }),
    }))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ reason: 'INVALID_BODY' })
  })
})
