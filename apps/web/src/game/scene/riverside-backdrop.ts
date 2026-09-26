import type Phaser from 'phaser'
import { LAYOUT as L } from './juice'

/** Extend only the outer sky/water edges; never repeat the skyline or moon. */
export function riversidePortraitBackdrop(scene: Phaser.Scene): Phaser.GameObjects.Image[] {
  const width = 768
  const height = 384
  for (const water of [false, true]) {
    const key = water ? 'river-water-extension' : 'river-sky-extension'
    if (scene.textures.exists(key)) continue
    const source = scene.textures.get(water ? 'river-water-boardwalk' : 'river-sky').getSourceImage() as HTMLImageElement | HTMLCanvasElement
    const texture = scene.textures.createCanvas(key, width, height)
    if (!texture) continue
    const ctx = texture.context
    const strip = Math.min(24, source.height)
    const fill = ctx.createLinearGradient(0, 0, 0, height)
    fill.addColorStop(0, water ? '#193f50' : '#102b43')
    fill.addColorStop(1, water ? '#112f3e' : '#153955')
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, width, height)
    ctx.save()
    ctx.translate(0, water ? strip : height)
    ctx.scale(1, -1)
    // Reflection at the outermost edge keeps the boundary pixel continuous.
    // A gradient below suppresses any visible repetition further from it.
    ctx.drawImage(source, 0, water ? source.height - strip : 0, source.width, strip, 0, 0, width, strip)
    ctx.restore()
    const fade = ctx.createLinearGradient(0, water ? 0 : height - strip, 0, water ? strip : height)
    if (water) {
      fade.addColorStop(0, 'rgba(25,63,80,0)')
      fade.addColorStop(1, '#193f50')
    } else {
      fade.addColorStop(0, '#153955')
      fade.addColorStop(1, 'rgba(21,57,85,0)')
    }
    ctx.fillStyle = fade
    ctx.fillRect(0, water ? 0 : height - strip, width, strip)
    if (water) {
      // Quiet painterly ripples carry the same cool reflections into portrait.
      for (let row = 0; row < 28; row++) {
        const y = 28 + row * 13
        for (let col = 0; col < 14; col++) {
          const x = col * 61 + Math.sin(row * 2.3 + col) * 22
          ctx.strokeStyle = col > 3 && col < 10 ? 'rgba(183,199,160,.14)' : 'rgba(104,151,158,.18)'
          ctx.lineWidth = 1 + (row % 3) * 0.35
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.quadraticCurveTo(x + 9, y - 2, x + 22 + Math.sin(col) * 9, y)
          ctx.stroke()
        }
      }
      for (const [x, y, r] of [[45, 175, 30], [18, 238, 42], [99, 272, 26], [722, 189, 35], [760, 279, 48], [683, 330, 32]]) {
        ctx.fillStyle = '#284d47'
        ctx.beginPath()
        ctx.ellipse(x, y, r, r * 0.24, -0.12, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(156,171,111,.4)'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(x - r, y)
        ctx.lineTo(x + r * 0.7, y - 3)
        ctx.stroke()
      }
    }
    texture.refresh()
  }
  return [
    scene.add.image(0, -960, 'river-sky-extension').setOrigin(0).setDisplaySize(L.W, 960).setDepth(-0.5),
    scene.add.image(0, L.H - 1, 'river-water-extension').setOrigin(0).setDisplaySize(L.W, 960).setDepth(4),
  ]
}
