import type Phaser from 'phaser'

export type WalkActorKind = 'trainer' | 'rooster'

export interface WalkPose {
  leftX: number
  leftY: number
  rightX: number
  rightY: number
  upperX: number
  upperY: number
  upperAngle: number
}

export interface WalkRigState {
  moving: boolean
  facing: -1 | 1
  /** An attack always wins over locomotion and shows the untouched source sprite. */
  attackActive: boolean
  /** 1 is the ordinary gait; Auto may pass the absolute journey motion here. */
  pace?: number
}

export interface WalkRigOptions {
  /** Trainer uses its stride artwork while its idle sprite remains untouched. */
  movingTextureKey?: string
  movingOriginY?: number
  reducedMotion?: boolean
}

export interface WalkRig {
  update(delta: number, state: WalkRigState): void
  /** Re-reads texture dimensions, display size, origin and alpha from the source. */
  syncSource(): void
  reset(): void
  destroy(): void
  debugState(): { phase: number; walking: boolean }
}

interface CropSpec {
  x: number
  y: number
  width: number
  height: number
}

interface RigSpec {
  upper: CropSpec
  left: CropSpec
  right: CropSpec
  cyclesPerSecond: number
  strideX: number
  liftY: number
  swayX: number
  swayY: number
  swayAngle: number
}

const TWO_PI = Math.PI * 2

// Normalized crops intentionally overlap around the hips. This keeps the sash or
// breast feathers sealed while the feet move, including on the code-drawn fallback.
const RIG_SPECS: Record<WalkActorKind, RigSpec> = {
  trainer: {
    upper: { x: 0, y: 0, width: 1, height: 0.66 },
    left: { x: 0.08, y: 0.5, width: 0.48, height: 0.5 },
    right: { x: 0.42, y: 0.5, width: 0.52, height: 0.5 },
    cyclesPerSecond: 1.85,
    strideX: 0.035,
    liftY: 0.025,
    swayX: 0.006,
    swayY: 0.008,
    swayAngle: 1.2,
  },
  rooster: {
    upper: { x: 0, y: 0, width: 1, height: 0.84 },
    left: { x: 0.35, y: 0.68, width: 0.24, height: 0.32 },
    right: { x: 0.51, y: 0.68, width: 0.28, height: 0.32 },
    cyclesPerSecond: 2.8,
    strideX: 0.028,
    liftY: 0.018,
    swayX: 0.008,
    swayY: 0.012,
    swayAngle: 1.8,
  },
}

/** Writes a deterministic alternating-leg pose into `out` without allocating. */
export function walkPoseAt(kind: WalkActorKind, phase: number, out: WalkPose): WalkPose {
  const spec = RIG_SPECS[kind]
  const rawWave = Math.sin(phase * TWO_PI)
  const wave = Math.abs(rawWave) < 1e-12 ? 0 : rawWave
  const compression = Math.abs(wave)
  out.leftX = wave * spec.strideX
  out.leftY = wave > 0 ? -wave * spec.liftY : 0
  out.rightX = wave === 0 ? 0 : -wave * spec.strideX
  out.rightY = wave < 0 ? wave * spec.liftY : 0
  out.upperX = wave === 0 ? 0 : -wave * spec.swayX
  out.upperY = compression * spec.swayY
  out.upperAngle = wave === 0 ? 0 : -wave * spec.swayAngle
  return out
}

function setNormalizedCrop(image: Phaser.GameObjects.Image, crop: CropSpec): void {
  const frame = image.frame
  const width = frame.realWidth
  const height = frame.realHeight
  image.setCrop(
    Math.round(width * crop.x),
    Math.round(height * crop.y),
    Math.max(1, Math.round(width * crop.width)),
    Math.max(1, Math.round(height * crop.height)),
  )
}

/**
 * Builds a small, Canvas-compatible cutout rig from the existing actor texture.
 * It never mutates the supplied parent container: the original source remains the
 * single rendering path for idle and combat, while owned cropped pieces render only
 * during travel. Phase persists across stops so the next step alternates naturally.
 */
export function createWalkRig(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  source: Phaser.GameObjects.Image,
  kind: WalkActorKind,
  options: WalkRigOptions = {},
): WalkRig {
  const spec = RIG_SPECS[kind]
  const textureKey = options.movingTextureKey ?? source.texture.key
  const root = scene.add.container(0, 0).setVisible(false)
  const left = scene.add.image(0, 0, textureKey).setVisible(false)
  const right = scene.add.image(0, 0, textureKey).setVisible(false)
  const upper = scene.add.image(0, 0, textureKey).setVisible(false)
  root.add([left, right, upper])
  parent.add(root)

  const pose: WalkPose = {
    leftX: 0,
    leftY: 0,
    rightX: 0,
    rightY: 0,
    upperX: 0,
    upperY: 0,
    upperAngle: 0,
  }
  let phase = 0
  let walking = false
  let destroyed = false

  const syncSource = (): void => {
    if (destroyed) return
    for (const part of [left, right, upper]) {
      if (part.texture.key !== textureKey) part.setTexture(textureKey)
      part
        .setOrigin(source.originX, options.movingOriginY ?? source.originY)
        .setDisplaySize(source.displayWidth, source.displayHeight)
        .setAlpha(source.alpha)
        .setBlendMode(source.blendMode)
    }
    setNormalizedCrop(left, spec.left)
    setNormalizedCrop(right, spec.right)
    setNormalizedCrop(upper, spec.upper)
  }

  const showSource = (): void => {
    root.setVisible(false)
    left.setVisible(false)
    right.setVisible(false)
    upper.setVisible(false)
    source.setVisible(true)
    walking = false
  }

  const update = (delta: number, state: WalkRigState): void => {
    if (destroyed) return
    if (!state.moving || state.attackActive || options.reducedMotion) {
      showSource()
      return
    }

    const pace = Math.max(0.35, Math.min(1.75, Math.abs(state.pace ?? 1)))
    const seconds = Math.max(0, Math.min(delta, 50)) / 1000
    phase = (phase + seconds * spec.cyclesPerSecond * pace) % 1
    walkPoseAt(kind, phase, pose)

    // Compensate for any facing already applied to the shared body container.
    // This lets callers keep their existing attack-facing logic without a double flip.
    const parentFacing = parent.scaleX < 0 ? -1 : 1
    root.setScale(state.facing * parentFacing, 1)
    root.setVisible(true)
    source.setVisible(false)
    left.setVisible(true)
    right.setVisible(true)
    upper.setVisible(true)

    const width = source.displayWidth
    const height = source.displayHeight
    left.setPosition(pose.leftX * width, pose.leftY * height)
    right.setPosition(pose.rightX * width, pose.rightY * height)
    upper.setPosition(pose.upperX * width, pose.upperY * height).setAngle(pose.upperAngle)
    walking = true
  }

  const reset = (): void => {
    if (destroyed) return
    left.setPosition(0, 0)
    right.setPosition(0, 0)
    upper.setPosition(0, 0).setAngle(0)
    root.setScale(1, 1)
    showSource()
  }

  const destroy = (): void => {
    if (destroyed) return
    showSource()
    destroyed = true
    root.destroy(true)
  }

  syncSource()

  return {
    update,
    syncSource,
    reset,
    destroy,
    debugState: () => ({ phase, walking }),
  }
}
