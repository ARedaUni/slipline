import type { Vec3 } from './types'

export type CollisionResponse = Readonly<{
  grounded: boolean
}>

// Port (Cockburn): the sim asks a CharacterBody to attempt a movement.
// The body — Rapier KCC in production, a fake in tests — applies any
// collision correction and reports back whether the character is grounded.
// The sim depends on this interface, never on the implementation.
export type CharacterBody = {
  readonly tryMove: (desired: Vec3) => CollisionResponse
}
