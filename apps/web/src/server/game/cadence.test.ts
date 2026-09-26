// Sync-cadence regression: attack timers + monster HP persist across windows and lastSyncedAt
// advances by whole simulated seconds only. A judge polling /game every second (or with two
// tabs = double poll rate) must progress exactly like a slow poller.
import { describe, expect, it } from 'vitest'
import type { Player, StatKey } from '../../game/types'
import { DEMO_OPTS, simulateLive } from './combat'
import { hashSeed, mulberry32 } from './rng'
import { allocateStats } from './stats'
import { buildPlayer } from './index'

const T0 = 1_700_000_000_000
const ADDR = '0x1515151515151515151515151515151515151515'

function spendStarterPoints(p: Player): void {
  const priority: StatKey[] = ['str', 'vit', 'dex', 'agi', 'luk', 'int']
  for (;;) {
    const stat = priority.find((s) => p.statPoints >= 2 + Math.floor((p.stats[s] - 1) / 10))
    if (!stat) break
    allocateStats(p, { [stat]: 1 })
  }
}

/** Run `totalSecs` of game time in fixed `windowSecs` syncs, threading state like syncPlayer does. */
function runWindowed(windowSecs: number, totalSecs: number, tag: string): { player: Player; kills: number } {
  let p = buildPlayer(ADDR, 'นายไก่แคดเดนซ์', 'kingkong', T0)
  spendStarterPoints(p)
  let kills = 0
  let sync = 0
  for (let t = 0; t < totalSecs; t += windowSecs) {
    // seed by ABSOLUTE window position, not window index: comparing cadences must measure
    // the ENGINE's windowing behavior, not which stream each cadence happened to draw.
    // (Balance changes otherwise move the drift — a 0.45 pond-HP tune pushed the old
    // per-index seeds to a 16% gap with zero engine asymmetry behind it.)
    const { player, aggregates } = simulateLive(p, windowSecs, mulberry32(hashSeed(ADDR, tag, t)), DEMO_OPTS)
    p = player
    kills += aggregates.kills
    sync += 1
  }
  return { player: p, kills }
}

/** Alternate two pollers' window sizes (double poll rate, interleaved by the per-address mutex). */
function runInterleaved(totalSecs: number): { player: Player; kills: number } {
  let p = buildPlayer(ADDR, 'นายไก่แคดเดนซ์', 'kingkong', T0)
  spendStarterPoints(p)
  let kills = 0
  let sync = 0
  let t = 0
  while (t < totalSecs) {
    const windowSecs = sync % 2 === 0 ? 1 : 3 // poller A then poller B, interleaved
    const { player, aggregates } = simulateLive(p, windowSecs, mulberry32(hashSeed(ADDR, 'interleaved', t)), DEMO_OPTS)
    p = player
    kills += aggregates.kills
    t += windowSecs
    sync += 1
  }
  return { player: p, kills }
}

const TOTAL = 900

describe('sync cadence independence (attack timers + whole-second lastSyncedAt)', () => {
  it('1s windows produce kills at all (pre-fix: 0 kills forever at 1s)', () => {
    const { kills, player } = runWindowed(1, TOTAL, 'w1')
    expect(kills).toBeGreaterThan(50)
    expect(player.baseLevel).toBeGreaterThan(30)
  })

  it('1s windows land within ±10% of the 4s-window result over 900s', () => {
    const fast = runWindowed(1, TOTAL, 'cmp')
    const slow = runWindowed(4, TOTAL, 'cmp')
    const killDrift = Math.abs(fast.kills - slow.kills) / slow.kills
    const levelDrift = Math.abs(fast.player.baseLevel - slow.player.baseLevel) / slow.player.baseLevel
    expect(killDrift).toBeLessThanOrEqual(0.1)
    expect(levelDrift).toBeLessThanOrEqual(0.1)
  })

  it('two interleaved pollers behave like one steady poller (±10%)', () => {
    const duo = runInterleaved(TOTAL)
    const single = runWindowed(2, TOTAL, 'interleaved')
    const killDrift = Math.abs(duo.kills - single.kills) / single.kills
    const levelDrift = Math.abs(duo.player.baseLevel - single.player.baseLevel) / single.player.baseLevel
    expect(killDrift).toBeLessThanOrEqual(0.1)
    expect(levelDrift).toBeLessThanOrEqual(0.1)
  })
})
