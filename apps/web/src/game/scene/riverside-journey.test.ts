import { describe, expect, it } from 'vitest'
import { RiversideJourney } from './riverside-journey'

function setup(reducedMotion = false, speed = 50) {
  const panels = [{ x: 0 }, { x: 1920 }]
  const journey = new RiversideJourney(reducedMotion)
  journey.addLayer(panels, 1920, speed)
  return { journey, panels }
}

describe('riverside journey', () => {
  it('keeps every background layer stationary for reduced motion', () => {
    const { journey, panels } = setup(true)
    journey.update(50, false)
    journey.update(50, true)
    expect(panels.map((panel) => panel.x)).toEqual([0, 1920])
    expect(journey.debugState().motion).toBe(0)
  })

  it('travels the same distance across ordinary frame-time partitions', () => {
    const single = setup()
    const partitioned = setup()
    single.journey.update(40, false)
    for (let frame = 0; frame < 4; frame++) partitioned.journey.update(10, false)
    expect(partitioned.panels[0].x).toBeCloseTo(single.panels[0].x, 8)
  })

  it('keeps two panels covering the travel band after repeated wraps', () => {
    const { journey, panels } = setup(false, 120)
    for (let frame = 0; frame < 12000; frame++) journey.update(50, false)
    const xs = panels.map((panel) => panel.x).sort((a, b) => a - b)
    expect(xs[0]).toBeGreaterThan(-1920)
    expect(xs[0]).toBeLessThanOrEqual(0)
    expect(xs[1]).toBeGreaterThanOrEqual(0)
    expect(xs[1] - xs[0]).toBeCloseTo(1920, 6)
  })

  it('bounds the jump after a suspended tab resumes', () => {
    const { journey, panels } = setup(false, 50)
    journey.update(60_000, false)
    expect(panels[0].x).toBeCloseTo(-2.5, 8)
  })

  it('eases to a stop for a boss and smoothly resumes travel', () => {
    const { journey, panels } = setup()
    journey.update(50, true)
    const firstBossFrame = journey.debugState().motion
    const xAfterFirstBossFrame = panels[0].x
    expect(firstBossFrame).toBeGreaterThan(0)
    expect(firstBossFrame).toBeLessThan(1)

    for (let frame = 0; frame < 60; frame++) journey.update(50, true)
    const stopped = journey.debugState().motion
    const xAtStop = panels[0].x
    journey.update(50, true)
    expect(stopped).toBe(0)
    expect(panels[0].x).toBe(xAtStop)
    expect(xAtStop).toBeLessThan(xAfterFirstBossFrame)

    journey.update(50, false)
    expect(journey.debugState().motion).toBeGreaterThan(0)
    expect(journey.debugState().motion).toBeLessThan(1)
    expect(panels[0].x).toBeLessThan(xAtStop)
  })
})
