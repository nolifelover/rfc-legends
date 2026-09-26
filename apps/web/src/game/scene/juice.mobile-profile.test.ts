import { describe, expect, it } from 'vitest'
import { LAYOUT, clampedWorldCenter, isMobileProfile, roosterDisplayHeight } from './juice'

describe('mobile display profile', () => {
  it('uses narrow viewports as mobile', () => {
    expect(isMobileProfile(699, false)).toBe(true)
    expect(isMobileProfile(700, false)).toBe(false)
  })

  it('uses coarse pointers only below the desktop breakpoint', () => {
    expect(isMobileProfile(1023, true)).toBe(true)
    expect(isMobileProfile(1024, true)).toBe(false)
    expect(isMobileProfile(1280, true)).toBe(false)
  })
})

describe('actor display proportions', () => {
  it.each([35, 52, 70])('keeps the level %i rooster near one third of trainer height', (level) => {
    const ratio = roosterDisplayHeight(level) / LAYOUT.TRAINER_H
    expect(ratio).toBeGreaterThanOrEqual(0.35)
    expect(ratio).toBeLessThan(0.363)
  })

  it('caps visual growth after the final tier band', () => {
    expect(roosterDisplayHeight(999)).toBe(roosterDisplayHeight(90))
  })
})

describe('camera world coverage', () => {
  it('clamps a left-biased manual midpoint so the world still fills a wide viewport', () => {
    const center = clampedWorldCenter(720, 1920, LAYOUT.WORLD_ZOOM)
    const half = 1920 / (2 * LAYOUT.WORLD_ZOOM)
    expect(center).toBeCloseTo(half)
    expect(center - half).toBeCloseTo(0)
  })
})

describe('riverside bridge alignment', () => {
  it('keeps every combat foot line on the painted plank band', () => {
    const feet = [LAYOUT.FEET_BACK, LAYOUT.FEET_MID, LAYOUT.FEET_FRONT, LAYOUT.TRAINER_FEET, LAYOUT.ROOSTER_FEET]
    expect(Math.min(...feet)).toBeGreaterThanOrEqual(623)
    expect(Math.max(...feet)).toBeLessThanOrEqual(661)
    expect(LAYOUT.FEET_FRONT - LAYOUT.FEET_BACK).toBe(16)
  })
})
