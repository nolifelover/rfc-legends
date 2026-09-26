import { describe, expect, it } from 'vitest'
import { activeManualDirection, projectedManualX } from './manual-scene-state'
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
