// Deterministic RNG — the whole engine must replay identically from a seed.
// No Date.now, no network, no fs in here. GDD §4.1 (server-authoritative).

export type Rng = () => number // uniform in [0, 1)

/** mulberry32: tiny, fast, decent-quality 32-bit PRNG. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

/** FNV-1a-ish hash over the joined parts → uint32. Stable across processes. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = FNV_OFFSET
  const s = parts.join('|')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, FNV_PRIME)
  }
  return h >>> 0
}

/** Deterministic bytes32-style hex id (64 hex chars) for drop records. */
export function hashToBytes32(...parts: (string | number)[]): `0x${string}` {
  const base = hashSeed(...parts)
  let out = '0x'
  for (let i = 0; i < 8; i++) {
    out += hashSeed('drop32', base, i).toString(16).padStart(8, '0')
  }
  return out as `0x${string}`
}
