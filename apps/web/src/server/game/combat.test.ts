import { describe, expect, it } from 'vitest'
import type { Player, StatKey } from '../../game/types'
import { DEMO_OPTS, KILL_RATE_MAX, NORMAL_OPTS, OFFLINE_CAP_SECONDS, OFFLINE_EFFICIENCY, simulateLive, settleOffline } from './combat'
import { hashSeed, mulberry32 } from './rng'
import { allocateStats, expToNext } from './stats'
import { buildPlayer } from './index'

const T0 = 1_700_000_000_000
const ADDR = '0x2222222222222222222222222222222222222222'

/** Greedy starter build: str → vit → dex → agi (what a real player picks first). */
export function spendStarterPoints(p: Player): void {
  const priority: StatKey[] = ['str', 'vit', 'dex', 'agi', 'luk', 'int']
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let raised = false
    for (const stat of priority) {
      const cost = 2 + Math.floor((p.stats[stat] - 1) / 10)
      if (p.statPoints >= cost) {
        allocateStats(p, { [stat]: 1 })
        raised = true
        break
      }
    }
    if (!raised) break
  }
}

function readyPlayer(): Player {
  const p = buildPlayer(ADDR, 'นายไก่ทดสอบ', 'kingkong', T0)
  spendStarterPoints(p)
  return p
}

describe('simulateLive — determinism (GDD §4.1 server-authoritative)', () => {
  it('two identical runs from the same snapshot are byte-identical', () => {
    const a = readyPlayer()
    const b = readyPlayer()
    const runA = simulateLive(a, 120, mulberry32(hashSeed(ADDR, 1)), NORMAL_OPTS)
    const runB = simulateLive(b, 120, mulberry32(hashSeed(ADDR, 1)), NORMAL_OPTS)
    expect(JSON.stringify(runB.player)).toBe(JSON.stringify(runA.player))
    expect(JSON.stringify(runB.aggregates)).toBe(JSON.stringify(runA.aggregates))
  })

  it('does not mutate the input player', () => {
    const a = readyPlayer()
    const before = JSON.stringify(a)
    simulateLive(a, 60, mulberry32(42), NORMAL_OPTS)
    expect(JSON.stringify(a)).toBe(before)
  })

  it('actually kills monsters and gains exp in 2 minutes', () => {
    const p = readyPlayer()
    const { player, aggregates } = simulateLive(p, 120, mulberry32(hashSeed(ADDR, 7)), NORMAL_OPTS)
    expect(aggregates.kills).toBeGreaterThan(0)
    expect(aggregates.expGained).toBeGreaterThan(0)
    expect(player.killCount).toBe(aggregates.kills)
    expect(player.exp).toBeGreaterThanOrEqual(0)
    expect(player.baseLevel).toBeGreaterThan(1)
  })

})

describe('settleOffline — rate-based, 70%, capped 12h (GDD §4.1)', () => {
  it('caps settlement at 12h', () => {
    const p = readyPlayer()
    const { aggregates } = settleOffline(p, 24 * 3600, mulberry32(hashSeed(ADDR, 9)), NORMAL_OPTS)
    expect(aggregates.seconds).toBe(OFFLINE_CAP_SECONDS)
  })

  it('never exceeds the kill-rate ceiling (8/min × 0.7)', () => {
    const p = readyPlayer()
    const { aggregates } = settleOffline(p, 24 * 3600, mulberry32(hashSeed(ADDR, 9)), NORMAL_OPTS)
    const maxKills = Math.round(KILL_RATE_MAX * (OFFLINE_CAP_SECONDS / 60) * OFFLINE_EFFICIENCY)
    expect(aggregates.kills).toBeLessThanOrEqual(maxKills)
    expect(aggregates.killRatePerMin).toBeLessThanOrEqual(KILL_RATE_MAX)
  })

  it('offline exp roughly tracks the online rate × 0.7', () => {
    const p = readyPlayer()
    const { player, aggregates } = settleOffline(p, 3600, mulberry32(hashSeed(ADDR, 11)), NORMAL_OPTS)
    expect(player.killCount).toBe(aggregates.kills)
    // weighted avg exp per kill on thung-na ≈ 46; exp must be kills × avg × 0.7-ish (MVPs add more)
    expect(aggregates.expGained).toBeGreaterThanOrEqual(aggregates.kills * 40)
  })

  it('is deterministic', () => {
    const a = readyPlayer()
    const b = readyPlayer()
    const outA = settleOffline(a, 600, mulberry32(hashSeed('off', 1)), NORMAL_OPTS)
    const outB = settleOffline(b, 600, mulberry32(hashSeed('off', 1)), NORMAL_OPTS)
    expect(JSON.stringify(outB.player)).toBe(JSON.stringify(outA.player))
    expect(JSON.stringify(outB.aggregates)).toBe(JSON.stringify(outA.aggregates))
  })

  it('zero seconds is a no-op', () => {
    const p = readyPlayer()
    const { player, aggregates } = settleOffline(p, 0, mulberry32(3), NORMAL_OPTS)
    expect(aggregates.kills).toBe(0)
    expect(aggregates.expGained).toBe(0)
    expect(JSON.stringify(player)).toBe(JSON.stringify(readyPlayer()))
  })
})

describe('level pacing sanity', () => {
  it('a starter player passes Lv5 within 20 min of live sim (online pace)', () => {
    const p = readyPlayer()
    const { player } = simulateLive(p, 1200, mulberry32(hashSeed(ADDR, 21)), NORMAL_OPTS)
    expect(player.baseLevel).toBeGreaterThanOrEqual(5)
  })

  it('exp applied per kill matches monster exp', () => {
    const p = readyPlayer()
    const { player, aggregates } = simulateLive(p, 60, mulberry32(hashSeed(ADDR, 5)), NORMAL_OPTS)
    if (aggregates.kills > 0) {
      // every kill awards at least the weakest monster's exp
      expect(aggregates.expGained).toBeGreaterThanOrEqual(aggregates.kills * 14) // หนูนา exp
      expect(player.exp).toBeLessThan(expToNext(player.baseLevel))
    }
  })
})

describe('demo opts are wired differently from normal', () => {
  it('DEMO_OPTS boosts exp and MVP cadence', () => {
    expect(DEMO_OPTS.expMult).toBeGreaterThan(NORMAL_OPTS.expMult)
    expect(DEMO_OPTS.mvpEveryKills).toBeLessThan(NORMAL_OPTS.mvpEveryKills)
  })
})
