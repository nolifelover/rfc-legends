import { describe, expect, it } from 'vitest'
import type { Player, StatKey } from '../../game/types'
import { DEMO_OPTS, DEMO_EXP_MULT, DEMO_DROP_BOOST, DEMO_MVP_EVERY_KILLS, simulateLive } from './combat'
import { hashSeed, mulberry32 } from './rng'
import { allocateStats } from './stats'
import { buildPlayer } from './index'

// Demo target (interfaces.md §5): a fresh player reaches Base Lv 30 AND gets ≥1 mvp_card drop
// within ~5–6 minutes of live sim (360 ticks × 1s). If this fails after formula changes,
// re-tune the DEMO_* consts in combat.ts and update the values in the report.
const T0 = 1_700_000_000_000
const WALLET_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

function spendStarterPoints(p: Player): void {
  const priority: StatKey[] = ['str', 'vit', 'dex', 'agi', 'luk', 'int']
  for (;;) {
    const stat = priority.find((s) => p.statPoints >= 2 + Math.floor((p.stats[s] - 1) / 10))
    if (!stat) break
    allocateStats(p, { [stat]: 1 })
  }
}

describe('demo mode — boosted rates reach the demo beat (interfaces.md §5)', () => {
  it('fresh player: 6 min of live sim → Base Lv ≥ 30 and ≥1 mvp_card drop', () => {
    const p = buildPlayer(WALLET_A, 'นายไก่เอ', 'kingkong', T0)
    spendStarterPoints(p)
    const { player, aggregates } = simulateLive(p, 360, mulberry32(hashSeed(WALLET_A, 1)), DEMO_OPTS)

    expect(player.baseLevel).toBeGreaterThanOrEqual(30)
    const mvpCards = aggregates.drops.filter((d) => d.rarity === 'mvp_card')
    expect(mvpCards.length).toBeGreaterThanOrEqual(1)
    // the beat needs some ordinary mintables too (monster cards / legendaries for the market flow)
    expect(aggregates.drops.length).toBeGreaterThanOrEqual(2)
  })

  it('documented boost values are the ones in effect', () => {
    expect(DEMO_OPTS.expMult).toBe(DEMO_EXP_MULT)
    expect(DEMO_OPTS.dropOpts.boost).toBe(DEMO_DROP_BOOST)
    expect(DEMO_OPTS.mvpEveryKills).toBe(DEMO_MVP_EVERY_KILLS)
  })
})
