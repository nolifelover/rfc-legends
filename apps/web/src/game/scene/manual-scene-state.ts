import {
  MANUAL_MAX_X,
  MANUAL_MIN_X,
  MANUAL_MOVE_SPEED,
} from '../manual-controls'
import type { MovementDirection } from '../manual-controls'
import type { PlayerControlState } from '../types'

export function activeManualDirection(control: PlayerControlState, now: number): MovementDirection {
  return control.moveUntil > now ? control.direction : 0
}

/** Project an authoritative heartbeat to the current instant without exceeding its lease. */
export function projectedManualX(control: PlayerControlState, now: number): number {
  const travelMs = Math.max(0, Math.min(now, control.moveUntil) - control.updatedAt)
  return Math.max(
    MANUAL_MIN_X,
    Math.min(MANUAL_MAX_X, control.x + control.direction * MANUAL_MOVE_SPEED * (travelMs / 1000)),
  )
}

export interface ManualCompanionPosition {
  x: number
  side: -1 | 1
}

/** Follow at a readable distance and cross sides at a bounded visual speed near world edges. */
export function nextManualCompanionPosition(
  trainerX: number,
  currentX: number,
  currentSide: -1 | 1,
  seconds: number,
): ManualCompanionPosition {
  const followDistance = 330
  const switchGap = 250
  let side = currentSide
  if (side === 1 && trainerX > MANUAL_MAX_X - switchGap) side = -1
  else if (side === -1 && trainerX < MANUAL_MIN_X + switchGap) side = 1
  const target = Math.max(MANUAL_MIN_X, Math.min(MANUAL_MAX_X, trainerX + side * followDistance))
  const maxStep = 1200 * Math.max(0, Math.min(seconds, 0.05))
  const step = Math.max(-maxStep, Math.min(maxStep, target - currentX))
  return { x: currentX + step, side }
}
