// Art pipeline for the idle scene.
//
// Legacy art remains SVG in /public/assets; riverside replacements are raster
// images loaded by the same scene registry. Every registry entry has a
// code-drawn fallback (Phaser Graphics → generateTexture), and FX textures are
// generated at runtime.

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
  /** Riverside replacement for every viewport, with a category-specific fallback texture. */
  riverside?: { url: string; w: number; h: number; draw: (g: Phaser.GameObjects.Graphics) => void; fb?: [number, number] }
}

/** Asset selection shares the same profile rule as camera and HUD layout. */
export function isRiversideArtProfile(): boolean {
  // This is the art direction switch, not the responsive layout switch. The
  // riverside theme is shared by desktop and mobile; camera/UI sizing continues
  // to use isMobileProfile() independently.
  return true
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

// --- riverside fallbacks ----------------------------------------------------
// These deliberately do not call the legacy artists above. If a generated
// image is unavailable, the game keeps its moonlit indigo / lantern-gold
// identity and each actor remains recognizable at gameplay size.

const RIVER_INK = 0x17213a
const RIVER_INDIGO = 0x283b63
const RIVER_AMBER = 0xf2b45b
const RIVER_AMBER_LIGHT = 0xffdda0
const RIVER_PAPER = 0xf4e7c8
const RIVER_TEAL = 0x3f7880

function riverBlob(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number): void {
  g.fillStyle(fill)
  g.fillEllipse(x, y, w, h)
  g.lineStyle(3, RIVER_INK)
  g.strokeEllipse(x, y, w, h)
}

function riverDot(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, fill: number): void {
  g.fillStyle(fill)
  g.fillCircle(x, y, r)
  g.lineStyle(2.5, RIVER_INK)
  g.strokeCircle(x, y, r)
}

function riverStroke(g: Phaser.GameObjects.Graphics, pts: Array<[number, number]>, color: number, width = 4): void {
  g.lineStyle(width + 2, RIVER_INK)
  g.beginPath()
  g.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1])
  g.strokePath()
  g.lineStyle(width, color)
  g.beginPath()
  g.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1])
  g.strokePath()
}

function drawRiverTrainer(g: Phaser.GameObjects.Graphics, walking = false): void {
  // Thai field trainer: indigo mor-hom shirt, pha khao ma sash, chong
  // kraben trousers and a broad ngob-style woven hat.
  const step = walking ? 5 : 0
  riverStroke(g, [[43, 65], [37 - step, 83]], RIVER_INDIGO, 8)
  riverStroke(g, [[55, 65], [61 + step, 83]], RIVER_INDIGO, 8)
  g.fillStyle(0x6f4931)
  g.fillRoundedRect(27 - step, 82, 19, 7, 3)
  g.fillRoundedRect(53 + step, 82, 19, 7, 3)
  g.lineStyle(2.5, RIVER_INK)
  g.strokeRoundedRect(27 - step, 82, 19, 7, 3)
  g.strokeRoundedRect(53 + step, 82, 19, 7, 3)
  g.fillStyle(RIVER_INDIGO)
  g.fillRoundedRect(30, 39, 38, 31, 11)
  g.lineStyle(3, RIVER_INK)
  g.strokeRoundedRect(30, 39, 38, 31, 11)
  g.fillStyle(0xbd5a43)
  g.fillRoundedRect(30, 60, 38, 7, 3)
  g.fillTriangle(57, 64, 68, 67, 61, 82)
  riverStroke(g, [[33, 47], [22 - step, 64]], 0xc78356, 7)
  riverStroke(g, [[65, 47], [76 + step, 62]], 0xc78356, 7)
  riverDot(g, 22 - step, 65, 4, 0xc78356)
  riverDot(g, 76 + step, 63, 4, 0xc78356)
  riverDot(g, 49, 28, 13, 0xc78356)
  g.fillStyle(RIVER_INK)
  g.fillCircle(44, 28, 1.7)
  g.fillCircle(54, 28, 1.7)
  g.lineStyle(2, 0x75432f)
  g.lineBetween(46, 34, 52, 34)
  g.fillStyle(RIVER_AMBER)
  g.fillEllipse(49, 19, 50, 12)
  g.fillTriangle(34, 18, 49, 5, 64, 18)
  g.lineStyle(3, RIVER_INK)
  g.strokeEllipse(49, 19, 50, 12)
  g.strokeTriangle(34, 18, 49, 5, 64, 18)
  g.lineStyle(2, 0x9e6534)
  g.lineBetween(38, 18, 60, 18)
}

function drawRiverRooster(body: number, wing: number, tail: number, accent: number) {
  return (g: Phaser.GameObjects.Graphics): void => {
    riverStroke(g, [[29, 48], [8, 18]], tail, 6)
    riverStroke(g, [[26, 51], [4, 32]], accent, 6)
    riverStroke(g, [[30, 52], [12, 46]], tail, 5)
    riverBlob(g, 42, 51, 46, 36, body)
    riverDot(g, 58, 30, 13, body)
    g.fillStyle(0xc84e42)
    for (const [x, y, r] of [[53, 17, 4], [59, 14, 5], [65, 18, 4]] as const) g.fillCircle(x, y, r)
    g.lineStyle(2.5, RIVER_INK)
    for (const [x, y, r] of [[53, 17, 4], [59, 14, 5], [65, 18, 4]] as const) g.strokeCircle(x, y, r)
    g.fillStyle(RIVER_AMBER)
    g.fillTriangle(69, 29, 79, 34, 68, 37)
    g.lineStyle(2.5, RIVER_INK)
    g.strokeTriangle(69, 29, 79, 34, 68, 37)
    g.fillStyle(wing)
    g.fillEllipse(41, 52, 24, 16)
    g.lineStyle(2.5, RIVER_INK)
    g.strokeEllipse(41, 52, 24, 16)
    g.lineStyle(2, RIVER_AMBER_LIGHT, 0.8)
    g.lineBetween(34, 51, 47, 56)
    g.fillStyle(RIVER_INK)
    g.fillCircle(61, 28, 2)
    g.fillStyle(0xffffff)
    g.fillCircle(61.5, 27.4, 0.7)
    riverStroke(g, [[40, 68], [38, 78]], RIVER_AMBER, 4)
    riverStroke(g, [[51, 67], [53, 78]], RIVER_AMBER, 4)
    g.lineStyle(2, RIVER_INK)
    g.lineBetween(32, 78, 42, 78)
    g.lineBetween(48, 78, 58, 78)
  }
}

function drawRiverRat(g: Phaser.GameObjects.Graphics): void {
  riverStroke(g, [[65, 56], [83, 43], [78, 29]], 0xc9879c, 5)
  riverBlob(g, 43, 51, 52, 38, 0x73819c)
  riverDot(g, 29, 27, 10, 0x73819c)
  riverDot(g, 51, 24, 11, 0x73819c)
  g.fillStyle(0xc9879c)
  g.fillCircle(29, 27, 3)
  g.fillCircle(51, 24, 3)
  g.fillStyle(RIVER_INK)
  g.fillCircle(38, 39, 2)
  g.fillCircle(51, 38, 2)
  g.fillStyle(RIVER_AMBER_LIGHT)
  g.fillCircle(44, 46, 3)
  riverStroke(g, [[31, 67], [27, 78]], 0x73819c, 5)
  riverStroke(g, [[55, 67], [60, 78]], 0x73819c, 5)
}

function drawRiverLocust(g: Phaser.GameObjects.Graphics): void {
  riverStroke(g, [[38, 21], [31, 7]], RIVER_TEAL, 3)
  riverStroke(g, [[49, 20], [57, 7]], RIVER_TEAL, 3)
  riverBlob(g, 44, 48, 49, 43, 0x6f986f)
  g.fillStyle(0x9cad72)
  g.fillEllipse(52, 47, 28, 32)
  g.lineStyle(2.5, RIVER_INK)
  g.strokeEllipse(52, 47, 28, 32)
  g.fillStyle(RIVER_AMBER_LIGHT, 0.72)
  g.fillEllipse(40, 44, 13, 23)
  g.fillStyle(RIVER_INK)
  g.fillCircle(33, 36, 2.5)
  riverStroke(g, [[30, 57], [13, 70], [23, 79]], RIVER_TEAL, 4)
  riverStroke(g, [[58, 57], [75, 70], [65, 79]], RIVER_TEAL, 4)
  riverStroke(g, [[40, 69], [40, 79]], 0x6f986f, 4)
  riverStroke(g, [[50, 69], [50, 79]], 0x6f986f, 4)
}

function drawRiverCrab(g: Phaser.GameObjects.Graphics): void {
  riverBlob(g, 40, 49, 48, 34, 0xb85f48)
  riverStroke(g, [[31, 36], [27, 20]], 0xb85f48, 4)
  riverStroke(g, [[49, 36], [53, 20]], 0xb85f48, 4)
  riverDot(g, 27, 17, 5, RIVER_PAPER)
  riverDot(g, 53, 17, 5, RIVER_PAPER)
  g.fillStyle(RIVER_INK)
  g.fillCircle(27, 17, 2)
  g.fillCircle(53, 17, 2)
  g.fillStyle(RIVER_AMBER)
  g.fillTriangle(14, 43, 2, 31, 7, 48)
  g.fillTriangle(66, 43, 78, 31, 73, 48)
  g.lineStyle(2.5, RIVER_INK)
  g.strokeTriangle(14, 43, 2, 31, 7, 48)
  g.strokeTriangle(66, 43, 78, 31, 73, 48)
  for (const [a, b, c, d] of [[22, 59, 12, 69], [34, 63, 30, 74], [48, 63, 52, 74], [59, 59, 69, 69]] as const) riverStroke(g, [[a, b], [c, d]], 0xb85f48, 4)
}

function drawRiverRatKing(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(RIVER_AMBER, 0.12)
  g.fillCircle(72, 76, 62)
  g.fillStyle(0x663c62)
  g.fillTriangle(36, 57, 17, 126, 61, 113)
  g.fillTriangle(87, 57, 108, 126, 62, 113)
  g.lineStyle(3, RIVER_INK)
  g.strokeTriangle(36, 57, 17, 126, 61, 113)
  g.strokeTriangle(87, 57, 108, 126, 62, 113)
  riverBlob(g, 72, 84, 84, 72, 0x69738e)
  riverDot(g, 43, 40, 15, 0x69738e)
  riverDot(g, 82, 35, 16, 0x69738e)
  g.fillStyle(RIVER_INK)
  g.fillCircle(62, 65, 3)
  g.fillCircle(84, 65, 3)
  g.fillStyle(RIVER_AMBER_LIGHT)
  g.fillCircle(73, 76, 4)
  g.fillStyle(RIVER_AMBER)
  g.fillTriangle(52, 25, 57, 8, 64, 23)
  g.fillTriangle(63, 23, 72, 4, 79, 22)
  g.fillTriangle(78, 22, 86, 8, 90, 26)
  g.fillRoundedRect(51, 23, 40, 8, 3)
  g.lineStyle(3, RIVER_INK)
  g.strokeRoundedRect(51, 23, 40, 8, 3)
  riverStroke(g, [[108, 92], [130, 70], [123, 53]], 0xc9879c, 8)
}

function drawRiverSnail(g: Phaser.GameObjects.Graphics): void {
  riverBlob(g, 47, 58, 52, 25, 0x7d946f)
  riverBlob(g, 38, 43, 36, 36, 0xb64d6a)
  g.lineStyle(4, RIVER_AMBER_LIGHT)
  g.strokeCircle(38, 43, 10)
  riverStroke(g, [[64, 49], [69, 34]], 0x7d946f, 3)
  riverStroke(g, [[72, 49], [78, 35]], 0x7d946f, 3)
  riverDot(g, 69, 32, 3.5, RIVER_PAPER)
  riverDot(g, 78, 33, 3.5, RIVER_PAPER)
  g.fillStyle(RIVER_INK)
  g.fillCircle(69, 32, 1.3)
  g.fillCircle(78, 33, 1.3)
  g.fillStyle(0xd96d7d)
  g.fillCircle(29, 28, 5)
  g.fillCircle(38, 24, 5)
  g.fillCircle(47, 29, 5)
}

function drawRiverHyacinth(g: Phaser.GameObjects.Graphics): void {
  riverBlob(g, 44, 56, 48, 40, 0x557e70)
  g.fillStyle(0x8aa47a)
  for (const [x, y, w, h] of [[28, 29, 25, 12], [43, 23, 27, 13], [59, 30, 25, 12]] as const) {
    g.fillEllipse(x, y, w, h)
    g.lineStyle(2.5, RIVER_INK)
    g.strokeEllipse(x, y, w, h)
  }
  riverStroke(g, [[28, 68], [15, 79]], RIVER_TEAL, 5)
  riverStroke(g, [[44, 73], [44, 84]], RIVER_TEAL, 5)
  riverStroke(g, [[60, 68], [73, 79]], RIVER_TEAL, 5)
  g.fillStyle(0x9b75ae)
  for (const [x, y] of [[36, 40], [45, 35], [53, 42]] as const) g.fillCircle(x, y, 5)
  g.fillStyle(RIVER_INK)
  g.fillCircle(37, 55, 2)
  g.fillCircle(51, 55, 2)
}

function drawRiverFish(g: Phaser.GameObjects.Graphics): void {
  riverBlob(g, 43, 46, 56, 35, 0x426f7d)
  g.fillStyle(RIVER_TEAL)
  g.fillTriangle(17, 45, 3, 27, 4, 63)
  g.fillTriangle(41, 29, 52, 12, 58, 33)
  g.lineStyle(3, RIVER_INK)
  g.strokeTriangle(17, 45, 3, 27, 4, 63)
  g.strokeTriangle(41, 29, 52, 12, 58, 33)
  g.fillStyle(RIVER_AMBER_LIGHT)
  g.fillEllipse(48, 49, 22, 14)
  g.lineStyle(2, RIVER_INK)
  g.strokeEllipse(48, 49, 22, 14)
  riverDot(g, 63, 39, 4, RIVER_PAPER)
  g.fillStyle(RIVER_INK)
  g.fillCircle(64, 39, 1.5)
  g.lineStyle(3, RIVER_INK)
  g.lineBetween(68, 50, 77, 48)
}

function drawRiverCrocodile(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(RIVER_AMBER, 0.1)
  g.fillCircle(72, 78, 64)
  riverBlob(g, 73, 82, 104, 54, 0x476f63)
  g.fillStyle(0x5f8b70)
  g.fillRoundedRect(82, 48, 58, 31, 14)
  g.lineStyle(3, RIVER_INK)
  g.strokeRoundedRect(82, 48, 58, 31, 14)
  g.fillStyle(0x375d58)
  g.fillTriangle(25, 75, 3, 52, 12, 91)
  g.lineStyle(3, RIVER_INK)
  g.strokeTriangle(25, 75, 3, 52, 12, 91)
  for (const x of [47, 65, 84]) {
    g.fillStyle(RIVER_AMBER)
    g.fillTriangle(x, 57, x + 8, 43, x + 15, 60)
    g.lineStyle(2.5, RIVER_INK)
    g.strokeTriangle(x, 57, x + 8, 43, x + 15, 60)
  }
  g.fillStyle(RIVER_PAPER)
  g.fillCircle(117, 59, 5)
  g.fillStyle(RIVER_INK)
  g.fillCircle(118, 59, 2)
  g.lineStyle(3, RIVER_INK)
  g.lineBetween(104, 72, 139, 72)
  for (const x of [111, 123, 135]) {
    g.fillStyle(RIVER_PAPER)
    g.fillTriangle(x, 72, x + 5, 72, x + 2, 79)
  }
  riverStroke(g, [[49, 104], [38, 124]], 0x476f63, 8)
  riverStroke(g, [[95, 105], [108, 124]], 0x476f63, 8)
}

function drawRiverHayBale(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xbc8245)
  g.fillRoundedRect(7, 20, 50, 36, 12)
  g.lineStyle(3, RIVER_INK)
  g.strokeRoundedRect(7, 20, 50, 36, 12)
  g.lineStyle(3, RIVER_AMBER_LIGHT)
  g.strokeRoundedRect(14, 26, 36, 23, 7)
  riverStroke(g, [[21, 21], [21, 55]], 0x72513b, 3)
  riverStroke(g, [[44, 21], [44, 55]], 0x72513b, 3)
}

function drawRiverScarecrow(g: Phaser.GameObjects.Graphics): void {
  riverStroke(g, [[32, 14], [32, 62]], 0x79543a, 5)
  riverStroke(g, [[9, 29], [55, 29]], 0x79543a, 5)
  g.fillStyle(RIVER_INDIGO)
  g.fillTriangle(14, 27, 50, 27, 32, 58)
  g.lineStyle(3, RIVER_INK)
  g.strokeTriangle(14, 27, 50, 27, 32, 58)
  riverDot(g, 32, 17, 9, RIVER_PAPER)
  g.fillStyle(RIVER_AMBER)
  g.fillEllipse(32, 10, 31, 8)
  g.lineStyle(2.5, RIVER_INK)
  g.strokeEllipse(32, 10, 31, 8)
  g.fillStyle(RIVER_AMBER)
  g.fillCircle(28, 17, 1.5)
  g.fillCircle(36, 17, 1.5)
}

function drawRiverJar(g: Phaser.GameObjects.Graphics): void {
  riverBlob(g, 32, 40, 42, 38, 0x6e7194)
  g.fillStyle(RIVER_INDIGO)
  g.fillEllipse(32, 22, 23, 8)
  g.lineStyle(3, RIVER_INK)
  g.strokeEllipse(32, 22, 23, 8)
  g.lineStyle(3, RIVER_AMBER)
  g.strokeEllipse(32, 41, 27, 17)
  g.fillStyle(RIVER_AMBER_LIGHT)
  g.fillCircle(32, 41, 4)
}

function drawRiverFence(g: Phaser.GameObjects.Graphics): void {
  for (const x of [6, 27, 48]) {
    g.fillStyle(0x76523a)
    g.fillRoundedRect(x, 13, 10, 45, 3)
    g.fillTriangle(x, 13, x + 10, 13, x + 5, 5)
    g.lineStyle(2.5, RIVER_INK)
    g.strokeRoundedRect(x, 13, 10, 45, 3)
    g.strokeTriangle(x, 13, x + 10, 13, x + 5, 5)
  }
  riverStroke(g, [[4, 26], [60, 26]], 0x9a704c, 5)
  riverStroke(g, [[4, 43], [60, 43]], 0x9a704c, 5)
}

function drawRiverRiceBundle(g: Phaser.GameObjects.Graphics): void {
  for (const [dx, tip] of [[-20, 16], [-10, 8], [0, 5], [10, 8], [20, 16]] as const) {
    riverStroke(g, [[32, 55], [32 + dx * 0.55, 30], [32 + dx, tip]], RIVER_AMBER, 3)
    g.fillStyle(RIVER_AMBER_LIGHT)
    g.fillEllipse(32 + dx, tip, 5, 9)
  }
  riverStroke(g, [[32, 53], [32, 63]], 0x76523a, 5)
  g.fillStyle(0xbd5a43)
  g.fillRoundedRect(24, 48, 16, 6, 3)
}

function drawRiverItem(id: number) {
  return (g: Phaser.GameObjects.Graphics): void => {
    const tier = id >= 3000 ? 0xb64d6a : id >= 2000 ? 0x795b9a : id >= 1000 ? RIVER_TEAL : id >= 200 ? 0x566d8f : 0x76523a
    g.fillStyle(RIVER_INDIGO)
    g.fillRoundedRect(3, 3, 42, 42, 10)
    g.lineStyle(2.5, RIVER_AMBER)
    g.strokeRoundedRect(3, 3, 42, 42, 10)
    g.fillStyle(tier)
    g.fillCircle(24, 24, 15)
    g.lineStyle(2, RIVER_AMBER_LIGHT)
    g.strokeCircle(24, 24, 15)
    g.fillStyle(RIVER_PAPER)
    const variant = id % 10
    if (id < 200) {
      g.fillEllipse(24, 29, 18, 15)
      g.fillRoundedRect(19, 13, 10, 8, 3)
      g.lineStyle(2, RIVER_INK)
      g.strokeEllipse(24, 29, 18, 15)
      g.lineBetween(17, 21, 31, 21)
    } else if (id < 1000) {
      g.fillStyle(RIVER_AMBER_LIGHT)
      g.fillRoundedRect(22, 12, 5, 25, 2)
      g.fillStyle(RIVER_PAPER)
      if (variant % 3 === 0) g.fillRect(13, 14, 22, 5)
      else if (variant % 3 === 1) g.fillTriangle(11, 16, 25, 11, 25, 22)
      else g.fillEllipse(29, 15, 17, 8)
    } else if (id < 2000) {
      g.fillStyle(RIVER_PAPER)
      g.fillTriangle(24, 10, 36, 21, 31, 37)
      g.fillTriangle(24, 10, 12, 21, 17, 37)
      g.fillStyle(RIVER_AMBER)
      g.fillCircle(24, 25, 6)
      g.fillStyle(tier)
      g.fillCircle(24, 25, 2)
    } else if (id < 3000) {
      g.fillStyle(RIVER_PAPER)
      g.fillRoundedRect(14, 9, 20, 30, 4)
      g.lineStyle(2, RIVER_INK)
      g.strokeRoundedRect(14, 9, 20, 30, 4)
      g.fillStyle(tier)
      g.fillCircle(24, 23, 7)
      g.fillStyle(RIVER_AMBER)
      g.fillCircle(24, 23, 2.5)
    } else {
      const points: Phaser.Geom.Point[] = []
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? 15 : 7
        const angle = i * Math.PI / 5 - Math.PI / 2
        points.push(new Phaser.Geom.Point(24 + Math.cos(angle) * radius, 24 + Math.sin(angle) * radius))
      }
      g.fillStyle(RIVER_AMBER)
      g.fillPoints(points, true)
      g.lineStyle(2, RIVER_INK)
      g.strokePoints(points, true)
      g.fillStyle(RIVER_PAPER)
      g.fillCircle(24, 24, 4)
    }
    g.fillStyle(variant % 2 === 0 ? RIVER_AMBER_LIGHT : 0xd67878)
    g.fillCircle(38, 10, 2.5)
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
  ({ key, url, w, h, draw, fb, riverside: riversideSpec(key, url, w, h, draw, fb) })

export const RIVERSIDE_READY_KEYS = new Set<string>()

function riversideUrl(key: string, sourceUrl: string): string | null {
  if (sourceUrl.includes('/assets/scene/props/')) {
    return `/assets/game/riverside/props/${sourceUrl.split('/').at(-1)!.replace('.svg', '.png')}`
  }
  if (sourceUrl.includes('/assets/sprites/')) {
    const sourceFile = sourceUrl.split('/').at(-1)!
    const file = sourceFile.replace('.svg', '.webp')
    const name = sourceFile === 'trainer.svg' ? 'trainer-idle.webp' : sourceFile === 'trainer-walk.svg' ? 'trainer-walk.webp' : file
    return `/assets/game/riverside/characters/${name}`
  }
  if (sourceUrl.includes('/assets/monsters/')) return `/assets/game/riverside/creatures/${key.replace('art-monster-', '')}.png`
  if (sourceUrl.includes('/assets/items/')) return `/assets/game/riverside/items/${sourceUrl.split('/').at(-1)!.replace('.svg', '.png')}`
  if (sourceUrl.includes('/assets/scene/')) return null
  return null
}

function riversideSpec(
  key: string,
  sourceUrl: string,
  w: number,
  h: number,
  _legacyDraw: (g: Phaser.GameObjects.Graphics) => void,
  legacyFb?: [number, number],
): ArtSpec['riverside'] {
  const url = riversideUrl(key, sourceUrl)
  if (!url) return undefined
  const [rw, rh] = sourceUrl.includes('/assets/sprites/')
    ? sourceUrl.includes('trainer') ? [240, 240] : [280, 280]
    : sourceUrl.includes('/assets/monsters/')
      ? w > 500 ? [360, 360] : [192, 192]
      : sourceUrl.includes('/assets/scene/props/')
        ? [128, 128]
        : sourceUrl.includes('/assets/items/')
          ? Number(sourceUrl.split('/').at(-1)!.split('.')[0]) >= 1001 ? [256, 256] : [128, 128]
          : [w, h]
  return { url, w: rw, h: rh, draw: riversideFallback(key, sourceUrl), fb: legacyFb ?? [w, h] }
}

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
  // บึงบัวหลวง (zone 2)
  'hoi-cherry': 'art-monster-hoi-cherry',
  'phak-tob-chawai-yak': 'art-monster-phak-tob-chawai-yak',
  'pla-chon-yak': 'art-monster-pla-chon-yak',
  'jorakhe-thao-bueng': 'art-monster-jorakhe-thao-bueng',
}

function riversideFallback(key: string, sourceUrl: string): (g: Phaser.GameObjects.Graphics) => void {
  if (key === TRAINER_KEY) return (g) => drawRiverTrainer(g)
  if (key === TRAINER_WALK_KEY) return (g) => drawRiverTrainer(g, true)

  const roosterFallbacks: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
    [ROOSTER_KEYS.kumarnjeen]: drawRiverRooster(0xb95542, 0xd68055, 0x315b65, RIVER_AMBER),
    [ROOSTER_KEYS.kingkong]: drawRiverRooster(0x5b463e, 0x7e6858, 0x253550, 0xbd5a43),
    [ROOSTER_KEYS.chaokhunthong]: drawRiverRooster(0xc99143, 0xe7bd66, 0x75503b, 0xf4d28a),
    [ROOSTER_KEYS.thepbut]: drawRiverRooster(0xe7dfc9, 0xb9c3d0, 0x67799a, 0xf2b45b),
    [ROOSTER_KEYS.raptor]: drawRiverRooster(0x334f49, 0x547668, 0x1d3547, 0xb74f32),
  }
  if (roosterFallbacks[key]) return roosterFallbacks[key]

  const monsterFallbacks: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
    [MONSTER_KEYS['nu-na']]: drawRiverRat,
    [MONSTER_KEYS['takka-taen-yak']]: drawRiverLocust,
    [MONSTER_KEYS['pu-na']]: drawRiverCrab,
    [MONSTER_KEYS['raja-nu-na']]: drawRiverRatKing,
    [MONSTER_KEYS['hoi-cherry']]: drawRiverSnail,
    [MONSTER_KEYS['phak-tob-chawai-yak']]: drawRiverHyacinth,
    [MONSTER_KEYS['pla-chon-yak']]: drawRiverFish,
    [MONSTER_KEYS['jorakhe-thao-bueng']]: drawRiverCrocodile,
  }
  if (monsterFallbacks[key]) return monsterFallbacks[key]

  const propFallbacks: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
    'art-prop-hay-bale': drawRiverHayBale,
    'art-prop-scarecrow': drawRiverScarecrow,
    'art-prop-water-jar': drawRiverJar,
    'art-prop-fence': drawRiverFence,
    'art-prop-rice-bundle': drawRiverRiceBundle,
  }
  if (propFallbacks[key]) return propFallbacks[key]

  if (sourceUrl.includes('/assets/items/')) return drawRiverItem(Number(key.replace('art-item-', '')))
  throw new Error(`Missing riverside fallback artist for ${key}`)
}

for (const key of [TRAINER_KEY, TRAINER_WALK_KEY, ...Object.values(ROOSTER_KEYS), ...Object.values(MONSTER_KEYS), 'art-prop-hay-bale', 'art-prop-scarecrow', 'art-prop-water-jar', 'art-prop-fence', 'art-prop-rice-bundle']) {
  RIVERSIDE_READY_KEYS.add(key)
}
export const itemKey = (id: number): string => `art-item-${id}`

for (const id of [101, 102, 103, 104, 201, 202, 203, 204, 205, 206, 207, 208, 1001, 1002, 1003, 1004, 1005, 1006, 2001, 2002, 2003, 3001, 3002]) {
  RIVERSIDE_READY_KEYS.add(itemKey(id))
}

export const CLOUD_KEYS = { puffy: 'art-cloud-1', stratus: 'art-cloud-2', tower: 'art-cloud-3' } as const

export const RIVERSIDE_ENVIRONMENT = [
  { key: 'river-sky', url: '/assets/game/riverside/environment/sky-temple-night.webp', w: 1536, h: 864, draw: drawRiverSky },
  { key: 'river-houses-left', url: '/assets/game/riverside/environment/stilt-houses-left.webp', w: 700, h: 560, draw: drawRiverHouse },
  { key: 'river-houses-right', url: '/assets/game/riverside/environment/stilt-houses-right.webp', w: 700, h: 560, draw: drawRiverHouse },
  { key: 'river-corridor', url: '/assets/game/riverside/environment/quiet-central-corridor.webp', w: 1536, h: 320, draw: drawRiverCorridor },
  { key: 'river-water-boardwalk', url: '/assets/game/riverside/environment/water-lotus-boardwalk.webp', w: 1536, h: 420, draw: drawRiverWater },
] as const
export const RIVERSIDE_ENVIRONMENT_READY = new Set(['river-sky', 'river-houses-left', 'river-houses-right', 'river-corridor', 'river-water-boardwalk'])

function drawRiverSky(g: Phaser.GameObjects.Graphics): void {
  g.fillGradientStyle(0x102b43, 0x102b43, 0x345a69, 0x345a69, 1)
  g.fillRect(0, 0, 1536, 864)
  g.fillStyle(0xf3d295, 0.68)
  g.fillCircle(1190, 190, 82)
  g.fillStyle(0xf3d295, 0.16)
  g.fillCircle(1190, 190, 124)
  g.fillStyle(0x183946, 0.84)
  g.fillTriangle(940, 510, 1080, 340, 1220, 510)
  g.fillTriangle(1135, 510, 1270, 370, 1410, 510)
}
function drawRiverHouse(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x50372b, 0.96)
  g.fillPoints([{ x: 30, y: 210 }, { x: 350, y: 55 }, { x: 670, y: 210 }], true)
  g.fillStyle(0x78523b, 0.98)
  g.fillRect(86, 200, 528, 258)
  g.fillStyle(0x293b50, 0.95)
  for (const x of [145, 280, 415, 550]) g.fillRect(x, 248, 34, 210)
  g.fillStyle(0xf2b45b, 0.82)
  for (const x of [174, 310, 446, 580]) g.fillRoundedRect(x, 263, 18, 45, 6)
  g.fillStyle(0x50372b, 0.96)
  for (const x of [115, 545]) g.fillRect(x, 442, 18, 118)
}
function drawRiverCorridor(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x284659, 0.24)
  g.fillRoundedRect(0, 48, 1536, 224, 72)
  g.fillStyle(0xc1a77c, 0.09)
  g.fillRoundedRect(180, 78, 1176, 170, 68)
}
function drawRiverWater(g: Phaser.GameObjects.Graphics): void {
  g.fillGradientStyle(0x254f60, 0x254f60, 0x132e3b, 0x132e3b, 1)
  g.fillRect(0, 0, 1536, 420)
  g.fillStyle(0xf2b45b, 0.38)
  for (let x = 90; x < 1500; x += 186) g.fillRoundedRect(x, 92 + (x % 3) * 28, 82, 5, 3)
  // Match the raster asset's playable bridge at its top edge. Gameplay feet use
  // this same deck in both loaded-art and fallback rendering paths.
  g.fillStyle(0xb37a4b, 1)
  g.fillRect(0, 36, 1536, 22)
  g.fillStyle(0x50372b, 1)
  g.fillRect(0, 58, 1536, 30)
  g.fillStyle(0xd0a06a, 0.76)
  g.fillRect(0, 36, 1536, 4)
  g.lineStyle(2, 0x332521, 0.8)
  for (let x = 0; x < 1536; x += 96) g.lineBetween(x, 36, x, 58)
  for (let x = 72; x < 1536; x += 240) {
    g.fillStyle(0x3f2d26, 1)
    g.fillRect(x, 0, 18, 118)
  }
  g.fillStyle(0x688367, 0.92)
  for (const [x, y] of [[100, 92], [340, 120], [1240, 88], [1450, 140]] as const) {
    g.fillEllipse(x, y, 84, 26)
    g.fillStyle(0x92a174, 0.9)
    g.fillCircle(x + 26, y - 4, 3)
    g.fillStyle(0x688367, 0.92)
  }
}

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
  // zone 2 pests (fallbacks reuse the zone-1 shapes until the SVGs load)
  A(MONSTER_KEYS['hoi-cherry'], '/assets/monsters/hoi-cherry.svg', 280, 280, drawCrab, [80, 80]),
  A(MONSTER_KEYS['phak-tob-chawai-yak'], '/assets/monsters/phak-tob-chawai-yak.svg', 320, 320, drawNuNa, [88, 88]),
  A(MONSTER_KEYS['pla-chon-yak'], '/assets/monsters/pla-chon-yak.svg', 320, 320, drawLocust, [88, 88]),
  A(MONSTER_KEYS['jorakhe-thao-bueng'], '/assets/monsters/jorakhe-thao-bueng.svg', 720, 720, drawRaja, [144, 144]),

  A('art-prop-hay-bale', '/assets/scene/props/hay-bale.svg', 200, 200, drawHayBale, [64, 64]),
  A('art-prop-scarecrow', '/assets/scene/props/scarecrow.svg', 200, 200, drawScarecrow, [64, 64]),
  A('art-prop-water-jar', '/assets/scene/props/water-jar.svg', 200, 200, drawJar, [64, 64]),
  A('art-prop-fence', '/assets/scene/props/fence.svg', 200, 200, drawFence, [64, 64]),
  A('art-prop-rice-bundle', '/assets/scene/props/rice-bundle.svg', 200, 200, drawRiceBundle, [64, 64]),

  // every non-mintable item can arrive through the inventory diff, so load all of them
  ...[101, 102, 103, 104, 201, 202, 203, 204, 205, 206, 207, 208, 1001, 1002, 1003, 1004, 1005, 1006, 2001, 2002, 2003, 3001, 3002].map((id) =>
    A(itemKey(id), `/assets/items/${id}.svg`, 96, 96, drawItem(0xc9a24b), [48, 48]),
  ),
]

/**
 * A tinted copy of a texture baked into a canvas, so zone palettes and pest skins
 * render the same on the Canvas renderer (Phaser's setTint is WebGL-only, and the
 * capture rig runs on Canvas). Cached per (key, tint); 0xffffff returns the base.
 */
export function tintedTexture(scene: Phaser.Scene, baseKey: string, tint: number): string {
  if (tint === 0xffffff) return baseKey
  const key = `${baseKey}-tint-${tint.toString(16)}`
  if (scene.textures.exists(key)) return key
  const src = scene.textures.get(baseKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement
  const w = src.width
  const h = src.height
  if (!w || !h) return baseKey
  const ct = scene.textures.createCanvas(key, w, h)
  if (!ct) return baseKey
  const ctx = ct.context
  ctx.drawImage(src, 0, 0)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = `#${tint.toString(16).padStart(6, '0')}`
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(src, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ct.refresh()
  return key
}

/**
 * Assets whose SVG the art lane has not committed yet. The loader skips them (the
 * drawn fallback is used) so the console shows no 404s — a browser logs every
 * missing network request, so the only quiet option is not to ask for the file.
 * Remove an entry when its SVG lands in /public/assets.
 */
export const PENDING_SVG: ReadonlySet<string> = new Set([])

/** Generate the code-drawn stand-in for every asset whose SVG never arrived. */
export function ensureFallbacks(scene: Phaser.Scene): void {
  const riverside = isRiversideArtProfile()
  for (const spec of ART) {
    if (scene.textures.exists(spec.key)) continue // SVG loaded fine
    // The riverside renderer builds its environment from RIVERSIDE_ENVIRONMENT.
    // Avoid allocating legacy background and cloud textures that no live object
    // will reference. Props are still used by the riverside scene and must remain.
    if (riverside && spec.url.includes('/assets/scene/') && !spec.url.includes('/assets/scene/props/')) continue
    const g = scene.add.graphics()
    const riversideReplacement = riverside && spec.riverside && RIVERSIDE_READY_KEYS.has(spec.key) ? spec.riverside : undefined
    ;(riversideReplacement?.draw ?? spec.draw)(g)
    const [w, h] = riversideReplacement?.fb ?? spec.fb ?? [spec.w, spec.h]
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
  kite: 'fx-kite',
  butterfly: 'fx-butterfly',
  chaff: 'fx-chaff',
  plume1: 'fx-plume-1',
  plume2: 'fx-plume-2',
  comb: 'fx-comb',
  medal: 'fx-medal',
  hatBand1: 'fx-hat-band-1',
  hatBand2: 'fx-hat-band-2',
  scarf: 'fx-scarf',
  cape: 'fx-cape',
  bag: 'fx-seed-bag',
  lotus: 'fx-lotus',
  lotusWhite: 'fx-lotus-white',
  walkway: 'fx-walkway',
  treeline: 'fx-treeline',
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

  // lotus on a lily pad — บึงบัวหลวง prop (origin centre)
  make(FX.lotus, 160, 100, (g) => {
    g.fillStyle(0x4f9a5a)
    g.fillEllipse(80, 72, 150, 44)
    g.lineStyle(4, OUTLINE)
    g.strokeEllipse(80, 72, 150, 44)
    g.fillStyle(0xff8fb1)
    for (const [x, y] of [[62, 40], [98, 40], [80, 30], [70, 52], [90, 52]] as const) g.fillEllipse(x, y, 26, 40)
    g.lineStyle(3, OUTLINE)
    for (const [x, y] of [[62, 40], [98, 40], [80, 30], [70, 52], [90, 52]] as const) g.strokeEllipse(x, y, 26, 40)
    g.fillStyle(0xffd24a)
    g.fillCircle(80, 46, 9)
  })

  // mid-ground treeline: rounded canopies along the horizon (white; tinted per zone)
  make(FX.treeline, 1920, 160, (g) => {
    g.fillStyle(0xffffff, 1)
    g.fillRect(0, 110, 1920, 50)
    let x = -40
    let i = 0
    while (x < 1980) {
      const r = 44 + ((i * 37) % 40)
      g.fillCircle(x, 118 - ((i * 23) % 30), r)
      x += r * 1.1
      i++
    }
  })

  make(FX.lotusWhite, 160, 100, (g) => {
    g.fillStyle(0x3f8a52)
    g.fillEllipse(80, 72, 150, 44)
    g.lineStyle(4, OUTLINE)
    g.strokeEllipse(80, 72, 150, 44)
    g.fillStyle(0xfff8ec)
    for (const [x, y] of [[62, 40], [98, 40], [80, 30], [70, 52], [90, 52]] as const) g.fillEllipse(x, y, 26, 40)
    g.lineStyle(3, OUTLINE)
    for (const [x, y] of [[62, 40], [98, 40], [80, 30], [70, 52], [90, 52]] as const) g.strokeEllipse(x, y, 26, 40)
    g.fillStyle(0xffd24a)
    g.fillCircle(80, 46, 9)
  })
  // wooden walkway planks (tiled along the bottom of the pond)
  make(FX.walkway, 240, 110, (g) => {
    g.fillStyle(0x8a5a33)
    g.fillRect(0, 20, 240, 70)
    g.lineStyle(4, OUTLINE)
    g.strokeRect(2, 20, 236, 70)
    g.lineStyle(3, 0x5c3a1e)
    for (const x of [60, 120, 180]) g.lineBetween(x, 22, x, 88)
    g.fillStyle(0xa9774c)
    g.fillRect(0, 26, 240, 10)
    // posts
    g.fillStyle(0x6e4a2e)
    g.fillRect(14, 0, 16, 30)
    g.fillRect(210, 0, 16, 30)
    g.lineStyle(3, OUTLINE)
    g.strokeRect(14, 0, 16, 30)
    g.strokeRect(210, 0, 16, 30)
  })

  // --- power-tier gear (drawn over the SVG actors; tier 1 silver/teal, tier 2 gold/iridescent) ---
  const featherArc = (g: Phaser.GameObjects.Graphics, x0: number, y0: number, len: number, ang: number, color: number, w: number): void => {
    // a tapered feather: thick outlined stroke then a bright core
    const x1 = x0 + Math.cos(ang) * len
    const y1 = y0 + Math.sin(ang) * len
    const cx = (x0 + x1) / 2 - Math.sin(ang) * len * 0.35
    const cy = (y0 + y1) / 2 + Math.cos(ang) * len * 0.35
    const pts = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x0, y0), new Phaser.Math.Vector2(cx, cy), new Phaser.Math.Vector2(x1, y1)).getPoints(14)
    g.lineStyle(w + 6, OUTLINE, 1)
    g.beginPath()
    g.moveTo(pts[0].x, pts[0].y)
    for (const p of pts) g.lineTo(p.x, p.y)
    g.strokePath()
    g.lineStyle(w, color, 1)
    g.beginPath()
    g.moveTo(pts[0].x, pts[0].y)
    for (const p of pts) g.lineTo(p.x, p.y)
    g.strokePath()
  }
  // sickle tail plumes: root at the bottom-right corner, sweeping up-left
  // palette colours (no neon): teal, silver / rose, teal, gold, clay
  make(FX.plume1, 220, 260, (g) => {
    featherArc(g, 200, 240, 200, Phaser.Math.DegToRad(-140), 0x5aa9a0, 16)
    featherArc(g, 200, 240, 180, Phaser.Math.DegToRad(-118), 0xdfe6ee, 16)
  })
  make(FX.plume2, 320, 340, (g) => {
    featherArc(g, 300, 320, 300, Phaser.Math.DegToRad(-150), 0xd97aa8, 18)
    featherArc(g, 300, 320, 290, Phaser.Math.DegToRad(-134), 0x5aa9a0, 18)
    featherArc(g, 300, 320, 280, Phaser.Math.DegToRad(-118), 0xe8c25a, 18)
    featherArc(g, 300, 320, 240, Phaser.Math.DegToRad(-102), 0xe08a4a, 16)
  })
  // gold comb: three outlined lobes
  make(FX.comb, 96, 64, (g) => {
    for (const [x, y, r] of [[22, 34, 18], [48, 22, 22], [76, 34, 18]] as const) {
      g.fillStyle(0xffd24a)
      g.fillCircle(x, y, r)
      g.lineStyle(4, OUTLINE)
      g.strokeCircle(x, y, r)
    }
    g.fillStyle(0xfff3d6, 0.8)
    g.fillCircle(44, 18, 7)
  })
  // sash medal: gold star on a red ribbon
  make(FX.medal, 64, 80, (g) => {
    g.fillStyle(0xe2574c)
    g.fillTriangle(20, 0, 44, 0, 32, 34)
    g.lineStyle(3, OUTLINE)
    g.strokeTriangle(20, 0, 44, 0, 32, 34)
    const pts: Phaser.Geom.Point[] = []
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 26 : 11
      const a = (Math.PI / 5) * i - Math.PI / 2
      pts.push(new Phaser.Geom.Point(32 + Math.cos(a) * r, 50 + Math.sin(a) * r))
    }
    g.fillStyle(0xffd24a)
    g.fillPoints(pts, true)
    g.lineStyle(3, OUTLINE)
    g.strokePoints(pts, true)
  })
  // hat bands: silver (tier 1) and gold with a hanging tassel (tier 2)
  make(FX.hatBand1, 240, 60, (g) => {
    g.fillStyle(0xdfe6ee)
    g.fillRoundedRect(8, 18, 224, 24, 10)
    g.lineStyle(4, OUTLINE)
    g.strokeRoundedRect(8, 18, 224, 24, 10)
  })
  make(FX.hatBand2, 240, 110, (g) => {
    g.fillStyle(0xffd24a)
    g.fillRoundedRect(8, 18, 224, 26, 10)
    g.lineStyle(4, OUTLINE)
    g.strokeRoundedRect(8, 18, 224, 26, 10)
    g.fillStyle(0xe2574c)
    g.fillCircle(120, 31, 9)
    // tassel
    g.lineStyle(6, OUTLINE)
    g.lineBetween(218, 40, 214, 78)
    g.lineStyle(3, 0xffd24a)
    g.lineBetween(218, 40, 214, 78)
    g.fillStyle(0xe2574c)
    g.fillEllipse(214, 90, 18, 26)
    g.lineStyle(3, OUTLINE)
    g.strokeEllipse(214, 90, 18, 26)
  })
  // scarf (tier 1 teal) and cape (tier 2 crimson with gold hem), origin at the shoulders
  make(FX.scarf, 160, 120, (g) => {
    g.fillStyle(0x3fb8c9)
    g.fillRoundedRect(10, 10, 140, 34, 14)
    g.fillTriangle(30, 40, 70, 40, 44, 110)
    g.lineStyle(4, OUTLINE)
    g.strokeRoundedRect(10, 10, 140, 34, 14)
    g.strokeTriangle(30, 40, 70, 40, 44, 110)
  })
  make(FX.cape, 220, 260, (g) => {
    g.fillStyle(0xc4302b)
    g.fillTriangle(60, 10, 160, 10, 210, 240)
    g.fillTriangle(60, 10, 210, 240, 10, 240)
    g.fillStyle(0xffd24a)
    g.fillRect(10, 226, 200, 16)
    g.lineStyle(5, OUTLINE)
    g.beginPath()
    g.moveTo(60, 10)
    g.lineTo(160, 10)
    g.lineTo(210, 240)
    g.lineTo(10, 240)
    g.closePath()
    g.strokePath()
  })
  // thrown seed bag (the trainer's ranged attack)
  make(FX.bag, 64, 64, (g) => {
    g.fillStyle(0xd9b45c)
    g.fillEllipse(32, 38, 44, 40)
    g.fillStyle(0xb98d3e)
    g.fillRoundedRect(20, 8, 24, 16, 6)
    g.lineStyle(4, OUTLINE)
    g.strokeEllipse(32, 38, 44, 40)
    g.strokeRoundedRect(20, 8, 24, 16, 6)
    g.lineStyle(3, 0xe2574c)
    g.lineBetween(18, 24, 46, 24)
  })

  // butterfly: two wings + body (flaps by scaling X), and a rice-chaff flake
  make(FX.butterfly, 56, 40, (g) => {
    g.fillStyle(0xffb347)
    g.fillEllipse(16, 16, 26, 22)
    g.fillEllipse(40, 16, 26, 22)
    g.fillStyle(0xffd24a)
    g.fillEllipse(18, 28, 18, 14)
    g.fillEllipse(38, 28, 18, 14)
    g.lineStyle(3, OUTLINE)
    g.strokeEllipse(16, 16, 26, 22)
    g.strokeEllipse(40, 16, 26, 22)
    g.strokeEllipse(18, 28, 18, 14)
    g.strokeEllipse(38, 28, 18, 14)
    g.fillStyle(OUTLINE)
    g.fillEllipse(28, 20, 6, 24)
  })
  make(FX.chaff, 14, 8, (g) => {
    g.fillStyle(0xffffff)
    g.fillEllipse(7, 4, 14, 6)
  })

  // Thai diamond kite (ว่าว) with a bow tail — sky filler, origin at the centre
  make(FX.kite, 120, 200, (g) => {
    g.fillStyle(0xe2574c)
    g.fillTriangle(60, 4, 116, 70, 60, 136)
    g.fillStyle(0xffd24a)
    g.fillTriangle(60, 4, 4, 70, 60, 136)
    g.lineStyle(4, OUTLINE)
    g.strokeTriangle(60, 4, 116, 70, 60, 136)
    g.strokeTriangle(60, 4, 4, 70, 60, 136)
    g.lineBetween(60, 4, 60, 136)
    g.lineBetween(4, 70, 116, 70)
    g.lineStyle(3, OUTLINE)
    g.lineBetween(60, 136, 52, 196)
    for (const [y, c] of [[150, 0x3b82c4], [166, 0xffd24a], [182, 0xe2574c]] as const) {
      g.fillStyle(c)
      g.fillTriangle(48, y - 6, 66, y, 48, y + 6)
      g.fillTriangle(66, y - 6, 48, y, 66, y + 6)
    }
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
