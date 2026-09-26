// Map & monster data — GDD §5. The vertical slice ships ทุ่งนาบ้านเกิด only.

import type { MapDef, MonsterDef, MonsterSpawn } from '../types'

// Monster stat formulas — tunable consts (GDD §5.2 balance placeholder).
export const MONSTER_HP = (lv: number): number => 40 + lv * 22
export const MONSTER_ATK = (lv: number): number => 5 + lv * 3
export const MONSTER_DEF = (lv: number): number => lv * 2
export const MONSTER_FLEE = (lv: number): number => 10 + lv * 2
// GDD §4.3: EXP per monster ≈ 5 × Lv^1.5
export const MONSTER_EXP = (lv: number): number => Math.floor(5 * lv ** 1.5)
// MVP bosses award ×20 (task spec; GDD §5.2 MVP rewards).
export const MVP_EXP_MULT = 20

function monster(
  id: string,
  name: string,
  emoji: string,
  level: number,
  cardId: number,
  materialItemId: number,
): MonsterDef {
  return {
    id,
    name,
    emoji,
    level,
    cardId,
    stats: {
      hp: MONSTER_HP(level),
      atk: MONSTER_ATK(level),
      def: MONSTER_DEF(level),
      flee: MONSTER_FLEE(level),
    },
    exp: MONSTER_EXP(level),
    materialItemId,
  }
}

function mvp(id: string, name: string, emoji: string, level: number, cardId: number, materialItemId: number): MonsterDef {
  const m = monster(id, name, emoji, level, cardId, materialItemId)
  return { ...m, isMvp: true, exp: m.exp * MVP_EXP_MULT }
}

const nuNa = monster('nu-na', 'หนูนา', '🐭', 2, 1001, 103)
const takkaTaen = monster('takka-taen-yak', 'ตั๊กแตนยักษ์', '🦗', 5, 1002, 102)
const puNa = monster('pu-na', 'ปูนา', '🦀', 8, 1003, 104)

export const THUNG_NA: MapDef = {
  id: 'thung-na',
  name: 'ทุ่งนาบ้านเกิด',
  lvRange: [1, 10],
  element: 'earth',
  monsters: [
    { monster: nuNa, weight: 50 },
    { monster: takkaTaen, weight: 30 },
    { monster: puNa, weight: 20 },
  ] satisfies MonsterSpawn[],
  mvp: mvp('raja-nu-na', 'ราชาหนูนา', '👑', 12, 3001, 103),
}

export const MAPS: Record<string, MapDef> = {
  [THUNG_NA.id]: THUNG_NA,
}

export const DEFAULT_MAP_ID = THUNG_NA.id

export function getMap(id: string): MapDef {
  return MAPS[id] ?? THUNG_NA
}
