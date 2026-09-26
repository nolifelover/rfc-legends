// Sync-level regression tests (D1 timing bar + D2 mutex). Runs the engine in DEMO_MODE:
// the env var must be set before the engine module is imported, hence the dynamic import.
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

process.env.DEMO_MODE = 'true'

const T0 = 1_700_000_000_000
const A = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'rfcl-sync-'))
  process.env.GAME_DATA_DIR = dir
})

afterEach(() => {
  delete process.env.GAME_DATA_DIR
  delete process.env.DEMO_MODE
})

async function engine() {
  return import('./index')
}

describe('D1: demo-mode 24h sync must be fast (batch drop persistence)', () => {
  it('completes a DEMO_MODE 24h syncPlayer well under 2s and caps persisted drops', async () => {
    const { createPlayer, syncPlayer, listDrops, MAX_DROPS_PER_SYNC } = await engine()
    await createPlayer(A, 'นายไก่สายซิงก์', 'kingkong', T0)

    const started = performance.now()
    const res = await syncPlayer(A, T0 + 24 * 3600 * 1000)
    const elapsedMs = performance.now() - started

    expect(res.demoMode).toBe(true)
    // the bar from the verify pass: < 2s (was 139.9s with per-drop whole-file writes)
    expect(elapsedMs).toBeLessThan(2000)
    const drops = await listDrops(A)
    expect(drops.length).toBeLessThanOrEqual(MAX_DROPS_PER_SYNC)
    expect(drops.length).toBeGreaterThan(0)
    // rarest-first cap: with a demo flood, at least one mvp_card must survive the cut
    expect(drops.some((d) => d.rarity === 'mvp_card')).toBe(true)
  })
})

describe('D2: concurrent syncPlayer is serialized per address', () => {
  it('two overlapping syncs: +2 sessionCounter, one lastSyncedAt, zero duplicate dropIds', async () => {
    const { createPlayer, syncPlayer, getPlayer, listDrops } = await engine()
    await createPlayer(A, 'นายไก่สายซิงก์', 'raptor', T0)

    const later = T0 + 2 * 3600 * 1000
    const [r1, r2] = await Promise.all([
      syncPlayer(A, T0 + 3600 * 1000),
      syncPlayer(A, later), // overlapping; must queue behind the first
    ])

    const player = await getPlayer(A)
    expect(player?.sessionCounter).toBe(2)
    expect(player?.lastSyncedAt).toBe(later) // exactly one, the later one
    expect(r1.player.sessionCounter).toBe(1)
    expect(r2.player.sessionCounter).toBe(2)

    const drops = await listDrops(A)
    const ids = new Set(drops.map((d) => d.dropId))
    expect(ids.size).toBe(drops.length) // zero duplicates (onchain dropMinted dedup depends on this)
    expect(drops.length).toBeGreaterThan(0)

    // and the store file is parseable with the same content
    const file = JSON.parse(await readFile(path.join(dir, 'game.json'), 'utf8'))
    expect(Object.keys(file.players)).toHaveLength(1)
  })
})
