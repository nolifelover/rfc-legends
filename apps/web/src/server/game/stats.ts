// Level/exp/derived-stat math — GDD §2.2–2.3, §3. Pure functions; mutates only the Player passed in
// (callers clone first). No Date.now, no IO.

import type { Player, Rooster, RoosterStats, SireLine, StatKey, Stats } from '../../game/types'

export const BASE_LEVEL_CAP = 99
export const NOVICE_JOB_CAP = 10 // GDD §2.1
export const START_STAT_POINTS = 48 // GDD §2.2
export const STAT_CAP = 99

/** GDD §4.3: EXP to next level = round(1.6 × Lv^3.75) */
export function expToNext(lv: number): number {
  return Math.round(1.6 * lv ** 3.75)
}

/** GDD §2.2: reaching level L grants 3 + floor(L/5) stat points */
export function statPointsForLevel(lv: number): number {
  return 3 + Math.floor(lv / 5)
}

/** Total points a player has received by base level lv (start 48 at Lv1). */
export function totalStatPointsAt(lv: number): number {
  let p = START_STAT_POINTS
  for (let L = 2; L <= lv; L++) p += statPointsForLevel(L)
  return p
}

/** GDD §2.2: raising a stat from x to x+1 costs 2 + floor((x−1)/10) */
export function statUpgradeCost(currentValue: number): number {
  return 2 + Math.floor((currentValue - 1) / 10)
}

/** Total cost to raise one stat from 1 to 99 = 628 (GDD §2.2 balance note). */
export function totalCostToMax(): number {
  let c = 0
  for (let x = 1; x <= 98; x++) c += statUpgradeCost(x)
  return c
}

// --- Job / rooster exp shares (GDD §2.1: job 75% of base; §3: rooster 60%) ---
export const JOB_EXP_SHARE = 0.75
export const ROOSTER_EXP_SHARE = 0.6

// --- Derived stats, Novice job multiplier 1.0 (GDD §2.3) ---
export const JOB_HP_MULT = 1.0

type StatBearer = Pick<Player, 'stats' | 'baseLevel'>

export function maxHp(p: StatBearer): number {
  return Math.round((100 + p.stats.vit * 10 + p.baseLevel * 8) * JOB_HP_MULT)
}

export function maxSp(p: StatBearer): number {
  return 20 + p.stats.int * 4 + p.baseLevel * 2
}

export function atkOf(p: StatBearer): number {
  return p.stats.str * 2 + Math.floor(p.stats.dex / 5) + Math.floor(p.stats.luk / 5)
}

export function defOf(p: StatBearer): number {
  return p.stats.vit
}

export function hitOf(p: StatBearer): number {
  return p.baseLevel + p.stats.dex
}

export function fleeOf(p: StatBearer): number {
  return p.baseLevel + p.stats.agi
}

/** 1% + LUK×0.3% (GDD §2.3) */
export function critChance(p: StatBearer): number {
  return 0.01 + p.stats.luk * 0.003
}

/** attacks/sec, cap 3.0 (GDD §2.3) */
export function aspdOf(p: StatBearer): number {
  return Math.min(3.0, 0.8 + p.stats.agi * 0.01 + p.stats.dex * 0.003)
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

/** GDD §2.3: chance to land a hit = clamp(80 + HIT − targetFlee, 5, 95)% */
export function hitChance(hit: number, targetFlee: number): number {
  return clamp((80 + hit - targetFlee) / 100, 0.05, 0.95)
}

// --- Rooster combat — GDD §3.1 ---
export const ROOSTER_BASE_STATS: RoosterStats = { pow: 5, spd: 5, sta: 5, tec: 5, spr: 5 }

export function roosterMaxHp(r: Rooster): number {
  return 80 + r.stats.sta * 12
}

export function roosterAtk(r: Rooster): number {
  return r.stats.pow * 2.5 + r.stats.tec
}

export function roosterAspd(r: Rooster): number {
  return Math.min(3.0, 0.8 + r.stats.spd * 0.01)
}

export function roosterCrit(r: Rooster): number {
  return 0.01 + r.stats.tec * 0.003
}

export function roosterHitChance(r: Rooster, targetFlee: number): number {
  return hitChance(r.level + r.stats.tec, targetFlee)
}

/**
 * Per-level stat growth by sire line, ≈3 points/level (GDD §3.2).
 * chaokhunthong (balanced + spr bias): over 4 levels → pow+2 spd+2 sta+2 tec+2 spr+4 = 12 = 3/lv.
 */
export function roosterLevelUpGrowth(sireLine: SireLine, newLevel: number): Partial<RoosterStats> {
  switch (sireLine) {
    case 'kumarnjeen':
      return { tec: 2, spd: 1 }
    case 'kingkong':
      return { pow: 2, sta: 1 }
    case 'thepbut':
      return { sta: 2, spr: 1 }
    case 'raptor':
      return { spd: 2, tec: 1 }
    case 'chaokhunthong':
      return newLevel % 2 === 0 ? { pow: 1, spd: 1, spr: 1 } : { sta: 1, tec: 1, spr: 1 }
  }
}

export interface ExpResult {
  baseLevelsGained: number
  jobLevelsGained: number
  roosterLevelsGained: number
}

/**
 * Apply a base-exp gain: levels base (cap 99), job exp = 75% (Novice cap 10),
 * rooster exp = 60% (cap 99, per-line growth). Mutates `player`.
 */
export function applyExp(player: Player, baseExpGain: number): ExpResult {
  const result: ExpResult = { baseLevelsGained: 0, jobLevelsGained: 0, roosterLevelsGained: 0 }

  // base level
  player.exp += baseExpGain
  while (player.baseLevel < BASE_LEVEL_CAP && player.exp >= expToNext(player.baseLevel)) {
    player.exp -= expToNext(player.baseLevel)
    player.baseLevel += 1
    player.statPoints += statPointsForLevel(player.baseLevel)
    result.baseLevelsGained += 1
  }
  if (player.baseLevel >= BASE_LEVEL_CAP && player.exp > expToNext(BASE_LEVEL_CAP)) {
    player.exp = expToNext(BASE_LEVEL_CAP) // hold at cap, no overflow
  }

  // job level (same curve, Novice cap 10)
  player.jobExp += Math.round(baseExpGain * JOB_EXP_SHARE)
  while (player.jobLevel < NOVICE_JOB_CAP && player.jobExp >= expToNext(player.jobLevel)) {
    player.jobExp -= expToNext(player.jobLevel)
    player.jobLevel += 1
    result.jobLevelsGained += 1
  }
  if (player.jobLevel >= NOVICE_JOB_CAP && player.jobExp > expToNext(NOVICE_JOB_CAP)) {
    player.jobExp = expToNext(NOVICE_JOB_CAP)
  }

  // rooster level (same curve, cap 99, growth by sire line)
  player.rooster.exp += Math.round(baseExpGain * ROOSTER_EXP_SHARE)
  while (player.rooster.level < BASE_LEVEL_CAP && player.rooster.exp >= expToNext(player.rooster.level)) {
    player.rooster.exp -= expToNext(player.rooster.level)
    player.rooster.level += 1
    const growth = roosterLevelUpGrowth(player.rooster.sireLine, player.rooster.level)
    for (const k of Object.keys(growth) as (keyof RoosterStats)[]) {
      player.rooster.stats[k] += growth[k] ?? 0
    }
    result.roosterLevelsGained += 1
  }
  if (player.rooster.level >= BASE_LEVEL_CAP && player.rooster.exp > expToNext(BASE_LEVEL_CAP)) {
    player.rooster.exp = expToNext(BASE_LEVEL_CAP)
  }

  return result
}

const STAT_KEYS: StatKey[] = ['str', 'agi', 'vit', 'int', 'dex', 'luk']

/**
 * Validate and apply stat allocations `{stat: increment}`. Throws plain Error whose message is an
 * ASCII code (Thai-safe — the UI maps it to Thai copy). Mutates `player` only on success.
 */
export function allocateStats(player: Player, allocations: Partial<Record<StatKey, number>>): void {
  const entries = Object.entries(allocations ?? {})
  if (entries.length === 0) throw new Error('NO_ALLOCATION')

  let totalCost = 0
  for (const [stat, inc] of entries) {
    if (!STAT_KEYS.includes(stat as StatKey)) throw new Error('INVALID_STAT')
    if (!Number.isInteger(inc) || inc < 0) throw new Error('INVALID_AMOUNT')
    const target = player.stats[stat as StatKey] + inc
    if (target > STAT_CAP) throw new Error('STAT_CAP_EXCEEDED')
    // total cost of raising `inc` steps from the current value
    let cost = 0
    for (let x = player.stats[stat as StatKey]; x < target; x++) cost += statUpgradeCost(x)
    totalCost += cost
  }
  if (totalCost > player.statPoints) throw new Error('NOT_ENOUGH_POINTS')

  for (const [stat, inc] of entries) {
    player.stats[stat as StatKey] += inc as number
  }
  player.statPoints -= totalCost
}

export function freshStats(): Stats {
  return { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }
}

/** Default starter inventory: 10 ยาต้มสมุนไพร so the auto-heal loop has something to eat. */
export const STARTER_INVENTORY: Record<number, number> = { 101: 10 }

export function defaultRoosterName(sireLine: SireLine): string {
  switch (sireLine) {
    case 'kumarnjeen':
      return 'จีนน้อย'
    case 'kingkong':
      return 'กองใหญ่'
    case 'chaokhunthong':
      return 'ทองหล่อ'
    case 'thepbut':
      return 'เทพน้อย'
    case 'raptor':
      return 'เหยี่ยวเร็ว'
  }
}
