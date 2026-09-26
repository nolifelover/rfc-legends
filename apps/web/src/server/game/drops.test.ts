import { describe, expect, it } from 'vitest'
import { getMap } from '../../game/data/maps'
import { getItem } from '../../game/data/items'
import { hashSeed, mulberry32 } from './rng'
import {
  COMMON_MATERIAL_CHANCE,
  EPIC_EQUIP_CHANCE,
  LEGENDARY_CHANCE,
  NORMAL_DROP_OPTS,
  OWN_CARD_CHANCE,
  RARE_EQUIP_CHANCE,
  rollDrops,
} from './drops'

const map = getMap('thung-na')

describe('drop table — GDD §6.4 (seeded batch sanity)', () => {
  const KILLS = 12_000
  const rng = mulberry32(hashSeed('drops-test', 'nu-na-batch'))
  const rat = map.monsters[0].monster

  let material = 0
  let rare = 0
  let epic = 0
  let legendary = 0
  let cards = 0
  const mintable: { itemId: number; rarity: string }[] = []

  for (let i = 0; i < KILLS; i++) {
    const res = rollDrops(rat, rng, NORMAL_DROP_OPTS)
    if (res.inventory[103] ?? 0) material += res.inventory[103]
    rare += res.inventory[205] ?? 0
    rare += res.inventory[206] ?? 0
    epic += res.inventory[207] ?? 0
    epic += res.inventory[208] ?? 0
    for (const d of res.mintable) {
      mintable.push(d)
      if (d.rarity === 'legendary') legendary++
      if (d.rarity === 'monster_card') cards++
    }
  }

  it('commons land at ~25% ±3%', () => {
    const rate = material / KILLS
    expect(rate).toBeGreaterThan(COMMON_MATERIAL_CHANCE - 0.03)
    expect(rate).toBeLessThan(COMMON_MATERIAL_CHANCE + 0.03)
  })

  it('rare and epic equipment land within ±35% of their base rates', () => {
    expect(rare / KILLS).toBeGreaterThan(RARE_EQUIP_CHANCE * 0.65)
    expect(rare / KILLS).toBeLessThan(RARE_EQUIP_CHANCE * 1.35)
    expect(epic / KILLS).toBeGreaterThan(EPIC_EQUIP_CHANCE * 0.6)
    expect(epic / KILLS).toBeLessThan(EPIC_EQUIP_CHANCE * 1.6)
  })

  it('mintable drops are present in a 12k batch (χ²-lite sanity)', () => {
    expect(legendary).toBeGreaterThan(0)
    expect(legendary / KILLS).toBeGreaterThan(LEGENDARY_CHANCE * 0.5)
    expect(legendary / KILLS).toBeLessThan(LEGENDARY_CHANCE * 2)
    expect(cards).toBeGreaterThan(0)
    expect(cards / KILLS).toBeGreaterThan(OWN_CARD_CHANCE * 0.4)
    expect(cards / KILLS).toBeLessThan(OWN_CARD_CHANCE * 2.5)
    for (const d of mintable) {
      expect(getItem(d.itemId)).toBeDefined()
    }
  })

  it('is deterministic for a fixed seed', () => {
    const rngA = mulberry32(hashSeed('determinism'))
    const rngB = mulberry32(hashSeed('determinism'))
    const outA = JSON.stringify(rollDrops(rat, rngA))
    const outB = JSON.stringify(rollDrops(rat, rngB))
    expect(outA).toBe(outB)
  })

  it('every dropped itemId resolves in the catalog', () => {
    const rng2 = mulberry32(hashSeed('catalog-check'))
    for (let i = 0; i < 200; i++) {
      const m = map.monsters[i % map.monsters.length].monster
      const res = rollDrops(m, rng2, NORMAL_DROP_OPTS)
      for (const id of Object.keys(res.inventory)) expect(getItem(Number(id))).toBeDefined()
      for (const d of res.mintable) expect(getItem(d.itemId)).toBeDefined()
    }
  })
})
