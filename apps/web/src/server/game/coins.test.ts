// Visible-loot regression (game critic r3): coins accrue on every credited kill and demo
// commons land on ~1 in 2 kills. The runbook's mintable bars must stay untouched.
import { describe, expect, it } from 'vitest'
import type { Player } from '../../game/types'
import { DEMO_OPTS, NORMAL_OPTS, simulateLive } from './combat'
import { mulberry32 } from './rng'
import { buildPlayer } from './index'

const ADDR = '0x1616161616161616161616161616161616161616'

function run(seconds: number, opts = DEMO_OPTS): { player: Player; kills: number; coins: number; commonItems: number; mintable: number } {
  let p = buildPlayer(ADDR, 'นายไก่เบี้ย', 'kingkong', 1_700_000_000_000)
  let kills = 0
  let coins = 0
  let commonItems = 0
  let mintable = 0
  for (let t = 0; t < seconds; t += 30) {
    const { player, aggregates } = simulateLive(p, 30, mulberry32(42 + t), opts)
    p = player
    kills += aggregates.kills
    coins += aggregates.coinsGained
    // commons are the 1xx farm materials; 2xx equipment gains don't count toward the bar
    commonItems += Object.entries(aggregates.inventory).reduce((s, [id, n]) => s + (Number(id) < 200 ? n : 0), 0)
    mintable += aggregates.drops.length
  }
  return { player: p, kills, coins, commonItems, mintable }
}

describe('visible loot — เบี้ย coins + demo commons', () => {
  it('coins accrue on every credited kill and persist on the player', () => {
    const r = run(600)
    // ~60s of fast zone-1 kills, then the pond's steadier pace — a healthy floor, not a bar
    expect(r.kills).toBeGreaterThan(40)
    expect(r.coins).toBeGreaterThan(0)
    expect(r.player.coins).toBe(r.coins) // persisted (undefined stays undefined only at 0 kills)
    // per-kill bounds: base 3–8, level scale ≥ 1, boss kills pay more — sanity band
    const perKill = r.coins / r.kills
    expect(perKill).toBeGreaterThanOrEqual(3)
    expect(perKill).toBeLessThanOrEqual(8 * 30) // generous upper bound incl. bosses & levels
  })

  it('demo commons land on roughly 1 in 2 kills (0.35–0.65)', () => {
    const r = run(900)
    const rate = r.commonItems / r.kills
    expect(r.kills).toBeGreaterThan(60)
    expect(rate).toBeGreaterThanOrEqual(0.35)
    expect(rate).toBeLessThanOrEqual(0.65)
  })

  it('normal play keeps the base ~25% common chance', () => {
    const r = run(900, NORMAL_OPTS)
    const rate = r.commonItems / r.kills
    expect(rate).toBeGreaterThanOrEqual(0.12)
    expect(rate).toBeLessThanOrEqual(0.38)
  })

  it('mintable bars are unchanged by the loot feel (≤15% of kills, demo)', () => {
    const r = run(900)
    expect(r.mintable / r.kills).toBeLessThanOrEqual(0.15)
  })
})
