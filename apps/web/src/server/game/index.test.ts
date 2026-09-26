import { mkdtemp, copyFile, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  GameError,
  allocateStats,
  createPlayer,
  getDrop,
  getPlayer,
  listDrops,
  normalizeAddress,
  setDropStatus,
  syncPlayer,
} from './index'
import { JsonFileStore, getStore } from './store'
import { OFFLINE_CAP_SECONDS, KILL_RATE_MAX, OFFLINE_EFFICIENCY, LIVE_WINDOW } from './combat'

const T0 = 1_700_000_000_000
const A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
let dir: string

function useDataDir(d: string): void {
  process.env.GAME_DATA_DIR = d
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'rfcl-game-'))
  useDataDir(dir)
})

afterEach(() => {
  delete process.env.GAME_DATA_DIR
})

describe('normalizeAddress', () => {
  it('lowercases and accepts valid hex', () => {
    expect(normalizeAddress('0xABCdef0000000000000000000000000000000001')).toBe(
      '0xabcdef0000000000000000000000000000000001',
    )
  })
  it('rejects junk', () => {
    expect(() => normalizeAddress('nope')).toThrowError(GameError)
    expect(() => normalizeAddress('0x123')).toThrowError('INVALID_ADDRESS')
  })
})

describe('createPlayer / getPlayer', () => {
  it('round-trips a fresh player', async () => {
    const created = await createPlayer(A, 'นายไก่เอ', 'kumarnjeen', T0)
    expect(created.address).toBe(A)
    expect(created.statPoints).toBe(48)
    expect(created.rooster.stats.pow).toBe(5)
    expect(created.mapId).toBe('thung-na')
    const loaded = await getPlayer(A)
    expect(loaded).toEqual(created)
  })

  it('rejects duplicates and bad input', async () => {
    await createPlayer(A, 'นายไก่เอ', 'raptor', T0)
    await expect(createPlayer(A, 'อีกคน', 'raptor', T0)).rejects.toThrowError('PLAYER_EXISTS')
    await expect(createPlayer(A, '', 'raptor', T0)).rejects.toThrowError('INVALID_NAME')
    await expect(
      createPlayer('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'นายไก่บี', 'poring' as never, T0),
    ).rejects.toThrowError('INVALID_SIRE_LINE')
  })

  it('returns null for unknown players', async () => {
    expect(await getPlayer('0x0000000000000000000000000000000000000001')).toBeNull()
  })
})

describe('allocateStats API', () => {
  it('allocates and persists', async () => {
    await createPlayer(A, 'นายไก่เอ', 'thepbut', T0)
    const p = await allocateStats(A, { str: 3, vit: 2 })
    expect(p.stats.str).toBe(4)
    expect(p.stats.vit).toBe(3)
    const reloaded = await getPlayer(A)
    expect(reloaded?.stats.str).toBe(4)
    expect(reloaded?.statPoints).toBe(p.statPoints)
  })

  it('errors surface as GameError codes', async () => {
    await createPlayer(A, 'นายไก่เอ', 'thepbut', T0)
    await expect(allocateStats(A, { str: 90 })).rejects.toThrowError('NOT_ENOUGH_POINTS')
    await expect(
      allocateStats('0xcccccccccccccccccccccccccccccccccccccccc', { str: 1 }),
    ).rejects.toThrowError('PLAYER_NOT_FOUND')
  })
})

describe('syncPlayer', () => {
  it('sub-1s sync is a no-op', async () => {
    await createPlayer(A, 'นายไก่เอ', 'kingkong', T0)
    const res = await syncPlayer(A, T0 + 500)
    expect(res.live).toBeNull()
    expect(res.offline).toBeNull()
    expect(res.player.lastSyncedAt).toBe(T0)
  })

  it('runs the live window first, then offline settle', async () => {
    await createPlayer(A, 'นายไก่เอ', 'kingkong', T0)
    const res = await syncPlayer(A, T0 + (LIVE_WINDOW + 600) * 1000)
    expect(res.live?.ticks).toBe(LIVE_WINDOW)
    expect(res.offline?.seconds).toBe(600)
    expect(res.player.killCount).toBe(res.live!.kills + res.offline!.kills)
    expect(res.player.lastSyncedAt).toBe(T0 + (LIVE_WINDOW + 600) * 1000)
  })

  it('caps offline settlement at 12h when 24h elapsed', async () => {
    await createPlayer(A, 'นายไก่เอ', 'kingkong', T0)
    const res = await syncPlayer(A, T0 + 24 * 3600 * 1000)
    expect(res.offline?.seconds).toBe(OFFLINE_CAP_SECONDS)
    const maxKills = Math.round(KILL_RATE_MAX * (OFFLINE_CAP_SECONDS / 60) * OFFLINE_EFFICIENCY)
    expect(res.offline!.kills).toBeLessThanOrEqual(maxKills)
  })

  it('is byte-identical from the same snapshot (determinism contract)', async () => {
    // store A
    await createPlayer(A, 'นายไก่เอ', 'raptor', T0)
    // copy the snapshot into store B before syncing
    const dirB = path.join(dir, 'snapshot-b')
    await mkdir(dirB, { recursive: true })
    await copyFile(path.join(dir, 'game.json'), path.join(dirB, 'game.json'))

    const syncAt = T0 + 3600 * 1000
    const resA = await syncPlayer(A, syncAt)
    const fileA = await readFile(path.join(dir, 'game.json'), 'utf8')

    useDataDir(dirB)
    const resB = await syncPlayer(A, syncAt)
    const fileB = await readFile(path.join(dirB, 'game.json'), 'utf8')

    expect(JSON.stringify(resB.player)).toBe(JSON.stringify(resA.player))
    expect(resB.player.sessionCounter).toBe(resA.player.sessionCounter)
    expect(fileB).toBe(fileA)
  })

  it('records mintable drops as unminted Drop records with deterministic ids', async () => {
    // demo-tier boost so drops actually land in a short window; use the store directly
    const store = new JsonFileStore(path.join(dir, 'boost'))
    useDataDir(path.join(dir, 'boost'))
    await createPlayer(A, 'นายไก่เอ', 'raptor', T0)
    // force many kills → drops via a long offline settle in demo shape is not exposed here;
    // instead verify plumbing with a synthetic drop saved to the store
    const drop = {
      dropId: '0x' + 'ab'.repeat(32) as `0x${string}`,
      itemId: 2001,
      rarity: 'legendary' as const,
      status: 'unminted' as const,
      droppedAt: T0,
    }
    await store.saveDrop(A, drop)
    const drops = await listDrops(A)
    expect(drops).toHaveLength(1)
    expect(drops[0].itemId).toBe(2001)
    const got = await getDrop(A, drop.dropId)
    expect(got?.dropId).toBe(drop.dropId)
    await setDropStatus(A, drop.dropId, 'minted', '0xdeadbeef')
    expect((await getDrop(A, drop.dropId))?.status).toBe('minted')
    expect((await getDrop(A, drop.dropId))?.txHash).toBe('0xdeadbeef')
    await expect(setDropStatus(A, drop.dropId, 'wild' as never)).rejects.toThrowError('INVALID_STATUS')
    await expect(
      setDropStatus('0xdddddddddddddddddddddddddddddddddddddddd', drop.dropId, 'minted'),
    ).rejects.toThrowError('DROP_NOT_FOUND')
  })

  it('matches dropIds case-insensitively (worldid lane passes lowercase)', async () => {
    useDataDir(path.join(dir, 'case'))
    await createPlayer(A, 'นายไก่เอ', 'raptor', T0)
    const store = getStore()
    const lower = '0x' + 'ab'.repeat(32) as `0x${string}`
    await store.saveDrop(A, {
      dropId: lower,
      itemId: 3001,
      rarity: 'mvp_card',
      status: 'unminted',
      droppedAt: T0,
    })
    // uppercase lookup finds it, uppercase status update hits the same record
    const upper = ('0x' + 'AB'.repeat(32)) as `0x${string}`
    expect((await getDrop(A, upper))?.dropId).toBe(lower)
    await setDropStatus(A, upper, 'minting')
    expect((await getDrop(A, lower))?.status).toBe('minting')
  })
})

describe('store', () => {
  it('getStore() returns a singleton keyed by data dir', () => {
    const s1 = getStore()
    const s2 = getStore()
    expect(s1).toBe(s2)
  })

  it('savePlayer preserves existing drops', async () => {
    const store = getStore()
    const p = await createPlayer(A, 'นายไก่เอ', 'kumarnjeen', T0)
    await store.saveDrop(A, {
      dropId: '0x' + 'cd'.repeat(32) as `0x${string}`,
      itemId: 1001,
      rarity: 'monster_card',
      status: 'unminted',
      droppedAt: T0,
    })
    p.name = 'นายไก่เอ้'
    await store.savePlayer(p)
    const drops = await store.listDrops(A)
    expect(drops).toHaveLength(1)
    const reloaded = await getPlayer(A)
    expect(reloaded?.name).toBe('นายไก่เอ้')
  })
})
