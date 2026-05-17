import type { CharacterBody } from './character'
import type { MoveIntent } from './intent'
import { accelerate, applyFriction } from './movement'
import type { Vec3 } from './types'

export type CharacterState = Readonly<{
  velocity: Vec3
  grounded: boolean
  // Last known surface normal. Meaningful only while grounded; carried
  // across ticks so the slide branch can read it before tryMove runs.
  groundNormal: Vec3
}>

export type StepTuning = Readonly<{
  gravity: number
  jumpSpeed: number
  groundFriction: number
  groundStopSpeed: number
  groundWishSpeed: number
  groundAccel: number
  airWishSpeed: number
  airAccel: number
}>

// Removes the component of v perpendicular to n: v - (v·n)·n. On a
// slope, this turns "gravity straight down" into "gravity along the
// surface tangent" — the downslope acceleration that drives sliding.
const projectOntoTangent = (v: Vec3, n: Vec3): Vec3 => {
  const dot = v[0] * n[0] + v[1] * n[1] + v[2] * n[2]
  return [v[0] - dot * n[0], v[1] - dot * n[1], v[2] - dot * n[2]]
}

// biome-ignore format: multi-line signature keeps typed params readable
export const stepCharacter = (
  state: CharacterState,
  intent: MoveIntent,
  body: CharacterBody,
  tuning: StepTuning,
  dt: number,
): CharacterState => {
  let v: Vec3 = state.velocity
  let grounded = state.grounded
  let groundNormal: Vec3 = state.groundNormal
  // Snapshot whether this tick is a slide; jump can flip grounded below,
  // but the post-move landing clamp still needs to know we were sliding.
  const sliding = grounded && intent.wantsCrouch

  // gravity
  v = [v[0], v[1] + tuning.gravity * dt, v[2]]

  // jump takes precedence over slide: pressing space mid-slide cancels it
  if (grounded && intent.wantsJump) {
    v = [v[0], tuning.jumpSpeed, v[2]]
    grounded = false
  } else if (sliding) {
    v = projectOntoTangent(v, groundNormal)
  } else if (grounded) {
    v = applyFriction(v, {
      friction: tuning.groundFriction,
      stopSpeed: tuning.groundStopSpeed,
      dt,
    })
    v = accelerate(v, {
      wishDir: intent.wishDir,
      wishSpeed: tuning.groundWishSpeed,
      accel: tuning.groundAccel,
      dt,
    })
  } else {
    v = accelerate(v, {
      wishDir: intent.wishDir,
      wishSpeed: tuning.airWishSpeed,
      accel: tuning.airAccel,
      dt,
    })
  }

  const desired: Vec3 = [v[0] * dt, v[1] * dt, v[2] * dt]
  const response = body.tryMove(desired)
  grounded = response.grounded
  if (response.grounded) {
    groundNormal = response.groundNormal
  }

  // landing clamp: kill downward velocity so gravity doesn't accumulate
  // across grounded ticks. Sliding has already projected v onto the slope
  // tangent — its negative vy is the slope's vy component, not stray
  // gravity, so we must NOT clamp it.
  if (grounded && !sliding && v[1] < 0) {
    v = [v[0], 0, v[2]]
  }

  return { velocity: v, grounded, groundNormal }
}
