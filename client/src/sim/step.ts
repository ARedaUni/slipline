import type { CharacterBody } from './character'
import type { MoveIntent } from './intent'
import { accelerate, applyFriction } from './movement'
import type { Vec3 } from './types'

export type CharacterState = Readonly<{
  velocity: Vec3
  grounded: boolean
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

  // gravity
  v = [v[0], v[1] + tuning.gravity * dt, v[2]]

  // jump: only when grounded; immediately ungrounds the sim's view
  if (grounded && intent.wantsJump) {
    v = [v[0], tuning.jumpSpeed, v[2]]
    grounded = false
  }

  if (grounded) {
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

  // landing: kill downward velocity so gravity doesn't accumulate while grounded
  if (grounded && v[1] < 0) {
    v = [v[0], 0, v[2]]
  }

  return { velocity: v, grounded }
}
