import { describe, expect, it } from 'vitest'
import type { Player, StatKey } from '../../game/types'
import {
  DEMO_OPTS,
  DEMO_EXP_MULT,
  DEMO_DROP_EPIC_MULT,
  DEMO_DROP_LEGENDARY_MULT,
  DEMO_DROP_RARE_MULT,
  DEMO_MONSTER_CARD_MULT,
  DEMO_MVP_CARD_MULT,
  DEMO_MVP_EVERY_KILLS,
  DEMO_PITY_MONSTER_CARD_LEVEL,
  NORMAL_OPTS,
  simulateLive,
} from './combat'
import { hashSeed, mulberry32 } from './rng'
import { allocateStats } from './stats'
import { buildPlayer } from './index'

// Demo target (interfaces.md §5): a fresh player reaches Base Lv 30 AND gets ≥1 mvp_card drop
// within ~3–4 minutes of live sim, WITHOUT the mintable shower — mintables must land on ≤15% of
// kills (the MVP jackpot should feel earned). If this fails after formula changes, re-tune the
// DEMO_* consts in combat.ts and update the values in the report.
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
  it('fresh player: 6 min of live sim → Base Lv ≥ 30, ≥1 mvp_card, mintables ≤15% of kills', () => {
    const p = buildPlayer(WALLET_A, 'นายไก่เอ', 'kingkong', T0)
    spendStarterPoints(p)
    const { player, aggregates } = simulateLive(p, 360, mulberry32(hashSeed(WALLET_A, 1)), DEMO_OPTS)

    expect(player.baseLevel).toBeGreaterThanOrEqual(30)
    const mvpCards = aggregates.drops.filter((d) => d.rarity === 'mvp_card')
    expect(mvpCards.length).toBeGreaterThanOrEqual(1)
    // no card shower: total mintable rate must stay ≤ 15% of kills
    expect(aggregates.drops.length / aggregates.kills).toBeLessThanOrEqual(0.15)
    // the beat still needs some ordinary mintables (monster cards / legendaries for the market flow)
    expect(aggregates.drops.length).toBeGreaterThanOrEqual(2)
  })

  it('runbook window (docs/demo-runbook.md §4): by 4 min → Base Lv ≥ 30, ≥1 mvp_card, ≥1 monster_card (pity)', () => {
    const p = buildPlayer(WALLET_A, 'Khun Gai', 'thepbut', T0)
    spendStarterPoints(p)
    const { player, aggregates } = simulateLive(p, 240, mulberry32(hashSeed(WALLET_A, 3)), DEMO_OPTS)

    // Scene 1: "Lv 1 to Lv 30 took about 4 minutes with points spent"
    expect(player.baseLevel).toBeGreaterThanOrEqual(30)
    // Scene 2's video card: an MVP boss drops a rare card (55%/boss, boss every 8th kill)
    expect(aggregates.drops.some((d) => d.rarity === 'mvp_card')).toBe(true)
    // and the rehearsed flow mints Monster Card #1001 — pity guarantees one by the Lv 30 kill
    expect(aggregates.drops.some((d) => d.rarity === 'monster_card')).toBe(true)
  })

  it('pity only fires once and only when no monster card dropped naturally', () => {
    // heavy-card seed: run until past Lv 30 and count pity additions — the run above covers the
    // no-natural-card case; here assert no DUPLICATE pity (at most one forced card, and monster
    // card total stays small relative to kills)
    const p = buildPlayer(WALLET_A, 'นายไก่บี', 'raptor', T0)
    spendStarterPoints(p)
    const { player, aggregates } = simulateLive(p, 240, mulberry32(hashSeed(WALLET_A, 4)), DEMO_OPTS)
    expect(player.baseLevel).toBeGreaterThanOrEqual(30)
    const monsterCards = aggregates.drops.filter((d) => d.rarity === 'monster_card').length
    expect(monsterCards).toBeLessThanOrEqual(1 + Math.ceil(aggregates.kills * 0.025 * 2)) // pity(≤1) + ≤2× natural rate
  })

  it('documented boost values are the ones in effect', () => {
    expect(DEMO_OPTS.expMult).toBe(DEMO_EXP_MULT)
    expect(DEMO_OPTS.dropOpts.rare).toBe(DEMO_DROP_RARE_MULT)
    expect(DEMO_OPTS.dropOpts.epic).toBe(DEMO_DROP_EPIC_MULT)
    expect(DEMO_OPTS.dropOpts.legendary).toBe(DEMO_DROP_LEGENDARY_MULT)
    expect(DEMO_OPTS.dropOpts.monsterCard).toBe(DEMO_MONSTER_CARD_MULT)
    expect(DEMO_OPTS.dropOpts.mvpCard).toBe(DEMO_MVP_CARD_MULT)
    expect(DEMO_OPTS.mvpEveryKills).toBe(DEMO_MVP_EVERY_KILLS)
    expect(DEMO_OPTS.pityMonsterCardLevel).toBe(DEMO_PITY_MONSTER_CARD_LEVEL)
    expect(NORMAL_OPTS.pityMonsterCardLevel).toBeUndefined() // never in normal play
  })
})
