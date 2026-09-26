// Art pipeline for the idle scene.
//
// Every asset is an SVG in /public/assets (committed by the art lane) loaded
// with `load.svg(key, url, { width, height })`. Every asset ALSO has a
// code-drawn fallback (Phaser Graphics → generateTexture): if the SVG is
// missing or fails to load, the scene swaps in the fallback so it never looks
// broken. FX textures (stars, glows, clouds, birds…) are always generated.

import Phaser from 'phaser'
import type { Rarity } from '../types'

export const OUTLINE = 0x2b1b12 // matches the #2B1B12 stroke every SVG uses
export const INK_TEXT = '#2b1b12'

export const RARITY_COLORS: Record<Rarity, number> = {
  common: 0x8a9a5b,
  rare: 0x3b82c4,
  epic: 0x8b5cf6,
  legendary: 0xb45309,
  monster_card: 0x7c3aed,
  mvp_card: 0xdc2626,
}

export const RARITY_HEX: Record<Rarity, string> = {
  common: '#8a9a5b',
  rare: '#3b82c4',
  epic: '#8b5cf6',
  legendary: '#b45309',
  monster_card: '#7c3aed',
  mvp_card: '#dc2626',
}

export interface ArtSpec {
  key: string
  url: string
  /** SVG rasterization size — 2× display keeps sprites crisp under FIT upscale. */
  w: number
  h: number
  /** Fallback texture size in design units (defaults to w/h). */
  fb?: [number, number]
  /** Code-drawn stand-in with dark outlines, used only when the SVG is gone. */
  draw: (g: Phaser.GameObjects.Graphics) => void
}

// --- shared draw helpers (fallback style: flat cartoon shapes + dark outline) ---

function pill(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  r = 8,
): void {
  g.fillStyle(fill)
  g.fillRoundedRect(x, y, w, h, r)
  g.lineStyle(3, OUTLINE)
  g.strokeRoundedRect(x, y, w, h, r)
}

function dot(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, fill: number): void {
  g.fillStyle(fill)
  g.fillCircle(x, y, r)
}

function outlinedDot(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  fill: number,
): void {
  g.fillStyle(fill)
  g.fillCircle(x, y, r)
  g.lineStyle(3, OUTLINE)
  g.strokeCircle(x, y, r)
}

function blob(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
): void {
  g.fillStyle(fill)
  g.fillEllipse(x, y, w, h)
  g.lineStyle(3, OUTLINE)
  g.strokeEllipse(x, y, w, h)
}

function stroke(
  g: Phaser.GameObjects.Graphics,
  pts: Array<[number, number]>,
  color: number,
  width = 4,
): void {
  g.lineStyle(width, OUTLINE)
  g.beginPath()
  g.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1])
  g.strokePath()
  g.lineStyle(width - 1.4, color)
  g.beginPath()
  g.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1])
  g.strokePath()
}

function tuft(g: Phaser.GameObjects.Graphics, x: number, y: number, s = 1): void {
  stroke(g, [[x, y], [x - 5 * s, y - 10 * s]], 0x55803c, 3)
  stroke(g, [[x, y], [x, y - 13 * s]], 0x7cb342, 3)
  stroke(g, [[x, y], [x + 6 * s, y - 9 * s]], 0x9ccc65, 3)
}

// --- fallback artists ---

function drawSky(g: Phaser.GameObjects.Graphics): void {
  // warm gold → pale blue, read top-down
  g.fillGradientStyle(0xa6d3e4, 0xa6d3e4, 0xf7ce79, 0xf7ce79, 1)
  g.fillRect(0, 0, 960, 540)
  g.fillStyle(0xfff3c9, 0.5)
  g.fillCircle(806, 108, 96)
  g.fillStyle(0xfff3c9, 0.55)
  g.fillCircle(806, 108, 64)
}

function drawHills(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xa9c4a0)
  g.fillEllipse(150, 150, 460, 190)
  g.fillEllipse(490, 138, 540, 210)
  g.fillEllipse(840, 150, 480, 190)
  g.fillStyle(0x8fae86)
  g.fillEllipse(300, 196, 640, 200)
  g.fillEllipse(780, 196, 680, 200)
}

function drawPaddy(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x8fbfa8)
  g.fillRect(0, 0, 960, 140)
  g.fillStyle(0x9fd0c0)
  g.fillRect(0, 8, 960, 56)
  g.fillStyle(0x6f9c88)
  g.fillRect(0, 0, 960, 8)
  g.fillStyle(0x74a68e)
  g.fillRect(0, 118, 960, 22)
  for (let x = 20; x < 960; x += 58) tuft(g, x, 132, 1.1)
  for (let x = 48; x < 960; x += 74) tuft(g, x, 86, 0.9)
}

function drawGround(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xb98a5f)
  g.fillRect(0, 0, 960, 120)
  g.fillStyle(0xcaa273)
  g.fillRect(0, 0, 960, 10)
  g.fillStyle(0x9c7248)
  g.fillRect(0, 98, 960, 22)
  for (const x of [70, 210, 335, 560, 700, 905]) tuft(g, x, 14, 0.9)
  g.fillStyle(0xcaa273)
  for (const [x, y] of [[130, 46], [420, 66], [640, 40], [840, 60]] as const) g.fillEllipse(x, y, 18, 10)
}

function drawTrainer(g: Phaser.GameObjects.Graphics): void {
  // legs + feet
  stroke(g, [[44, 62], [40, 84]], 0x6b4a32, 9)
  stroke(g, [[54, 62], [58, 84]], 0x6b4a32, 9)
  pill(g, 32, 82, 14, 8, 0x8a5a33, 4)
  pill(g, 52, 82, 14, 8, 0x8a5a33, 4)
  // torso (green vest)
  pill(g, 32, 40, 34, 30, 0x4e7a3a, 10)
  // arms
  stroke(g, [[34, 46], [24, 64]], 0xe5a76b, 8)
  stroke(g, [[64, 46], [74, 64]], 0xe5a76b, 8)
  outlinedDot(g, 24, 66, 5, 0xe5a76b)
  outlinedDot(g, 74, 66, 5, 0xe5a76b)
  // head
  outlinedDot(g, 49, 28, 13, 0xe5a76b)
  dot(g, 44, 27, 1.8, OUTLINE)
  dot(g, 54, 27, 1.8, OUTLINE)
  stroke(g, [[46, 33], [52, 33]], 0xb97a56, 3)
  // straw hat
  g.fillStyle(0xd9b45c)
  g.fillEllipse(49, 20, 46, 12)
  g.lineStyle(3, OUTLINE)
  g.strokeEllipse(49, 20, 46, 12)
  g.fillStyle(0xd9b45c)
  g.fillEllipse(49, 15, 24, 14)
  g.lineStyle(3, OUTLINE)
  g.strokeEllipse(49, 15, 24, 14)
}

function drawRooster(body: number, tail: number) {
  return (g: Phaser.GameObjects.Graphics): void => {
    // tail feathers
    stroke(g, [[26, 46], [8, 22]], tail, 6)
    stroke(g, [[24, 50], [4, 34]], tail, 6)
    // body
    blob(g, 40, 50, 44, 36, body)
    // head
    outlinedDot(g, 56, 30, 13, body)
    // comb
    dot(g, 52, 17, 4.4, 0xd2452f)
    dot(g, 58, 15, 4.6, 0xd2452f)
    dot(g, 63, 18, 4, 0xd2452f)
    g.lineStyle(2.4, OUTLINE)
    g.strokeCircle(52, 17, 4.4)
    g.strokeCircle(58, 15, 4.6)
    g.strokeCircle(63, 18, 4)
    // beak
    g.fillStyle(0xe8a13c)
    g.fillTriangle(67, 30, 78, 33, 67, 37)
    g.lineStyle(2.6, OUTLINE)
    g.strokeTriangle(67, 30, 78, 33, 67, 37)
    dot(g, 59, 28, 2, OUTLINE)
    dot(g, 60, 27, 0.8, 0xffffff)
    // wing
    g.fillStyle(tail)
    g.fillEllipse(38, 52, 22, 14)
    g.lineStyle(2.6, OUTLINE)
    g.strokeEllipse(38, 52, 22, 14)
    // legs
    stroke(g, [[38, 67], [36, 78]], 0xe8a13c, 5)
    stroke(g, [[48, 67], [50, 78]], 0xe8a13c, 5)
  }
}

function drawNuNa(g: Phaser.GameObjects.Graphics): void {
  // tail
  stroke(g, [[66, 56], [84, 40], [78, 26]], 0xd99a91, 7)
  blob(g, 44, 48, 56, 46, 0xa8a09b)
  g.fillStyle(0xd9d2cc)
  g.fillEllipse(46, 56, 34, 24)
  outlinedDot(g, 26, 22, 11, 0xa8a09b) // ear
  outlinedDot(g, 50, 18, 12, 0xa8a09b)
  dot(g, 22, 21, 3, 0xd99a91)
  dot(g, 50, 17, 3, 0xd99a91)
  dot(g, 40, 36, 2.4, OUTLINE)
  dot(g, 54, 36, 2.4, OUTLINE)
  dot(g, 42, 35, 0.9, 0xffffff)
  dot(g, 54, 35, 0.9, 0xffffff)
  dot(g, 47, 44, 3, 0xd98a80) // nose
  stroke(g, [[30, 68], [26, 78]], 0xa8a09b, 7)
  stroke(g, [[56, 68], [60, 78]], 0xa8a09b, 7)
}

function drawLocust(g: Phaser.GameObjects.Graphics): void {
  stroke(g, [[42, 16], [36, 4]], 0x7cb342, 4)
  stroke(g, [[48, 16], [54, 4]], 0x7cb342, 4)
  outlinedDot(g, 38, 6, 4, 0x9ccc65)
  outlinedDot(g, 52, 6, 4, 0x9ccc65)
  blob(g, 44, 48, 54, 48, 0x9ccc65)
  // wing shell
  g.fillStyle(0x7cb342)
  g.fillEllipse(52, 46, 30, 34)
  g.lineStyle(3, OUTLINE)
  g.strokeEllipse(52, 46, 30, 34)
  dot(g, 34, 36, 2.6, OUTLINE)
  dot(g, 34, 35, 1, 0xffffff)
  // hind legs
  stroke(g, [[30, 56], [16, 68], [24, 78]], 0x55803c, 5)
  stroke(g, [[58, 56], [72, 68], [64, 78]], 0x55803c, 5)
  stroke(g, [[40, 70], [40, 79]], 0x7cb342, 5)
  stroke(g, [[50, 70], [50, 79]], 0x7cb342, 5)
}

function drawCrab(g: Phaser.GameObjects.Graphics): void {
  blob(g, 40, 46, 50, 36, 0xd96a3c)
  // eye stalks
  stroke(g, [[32, 30], [28, 16]], 0xd96a3c, 5)
  stroke(g, [[48, 30], [52, 16]], 0xd96a3c, 5)
  outlinedDot(g, 28, 13, 6, 0xffffff)
  outlinedDot(g, 52, 13, 6, 0xffffff)
  dot(g, 28, 13, 2.4, OUTLINE)
  dot(g, 52, 13, 2.4, OUTLINE)
  // claws
  g.fillStyle(0xd96a3c)
  g.fillTriangle(14, 40, 2, 30, 6, 44)
  g.fillTriangle(66, 40, 78, 30, 74, 44)
  g.lineStyle(3, OUTLINE)
  g.strokeTriangle(14, 40, 2, 30, 6, 44)
  g.strokeTriangle(66, 40, 78, 30, 74, 44)
  // legs
  stroke(g, [[22, 58], [12, 68]], 0xc25a30, 5)
  stroke(g, [[36, 62], [32, 72]], 0xc25a30, 5)
  stroke(g, [[50, 62], [54, 72]], 0xc25a30, 5)
  stroke(g, [[60, 58], [70, 68]], 0xc25a30, 5)
  // smile
  stroke(g, [[34, 44], [40, 48], [46, 44]], 0x8c3a1e, 3)
}

function drawRaja(g: Phaser.GameObjects.Graphics): void {
  // aura
  g.fillStyle(0xffd766, 0.16)
  g.fillCircle(72, 76, 64)
  g.fillStyle(0xffd766, 0.14)
  g.fillCircle(72, 76, 52)
  // cape
  g.fillStyle(0x7a3040)
  g.fillTriangle(40, 60, 18, 124, 60, 116)
  g.fillTriangle(84, 60, 104, 128, 64, 116)
  g.lineStyle(3, OUTLINE)
  g.strokeTriangle(40, 60, 18, 124, 60, 116)
  g.strokeTriangle(84, 60, 104, 128, 64, 116)
  // portly royal body
  stroke(g, [[108, 92], [130, 70], [122, 54]], 0xd99a91, 10)
  blob(g, 72, 82, 88, 76, 0xa8a09b)
  g.fillStyle(0xd9d2cc)
  g.fillEllipse(76, 96, 54, 36)
  outlinedDot(g, 40, 38, 16, 0xa8a09b)
  outlinedDot(g, 80, 32, 17, 0xa8a09b)
  dot(g, 36, 37, 4.4, 0xd99a91)
  dot(g, 80, 31, 4.4, 0xd99a91)
  dot(g, 62, 62, 3.4, OUTLINE)
  dot(g, 84, 62, 3.4, OUTLINE)
  dot(g, 63, 61, 1.3, 0xffffff)
  dot(g, 85, 61, 1.3, 0xffffff)
  dot(g, 73, 74, 4.4, 0xd98a80)
  // crown
  g.fillStyle(0xffd766)
  g.fillTriangle(52, 22, 56, 6, 62, 20)
  g.fillTriangle(62, 20, 70, 2, 76, 19)
  g.fillTriangle(76, 19, 84, 6, 88, 22)
  g.fillRoundedRect(50, 20, 40, 8, 3)
  g.lineStyle(3, OUTLINE)
  g.strokeTriangle(52, 22, 56, 6, 62, 20)
  g.strokeTriangle(62, 20, 70, 2, 76, 19)
  g.strokeTriangle(76, 19, 84, 6, 88, 22)
  g.strokeRoundedRect(50, 20, 40, 8, 3)
  dot(g, 70, 10, 3, 0xdc2626)
}

function drawHayBale(g: Phaser.GameObjects.Graphics): void {
  stroke(g, [[20, 20], [14, 8]], 0xc99143, 3)
  stroke(g, [[32, 18], [32, 6]], 0xc99143, 3)
  stroke(g, [[44, 20], [50, 8]], 0xc99143, 3)
  pill(g, 8, 20, 48, 36, 0xd9b45c, 12)
  g.lineStyle(2.4, 0xb98d3e)
  g.strokeRoundedRect(14, 26, 36, 24, 8)
  stroke(g, [[20, 22], [20, 54]], 0xb98d3e, 3)
  stroke(g, [[44, 22], [44, 54]], 0xb98d3e, 3)
}

function drawScarecrow(g: Phaser.GameObjects.Graphics): void {
  pill(g, 29, 12, 6, 50, 0x9a6b43, 3)
  pill(g, 8, 24, 48, 6, 0xa9774c, 3)
  stroke(g, [[26, 58], [24, 63]], 0xc99143, 4)
  stroke(g, [[38, 58], [40, 63]], 0xc99143, 4)
  pill(g, 24, 12, 16, 16, 0xe5c98f, 6)
  dot(g, 29, 18, 1.6, OUTLINE)
  dot(g, 35, 18, 1.6, OUTLINE)
  g.fillStyle(0xd9b45c)
  g.fillEllipse(32, 10, 30, 9)
  g.lineStyle(2.6, OUTLINE)
  g.strokeEllipse(32, 10, 30, 9)
  stroke(g, [[8, 27], [2, 40]], 0xc99143, 4)
  stroke(g, [[56, 27], [62, 40]], 0xc99143, 4)
}

function drawJar(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x9d4728)
  g.fillEllipse(32, 57, 26, 9)
  g.lineStyle(3, OUTLINE)
  g.strokeEllipse(32, 57, 26, 9)
  g.fillStyle(0xb65d33)
  g.fillTriangle(14, 24, 6, 44, 18, 52)
  g.fillTriangle(50, 24, 58, 44, 46, 52)
  g.fillEllipse(32, 38, 40, 38)
  g.lineStyle(3, OUTLINE)
  g.strokeEllipse(32, 40, 40, 34)
  g.fillStyle(0x8c3a1e)
  g.fillEllipse(32, 22, 22, 8)
  g.lineStyle(3, OUTLINE)
  g.strokeEllipse(32, 22, 22, 8)
  g.lineStyle(2.4, 0x8c3a1e)
  g.strokeEllipse(32, 44, 28, 16)
}

function drawFence(g: Phaser.GameObjects.Graphics): void {
  pill(g, 4, 22, 56, 6, 0xa9774c, 2)
  pill(g, 4, 38, 56, 6, 0xa9774c, 2)
  for (const x of [6, 27, 48]) {
    pill(g, x, 14, 10, 44, 0xa9774c, 3)
    g.fillStyle(0xa9774c)
    g.fillTriangle(x, 14, x + 10, 14, x + 5, 6)
    g.lineStyle(2.6, OUTLINE)
    g.strokeTriangle(x, 14, x + 10, 14, x + 5, 6)
  }
}

function drawRiceBundle(g: Phaser.GameObjects.Graphics): void {
  stroke(g, [[32, 52], [22, 42], [16, 32]], 0x55803c, 3.4)
  stroke(g, [[32, 52], [42, 42], [48, 32]], 0x55803c, 3.4)
  for (const [dx, tip] of [[-20, 16], [-10, 8], [0, 6], [10, 8], [20, 16]] as const) {
    stroke(g, [[32, 52], [32 + dx * 0.6, 28], [32 + dx, tip]], 0xe3b341, 4)
  }
  stroke(g, [[32, 52], [32, 62]], 0x9a6b43, 5)
}

function drawItem(fill: number) {
  return (g: Phaser.GameObjects.Graphics): void => {
    pill(g, 8, 8, 32, 32, fill, 7)
    g.fillStyle(0xf7ecd2)
    g.fillRoundedRect(14, 14, 20, 20, 5)
    g.lineStyle(2.4, OUTLINE)
    g.strokeRoundedRect(14, 14, 20, 20, 5)
  }
}

// --- cloud fallbacks (cream puffs, warm-tinted undersides) ---

function drawCloudPuffy(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xfffdf6, 0.95)
  g.fillCircle(100, 62, 26)
  g.fillCircle(134, 50, 34)
  g.fillCircle(170, 64, 24)
  g.fillRoundedRect(74, 62, 122, 24, 12)
  g.fillStyle(0xf3e3c2, 0.85)
  g.fillRoundedRect(84, 76, 100, 10, 5)
}

function drawCloudStratus(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xfffdf6, 0.92)
  g.fillRoundedRect(20, 28, 220, 26, 13)
  g.fillCircle(90, 32, 18)
  g.fillCircle(150, 30, 20)
  g.fillCircle(200, 34, 15)
  g.fillStyle(0xf3e3c2, 0.8)
  g.fillRoundedRect(34, 44, 192, 9, 4.5)
}

function drawCloudTower(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xfffdf6, 0.95)
  g.fillCircle(75, 95, 26)
  g.fillCircle(75, 66, 30)
  g.fillCircle(75, 40, 24)
  g.fillRoundedRect(49, 86, 52, 24, 12)
  g.fillStyle(0xf3e3c2, 0.85)
  g.fillRoundedRect(53, 96, 44, 10, 5)
}

// --- the catalog ---

const A = (key: string, url: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void, fb?: [number, number]): ArtSpec =>
  ({ key, url, w, h, draw, fb })

export const TRAINER_KEY = 'art-trainer'
export const TRAINER_WALK_KEY = 'art-trainer-walk'
export const ROOSTER_KEYS: Record<string, string> = {
  kumarnjeen: 'art-rooster-kumarnjeen',
  kingkong: 'art-rooster-kingkong',
  chaokhunthong: 'art-rooster-chaokhunthong',
  thepbut: 'art-rooster-thepbut',
  raptor: 'art-rooster-raptor',
}
export const MONSTER_KEYS: Record<string, string> = {
  'nu-na': 'art-monster-nu-na',
  'takka-taen-yak': 'art-monster-takka-taen-yak',
  'pu-na': 'art-monster-pu-na',
  'raja-nu-na': 'art-monster-raja-nu-na',
}
export const itemKey = (id: number): string => `art-item-${id}`

export const CLOUD_KEYS = { puffy: 'art-cloud-1', stratus: 'art-cloud-2', tower: 'art-cloud-3' } as const

export const ART: ArtSpec[] = [
  // Backgrounds are rasterized at the 1920×1080 stage size (the canvas renders 1:1
  // at 1080p, so 1× is crisp; fallbacks draw at the old 960 design units and upscale).
  A('art-sky', '/assets/scene/sky.svg', 1920, 1080, drawSky, [960, 540]),
  A('art-hills', '/assets/scene/hills.svg', 1920, 400, drawHills, [960, 200]),
  A('art-paddy', '/assets/scene/paddy.svg', 1920, 280, drawPaddy, [960, 140]),
  A('art-ground', '/assets/scene/ground.svg', 1920, 240, drawGround, [960, 120]),

  A(CLOUD_KEYS.puffy, '/assets/scene/cloud1.svg', 400, 180, drawCloudPuffy, [200, 90]),
  A(CLOUD_KEYS.stratus, '/assets/scene/cloud2.svg', 520, 140, drawCloudStratus, [260, 70]),
  A(CLOUD_KEYS.tower, '/assets/scene/cloud3.svg', 300, 240, drawCloudTower, [150, 120]),

  // Actors raster at about their 1080p display size (trainer 400, rooster 480,
  // pests 230–290, boss 660) with a little headroom for squash/stretch.
  A(TRAINER_KEY, '/assets/sprites/trainer.svg', 440, 440, drawTrainer, [96, 96]),
  A(TRAINER_WALK_KEY, '/assets/sprites/trainer-walk.svg', 440, 440, drawTrainer, [96, 96]),

  A(ROOSTER_KEYS.kumarnjeen, '/assets/sprites/rooster-kumarnjeen.svg', 520, 520, drawRooster(0xc96f3b, 0xa85628), [80, 80]),
  A(ROOSTER_KEYS.kingkong, '/assets/sprites/rooster-kingkong.svg', 520, 520, drawRooster(0x8a5a33, 0x6d4426), [80, 80]),
  A(ROOSTER_KEYS.chaokhunthong, '/assets/sprites/rooster-chaokhunthong.svg', 520, 520, drawRooster(0xe0a93e, 0xc48a28), [80, 80]),
  A(ROOSTER_KEYS.thepbut, '/assets/sprites/rooster-thepbut.svg', 520, 520, drawRooster(0xede3cc, 0xcdbf9d), [80, 80]),
  A(ROOSTER_KEYS.raptor, '/assets/sprites/rooster-raptor.svg', 520, 520, drawRooster(0x56624c, 0x3f4a39), [80, 80]),

  A(MONSTER_KEYS['nu-na'], '/assets/monsters/nu-na.svg', 320, 320, drawNuNa, [88, 88]),
  A(MONSTER_KEYS['takka-taen-yak'], '/assets/monsters/takkaek-yak.svg', 320, 320, drawLocust, [88, 88]),
  A(MONSTER_KEYS['pu-na'], '/assets/monsters/pu-na.svg', 280, 280, drawCrab, [80, 80]),
  A(MONSTER_KEYS['raja-nu-na'], '/assets/monsters/racha-nu-na.svg', 720, 720, drawRaja, [144, 144]),

  A('art-prop-hay-bale', '/assets/scene/props/hay-bale.svg', 200, 200, drawHayBale, [64, 64]),
  A('art-prop-scarecrow', '/assets/scene/props/scarecrow.svg', 200, 200, drawScarecrow, [64, 64]),
  A('art-prop-water-jar', '/assets/scene/props/water-jar.svg', 200, 200, drawJar, [64, 64]),
  A('art-prop-fence', '/assets/scene/props/fence.svg', 200, 200, drawFence, [64, 64]),
  A('art-prop-rice-bundle', '/assets/scene/props/rice-bundle.svg', 200, 200, drawRiceBundle, [64, 64]),

  // every non-mintable item can arrive through the inventory diff, so load all of them
  ...[101, 102, 103, 104, 201, 202, 203, 204, 205, 206, 207, 208, 1001, 1002, 1003, 2001, 2002, 2003, 3001].map((id) =>
    A(itemKey(id), `/assets/items/${id}.svg`, 96, 96, drawItem(0xc9a24b), [48, 48]),
  ),
]

/** Generate the code-drawn stand-in for every asset whose SVG never arrived. */
export function ensureFallbacks(scene: Phaser.Scene): void {
  for (const spec of ART) {
    if (scene.textures.exists(spec.key)) continue // SVG loaded fine
    const g = scene.add.graphics()
    spec.draw(g)
    const [w, h] = spec.fb ?? [spec.w, spec.h]
    g.generateTexture(spec.key, w, h)
    g.destroy()
  }
}

// --- always-generated FX textures ---

export const FX = {
  star: 'fx-star',
  glow: 'fx-glow',
  ring: 'fx-ring',
  poof: 'fx-poof',
  bird: 'fx-bird',
  shimmer: 'fx-shimmer',
  card: 'fx-card',
  coin: 'fx-coin',
  pillar: 'fx-pillar',
  dust: 'fx-dust',
  tuft: 'fx-tuft',
  confetti: 'fx-confetti',
  aura: 'fx-aura',
  feather: 'fx-feather',
  bubble: 'fx-bubble',
} as const

export function makeFxTextures(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
    if (scene.textures.exists(key)) return
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    draw(g)
    g.generateTexture(key, w, h)
    g.destroy()
  }

  // 4-point sparkle star
  make(FX.star, 48, 48, (g) => {
    const pts: Phaser.Geom.Point[] = []
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 22 : 6
      const a = (Math.PI / 4) * i - Math.PI / 2
      pts.push(new Phaser.Geom.Point(24 + Math.cos(a) * r, 24 + Math.sin(a) * r))
    }
    g.fillStyle(0xffffff)
    g.fillPoints(pts, true)
  })

  // soft glow dot (concentric alphas — reads as a bloom at small scale)
  make(FX.glow, 64, 64, (g) => {
    for (let i = 5; i >= 1; i--) {
      g.fillStyle(0xffffff, 0.16)
      g.fillCircle(32, 32, i * 6.2)
    }
  })

  make(FX.ring, 72, 72, (g) => {
    g.lineStyle(6, 0xffffff, 1)
    g.strokeCircle(36, 36, 30)
  })

  make(FX.poof, 96, 96, (g) => {
    g.fillStyle(0xffffff, 0.5)
    g.fillCircle(48, 48, 46)
    g.fillStyle(0xffffff, 0.7)
    g.fillCircle(48, 48, 32)
    g.fillStyle(0xffffff, 0.9)
    g.fillCircle(48, 48, 18)
  })

  make(FX.bird, 40, 20, (g) => {
    g.fillStyle(0x46536b, 0.9)
    g.fillTriangle(4, 12, 20, 4, 18, 12)
    g.fillTriangle(4, 12, 22, 18, 19, 9)
    dot(g, 6, 11, 2.6, 0x46536b)
  })

  make(FX.shimmer, 64, 10, (g) => {
    g.fillStyle(0xffffff, 0.35)
    g.fillRoundedRect(0, 0, 64, 10, 5)
  })

  // framed loot card back (used for the boss-card fly-out + rare-drop frames)
  make(FX.card, 56, 72, (g) => {
    g.fillStyle(0xf7ecd2)
    g.fillRoundedRect(4, 4, 48, 64, 6)
    g.lineStyle(4, 0xd9a441)
    g.strokeRoundedRect(4, 4, 48, 64, 6)
    g.lineStyle(3, OUTLINE)
    g.strokeRoundedRect(1.5, 1.5, 53, 69, 7)
  })

  // gold coin (kill-reward sparkle)
  make(FX.coin, 40, 40, (g) => {
    g.fillStyle(0xf2c14e)
    g.fillCircle(20, 20, 17)
    g.lineStyle(4, OUTLINE)
    g.strokeCircle(20, 20, 17)
    g.lineStyle(3, 0xb8860b)
    g.strokeCircle(20, 20, 10.5)
    g.fillStyle(0xfff3c9, 0.9)
    g.fillCircle(14, 14, 4)
  })

  // light pillar: white column fading upward, drawn as stacked slices because
  // generateTexture rasterizes through a canvas (no gradient alpha). Tint per use.
  make(FX.pillar, 200, 1080, (g) => {
    const slices = 36
    for (let i = 0; i < slices; i++) {
      const t = i / slices // 0 at the top
      const a = 0.04 + 0.86 * t * t
      const w = 200 * (0.55 + 0.45 * t)
      g.fillStyle(0xffffff, a)
      g.fillRect((200 - w) / 2, (1080 / slices) * i, w, 1080 / slices + 1)
    }
  })

  // soft dust puff (tinted clay per use)
  make(FX.dust, 48, 48, (g) => {
    g.fillStyle(0xffffff, 0.35)
    g.fillCircle(24, 24, 22)
    g.fillStyle(0xffffff, 0.5)
    g.fillCircle(20, 26, 14)
    g.fillStyle(0xffffff, 0.6)
    g.fillCircle(28, 22, 9)
  })

  // a single rice tuft that can sway (origin at its base)
  make(FX.tuft, 56, 72, (g) => {
    stroke(g, [[28, 70], [12, 22]], 0x55803c, 7)
    stroke(g, [[28, 70], [28, 8]], 0x7cb342, 7)
    stroke(g, [[28, 70], [44, 20]], 0x9ccc65, 7)
    stroke(g, [[28, 70], [8, 40]], 0x7cb342, 6)
    stroke(g, [[28, 70], [48, 42]], 0x55803c, 6)
    g.fillStyle(0xe3b341)
    for (const [x, y] of [[12, 22], [28, 8], [44, 20]] as const) g.fillEllipse(x, y, 10, 16)
  })

  // confetti square
  make(FX.confetti, 16, 16, (g) => {
    g.fillStyle(0xffffff)
    g.fillRect(2, 2, 12, 12)
  })

  // cream feather (rooster ruffles and crits — never blood)
  make(FX.feather, 36, 48, (g) => {
    g.fillStyle(0xfff3d6)
    g.fillEllipse(18, 24, 22, 44)
    g.lineStyle(3, OUTLINE)
    g.strokeEllipse(18, 24, 22, 44)
    g.lineStyle(2, 0xd9c7a0)
    g.lineBetween(18, 4, 18, 44)
  })

  // speech bubble with a tail at the bottom-left (emotes and the crow)
  make(FX.bubble, 240, 120, (g) => {
    g.fillStyle(0xfffdf6)
    g.fillRoundedRect(6, 6, 228, 84, 26)
    g.fillTriangle(40, 86, 74, 86, 34, 114)
    g.lineStyle(4, OUTLINE)
    g.strokeRoundedRect(6, 6, 228, 84, 26)
    g.lineBetween(40, 88, 34, 114)
    g.lineBetween(34, 114, 74, 88)
  })

  // flat aura ellipse under the rooster's feet
  make(FX.aura, 240, 80, (g) => {
    g.fillStyle(0xffffff, 0.18)
    g.fillEllipse(120, 40, 236, 76)
    g.fillStyle(0xffffff, 0.22)
    g.fillEllipse(120, 40, 180, 56)
    g.lineStyle(4, 0xffffff, 0.75)
    g.strokeEllipse(120, 40, 220, 70)
  })
}
