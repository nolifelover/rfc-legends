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
