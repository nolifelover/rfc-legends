import type { Drop, Player } from './types'

export type MovementDirection = -1 | 0 | 1

export const MANUAL_MOVE_SPEED = 400
export const MANUAL_MIN_X = 190
export const MANUAL_MAX_X = 1390
export const MANUAL_START_X = 290
export const MANUAL_TARGET_X = 1150
export const MANUAL_ATTACK_RANGE = 300
export const MANUAL_MOVE_LEASE_MS = 650

export type GameAction =
  | { type: 'mode'; mode: 'auto' | 'manual' }
  | { type: 'move'; direction: MovementDirection }
  | { type: 'attack' }
  | { type: 'potion' }

export interface GameActionRequest {
  address: string
  sequence: number
  action: GameAction
}

export interface GameActionResult {
  accepted: boolean
  reason?: 'STALE_SEQUENCE' | 'AUTO_MODE' | 'OUT_OF_RANGE' | 'COOLDOWN' | 'KNOCKED_OUT' | 'NO_TARGET' | 'NO_ITEM' | 'FULL_HP'
  damage?: number
  healing?: number
  crit?: boolean
  miss?: boolean
  killed?: boolean
  targetId?: string
  sequence: number
}

export interface GameActionResponse {
  player: Player
  drops: Drop[]
  result: GameActionResult
  demoMode: boolean
}
