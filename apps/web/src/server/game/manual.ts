import type { PlayerControlState } from '../../game/types'
import {
  MANUAL_MAX_X,
  MANUAL_MIN_X,
  MANUAL_MOVE_LEASE_MS,
  MANUAL_MOVE_SPEED,
  MANUAL_START_X,
  type MovementDirection,
} from '../../game/manual-controls'
import { clamp } from './stats'

export function initialControl(nowMs: number, sequence = 0): PlayerControlState {
  return {
    mode: 'manual',
    x: MANUAL_START_X,
    direction: 0,
    moveUntil: nowMs,
    updatedAt: nowMs,
    sequence,
  }
}

/** Integrate only the server-leased portion of movement, then stop it if the lease expired. */
export function advanceMovement(control: PlayerControlState, nowMs: number): PlayerControlState {
  const end = Math.min(Math.max(nowMs, control.updatedAt), control.moveUntil)
  const elapsed = Math.max(0, end - control.updatedAt) / 1000
  const x = clamp(control.x + control.direction * MANUAL_MOVE_SPEED * elapsed, MANUAL_MIN_X, MANUAL_MAX_X)
  const expired = nowMs >= control.moveUntil || x === MANUAL_MIN_X || x === MANUAL_MAX_X
  return {
    ...control,
    x,
    direction: expired ? 0 : control.direction,
    updatedAt: nowMs,
  }
}

export function leaseMovement(
  control: PlayerControlState,
  direction: MovementDirection,
  nowMs: number,
  sequence: number,
): PlayerControlState {
  return {
    ...advanceMovement(control, nowMs),
    direction,
    moveUntil: direction === 0 ? nowMs : nowMs + MANUAL_MOVE_LEASE_MS,
    updatedAt: nowMs,
    sequence,
  }
}
