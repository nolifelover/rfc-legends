export const TOAST_VISIBLE_MS = 4_000

/**
 * Return the time left before a toast's fixed deadline. Re-rendering cannot
 * extend its lifetime because every new timer uses the original `expiresAt`.
 */
export function remainingToastMs(expiresAt: number, now = Date.now()): number {
  return Math.max(0, expiresAt - now)
}
