// Item catalog — GDD §6. All names/descriptions are original Thai-themed content (no Ragnarok IP).
// ID scheme: 1xx consumables/materials, 2xx equipment (common→epic), 1xxx Monster Card,
// 2xxx Legendary, 3xxx MVP Card. Only MINTABLE_RARITIES + id >= 1000 can be minted (interfaces.md §5).

import type { ItemDef, Rarity } from '../types'

export const ITEMS: ItemDef[] = [
  // --- 1xx consumables & materials (non-mintable) ---
  {
    id: 101,
    name: 'ยาต้มสมุนไพร',
    rarity: 'common',
    slot: 'consumable',
    image: '/assets/items/101.svg',
    emoji: '🍵',
    desc: 'หม้อดินเล็ก ๆ ตุ๋นสมุนไพรเก้าอย่าง กินแล้วซาบซ่าเหมือนยายต้มให้เอง',
  },
  {
    id: 102,
    name: 'ข้าวเปลือก',
    rarity: 'common',
    slot: 'material',
    image: '/assets/items/102.svg',
    emoji: '🌾',
    desc: 'ข้าวหอมมะลิจากทุ่งนาบ้านเกิด เก็บมาได้จากตั๊กแตนที่แอบขโมยไปซ่อน',
  },
  {
    id: 103,
    name: 'ขนไก่นุ่ม',
    rarity: 'common',
    slot: 'material',
    image: '/assets/items/103.svg',
    emoji: '🪶',
    desc: 'ขนนุ่มฟูจากหนูนาที่เพิ่งโดนไก่ไล่ตบ เอาไปทำหมอนได้',
  },
  {
    id: 104,
    name: 'คราบปูนา',
    rarity: 'common',
    slot: 'material',
    image: '/assets/items/104.svg',
    emoji: '🦀',
    desc: 'เปลือกปูนาที่ลอกทิ้งไว้ริมคูน้ำ แข็งแรงจนช่างบ้านเอาไปปูนฝาได้',
  },

  // --- 2xx equipment: common → epic (non-mintable) ---
  {
    id: 201,
    name: 'ไม้ตะพดหวาย',
    rarity: 'common',
    slot: 'weapon',
    image: '/assets/items/201.svg',
    emoji: '🪵',
    desc: 'ไม้หวายฟากแรกของนายไก่มือใหม่ ฟาดหนูนาได้พอดิบพอดี',
  },
  {
    id: 202,
    name: 'เสื้อกั๊กหนังควาย',
    rarity: 'common',
    slot: 'armor',
    image: '/assets/items/202.svg',
    emoji: '🦺',
    desc: 'กั๊กหนังควายเย็บมือป้ายาย ทั้งเท่ ทั้งกันแดดกันฝนกันหนูกัด',
  },
  {
    id: 203,
    name: 'งอบช่าง',
    rarity: 'common',
    slot: 'hat',
    image: '/assets/items/203.svg',
    emoji: '👷',
    desc: 'งอบสานเก่า ๆ ของช่างปูน สวมแล้วรู้สึกตัวเองเก่งขึ้นสามเท่า',
  },
  {
    id: 204,
    name: 'รองเท้าแตะยางพารา',
    rarity: 'common',
    slot: 'shoes',
    image: '/assets/items/204.svg',
    emoji: '🩴',
    desc: 'แตะยางพาราแท้ ๆ เดินลุยนาเสียดายบ่วล แต่สบายเท้าจนลืมหลังคาน',
  },
  {
    id: 205,
    name: 'ตะกรุดไม้ไผ่',
    rarity: 'rare',
    slot: 'accessory',
    image: '/assets/items/205.svg',
    emoji: '📿',
    desc: 'ตะกรุดไม้ไผ่สวดเก็บน้ำ ใส่แล้วใจสงบ ว่องไวขึ้นเล็ก ๆ',
  },
  {
    id: 206,
    name: 'ผ้าขาวม้าโพกหัว',
    rarity: 'rare',
    slot: 'hat',
    image: '/assets/items/206.svg',
    emoji: '🎀',
    desc: 'ผ้าขาวม้ามัดท้ายแบบพี่น้องสายชก มู้ดบู๊แน่นอน',
  },
  {
    id: 207,
    name: 'มีดพร้าช่างตี',
    rarity: 'epic',
    slot: 'weapon',
    image: '/assets/items/207.svg',
    emoji: '🔪',
    desc: 'พร้าชุบน้ำมันเผาไฟจากหลามช่างตีเก่า คมจนเฉือนลมได้',
  },
  {
    id: 208,
    name: 'รองเท้าหนังควาย',
    rarity: 'epic',
    slot: 'shoes',
    image: '/assets/items/208.svg',
    emoji: '👞',
    desc: 'หนังควายหนึ่งชิ้นตัดเย็บทั้งคู่ ทนทานจนส่งต่อหลานได้',
  },

  // --- 1xxx Monster Cards (mintable) ---
  {
    id: 1001,
    name: 'การ์ดหนูนา',
    rarity: 'monster_card',
    slot: 'weapon',
    image: '/assets/items/1001.svg',
    emoji: '🐭',
    desc: 'การ์ดหนูนาตาเป็นประกาย เสียบที่อาวุธแล้ว LUK +2 อัตราดรอป +2%',
  },
  {
    id: 1002,
    name: 'การ์ดตั๊กแตนยักษ์',
    rarity: 'monster_card',
    slot: 'weapon',
    image: '/assets/items/1002.svg',
    emoji: '🦗',
    desc: 'การ์ดตั๊กแตนยักษ์เหยียบข้าว เสียบที่อาวุธแล้วกระโดดหนีได้ไวขึ้น',
  },
  {
    id: 1003,
    name: 'การ์ดปูนา',
    rarity: 'monster_card',
    slot: 'armor',
    image: '/assets/items/1003.svg',
    emoji: '🦀',
    desc: 'การ์ดปูนาก้ามใหญ่ เสียบที่เกราะแล้ว HP +10% ต้านพิษ',
  },

  // --- 2xxx Legendary (mintable) ---
  {
    id: 2001,
    name: 'ไม้ตะพดตะนาวศรี',
    rarity: 'legendary',
    slot: 'weapon',
    image: '/assets/items/2001.svg',
    emoji: '🌟',
    desc: 'ไม้ตะพดที่ฝังไม้ตะนาวศรีทั้งลำ ฟาดทีเดียวสายลมเปลี่ยนทิศ ของมีคนเดียวในทุ่งนา',
  },
  {
    id: 2002,
    name: 'ม่อฮ่อมลายยันต์',
    rarity: 'legendary',
    slot: 'armor',
    image: '/assets/items/2002.svg',
    emoji: '🥋',
    desc: 'ม่อฮ่อมลายยันต์เขียนด้วยหมึกผสมผงไม้ศักดิ์สิทธิ์ ใส่แล้วอาวุธใดก็ทะลุยาก',
  },
  {
    id: 2003,
    name: 'ไข่ไก่เกรด S',
    rarity: 'legendary',
    image: '/assets/items/2003.svg',
    emoji: '🥚',
    desc: 'ไข่ไก่ชนเกรด S จากฟาร์มนิลนีย์ เปลือกเงาวับ อุ่นมือเหมือนมีชีวิตซ่อนอยู่ข้างใน',
  },

  // --- 3xxx MVP Cards (mintable) ---
  {
    id: 1004,
    name: 'การ์ดตัวเงินตัวทอง',
    rarity: 'monster_card',
    slot: 'armor',
    image: '/assets/items/1004.svg',
    emoji: '🐌',
    desc: 'การ์ดตัวเงินตัวทองเปลือกมันวาว เสียบที่เกราะแล้ว DEF +8 ว่ายน้ำเร็วขึ้น',
  },
  {
    id: 1005,
    name: 'การ์ดนกกระยาง',
    rarity: 'monster_card',
    slot: 'weapon',
    image: '/assets/items/1005.svg',
    emoji: '🦆',
    desc: 'การ์ดนกกระยางปีกเร็ว เสียบที่อาวุธแล้วโจมตีไวขึ้นเหมือนจับปลาในบึง',
  },
  {
    id: 1006,
    name: 'การ์ดปลาช่อนยักษ์',
    rarity: 'monster_card',
    slot: 'weapon',
    image: '/assets/items/1006.svg',
    emoji: '🐟',
    desc: 'การ์ดปลาช่อนยักษ์ฟันคม เสียบที่อาวุธแล้วดาเมจน้ำลึก +15%',
  },
  {
    id: 3002,
    name: 'การ์ดจระเข้เฒ่าบึง',
    rarity: 'mvp_card',
    slot: 'accessory',
    image: '/assets/items/3002.svg',
    emoji: '🐊',
    desc: 'การ์ดจระเข้เฒ่าผู้ครองบึงบัว บึกบึนที่สุดแห่งหนองน้ำ',
  },
  {
    id: 3001,
    name: 'การ์ดราชาหนูนา',
    rarity: 'mvp_card',
    slot: 'accessory',
    image: '/assets/items/3001.svg',
    emoji: '👑',
    desc: 'การ์ดราชาหนูนาเจ้าทุ่งนา มงกุฎขึ้นสนิมเพราะอายุนับร้อยปี เสียบที่เครื่องรางแล้ว ATK +15%',
  },
]

const BY_ID = new Map<number, ItemDef>(ITEMS.map((i) => [i.id, i]))

export function getItem(id: number): ItemDef | undefined {
  return BY_ID.get(id)
}

/** Only these rarities (with id >= 1000) can be minted as ERC-1155 — interfaces.md §5. */
export const MINTABLE_RARITIES: readonly Rarity[] = ['legendary', 'monster_card', 'mvp_card']

export function isMintableItem(id: number): boolean {
  const item = getItem(id)
  return !!item && id >= 1000 && MINTABLE_RARITIES.includes(item.rarity)
}
