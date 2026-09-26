// Shared game types — safe to import from client code (no server-only deps).
// Mirrors docs/interfaces.md §5 and GDD §2–§6.

export type SireLine = 'kumarnjeen' | 'kingkong' | 'chaokhunthong' | 'thepbut' | 'raptor'

export type Element = 'fire' | 'water' | 'wood' | 'metal' | 'earth'

/** นายไก่ main stats — GDD §2.2 */
export interface Stats {
  str: number
  agi: number
  vit: number
  int: number
  dex: number
  luk: number
}
export type StatKey = keyof Stats

/** ไก่คู่หู stats — GDD §3.1 */
export interface RoosterStats {
  pow: number
  spd: number
  sta: number
  tec: number
  spr: number
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'monster_card' | 'mvp_card'

export type DropStatus = 'unminted' | 'minting' | 'minted'

/** A mintable rare drop — interfaces.md §5. Only rarity legendary/monster_card/mvp_card items become Drops. */
export interface Drop {
  dropId: `0x${string}` // bytes32 hex, deterministically derived
  itemId: number
  rarity: Rarity
  status: DropStatus
  droppedAt: number // epoch ms
  txHash?: string
}

export interface ItemDef {
  id: number // <1000 non-mintable, 1xxx monster card, 2xxx legendary, 3xxx mvp card
  name: string // Thai display name
  rarity: Rarity
  slot?: 'weapon' | 'armor' | 'hat' | 'shoes' | 'accessory' | 'consumable' | 'material'
  image: string // '/assets/items/<id>.svg'
  emoji: string
  desc: string // Thai, playful
}

export interface MonsterStats {
  hp: number
  atk: number
  def: number
  flee: number
}

export interface MonsterDef {
  id: string
  name: string // Thai
  emoji: string
  level: number
  cardId?: number // its own 1xxx card (3xxx for MVP)
  isMvp?: boolean
  stats: MonsterStats
  exp: number
  materialItemId?: number // the ~25% common material drop (GDD §6.4)
}

export interface MonsterSpawn {
  monster: MonsterDef
  weight: number
}

export interface MapDef {
  id: string
  name: string
  lvRange: [number, number]
  element: Element
  monsters: MonsterSpawn[]
  mvp?: MonsterDef
}

export interface Rooster {
  name: string
  sireLine: SireLine
  level: number
  exp: number
  stats: RoosterStats
}

/** Server-authoritative player state, keyed by wallet address. */
/** Mid-fight monster carried between syncs so short sync windows can't reset boss HP. */
export interface CombatState {
  monsterId: string
  monsterHp: number
}

export interface Player {
  address: string // lowercase hex
  name: string
  sireLine: SireLine
  baseLevel: number
  jobLevel: number
  exp: number // progress within current base level
  jobExp: number
  statPoints: number // unspent (GDD §2.2)
  stats: Stats
  rooster: Rooster
  mapId: string
  inventory: Record<number, number> // itemId -> count (non-mintable items)
  killCount: number // total kills; drives MVP spawn cadence
  sessionCounter: number // increments per sync; seeds the deterministic rng
  dropCounter: number // increments per mintable drop; part of dropId
  combat?: CombatState // monster engaged when the last sync window ended
  lastSyncedAt: number // epoch ms
  createdAt: number // epoch ms
}
