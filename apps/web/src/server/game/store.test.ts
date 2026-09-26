// D3: corrupted game.json must never look empty — the next save would silently wipe all players.
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { JsonFileStore } from './store'
import { buildPlayer } from './index'

const T0 = 1_700_000_000_000
const A = '0x1212121212121212121212121212121212121212'
const B = '0x1313131313131313131313131313131313131313'
let dir: string
let file: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'rfcl-store-'))
  file = path.join(dir, 'game.json')
})

describe('JsonFileStore corruption guard (D3)', () => {
  it('missing file still means empty db (ENOENT path unchanged)', async () => {
    const store = new JsonFileStore(dir)
    expect(await store.getPlayer(A)).toBeNull()
  })

  it('unparseable file → clear error, file renamed to .corrupt-<ts>.bak, nothing silently wiped', async () => {
    await writeFile(file, '{ this is not json')
    const store = new JsonFileStore(dir)
    await expect(store.getPlayer(A)).rejects.toThrowError(/GAME_DATA_CORRUPT/)
    const files = await readdir(dir)
    const bak = files.find((f) => /^game\.json\.corrupt-\d+\.bak$/.test(f))
    expect(bak).toBeDefined()
    expect(files).not.toContain('game.json')
  })

  it('garbage records are moved to a backup while valid players are kept', async () => {
    const good = buildPlayer(A, 'ข้อมูลดี', 'raptor', T0)
    await writeFile(
      file,
      JSON.stringify({
        players: {
          [A]: { ...good, drops: [] },
          garbage: { nope: true },
          also_bad: 42,
        },
      }),
    )
    const store = new JsonFileStore(dir)
    const kept = await store.getPlayer(A)
    expect(kept?.address).toBe(A)
    expect(await store.getPlayer(B)).toBeNull()

    // a later save persists only the valid record, and the bad ones live in the backup
    const playerB = buildPlayer(B, 'ผู้เล่นบี', 'kingkong', T0)
    await store.savePlayer(playerB)
    const files = await readdir(dir)
    const bak = files.find((f) => /^game\.json\.corrupt-\d+\.bak$/.test(f))
    expect(bak).toBeDefined()
    const backed = JSON.parse(await readFile(path.join(dir, bak!), 'utf8'))
    expect(Object.keys(backed.players).sort()).toEqual(['also_bad', 'garbage'])
    const final = JSON.parse(await readFile(file, 'utf8'))
    expect(Object.keys(final.players).sort()).toEqual([A, B].sort())
  })

  it('a db whose top level is not a players map is treated as corrupt', async () => {
    await writeFile(file, JSON.stringify([1, 2, 3]))
    const store = new JsonFileStore(dir)
    await expect(store.getPlayer(A)).rejects.toThrowError(/GAME_DATA_CORRUPT/)
  })
})
