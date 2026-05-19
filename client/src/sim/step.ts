import type { AnchorProbe } from './anchorProbe'
import type { CharacterBody } from './character'
import {
  fireGrapple,
  type GrappleState,
  type GrappleTuning,
  grappleAcceleration,
} from './grapple'
import type { MoveIntent } from './intent'
import { accelerate, applyFriction } from './movement'
import type { Vec3 } from './types'

export type CharacterState = Readonly<{
  // World-space position. The sim owns position (alongside velocity)
  // so that the same step logic runs server-authoritatively in the
  // future Go port, where Rapier does not exist. On the client, the
  // CharacterBody adapter reports the post-collision-correction
  // position via the response, and stepCharacter writes it here —
  // keeping sim and Rapier in lock-step within a tick.
  position: Vec3
  velocity: Vec3
  grounded: boolean
  // Last known surface normal. Meaningful only while grounded; carried
  // across ticks so the slide branch can read it before tryMove runs.
  groundNormal: Vec3
  // Current grapple attachment. Owned by the intent/event layer
  // (fireGrapple / releaseGrapple); stepCharacter reads it but does
  // not transition between attached/detached. When attached, the spring
  // acceleration composes with the rest of the step (bullet c).
  grapple: GrappleState
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
  // Tuning for the grapple spring; consumed by stepCharacter when
  // state.grapple is attached. Lives here so all per-tick tuning sits
  // in one object (StepTuning is the canonical place for numbers a
  // designer would dial — see the Anti-patterns rule in CLAUDE.md).
  grapple: GrappleTuning
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
  probe: AnchorProbe,
  tuning: StepTuning,
  dt: number,
): CharacterState => {
  let v: Vec3 = state.velocity
  let grounded = state.grounded
  let groundNormal: Vec3 = state.groundNormal
  // Snapshot whether this tick is a slide; jump can flip grounded below,
  // but the post-move landing clamp still needs to know we were sliding.
  const sliding = grounded && intent.wantsCrouch

  // Grapple dispatch — runs before the force composition below so the
  // spring engages on the same tick the player fires (no one-tick delay
  // between click and pull). fireGrapple re-resolves from the world on
  // every call (see grapple.ts), so re-firing while attached either
  // re-anchors or detaches, exactly as the idempotency rule prescribes.
  let grapple: GrappleState = state.grapple
  if (intent.firedGrapple) {
    grapple = fireGrapple(
      grapple,
      state.position,
      intent.lookDir,
      tuning.grapple.maxRange,
      probe,
    )
  }

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

  // Grapple force composes on top of the input/friction branches (bullet
  // c: the spring is felt regardless of ground/air state). When detached,
  // grappleAcceleration returns ZERO so this is a no-op — no branch
  // needed. Order matches Quake3 bg_pmove.c: external forces after
  // input-driven accel, before the collision sweep.
  const ga = grappleAcceleration(grapple, state.position, v, tuning.grapple)
  v = [v[0] + ga[0] * dt, v[1] + ga[1] * dt, v[2] + ga[2] * dt]

  const desired: Vec3 = [v[0] * dt, v[1] * dt, v[2] * dt]
  const response = body.tryMove(desired)
  const position = response.position
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

  return {
    position,
    velocity: v,
    grounded,
    groundNormal,
    grapple,
  }
}
