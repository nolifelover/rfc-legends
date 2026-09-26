/**
 * Tiny in-memory sliding-window limiter for the guild routes. One process,
 * one map — enough for the vertical slice and keeps PocketBase simple.
 */
import 'server-only'

type Hit = { times: number[] }

const buckets = new Map<string, Hit>()

/** True when the action is allowed; also records the attempt when it is. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key) ?? { times: [] }
  bucket.times = bucket.times.filter((t) => now - t < windowMs)
  if (bucket.times.length >= max) {
    buckets.set(key, bucket)
    return false
  }
  bucket.times.push(now)
  buckets.set(key, bucket)
  if (buckets.size > 10_000) {
    // crude memory guard for a long-lived process
    for (const [k, v] of buckets) {
      if (v.times.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }
  return true
}
