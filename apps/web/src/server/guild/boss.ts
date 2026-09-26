/**
 * Guild boss state machine (GDD §11.3, vertical slice).
 *
 * One row per guild in PocketBase. Members' idle damage chips the HP down;
 * when it dies, contributors are recorded with a reward tier by damage share
 * and the next tower floor spawns (a fresh, stronger boss).
 */
import 'server-only'
import type PocketBase from 'pocketbase'
import { getPb } from '@/server/pb'

/** หอคอยพญาไก่ — the tower the guild climbs together. English-first names. */
const FLOOR_NAMES = [
  'Black Rooster King',
  'Golden Rooster King',
  'Crystal Rooster King',
  'Shadow Rooster King',
  'Rainbow Rooster King',
]

export interface Contributor {
  name: string
  damage: number
}

export interface BossState {
  id: string
  guild: string
  floor: number
  name: string
  hp: number
  max_hp: number
  contributors: Record<string, Contributor>
  defeated_at: number
}

export interface HitResult {
  boss: BossState
  damage: number
  defeated: boolean
  /** Present when this hit killed the boss. */
  reward?: { address: string; tier: 'gold' | 'silver' | 'bronze' }
}

const BASE_MAX_HP = 1000
const HP_GROWTH = 1.4

export function floorName(floor: number): string {
  return FLOOR_NAMES[(floor - 1) % FLOOR_NAMES.length]
}

export function floorMaxHp(floor: number): number {
  return Math.round(BASE_MAX_HP * Math.pow(HP_GROWTH, floor - 1))
}

function normalize(row: Record<string, unknown>): BossState {
  return {
    id: String(row.id),
    guild: String(row.guild),
    floor: Number(row.floor),
    name: String(row.name),
    hp: Number(row.hp),
    max_hp: Number(row.max_hp),
    contributors: (row.contributors ?? {}) as Record<string, Contributor>,
    defeated_at: Number(row.defeated_at ?? 0),
  }
}

/** The live boss for a guild, spawning floor 1 on first contact. */
export async function getBoss(guild: string): Promise<BossState> {
  const pb = await getPb()
  const rows = await pb.collection('guild_boss').getFullList({
    filter: pb.filter('guild = {:guild}', { guild }),
    limit: 1,
  })
  if (rows.length > 0) return normalize(rows[0])

  const created = await pb.collection('guild_boss').create({
    guild,
    floor: 1,
    name: floorName(1),
    hp: floorMaxHp(1),
    max_hp: floorMaxHp(1),
    contributors: {},
    defeated_at: 0,
  })
  return normalize(created)
}

/**
 * Applies damage and advances the floor on a kill. Damage is clamped
 * server-side; `address` is the attacker the server attaches to the record.
 */
export async function hitBoss(
  guild: string,
  address: string,
  name: string,
  damage: number,
): Promise<HitResult> {
  const pb = await getPb()
  const boss = await getBoss(guild)
  if (boss.defeated_at !== 0) {
    // Race: someone else landed the killing blow; nothing left to hit.
    return { boss, damage: 0, defeated: true }
  }

  const dealt = Math.max(1, Math.min(99, Math.floor(damage)))
  const contributors: Record<string, Contributor> = { ...boss.contributors }
  const prev = contributors[address]
  contributors[address] = { name, damage: (prev?.damage ?? 0) + dealt }

  const hp = boss.hp - dealt
  const defeated = hp <= 0
  const defeatedAt = defeated ? Date.now() : 0

  let updated: Record<string, unknown>
  if (defeated) {
    updated = await pb.collection('guild_boss').update(boss.id, {
      hp: 0,
      contributors,
      defeated_at: defeatedAt,
    })
  } else {
    updated = await pb.collection('guild_boss').update(boss.id, {
      hp,
      contributors,
    })
  }

  let reward: HitResult['reward'] | undefined
  if (defeated) {
    reward = { address, tier: rewardTier(contributors[address].damage, boss.max_hp) }
    await spawnNextFloor(pb, guild, boss.floor)
  }

  return { boss: normalize(updated), damage: dealt, defeated, reward }
}

function rewardTier(memberDamage: number, bossMaxHp: number): 'gold' | 'silver' | 'bronze' {
  const share = memberDamage / bossMaxHp
  if (share >= 0.25) return 'gold' // ~quarter of the boss on your own
  if (share >= 0.1) return 'silver'
  return 'bronze'
}

/** Floor N+1 replaces the dead row so the guild subscription stays on one record per guild. */
async function spawnNextFloor(pb: PocketBase, guild: string, floor: number): Promise<void> {
  // The update path keeps the unique (guild) index happy: find the dead row id.
  const rows = await pb.collection('guild_boss').getFullList({
    filter: pb.filter('guild = {:guild}', { guild }),
    limit: 1,
  })
  if (rows.length === 0) return
  const next = floor + 1
  await pb.collection('guild_boss').update(rows[0].id, {
    floor: next,
    name: floorName(next),
    hp: floorMaxHp(next),
    max_hp: floorMaxHp(next),
    contributors: {},
    defeated_at: 0,
  })
}
