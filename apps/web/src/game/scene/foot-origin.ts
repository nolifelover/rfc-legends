import type Phaser from 'phaser'

const footOrigins = new WeakMap<Phaser.Textures.Texture, number>()

/** Ignore transparent padding so the visible feet, rather than the image edge, touch the deck. */
export function alphaFootOrigin(pixels: Uint8ClampedArray, width: number, height: number): number {
  if (width <= 0 || height <= 0 || pixels.length < width * height * 4) return 1
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] >= 64) return (y + 1) / height
    }
  }
  return 1
}

/** Read each loaded or generated texture once. A missing/unreadable texture keeps the normal origin. */
export function visibleFootOrigin(scene: Phaser.Scene, key: string): number {
  const texture = scene.textures.get(key)
  const cached = footOrigins.get(texture)
  if (cached !== undefined) return cached
  let origin = 1
  try {
    const source = texture.getSourceImage()
    if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) {
      const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width
      const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height
      if (width > 0 && height > 0) {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (context) {
          context.drawImage(source, 0, 0)
          origin = alphaFootOrigin(context.getImageData(0, 0, width, height).data, width, height)
        }
      }
    }
  } catch {
    // Failed assets still use their code-drawn stand-in without blocking scene creation.
  }
  footOrigins.set(texture, origin)
  return origin
}
