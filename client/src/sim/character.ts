import type { Vec3 } from './types'

// Port (Cockburn): the sim asks a CharacterBody to attempt a movement.
// The body — Rapier KCC in production, a fake in tests — applies any
// collision correction and reports back whether the character is grounded
// and (when grounded) the surface normal it landed on. The slide branch
// in stepCharacter projects gravity along this normal to compute the
// downslope impulse.
//
// Modelled as a discriminated union: the groundNormal only exists when
// grounded is true, so the sim cannot accidentally read a stale normal
// while airborne.

export type CollisionResponse =
  | Readonly<{ grounded: false; position: Vec3 }>
  | Readonly<{ grounded: true; groundNormal: Vec3; position: Vec3 }>

export type CharacterBody = {
  readonly tryMove: (desired: Vec3) => CollisionResponse
}
