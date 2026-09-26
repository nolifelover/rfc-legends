import { describe, expect, it } from "vitest"
import { remainingToastMs, TOAST_VISIBLE_MS } from "./drop-toast-timing"

describe("drop toast timing", () => {
  it("keeps one absolute expiry across frequent parent re-renders", () => {
    const firstVisibleAt = 10_000
    const expiresAt = firstVisibleAt + TOAST_VISIBLE_MS

    expect(remainingToastMs(expiresAt, firstVisibleAt)).toBe(4_000)
    expect(remainingToastMs(expiresAt, firstVisibleAt + 1_000)).toBe(3_000)
    expect(remainingToastMs(expiresAt, firstVisibleAt + 3_950)).toBe(50)
    expect(remainingToastMs(expiresAt, firstVisibleAt + 4_100)).toBe(0)
  })
})
