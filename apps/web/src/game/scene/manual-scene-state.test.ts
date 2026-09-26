import { describe, expect, it } from 'vitest'
import { activeManualDirection, nextManualCompanionPosition, projectedManualX } from './manual-scene-state'
import type { PlayerControlState } from '../types'

const control = (overrides: Partial<PlayerControlState> = {}): PlayerControlState => ({
  mode: 'manual',
  x: 290,
  direction: 1,
  updatedAt: 1_000,
  moveUntil: 1_650,
  sequence: 1,
  ...overrides,
})

describe('manual companion follow', () => {
  it('switches sides near the right bound without a one-frame jump', () => {
    const next = nextManualCompanionPosition(1_141, 1_389, 1, 1 / 60)
    expect(next.side).toBe(-1)
    expect(Math.abs(next.x - 1_389)).toBeLessThanOrEqual(20)
  })

  it('stays inside the server movement bounds while catching up', () => {
    let state: { x: number; side: -1 | 1 } = { x: 1_390, side: -1 }
    for (let i = 0; i < 120; i++) state = nextManualCompanionPosition(1_100, state.x, state.side, 1 / 60)
    expect(state.x).toBe(770)
  })
})

describe('manual scene prediction', () => {
  it('projects at the shared server speed only through the movement lease', () => {
    expect(projectedManualX(control(), 1_250)).toBe(390)
    expect(projectedManualX(control(), 5_000)).toBe(550)
    expect(activeManualDirection(control(), 1_649)).toBe(1)
    expect(activeManualDirection(control(), 1_650)).toBe(0)
  })

  it('clamps prediction to the same server world bounds in both directions', () => {
    expect(projectedManualX(control({ x: 1_350 }), 1_650)).toBe(1_390)
    expect(projectedManualX(control({ x: 210, direction: -1 }), 1_650)).toBe(190)
  })

  it('does not rewind from timestamps older than the authoritative update', () => {
    expect(projectedManualX(control(), 900)).toBe(290)
  })
})
