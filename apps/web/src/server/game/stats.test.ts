import { describe, expect, it } from 'vitest'
import type { Player } from '../../game/types'
import { buildPlayer } from './index'
import {
  allocateStats,
  applyExp,
  aspdOf,
  atkOf,
  critChance,
  expToNext,
  freshStats,
  hitChance,
  maxHp,
  maxSp,
  roosterLevelUpGrowth,
  statPointsForLevel,
  statUpgradeCost,
  totalCostToMax,
  totalStatPointsAt,
} from './stats'

const T0 = 1_700_000_000_000
const ADDR = '0x1111111111111111111111111111111111111111'

function fresh(): Player {
  return buildPlayer(ADDR, 'นายไก่ทดสอบ', 'kumarnjeen', T0)
}

describe('exp curve — GDD §4.3 round(1.6 × Lv^3.75)', () => {
  it('matches the GDD table spot values', () => {
    expect(expToNext(1)).toBe(2)
    expect(expToNext(10)).toBe(8997)
    expect(expToNext(20)).toBe(121055)
    expect(Math.abs(expToNext(30) - 553764)).toBeLessThanOrEqual(1)
    expect(Math.abs(expToNext(50) - 3760603)).toBeLessThanOrEqual(1)
  })
})

describe('stat points — GDD §2.2', () => {
  it('grants 3 + floor(L/5) per level reached', () => {
    expect(statPointsForLevel(2)).toBe(3)
    expect(statPointsForLevel(5)).toBe(4)
    expect(statPointsForLevel(10)).toBe(5)
  })

  it('totals 61 points received at Lv5 (48 start + 13 gained)', () => {
    expect(totalStatPointsAt(5)).toBe(61)
  })

  it('totals 82 points received at Lv10 (48 start + 34 gained)', () => {
    expect(totalStatPointsAt(10)).toBe(82)
  })

  it('raising one stat 1→99 costs 628 total (GDD balance note)', () => {
    expect(totalCostToMax()).toBe(628)
  })

  it('cost steps are 2 + floor((x−1)/10)', () => {
    expect(statUpgradeCost(1)).toBe(2)
    expect(statUpgradeCost(10)).toBe(2)
    expect(statUpgradeCost(11)).toBe(3)
    expect(statUpgradeCost(21)).toBe(4)
  })
})

describe('derived stats — GDD §2.3 (novice multiplier 1.0)', () => {
  it('fresh player: MaxHP 118, MaxSP 26, ATK 2, ASPD ~0.813, CRIT 1.3%', () => {
    const p = fresh() // all stats 1, base level 1
    expect(maxHp(p)).toBe(100 + 10 + 8)
    expect(maxSp(p)).toBe(20 + 4 + 2)
    expect(atkOf(p)).toBe(2)
    expect(aspdOf(p)).toBeCloseTo(0.8 + 0.01 + 0.003, 6)
    expect(critChance(p)).toBeCloseTo(0.013, 6)
  })

  it('caps ASPD at 3.0', () => {
    const p = fresh()
    p.stats.agi = 250 // beyond any legal stat value to prove the clamp
    p.stats.dex = 250
    expect(aspdOf(p)).toBe(3.0)
  })

  it('hit chance is clamp((80 + HIT − FLEE)/100, 5%, 95%)', () => {
    expect(hitChance(30, 60)).toBeCloseTo(0.5, 6) // 80+30−60 = 50
    expect(hitChance(30, 14)).toBe(0.95) // 96 → clamped
    expect(hitChance(0, 100)).toBe(0.05) // −20 → clamped
  })
})

describe('applyExp — GDD §2.1/§3', () => {
  it('levels base 1→2 on 2 exp and grants 3 points', () => {
    const p = fresh()
    const r = applyExp(p, 2)
    expect(p.baseLevel).toBe(2)
    expect(p.exp).toBe(0)
    expect(p.statPoints).toBe(48 + 3)
    expect(r.baseLevelsGained).toBe(1)
  })

  it('splits job exp at 75% and rooster exp at 60%', () => {
    const p = fresh()
    applyExp(p, 1) // below expToNext(1)=2 so no level-ups muddy the check
    expect(p.jobExp).toBe(Math.round(0.75)) // 1
    expect(p.rooster.exp).toBe(Math.round(0.6)) // 1
    const q = fresh()
    applyExp(q, 1000) // big gain: job/rooster levels must rise
    expect(q.jobLevel).toBeGreaterThan(1)
    expect(q.rooster.level).toBeGreaterThan(1)
  })

  it('caps job level at Novice 10', () => {
    const p = fresh()
    applyExp(p, 100_000_000)
    expect(p.jobLevel).toBe(10)
  })

  it('caps base level at 99 without infinite loop', () => {
    const p = fresh()
    applyExp(p, 10_000_000_000)
    expect(p.baseLevel).toBe(99)
  })

  it('rooster levels apply per-line growth (kumarnjeen tec+2/spd+1)', () => {
    const p = fresh() // rooster lv1, stats all 5
    applyExp(p, expToNext(1) * 2) // enough for a couple of levels
    expect(p.rooster.level).toBeGreaterThanOrEqual(2)
    const lv2 = p.rooster.stats
    expect(lv2.tec).toBe(5 + 2)
    expect(lv2.spd).toBe(5 + 1)
    expect(lv2.pow).toBe(5)
  })

  it('chaokhunthong growth averages 3 pts/level over 4 levels', () => {
    const p = buildPlayer(ADDR, 'ทดสอบ', 'chaokhunthong', T0)
    // pump the rooster 4 levels directly through the growth fn
    const stats = { pow: 0, spd: 0, sta: 0, tec: 0, spr: 0 }
    for (let lv = 2; lv <= 5; lv++) {
      const g = roosterLevelUpGrowth('chaokhunthong', lv)
      for (const k of Object.keys(g) as (keyof typeof stats)[]) stats[k] += g[k] ?? 0
    }
    expect(stats.pow + stats.spd + stats.sta + stats.tec + stats.spr).toBe(12)
    expect(stats.spr).toBe(4) // spr bias
  })
})

describe('allocateStats', () => {
  it('spends points and deducts cost', () => {
    const p = fresh()
    allocateStats(p, { str: 1 }) // 1→2 costs 2
    expect(p.stats.str).toBe(2)
    expect(p.statPoints).toBe(46)
  })

  it('rejects overspend with NOT_ENOUGH_POINTS', () => {
    const p = fresh()
    expect(() => allocateStats(p, { str: 50 })).toThrowError('NOT_ENOUGH_POINTS') // legal target, unaffordable
  })

  it('rejects cap overflow', () => {
    const p = fresh()
    p.stats.str = 98
    p.statPoints = 100
    expect(() => allocateStats(p, { str: 2 })).toThrowError('STAT_CAP_EXCEEDED')
  })

  it('rejects invalid amounts and stats', () => {
    const p = fresh()
    expect(() => allocateStats(p, { str: -1 })).toThrowError('INVALID_AMOUNT')
    expect(() => allocateStats(p, { pow: 1 } as never)).toThrowError('INVALID_STAT')
    expect(() => allocateStats(p, {})).toThrowError('NO_ALLOCATION')
  })

  it('does not mutate on failure', () => {
    const p = fresh()
    expect(() => allocateStats(p, { str: 99 })).toThrowError()
    expect(p.stats).toEqual(freshStats())
    expect(p.statPoints).toBe(48)
  })
})
