// Art direction for the Home Fields scene (read this before touching any FX):
//
// - Zone hue: a golden rice field at harvest. The backdrop is warm and slightly
//   flattened by a grade rect; actors keep full saturation and the #2B1B12 outline.
// - Camera sits low: the horizon at ~35% of the frame, feet at ~78%, sky ≤ 20%.
//   Actors are big (trainer ~400px on a 1080 frame, the rooster 1.2× taller — it is
//   the hero of the pitch, not a prop).
// - Motion vocabulary: anticipation → strike → overshoot recovery (Back.easeOut).
//   Hit-stop on every impact, victims vibrate during the freeze, then knock back
//   and squash. Nothing moves linearly. Durations vary with weight: 45ms for a
//   tap, 260ms for a boss kill, ~1s of slow-mo for a card drop.
// - Scale: effects at player scale or larger. Text slams for events. Numbers must
//   stay readable at 320×180.
// - Every reward travels to a visible counter and the counter visibly changes by
//   exactly what the server granted. Nothing on screen invents a server number.
// - Personality: the rooster crouches, dashes, leaves afterimages and pulses when a
//   level is close.
// - Hard rules: cartoon only (pests go "poof", no blood or injury), the rooster
//   guards the rice field from pests and never fights another rooster, no gambling
//   framing, nothing that looks like a card flip or a pack opening.
//
// Every timing, colour and layout number lives here so tuning is one edit.

/** Stage geometry on the 1920×1080 internal frame. */
export const LAYOUT = {
  W: 1920,
  H: 1080,
  /** In-canvas chips stay inside this inset so a rounded/clipped frame never cuts them. */
  SAFE: 48,
  /** Top-right chip block: damage numbers never rise into it. */
  NO_SPAWN_X: 1360,
  NO_SPAWN_Y: 330,
  /** Top of the paddy water — the horizon line (35%). */
  HORIZON_Y: 378,
  /** Top of the clay lane where everyone stands. */
  GROUND_Y: 660,
  /** Pest lanes (back → front): feet lines, draw scale and where each leader stops. */
  FEET_BACK: 796,
  FEET_MID: 838,
  FEET_FRONT: 880,
  BACK_SCALE: 0.8,
  MID_SCALE: 0.9,
  ENGAGE_FRONT_X: 1150,
  ENGAGE_MID_X: 1260,
  ENGAGE_BACK_X: 1370,
  /** Spacing between queued pests behind the leader. */
  PACK_GAP: 215, // minimum spacing per lane so pests never blob
  SPAWN_X: 2020,
  PACK_MIN: 7,
  PACK_MAX: 10,
  WALK_SPEED: 420, // px/s while advancing
  /** Heroes. */
  TRAINER_X: 290,
  TRAINER_FEET: 862,
  TRAINER_H: 400,
  ROOSTER_X: 840,
  ROOSTER_FEET: 886,
  ROOSTER_H: 480,
  /** Where loot icons come to rest before flying to the Harvest chip. */
  LOOT_REST_Y: 905,
  /** Display heights per pest id (front row). */
  PEST_H: { 'nu-na': 260, 'takka-taen-yak': 290, 'pu-na': 230, 'raja-nu-na': 660 } as Record<string, number>,
} as const

/** Timings in ms, shake tuples as [duration, intensity], distances in px. */
export const JUICE = {
  // hit-stop (near-freeze). Juicy Breakout's slider range is 0–320.
  STOP_HIT: 45,
  STOP_CRIT: 85,
  STOP_KILL: 110,
  STOP_BOSS_LAND: 120,
  STOP_BOSS_KILL: 260,
  FREEZE_SCALE: 0.02,
  JITTER: 5, // victim vibration during hit-stop (±px)
  // camera.shake(duration, intensity); intensity is a fraction of the view (0.002 ≈ 4px at 1920)
  SHAKE_CRIT: [110, 0.002] as const,
  SHAKE_KILL: [140, 0.003] as const,
  SHAKE_BOSS_LAND: [260, 0.008] as const,
  SHAKE_BOSS_KILL: [420, 0.012] as const,
  KNOCK: 36,
  KNOCK_CRIT: 60,
  // attack phases
  WINDUP: 90,
  STRIKE: 80,
  HOLD: 120, // impact pose held so a still at any moment shows the hit
  RECOVER: 220,
  IMPACT_MS: 220, // white starburst on the target
  FLINCH_MS: 110, // white tint on the victim
  STRIKE_DX: 160, // trainer lunge
  THROW_MS: 190, // seed bag flight to the target
  DASH: 110, // rooster dash to the target
  DASH_BACK: 300,
  CROUCH: 70,
  // cadence (per attacker; the two alternate, so a swing lands every 0.5–0.8s)
  ATTACK_MIN: 1000,
  ATTACK_MAX: 1600,
  // slash arc
  SLASH_R0: 70,
  SLASH_R1: 190,
  SLASH_ARC_DEG: 120,
  SLASH_MS: 150,
  // damage numbers
  DMG_RISE_MIN: 80,
  DMG_RISE_MAX: 120,
  DMG_JITTER_X: 30,
  DMG_SPLIT_X: 90, // trainer numbers left of centre, rooster numbers right
  DMG_MS: 600,
  DMG_ABOVE_HEAD: 20,
  DMG_STACK_WINDOW: 700, // hits closer than this stack in a column (up to 5)
  DMG_STACK_MAX: 5,
  // loot flow
  LOOT_ARC_MIN: 150,
  LOOT_ARC_MAX: 250,
  LOOT_ARC_MS: 480,
  LOOT_REST: 1200, // common loot rests on the ground (stills should catch it)
  LOOT_REST_RARE: 2000, // rare / epic hold under their beam
  COIN_REST: 520,
  COINS_MIN: 2,
  COINS_MAX: 5,
  LOOT_FLY: 500,
  LOOT_STAGGER: 60,
  LOOT_QUEUE_CAP: 30,
  SWEEP_MIN: 3000, // resting coins and commons fly to the chips on a periodic sweep
  SWEEP_MAX: 4000,
  REST_CAP: 28, // more resting loot than this sweeps the oldest at once
  // ceremonies
  JACKPOT_SLOWMO: 0.25,
  JACKPOT_SLOWMO_MS: 1000,
  JACKPOT_THROTTLE: 8000,
  PILLAR_MS: 900,
  LEVELUP_SLOWMO: 0.3,
  LEVELUP_SLOWMO_MS: 400,
  BOSS_WARN_MS: 1200,
  BOSS_DROP_MS: 520,
  BOSS_EVERY_DEMO: 8,
  BOSS_EVERY: 25,
  // kill counter credit: snap the shown number up when it lags the server by more
  KILL_SNAP_LAG: 4,
} as const

/** Colour-by-source language. Text colours are CSS strings, tints are numbers. */
export const INK = {
  trainer: '#ffffff',
  rooster: '#ff6a2a',
  crit: '#ffd24a',
  exp: '#ffd24a',
  loot: '#b6f07a',
  hurt: '#ff6b5b',
  stroke: '#2b1b12',
  cream: '#fff3d6',
  gold: 0xffd24a,
  goldSoft: 0xffe9a8,
  plate: 0x3d2817,
  outline: 0x2b1b12,
  grade: 0xffcf8a,
  dim: 0x120b06,
  warn: 0x7a1f14,
  roosterTint: 0xff6a2a,
  expTint: 0x7ee0ff,
  lootTint: 0xb6f07a,
} as const

/**
 * Zone variants keyed by the server's `player.mapId`: backdrop tints, props and
 * pest skins (zone 2 reuses the zone-1 shapes with new tints until its SVGs land).
 */
export interface ZoneSkin {
  key: string
  tint?: number
  h: number
}
export interface ZoneSpec {
  en: string
  grade: number
  gradeAlpha: number
  skyTint: number
  hillsTint: number
  paddyTint: number
  groundTint: number
  lotus: boolean
  walkway: boolean
  /** water-shimmer tint (gold glints on the pond) */
  glint: number
  names: Record<string, string>
  skins: Record<string, ZoneSkin>
  bossId: string
}
export const ZONES: Record<string, ZoneSpec> = {
  'thung-na': {
    en: 'Home Fields',
    grade: 0xffcf8a,
    gradeAlpha: 0.14,
    skyTint: 0xffffff,
    hillsTint: 0xffffff,
    paddyTint: 0xffffff,
    groundTint: 0xffffff,
    lotus: false,
    walkway: false,
    glint: 0xffffff,
    names: { 'nu-na': 'Field Rat', 'takka-taen-yak': 'Giant Locust', 'pu-na': 'Rice Crab', 'raja-nu-na': 'Rat King' },
    skins: {
      'nu-na': { key: 'art-monster-nu-na', h: 260 },
      'takka-taen-yak': { key: 'art-monster-takka-taen-yak', h: 290 },
      'pu-na': { key: 'art-monster-pu-na', h: 230 },
      'raja-nu-na': { key: 'art-monster-raja-nu-na', h: 660 },
    },
    bossId: 'raja-nu-na',
  },
  // dusk lotus pond: purple-orange sky, deep green water, gold glints, a walkway
  'bueng-bua': {
    en: 'Royal Lotus Pond',
    grade: 0x8a4fb0,
    gradeAlpha: 0.2,
    skyTint: 0xffb08a,
    hillsTint: 0x6f8f8a,
    paddyTint: 0x3f8f5a,
    groundTint: 0x8f8470,
    lotus: true,
    walkway: true,
    glint: 0xffd24a,
    names: {
      'hoi-cherry': 'Golden Apple Snail',
      'phak-tob-chawai-yak': 'Giant Water Hyacinth',
      'pla-chon-yak': 'Giant Snakehead',
      'jorakhe-thao-bueng': 'Old Pond Crocodile',
    },
    // the art lane's own SVGs (no tint); heights on the 1080 frame
    skins: {
      'hoi-cherry': { key: 'art-monster-hoi-cherry', h: 250 },
      'phak-tob-chawai-yak': { key: 'art-monster-phak-tob-chawai-yak', h: 300 },
      'pla-chon-yak': { key: 'art-monster-pla-chon-yak', h: 300 },
      'jorakhe-thao-bueng': { key: 'art-monster-jorakhe-thao-bueng', h: 680 },
    },
    bossId: 'jorakhe-thao-bueng',
  },
}
export const zoneOf = (mapId: string): ZoneSpec => ZONES[mapId] ?? ZONES['thung-na']

/** Bloodline accent tints for the rooster's aura ring (5 sire lines). */
export const SIRE_TINT: Record<string, number> = {
  kumarnjeen: 0xff8a3d,
  kingkong: 0x8a5a33,
  chaokhunthong: 0xffd24a,
  thepbut: 0xfff3d6,
  raptor: 0x9ccc65,
}

/** Font sizes on the 1080 frame. */
export const TYPE = {
  dmgTrainer: 64,
  dmgRooster: 56,
  dmgCritMult: 1.4,
  exp: 44,
  lootTick: 30,
  plateTrainer: 30,
  plateRooster: 26,
  platePest: 24,
  chip: 28,
  slam: 88,
  slamSub: 36,
  bossName: 30,
} as const

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

/** 44,000 → "44K", 3,200,000 → "3.2M"; below 10,000 stays exact with separators. */
export function fmt(n: number): string {
  const v = Math.round(n)
  return v >= 10_000 ? compact.format(v) : v.toLocaleString('en-US')
}
