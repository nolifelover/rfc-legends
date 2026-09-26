import { describe, expect, it } from 'vitest'
import { walkPoseAt } from './walk-cycle'
import type { WalkPose } from './walk-cycle'

const pose = (): WalkPose => ({
  leftX: 0,
  leftY: 0,
  rightX: 0,
  rightY: 0,
  upperX: 0,
  upperY: 0,
  upperAngle: 0,
})

describe('walk cycle poses', () => {
  it('alternates trainer steps rather than moving the whole sprite as one piece', () => {
    const leftStep = walkPoseAt('trainer', 0.25, pose())
    const rightStep = walkPoseAt('trainer', 0.75, pose())

    expect(leftStep.leftX).toBeGreaterThan(0)
    expect(leftStep.leftY).toBeLessThan(0)
    expect(leftStep.rightX).toBeLessThan(0)
    expect(leftStep.rightY).toBe(0)
    expect(rightStep.leftX).toBeLessThan(0)
    expect(rightStep.leftY).toBe(0)
    expect(rightStep.rightX).toBeGreaterThan(0)
    expect(rightStep.rightY).toBeLessThan(0)
  })

  it('gives the faster rooster gait independent alternating feet', () => {
    const first = walkPoseAt('rooster', 0.25, pose())
    const opposite = walkPoseAt('rooster', 0.75, pose())

    expect(first.leftY).toBeLessThan(first.rightY)
    expect(opposite.rightY).toBeLessThan(opposite.leftY)
    expect(first.upperAngle).toBeLessThan(0)
    expect(opposite.upperAngle).toBeGreaterThan(0)
  })

  it('returns a neutral footfall at each full-cycle boundary', () => {
    expect(walkPoseAt('trainer', 0, pose())).toEqual(pose())
    const completed = walkPoseAt('trainer', 1, pose())
    expect(completed.leftX).toBeCloseTo(0, 12)
    expect(completed.rightX).toBeCloseTo(0, 12)
    expect(completed.leftY).toBe(0)
    expect(completed.rightY).toBeCloseTo(0, 12)
  })
})
