import { describe, expect, it } from 'vitest'
import { MANUAL_MAX_X, MANUAL_MOVE_LEASE_MS, MANUAL_START_X } from '../../game/manual-controls'
import { buildPlayer } from './index'
import { advanceMovement, initialControl, leaseMovement } from './manual'
import { NORMAL_OPTS, simulateLive } from './combat'
import { mulberry32 } from './rng'

const T0 = 1_700_000_000_000
const A = '0x7777777777777777777777777777777777777777'

describe('manual movement', () => {
  it('integrates only the leased interval, stops on expiry, and clamps to world bounds', () => {
    let control = leaseMovement(initialControl(T0), 1, T0, 1)
    control = advanceMovement(control, T0 + MANUAL_MOVE_LEASE_MS + 5_000)
    expect(control.x).toBe(MANUAL_START_X + 400 * (MANUAL_MOVE_LEASE_MS / 1000))
    expect(control.direction).toBe(0)

    control = { ...control, x: MANUAL_MAX_X - 10 }
    control = advanceMovement(leaseMovement(control, 1, control.updatedAt, 2), control.updatedAt + 500)
    expect(control.x).toBe(MANUAL_MAX_X)
    expect(control.direction).toBe(0)
  })
})

describe('manual combat progression', () => {
  it('advances enemies and cooldowns without passive player damage, kills, exp, coins, or drops', () => {
    const player = buildPlayer(A, 'ผู้เล่นแมนนวล', 'raptor', T0)
    const out = simulateLive(player, 30, mulberry32(42), NORMAL_OPTS, { autoAttack: false })
    expect(out.aggregates.kills).toBe(0)
    expect(out.aggregates.expGained).toBe(0)
    expect(out.aggregates.coinsGained).toBe(0)
    expect(out.aggregates.drops).toEqual([])
    expect(out.player.killCount).toBe(0)
    expect(out.player.exp).toBe(0)
  })

  it('does not auto-heal or let an out-of-range monster hit in manual mode', () => {
    const player = buildPlayer(A, 'ผู้เล่นแมนนวล', 'raptor', T0)
    player.combat = { monsterId: 'nu-na', monsterHp: 84, hp: 20, monsterAtkIn: 0 }
    const far = simulateLive(player, 2, mulberry32(9), NORMAL_OPTS, {
      autoAttack: false,
      autoHeal: false,
      enemyCanAttack: false,
    })
    expect(far.player.combat?.hp).toBe(20)
    expect(far.player.inventory[101]).toBe(player.inventory[101])

    const near = simulateLive(player, 2, mulberry32(9), NORMAL_OPTS, {
      autoAttack: false,
      autoHeal: false,
      enemyCanAttack: true,
    })
    expect(near.player.combat?.hp).toBeLessThan(20)
  })
})
