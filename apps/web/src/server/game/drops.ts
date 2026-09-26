// Drop tables — GDD §6.4. Commons (materials) and rare/epic equipment go to inventory;
// legendary / monster_card / mvp_card become mintable Drop records (interfaces.md §5).

import type { MonsterDef, Rarity } from '../../game/types'
import type { Rng } from './rng'
import { hashToBytes32 } from './rng'

// Base chances (non-demo), per kill.
export const COMMON_MATERIAL_CHANCE = 0.25 // commons ~25%
export const RARE_EQUIP_CHANCE = 0.02 // rare/epic equipment 0.5–3% total (GDD §6.4)
export const EPIC_EQUIP_CHANCE = 0.006
export const LEGENDARY_CHANCE = 0.001 // 0.1%
export const OWN_CARD_CHANCE = 0.0005 // monster's own card 0.05%
export const MVP_LEGENDARY_CHANCE = 0.01 // MVP boss: higher legendary 1%
export const MVP_CARD_CHANCE = 0.00005 // MVP card 0.005%

// Non-mintable equipment pools (picked uniformly inside the tier).
export const RARE_EQUIP_POOL: readonly number[] = [205, 206]
export const EPIC_EQUIP_POOL: readonly number[] = [207, 208]
export const LEGENDARY_POOL: readonly number[] = [2001, 2002, 2003]

/**
 * Per-tier multipliers over the GDD base rates — normal play is all 1. Demo mode uses one
 * multiplier per tier because the old single boost (+cap) pushed EVERY tier to the cap and
 * showered mintables on ~78% of kills; the demo feel we want is a rare trickle plus a
 * reliable MVP jackpot, so tiers need different magnitudes (see DEMO_OPTS in combat.ts).
 */
export interface DropOpts {
  /** stacks the COMMON material chance (base 25%); demo doubles it so ~1 in 2 kills
   *  shows a visible farm-loot gain — mintable tiers are NOT affected by this knob */
  common: number
  rare: number
  epic: number
  legendary: number
  monsterCard: number
  mvpCard: number // only rolls on MVP-boss kills (base 0.005%)
}
export const NORMAL_DROP_OPTS: DropOpts = { common: 1, rare: 1, epic: 1, legendary: 1, monsterCard: 1, mvpCard: 1 }

export interface RolledDrop {
  itemId: number
  rarity: Rarity
}

export interface DropRollResult {
  mintable: RolledDrop[] // usually empty
  inventory: Record<number, number> // itemId -> count gained
}

function pick(pool: readonly number[], rng: Rng): number {
  return pool[Math.floor(rng() * pool.length)]
}

/**
 * Roll one kill's loot. The sequence of rng() calls is a deterministic function of the
 * seed (rolls happen in a fixed tier order), so identical seeds replay identically.
 */
export function rollDrops(monster: MonsterDef, rng: Rng, opts: DropOpts = NORMAL_DROP_OPTS): DropRollResult {
  const out: DropRollResult = { mintable: [], inventory: {} }
  const isMvp = monster.isMvp === true
  const roll = (chance: number, mult: number) => rng() < Math.min(chance * mult, 1)
  const add = (id: number) => {
    out.inventory[id] = (out.inventory[id] ?? 0) + 1
  }

  // 1. common material (base ~25%; demo doubles it so most kills show a visible gain)
  if (monster.materialItemId !== undefined && rng() < Math.min(COMMON_MATERIAL_CHANCE * opts.common, 1)) {
    add(monster.materialItemId)
  }

  // 2. rare equipment
  if (roll(RARE_EQUIP_CHANCE * (isMvp ? 5 : 1), opts.rare)) {
    add(pick(RARE_EQUIP_POOL, rng))
  }

  // 3. epic equipment
  if (roll(EPIC_EQUIP_CHANCE * (isMvp ? 8 : 1), opts.epic)) {
    add(pick(EPIC_EQUIP_POOL, rng))
  }

  // 4. legendary (mintable)
  if (roll(isMvp ? MVP_LEGENDARY_CHANCE : LEGENDARY_CHANCE, opts.legendary)) {
    out.mintable.push({ itemId: pick(LEGENDARY_POOL, rng), rarity: 'legendary' })
  }

  // 5. card (mintable): own 1xxx card, or the 3xxx MVP card from an MVP boss
  if (monster.cardId !== undefined && roll(isMvp ? MVP_CARD_CHANCE : OWN_CARD_CHANCE, isMvp ? opts.mvpCard : opts.monsterCard)) {
    out.mintable.push({ itemId: monster.cardId, rarity: isMvp ? 'mvp_card' : 'monster_card' })
  }

  return out
}

/** Deterministic bytes32 dropId for a mintable roll — hash of (address, session, index). */
export function makeDropId(address: string, sessionCounter: number, dropIndex: number): `0x${string}` {
  return hashToBytes32('drop', address, sessionCounter, dropIndex)
}

/** Merge an inventory delta into a record (mutates target). */
export function mergeInventory(target: Record<number, number>, delta: Record<number, number>): void {
  for (const k of Object.keys(delta)) {
    const id = Number(k)
    target[id] = (target[id] ?? 0) + delta[id]
  }
}
