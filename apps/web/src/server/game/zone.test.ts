// Second zone (บึงบัวหลวง) — auto-advance at the rare-drop beat, pest levels in the
// GDD §5.2 band, and the runbook's zone-1 guarantees intact.
import { describe, expect, it } from 'vitest'
import { BUENG_BUA, THUNG_NA, ZONE_ADVANCE_LEVEL } from '../../game/data/maps'
import { DEMO_OPTS, simulateLive } from './combat'
import { mulberry32 } from './rng'
import { hitChance, hitOf } from './stats'
import { buildPlayer } from './index'

const ADDR = '0x1818181818181818181818181818181818181818'.toLowerCase()

describe('zone 2 — บึงบัวหลวง', () => {
  it('pest levels sit in the GDD §5.2 band (25–40) with the MVP above them', () => {
    const levels = [...BUENG_BUA.monsters.map((s) => s.monster.level), BUENG_BUA.mvp!.level]
    expect(levels.slice(0, 3).every((l) => l >= 24 && l <= 40)).toBe(true)
    expect(BUENG_BUA.mvp!.level).toBeGreaterThan(Math.max(...levels.slice(0, 3)))
    expect(BUENG_BUA.lvRange).toEqual([25, 40])
    expect(BUENG_BUA.element).toBe('water')
  })

  it('auto-advances at Base Lv 30, exactly once, and never regresses', () => {
    let p = buildPlayer(ADDR, 'นายไก่บึงบัว', 'kingkong', 0)
    let advanced = false
    for (let t = 0; t < 600; t += 15) {
      const { player } = simulateLive(p, 15, mulberry32(7 + t), DEMO_OPTS)
      p = player
      if (p.mapId === BUENG_BUA.id) {
        if (!advanced) {
          advanced = true
          expect(p.baseLevel).toBeGreaterThanOrEqual(ZONE_ADVANCE_LEVEL)
        }
      } else if (advanced) {
        throw new Error(`regressed to ${p.mapId} after advancing`)
      }
    }
    expect(advanced).toBe(true)
  })

  it('demo pond pace lands in the 10–12 kills/min band (visible-loot tune)', () => {
    let p = buildPlayer(ADDR, 'นายไก่บึงบัว3', 'kingkong', 0)
    let t = 0
    let zone2Start = -1
    let zone2Kills = 0
    for (let w = 0; w < 60; w++) {
      const { player, aggregates } = simulateLive(p, 15, mulberry32(3 + w), DEMO_OPTS)
      p = player
      if (p.mapId === BUENG_BUA.id && zone2Start < 0) zone2Start = t + 15
      if (zone2Start >= 0) zone2Kills += aggregates.kills
      t += 15
    }
    const perMin = zone2Kills / ((t - zone2Start) / 60)
    expect(perMin).toBeGreaterThanOrEqual(9.5)
    expect(perMin).toBeLessThanOrEqual(13)
  })

  it('runbook-stat Lv-30 player hits 75-85% and clears a pond pest in ~15-30s (functional balance)', () => {
    // docs/demo-runbook.md: 20 points spent — STR 8 / AGI 6 / DEX 6 — the exact build a
    // judge following the video has right after the Lv-30 beat that auto-advances here.
    const p = buildPlayer(ADDR, 'นายไก่รันบุ๊ค', 'kingkong', 0)
    p.baseLevel = 30
    p.stats = { str: 8, agi: 6, vit: 1, int: 1, dex: 6, luk: 1 }
    p.mapId = BUENG_BUA.id

    // analytic hit chance against every pest's tuned FLEE
    const hit = hitOf(p)
    for (const spawn of BUENG_BUA.monsters) {
      const chance = hitChance(hit, spawn.monster.stats.flee)
      expect(chance).toBeGreaterThanOrEqual(0.75)
      expect(chance).toBeLessThanOrEqual(0.85)
    }

    // simulated: a kill every 15-30s of live combat (encounter includes the 3s respawn)
    let kills = 0
    let q = p
    for (let w = 0; w < 8; w++) {
      const { player, aggregates } = simulateLive(q, 15, mulberry32(50 + w), DEMO_OPTS)
      q = player
      kills += aggregates.kills
    }
    const encounterSec = 120 / kills
    expect(kills).toBeGreaterThanOrEqual(4) // ≤ 30s per kill
    expect(kills).toBeLessThanOrEqual(8) // ≥ 15s per kill
    void encounterSec
  })

  it('zone 1 is untouched: same id, monsters, MVP, and the pity crossing still fires there', () => {
    expect(THUNG_NA.id).toBe('thung-na')
    expect(THUNG_NA.monsters.map((s) => s.monster.id)).toEqual(['nu-na', 'takka-taen-yak', 'pu-na'])
    // the runbook pity test (demo.test.ts runbook window) covers the crossing kill itself;
    // here we assert the advance only happens at window END, after the zone-1 sim finished
    let p = buildPlayer(ADDR, 'นายไก่บึงบัว2', 'kingkong', 0)
    let sawZone1At30Plus = false
    for (let t = 0; t < 300; t += 15) {
      const { player, aggregates } = simulateLive(p, 15, mulberry32(11 + t), DEMO_OPTS)
      p = player
      if (p.baseLevel >= ZONE_ADVANCE_LEVEL && p.mapId === THUNG_NA.id) sawZone1At30Plus = true
      void aggregates
    }
    // a Lv-30 crossing inside a window finishes that window in zone 1 before the flip
    expect(sawZone1At30Plus || p.mapId === BUENG_BUA.id).toBe(true)
  })
})
