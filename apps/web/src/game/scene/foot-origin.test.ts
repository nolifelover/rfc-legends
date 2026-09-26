import { describe, expect, it } from 'vitest'
import { alphaFootOrigin } from './foot-origin'

describe('visible bridge contact', () => {
  it('anchors padded art to its last solid foot row and ignores a faint shadow', () => {
    const pixels = new Uint8ClampedArray(4 * 10 * 4)
    pixels[(7 * 4 + 2) * 4 + 3] = 255
    pixels[(9 * 4 + 2) * 4 + 3] = 20
    const origin = alphaFootOrigin(pixels, 4, 10)
    expect(origin).toBe(0.8)
    const bridgeY = 642
    const renderedFootY = bridgeY + (0.8 - origin) * 480
    expect(renderedFootY).toBe(bridgeY)
  })

  it('keeps the normal origin for art drawn to the edge and empty fallback data', () => {
    const pixels = new Uint8ClampedArray(2 * 2 * 4)
    pixels[pixels.length - 1] = 255
    expect(alphaFootOrigin(pixels, 2, 2)).toBe(1)
    expect(alphaFootOrigin(new Uint8ClampedArray(16), 2, 2)).toBe(1)
    expect(alphaFootOrigin(new Uint8ClampedArray(), 0, 0)).toBe(1)
  })
})
