// Idle combat — GDD §4. Pure & deterministic: (state, ticks, rng, opts) → new state + aggregates.
// Same inputs always produce byte-identical outputs (no Date.now, no IO; all randomness via rng).
//
// v1 simplifications (vertical slice): monsters attack only the player and always hit
// (player FLEE is not yet a defensive stat), the rooster cannot be targeted, and death has
// no penalty (cartoon rule) — respawn full after 5s.

import { getMap } from '../../game/data/maps'
import type { MonsterDef, MonsterSpawn, Player } from '../../game/types'
import { NORMAL_DROP_OPTS, mergeInventory, rollDrops } from './drops'
import type { DropOpts, RolledDrop } from './drops'
import type { Rng } from './rng'
import {
  ROOSTER_EXP_SHARE,
  applyExp,
  aspdOf,
  atkOf,
  clamp,
  critChance,
  defOf,
  hitChance,
  hitOf,
  maxHp,
  roosterAspd,
  roosterAtk,
  roosterCrit,
  roosterHitChance,
  roosterMaxHp,
} from './stats'

/** 1 tick = 1 second of live simulation. */
export const TICK_SECONDS = 1
/** First LIVE_WINDOW seconds of a sync are simulated tick-by-tick; the rest settles rate-based. */
export const LIVE_WINDOW = 180
/** Substep for the live loop (attacks cooldowns are fractional seconds). */
const DT = 0.05

export const MONSTER_ATTACK_INTERVAL = 1.2 // s
export const MONSTER_RESPAWN_SECONDS = 3 // s, also used in the offline kill-rate model
export const DEATH_RESPAWN_SECONDS = 5 // s, no penalty (cartoon)
export const AUTO_HEAL_THRESHOLD = 0.4 // hp < 40% → กินยาต้ม / regen (GDD §4.2)
export const REGEN_PER_SEC = 0.05 // 5% maxHp/s when below threshold with no potions
export const POTION_ITEM_ID = 101 // ยาต้มสมุนไพร
export const POTION_HEAL_FRAC = 0.4 // restores 40% maxHp
export const CRIT_MULT = 1.5
export const DMG_VARIANCE_MIN = 0.95 // GDD §2.3: ×สุ่ม 0.95–1.05
export const DMG_VARIANCE_MAX = 1.05

export const MVP_EVERY_KILLS = 150

// Offline settle (GDD §4.1: rate-based, 70% of online, cap 12h)
export const OFFLINE_CAP_SECONDS = 12 * 3600
export const OFFLINE_EFFICIENCY = 0.7
export const KILL_RATE_MIN = 3 // kills/min analytic clamp
export const KILL_RATE_MAX = 8

// --- Demo-mode boosts (interfaces.md §5): tuned so a fresh player reaches Base Lv 30 with a
// reliable MVP jackpot but NO card shower — mintables land on ≤ ~12% of kills steady-state
// (was ~78% when a single boost+cap rode every tier to 60%). Boss kills are 1/8 of kills and
// carry ~64% mintable chance, so short boss-heavy windows still stay under the 15% bar.
// See demo.test.ts for the asserted bars.
//   legendary   0.1%   ×20    → 2%/kill
//   monsterCard 0.05%  ×50    → 2.5%/kill
//   mvpCard     0.005% ×11000 → 55% per MVP-boss kill (boss every 8th kill in demo → first
//                               jackpot well inside the first minute of boss kills)
export const DEMO_EXP_MULT = 800
export const DEMO_DROP_RARE_MULT = 5
export const DEMO_DROP_EPIC_MULT = 5
export const DEMO_DROP_LEGENDARY_MULT = 20
export const DEMO_MONSTER_CARD_MULT = 50
export const DEMO_MVP_CARD_MULT = 11000
export const DEMO_MVP_EVERY_KILLS = 8

export interface EngineOpts {
  expMult: number
  dropOpts: DropOpts
  mvpEveryKills: number
}

export const NORMAL_OPTS: EngineOpts = {
  expMult: 1,
  dropOpts: NORMAL_DROP_OPTS,
  mvpEveryKills: MVP_EVERY_KILLS,
}

export const DEMO_OPTS: EngineOpts = {
  expMult: DEMO_EXP_MULT,
  dropOpts: {
    rare: DEMO_DROP_RARE_MULT,
    epic: DEMO_DROP_EPIC_MULT,
    legendary: DEMO_DROP_LEGENDARY_MULT,
    monsterCard: DEMO_MONSTER_CARD_MULT,
    mvpCard: DEMO_MVP_CARD_MULT,
  },
  mvpEveryKills: DEMO_MVP_EVERY_KILLS,
}

export interface CombatAggregates {
  ticks: number
  expGained: number // base exp applied (post-multiplier)
  roosterExpGained: number
  kills: number
  byMonster: Record<string, number>
  deaths: number
  drops: RolledDrop[] // mintable rolls; index.ts turns these into Drop records
  inventory: Record<number, number> // non-mintable gains
}

export interface OfflineAggregates extends CombatAggregates {
  seconds: number // seconds actually settled (≤ cap)
  killRatePerMin: number
}

function emptyAgg(ticks: number): CombatAggregates {
  return {
    ticks,
    expGained: 0,
    roosterExpGained: 0,
    kills: 0,
    byMonster: {},
    deaths: 0,
    drops: [],
    inventory: {},
  }
}

function weightedPick(spawns: MonsterSpawn[], rng: Rng): MonsterDef {
  const total = spawns.reduce((s, x) => s + x.weight, 0)
  let r = rng() * total
  for (const s of spawns) {
    r -= s.weight
    if (r <= 0) return s.monster
  }
  return spawns[spawns.length - 1].monster
}

/** Physical damage: ATK × 100/(100+DEF) × rand(0.95, 1.05) — GDD §2.3. */
function damage(atk: number, targetDef: number, rng: Rng): number {
  const mit = 100 / (100 + targetDef)
  const variance = DMG_VARIANCE_MIN + rng() * (DMG_VARIANCE_MAX - DMG_VARIANCE_MIN)
  return atk * mit * variance
}

/**
 * Live simulation: `ticks` seconds of tick-by-tick combat. The trainer and rooster auto-attack
 * the current monster (crit rolls first, crits ignore flee — GDD §2.3); the monster attacks the
 * player every 1.2s; auto-heal below 40%; death respawns full after 5s with no penalty.
 */
export function simulateLive(
  player: Player,
  ticks: number,
  rng: Rng,
  opts: EngineOpts = NORMAL_OPTS,
): { player: Player; aggregates: CombatAggregates } {
  const p: Player = structuredClone(player)
  const map = getMap(p.mapId)
  const agg = emptyAgg(ticks)

  let monster: MonsterDef | null = null
  let monsterHp = 0
  let spawnAt = 0
  let reviveAt = -1
  let hp = maxHp(p)
  let roosterHp = roosterMaxHp(p.rooster)
  let nextPlayerAtk = 1 / aspdOf(p)
  let nextRoosterAtk = 1 / roosterAspd(p.rooster)
  let nextMonsterAtk = MONSTER_ATTACK_INTERVAL

  const pickMonster = (): MonsterDef => {
    // the upcoming kill number decides whether an MVP spawns
    const upcoming = p.killCount + 1
    if (map.mvp && upcoming % opts.mvpEveryKills === 0) return map.mvp
    return weightedPick(map.monsters, rng)
  }

  const onKill = (t: number, m: MonsterDef) => {
    p.killCount += 1
    agg.kills += 1
    agg.byMonster[m.id] = (agg.byMonster[m.id] ?? 0) + 1
    const gain = m.exp * opts.expMult
    applyExp(p, gain)
    agg.expGained += gain
    agg.roosterExpGained += Math.round(gain * ROOSTER_EXP_SHARE)
    const loot = rollDrops(m, rng, opts.dropOpts)
    agg.drops.push(...loot.mintable)
    mergeInventory(p.inventory, loot.inventory)
    mergeInventory(agg.inventory, loot.inventory)
    monster = null
    spawnAt = t + MONSTER_RESPAWN_SECONDS
  }

  const upkeep = () => {
    // auto-heal once per second (GDD §4.2: HP < 40% กินยาต้ม)
    const full = maxHp(p)
    if (hp <= 0 || hp >= full * AUTO_HEAL_THRESHOLD) return
    const potions = p.inventory[POTION_ITEM_ID] ?? 0
    if (potions > 0) {
      p.inventory[POTION_ITEM_ID] = potions - 1
      hp = Math.min(full, hp + full * POTION_HEAL_FRAC)
    } else {
      hp = Math.min(full, hp + full * REGEN_PER_SEC)
    }
  }

  const steps = Math.max(0, Math.round(ticks / DT))
  let wholeSec = 0
  for (let i = 1; i <= steps; i++) {
    const t = i * DT
    const sec = Math.floor(t + 1e-9)
    if (sec > wholeSec) {
      wholeSec = sec
      upkeep()
    }

    if (reviveAt >= 0) {
      if (t >= reviveAt) {
        reviveAt = -1
        hp = maxHp(p)
        roosterHp = roosterMaxHp(p.rooster)
        nextPlayerAtk = t + 1 / aspdOf(p)
        nextRoosterAtk = t + 1 / roosterAspd(p.rooster)
        nextMonsterAtk = t + MONSTER_ATTACK_INTERVAL
      } else {
        continue // knocked out — no actions this substep
      }
    }

    if (!monster && t >= spawnAt) {
      monster = pickMonster()
      monsterHp = monster.stats.hp
    }

    if (monster) {
      // trainer attack: crit rolls first (crits ignore flee)
      if (t >= nextPlayerAtk) {
        nextPlayerAtk = t + 1 / aspdOf(p)
        const r = rng()
        if (r < critChance(p)) {
          monsterHp -= damage(atkOf(p) * CRIT_MULT, monster.stats.def, rng)
        } else if (rng() < hitChance(hitOf(p), monster.stats.flee)) {
          monsterHp -= damage(atkOf(p), monster.stats.def, rng)
        }
        if (monsterHp <= 0) onKill(t, monster)
      }
    }

    if (monster) {
      // rooster attack
      if (t >= nextRoosterAtk) {
        nextRoosterAtk = t + 1 / roosterAspd(p.rooster)
        const r = rng()
        if (r < roosterCrit(p.rooster)) {
          monsterHp -= damage(roosterAtk(p.rooster) * CRIT_MULT, monster.stats.def, rng)
        } else if (rng() < roosterHitChance(p.rooster, monster.stats.flee)) {
          monsterHp -= damage(roosterAtk(p.rooster), monster.stats.def, rng)
        }
        if (monsterHp <= 0) onKill(t, monster)
      }
    }

    if (monster && t >= nextMonsterAtk) {
      // monster attacks the player (always hits in v1)
      nextMonsterAtk = t + MONSTER_ATTACK_INTERVAL
      hp -= damage(monster.stats.atk, defOf(p), rng)
      if (hp <= 0) {
        hp = 0
        agg.deaths += 1
        reviveAt = t + DEATH_RESPAWN_SECONDS
      }
    }
  }

  // rooster hp is tracked for future targeting; not persisted on Player in v1
  void roosterHp

  return { player: p, aggregates: agg }
}

/**
 * Offline settlement — rate-based (GDD §4.1): analytic kill rate from player DPS vs the map's
 * weighted-average monster, clamped 3–8 kills/min, rewards at 70%, capped at 12h.
 */
export function settleOffline(
  player: Player,
  seconds: number,
  rng: Rng,
  opts: EngineOpts = NORMAL_OPTS,
): { player: Player; aggregates: OfflineAggregates } {
  const p: Player = structuredClone(player)
  const map = getMap(p.mapId)
  const capped = Math.min(Math.max(0, seconds), OFFLINE_CAP_SECONDS)
  const agg: OfflineAggregates = { ...emptyAgg(0), seconds: capped, killRatePerMin: 0 }

  const totalW = map.monsters.reduce((s, x) => s + x.weight, 0)
  const avg = (f: (m: MonsterDef) => number): number =>
    map.monsters.reduce((s, x) => s + f(x.monster) * x.weight, 0) / totalW
  const avgExp = avg((m) => m.exp)
  const avgHp = avg((m) => m.stats.hp)
  const avgDef = avg((m) => m.stats.def)
  const avgFlee = avg((m) => m.stats.flee)

  // expected dps incl. crit bonus (×1.5 → +50% on the crit share)
  const pDps =
    atkOf(p) *
    (100 / (100 + avgDef)) *
    aspdOf(p) *
    hitChance(hitOf(p), avgFlee) *
    (1 + critChance(p) * (CRIT_MULT - 1))
  const rDps =
    roosterAtk(p.rooster) *
    (100 / (100 + avgDef)) *
    roosterAspd(p.rooster) *
    roosterHitChance(p.rooster, avgFlee) *
    (1 + roosterCrit(p.rooster) * (CRIT_MULT - 1))

  const ttk = avgHp / Math.max(pDps + rDps, 0.001)
  const kpm = clamp(60 / (ttk + MONSTER_RESPAWN_SECONDS), KILL_RATE_MIN, KILL_RATE_MAX)
  agg.killRatePerMin = kpm

  const kills = Math.round(kpm * (capped / 60) * OFFLINE_EFFICIENCY)
  const mvpKills = map.mvp ? Math.floor(kills / opts.mvpEveryKills) : 0
  const normalKills = kills - mvpKills

  const baseExp = (normalKills * avgExp + mvpKills * (map.mvp?.exp ?? 0)) * opts.expMult
  if (baseExp > 0) applyExp(p, baseExp)
  agg.kills = kills
  agg.expGained = baseExp
  agg.roosterExpGained = Math.round(baseExp * ROOSTER_EXP_SHARE)

  for (let i = 1; i <= kills; i++) {
    const isMvp = map.mvp !== undefined && i % opts.mvpEveryKills === 0
    const m = isMvp ? map.mvp! : weightedPick(map.monsters, rng)
    agg.byMonster[m.id] = (agg.byMonster[m.id] ?? 0) + 1
    const loot = rollDrops(m, rng, opts.dropOpts)
    agg.drops.push(...loot.mintable)
    mergeInventory(p.inventory, loot.inventory)
    mergeInventory(agg.inventory, loot.inventory)
  }
  p.killCount += kills

  return { player: p, aggregates: agg }
}
