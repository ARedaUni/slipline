import type { Vec3 } from './types'

// A grapple is a damped Hookean spring tether between the player and an
// anchor point in the world. When attached and stretched past restLength,
// it pulls the player toward the anchor; damping bleeds off radial
// oscillation so the player doesn't yo-yo forever.
//
// Modelled as a discriminated union so the math cannot accidentally read
// an anchor that doesn't exist.

export type GrappleState =
  | Readonly<{ attached: false }>
  | Readonly<{ attached: true; anchor: Vec3 }>

export type GrappleTuning = Readonly<{
  // Natural length of the rope. Below this distance the rope is slack
  // and exerts no force (a rope can pull, but cannot push).
  restLength: number
  // Hooke's spring constant k in F = -k·x. Higher = snappier pull.
  stiffness: number
  // Viscous damping coefficient c in F = -c·v_radial. Higher = less yo-yo.
  damping: number
}>

const ZERO: Vec3 = [0, 0, 0]

// biome-ignore format: multi-line signature keeps typed params readable
export const grappleAcceleration = (
  state: GrappleState,
  position: Vec3,
  velocity: Vec3,
  tuning: GrappleTuning,
): Vec3 => {
  if (!state.attached) return ZERO

  const rx = state.anchor[0] - position[0]
  const ry = state.anchor[1] - position[1]
  const rz = state.anchor[2] - position[2]
  const length = Math.sqrt(rx * rx + ry * ry + rz * rz)

  // Slack rope (or exactly at rest length) exerts no force. The guard
  // also protects the division by `length` below when the player happens
  // to be sitting on the anchor.
  const extension = length - tuning.restLength
  if (extension <= 0) return ZERO

  // unit vector toward anchor
  const ux = rx / length
  const uy = ry / length
  const uz = rz / length

  // Hooke spring: positive scalar k·x, pulls inward along û.
  const springMag = tuning.stiffness * extension
  // Viscous damping opposes RADIAL velocity (v·û). Tangential motion is
  // preserved — that's what lets the player swing on the grapple.
  const vRadial = velocity[0] * ux + velocity[1] * uy + velocity[2] * uz
  // Signed scalar — positive = pull toward anchor, negative = push away.
  // Goes negative when damping overpowers spring (very fast inward motion),
  // which correctly brakes the player from overshooting through the anchor.
  const radialAccel = springMag - tuning.damping * vRadial

  return [radialAccel * ux, radialAccel * uy, radialAccel * uz]
}
