// Public game-engine API — the only module other lanes import (interfaces.md §5).
// Server-authoritative: each sync recomputes state from elapsed time; no background worker.

import { DEFAULT_MAP_ID, getMap } from '../../game/data/maps'
import {
  MANUAL_ATTACK_RANGE,
  MANUAL_TARGET_X,
  type GameAction,
  type GameActionResponse,
  type GameActionResult,
} from '../../game/manual-controls'
import type { Drop, DropStatus, Player, Rarity, SireLine, StatKey } from '../../game/types'
import {
  DEMO_OPTS,
  DEMO_EXP_MULT,
  DEMO_DROP_RARE_MULT,
  DEMO_DROP_EPIC_MULT,
  DEMO_DROP_LEGENDARY_MULT,
  DEMO_MONSTER_CARD_MULT,
  DEMO_MVP_CARD_MULT,
  DEMO_MVP_EVERY_KILLS,
  DEMO_PITY_MONSTER_CARD_LEVEL,
  LIVE_WINDOW,
  NORMAL_OPTS,
  OFFLINE_CAP_SECONDS,
  POTION_HEAL_FRAC,
  POTION_ITEM_ID,
  type CombatAggregates,
  type EngineOpts,
  type OfflineAggregates,
  simulateLive,
  settleOffline,
} from './combat'
import { makeDropId } from './drops'
import { hashSeed, mulberry32 } from './rng'
import { advanceMovement, initialControl, leaseMovement } from './manual'
import {
  ROOSTER_BASE_STATS,
  START_STAT_POINTS,
  STARTER_INVENTORY,
  allocateStats as applyAllocation,
  defaultRoosterName,
  freshStats,
  maxHp,
} from './stats'
import { getStore, type GameStore } from './store'

/** interfaces.md §5 / §8: DEMO_MODE=true boosts rates for the demo video. Never shown as real. */
export const demoMode: boolean = process.env.DEMO_MODE === 'true'

export {
  DEMO_EXP_MULT,
  DEMO_DROP_RARE_MULT,
  DEMO_DROP_EPIC_MULT,
  DEMO_DROP_LEGENDARY_MULT,
  DEMO_MONSTER_CARD_MULT,
  DEMO_MVP_CARD_MULT,
  DEMO_MVP_EVERY_KILLS,
  DEMO_PITY_MONSTER_CARD_LEVEL,
  LIVE_WINDOW,
  OFFLINE_CAP_SECONDS,
}

export class GameError extends Error {
  constructor(readonly code: string) {
    super(code) // ASCII code, Thai-safe for transports; the UI maps it to Thai copy
  }
}

const SIRE_LINES: readonly SireLine[] = ['kumarnjeen', 'kingkong', 'chaokhunthong', 'thepbut', 'raptor']
const DROP_STATUSES: readonly DropStatus[] = ['unminted', 'minting', 'minted']

export function normalizeAddress(address: string): string {
  const a = (address ?? '').trim().toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(a)) throw new GameError('INVALID_ADDRESS')
  return a
}

// --- per-address serialization (D2) ---
const addressLocks = new Map<string, Promise<unknown>>()

/**
 * Serializes state transitions per address: two overlapping syncs would otherwise both derive
 * from the same snapshot — lost sessionCounter increments, lastSyncedAt regression and duplicate
 * dropIds (which also collide with the onchain dropMinted dedup and make getDrop ambiguous).
 * In-process only; a multi-instance deployment would need a DB-level lock (fine for our single
 * dev/demo instance). The map is bounded by distinct addresses seen this process.
 */
function withAddressLock<T>(address: string, fn: () => Promise<T>): Promise<T> {
  const prev = addressLocks.get(address) ?? Promise.resolve()
  const run = prev.then(fn, fn)
  addressLocks.set(
    address,
    run.then(
      () => undefined,
      () => undefined,
    ),
  )
  return run
}

// --- drop persistence cap (D1) ---
/** A demo-mode offline catch-up can roll thousands of mintables; persist only the rarest N. */
export const MAX_DROPS_PER_SYNC = 100
/** mvp_card > monster_card > legendary (non-mintables never reach Drop records at all). */
const DROP_RARITY_PRIORITY: Record<Rarity, number> = {
  mvp_card: 0,
  monster_card: 1,
  legendary: 2,
  common: 3,
  rare: 3,
  epic: 3,
}

// --- forward-only drop status machine (D4) ---
const VALID_DROP_TRANSITIONS: Record<DropStatus, readonly DropStatus[]> = {
  unminted: ['minting'],
  minting: ['minted', 'unminted'], // → unminted = mint aborted (rollback; clears any txHash)
  minted: [], // terminal
}

function engineOpts(): EngineOpts {
  return demoMode ? DEMO_OPTS : NORMAL_OPTS
}

function nextRng(player: Player) {
  player.sessionCounter += 1
  return mulberry32(hashSeed(player.address, player.sessionCounter))
}

function persistRolls(
  player: Player,
  rolled: CombatAggregates['drops'],
  nowMs: number,
): Drop[] {
  return rolled
    .sort((x, y) => DROP_RARITY_PRIORITY[x.rarity] - DROP_RARITY_PRIORITY[y.rarity])
    .slice(0, MAX_DROPS_PER_SYNC)
    .map((drop) => {
      player.dropCounter += 1
      return {
        dropId: makeDropId(player.address, player.sessionCounter, player.dropCounter).toLowerCase() as `0x${string}`,
        itemId: drop.itemId,
        rarity: drop.rarity,
        status: 'unminted' as const,
        droppedAt: nowMs,
      } satisfies Drop
    })
}

async function saveRolls(store: GameStore, player: Player, rolled: CombatAggregates['drops'], nowMs: number) {
  const drops = persistRolls(player, rolled, nowMs)
  if (drops.length > 0) await store.saveDrops(player.address, drops)
}

function advanceManualCombat(player: Player, nowMs: number): { player: Player; aggregates: CombatAggregates | null } {
  const elapsedMs = Math.max(0, nowMs - player.lastSyncedAt)
  const steps = Math.floor(elapsedMs / 50)
  if (steps === 0) return { player, aggregates: null }
  // Manual mode never grants catch-up rewards. A long-closed tab only needs enough live
  // simulation to settle cooldown/death state; skip older idle time instead of burning CPU.
  const seconds = Math.min(steps * 0.05, LIVE_WINDOW)
  const inRange = Math.abs((player.control?.x ?? 0) - MANUAL_TARGET_X) <= MANUAL_ATTACK_RANGE
  const res = simulateLive(player, seconds, nextRng(player), engineOpts(), {
    autoAttack: false,
    autoHeal: false,
    enemyCanAttack: inRange,
  })
  res.player.lastSyncedAt = player.lastSyncedAt + steps * 50
  return { player: res.player, aggregates: res.aggregates }
}

/** Pure player factory (also used by tests; no store access). */
export function buildPlayer(address: string, name: string, sireLine: SireLine, nowMs: number): Player {
  return {
    address,
    name,
    sireLine,
    baseLevel: 1,
    jobLevel: 1,
    exp: 0,
    jobExp: 0,
    statPoints: START_STAT_POINTS, // GDD §2.2
    stats: freshStats(),
    rooster: {
      name: defaultRoosterName(sireLine),
      sireLine,
      level: 1,
      exp: 0,
      stats: { ...ROOSTER_BASE_STATS },
    },
    mapId: DEFAULT_MAP_ID,
    inventory: { ...STARTER_INVENTORY },
    killCount: 0,
    sessionCounter: 0,
    dropCounter: 0,
    lastSyncedAt: nowMs,
    createdAt: nowMs,
  }
}

export async function createPlayer(
  address: string,
  name: string,
  sireLine: SireLine,
  nowMs: number = Date.now(),
): Promise<Player> {
  const a = normalizeAddress(address)
  const trimmed = (name ?? '').trim()
  if (trimmed.length < 1 || trimmed.length > 24) throw new GameError('INVALID_NAME')
  if (!SIRE_LINES.includes(sireLine)) throw new GameError('INVALID_SIRE_LINE')
  return withAddressLock(a, async () => {
    const store = getStore()
    if (await store.getPlayer(a)) throw new GameError('PLAYER_EXISTS')
    const player = buildPlayer(a, trimmed, sireLine, nowMs)
    await store.savePlayer(player)
    return player
  })
}

export async function getPlayer(address: string): Promise<Player | null> {
  const a = normalizeAddress(address)
  return getStore().getPlayer(a)
}

export async function listDrops(address: string): Promise<Drop[]> {
  const a = normalizeAddress(address)
  return getStore().listDrops(a)
}

export async function getDrop(address: string, dropId: string): Promise<Drop | null> {
  const drops = await listDrops(address)
  const id = dropId.toLowerCase() // dropIds are bytes32 hex — matched case-insensitively
  return drops.find((d) => d.dropId === id) ?? null
}

export async function setDropStatus(
  address: string,
  dropId: string,
  status: DropStatus,
  txHash?: string,
): Promise<void> {
  const a = normalizeAddress(address)
  if (!DROP_STATUSES.includes(status)) throw new GameError('INVALID_STATUS')
  return withAddressLock(a, async () => {
    const current = await getDrop(a, dropId)
    if (!current) throw new GameError('DROP_NOT_FOUND')
    if (!VALID_DROP_TRANSITIONS[current.status].includes(status)) throw new GameError('INVALID_STATUS')
    const isRollback = current.status === 'minting' && status === 'unminted'
    await getStore().updateDropStatus(a, dropId.toLowerCase(), status, isRollback ? null : txHash)
  })
}

export async function allocateStats(address: string, allocations: Partial<Record<StatKey, number>>): Promise<Player> {
  const a = normalizeAddress(address)
  return withAddressLock(a, async () => {
    const store = getStore()
    const player = await store.getPlayer(a)
    if (!player) throw new GameError('PLAYER_NOT_FOUND')
    try {
      applyAllocation(player, allocations)
    } catch (err) {
      throw new GameError(err instanceof Error ? err.message : 'INVALID_ALLOCATION')
    }
    await store.savePlayer(player)
    return player
  })
}

export interface SyncResult {
  player: Player
  live: CombatAggregates | null
  offline: OfflineAggregates | null
  demoMode: boolean
  /** current zone for the scene/UI (ENG3): id + display name */
  zoneId: string
  zoneName: string
}

/**
 * Advance a player to `nowMs`. First LIVE_WINDOW seconds of elapsed time run the tick simulation,
 * the remainder settles rate-based (capped at 12h). Each sync bumps sessionCounter and re-seeds a
 * deterministic rng from (address, sessionCounter), then persists player + any new Drop records.
 */
export async function syncPlayer(address: string, nowMs: number = Date.now()): Promise<SyncResult> {
  const a = normalizeAddress(address)
  return withAddressLock(a, async () => {
    const store = getStore()
    let player = await store.getPlayer(a)
    if (!player) throw new GameError('PLAYER_NOT_FOUND')

    if (player.control?.mode === 'manual') {
      player.control = advanceMovement(player.control, nowMs)
      const manual = advanceManualCombat(player, nowMs)
      player = manual.player
      await saveRolls(store, player, manual.aggregates?.drops ?? [], nowMs)
      await store.savePlayer(player)
      return {
        player,
        live: manual.aggregates,
        offline: null,
        demoMode,
        zoneId: player.mapId,
        zoneName: getMap(player.mapId).name,
      }
    }

    const elapsedMs = nowMs - player.lastSyncedAt
    if (elapsedMs < 1000) {
      return { player, live: null, offline: null, demoMode, zoneId: player.mapId, zoneName: getMap(player.mapId).name }
    }

    const rng = nextRng(player)
    const opts = engineOpts()

    const elapsedSec = Math.floor(elapsedMs / 1000)
    const liveTicks = Math.min(elapsedSec, LIVE_WINDOW)
    let live: CombatAggregates | null = null
    let offline: OfflineAggregates | null = null

    if (liveTicks > 0) {
      const res = simulateLive(player, liveTicks, rng, opts)
      player = res.player
      live = res.aggregates
    }
    const offlineSeconds = elapsedSec - LIVE_WINDOW
    if (offlineSeconds > 0) {
      const res = settleOffline(player, offlineSeconds, rng, opts)
      player = res.player
      offline = res.aggregates
    }

    // D1: batch-persist at most MAX_DROPS_PER_SYNC drops (rarest first) in ONE store write
    const rolled = [...(live?.drops ?? []), ...(offline?.drops ?? [])]
    await saveRolls(store, player, rolled, nowMs)

    // advance only by the whole seconds actually simulated — the sub-second remainder carries
    // to the next poll, so frequent pollers (two tabs) don't shave progress every cycle
    player.lastSyncedAt += elapsedSec * 1000
    await store.savePlayer(player)
    return { player, live, offline, demoMode, zoneId: player.mapId, zoneName: getMap(player.mapId).name }
  })
}

/** Apply one monotonic, server-authoritative control command. */
export async function applyGameAction(
  address: string,
  sequence: number,
  action: GameAction,
  nowMs: number = Date.now(),
): Promise<GameActionResponse> {
  const a = normalizeAddress(address)
  return withAddressLock(a, async () => {
    const store = getStore()
    let player = await store.getPlayer(a)
    if (!player) throw new GameError('PLAYER_NOT_FOUND')

    const currentSequence = player.control?.sequence ?? 0
    if (!Number.isSafeInteger(sequence) || sequence !== currentSequence + 1) {
      const drops = (await store.listDrops(a)).slice().sort((x, y) => y.droppedAt - x.droppedAt)
      return {
        player,
        drops,
        result: { accepted: false, reason: 'STALE_SEQUENCE', sequence: currentSequence },
        demoMode,
      }
    }

    // A legacy/auto player settles through the unchanged engine before entering manual mode.
    const wasAuto = (player.control?.mode ?? 'auto') === 'auto'
    if (wasAuto) {
      const elapsedMs = nowMs - player.lastSyncedAt
      if (elapsedMs >= 1000) {
        const elapsedSec = Math.floor(elapsedMs / 1000)
        const rng = nextRng(player)
        const opts = engineOpts()
        const liveTicks = Math.min(elapsedSec, LIVE_WINDOW)
        const rolled: CombatAggregates['drops'] = []
        if (liveTicks > 0) {
          const live = simulateLive(player, liveTicks, rng, opts)
          player = live.player
          rolled.push(...live.aggregates.drops)
        }
        const offlineSeconds = elapsedSec - LIVE_WINDOW
        if (offlineSeconds > 0) {
          const offline = settleOffline(player, offlineSeconds, rng, opts)
          player = offline.player
          rolled.push(...offline.aggregates.drops)
        }
        await saveRolls(store, player, rolled, nowMs)
        player.lastSyncedAt += elapsedSec * 1000
      }
    } else {
      player.control = advanceMovement(player.control!, nowMs)
      player = advanceManualCombat(player, nowMs).player
    }

    let result: GameActionResult = { accepted: true, sequence }
    if (action.type === 'move' && action.direction === 0 && wasAuto) {
      const control = player.control ?? { ...initialControl(nowMs), mode: 'auto' as const }
      player.control = {
        ...advanceMovement(control, nowMs),
        mode: 'auto',
        direction: 0,
        moveUntil: nowMs,
        sequence,
        updatedAt: nowMs,
      }
    } else if (action.type === 'potion') {
      const control = player.control ?? { ...initialControl(nowMs), mode: 'auto' as const }
      player.control = { ...advanceMovement(control, nowMs), sequence, updatedAt: nowMs }
      const potions = player.inventory[POTION_ITEM_ID] ?? 0
      const hp = player.combat?.hp ?? maxHp(player)
      if (potions <= 0) {
        result = { accepted: false, reason: 'NO_ITEM', sequence }
      } else if (hp <= 0 || player.combat?.reviveIn !== undefined) {
        result = { accepted: false, reason: 'KNOCKED_OUT', sequence }
      } else if (hp >= maxHp(player)) {
        result = { accepted: false, reason: 'FULL_HP', sequence }
      } else {
        const healedHp = Math.min(maxHp(player), hp + maxHp(player) * POTION_HEAL_FRAC)
        player.inventory[POTION_ITEM_ID] = potions - 1
        player.combat = { ...player.combat!, hp: healedHp }
        result = { accepted: true, healing: healedHp - hp, sequence }
      }
    } else if (action.type === 'mode' && action.mode === 'auto') {
      const control = player.control ?? initialControl(nowMs, sequence)
      player.control = { ...advanceMovement(control, nowMs), mode: 'auto', direction: 0, moveUntil: nowMs, sequence }
    } else {
      const control = player.control ?? initialControl(nowMs)
      player.control = { ...control, mode: 'manual', direction: 0, moveUntil: nowMs, sequence, updatedAt: nowMs }

      if (action.type === 'move') {
        player.control = leaseMovement(player.control, action.direction, nowMs, sequence)
      } else if (action.type === 'attack') {
        if (Math.abs(player.control.x - MANUAL_TARGET_X) > MANUAL_ATTACK_RANGE) {
          result = { accepted: false, reason: 'OUT_OF_RANGE', sequence }
        } else {
          const attack = simulateLive(player, 0, nextRng(player), engineOpts(), {
            autoAttack: false,
            manualAttack: true,
            autoHeal: false,
            enemyCanAttack: true,
          })
          player = attack.player
          player.control = { ...control, mode: 'manual', sequence, updatedAt: nowMs }
          await saveRolls(store, player, attack.aggregates.drops, nowMs)
          const feedback = attack.manualAttack
          result = feedback?.attempted
            ? {
                accepted: true,
                damage: feedback.damage,
                crit: feedback.crit,
                miss: feedback.miss,
                killed: feedback.killed,
                targetId: feedback.targetId,
                sequence,
              }
            : {
                accepted: false,
                reason: feedback?.reason ?? 'NO_TARGET',
                targetId: feedback?.targetId,
                sequence,
              }
        }
      }
    }

    await store.savePlayer(player)
    const drops = (await store.listDrops(a)).slice().sort((x, y) => y.droppedAt - x.droppedAt)
    return { player, drops, result, demoMode }
  })
}
