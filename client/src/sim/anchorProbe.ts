import type { Vec3 } from './types'

// Port (Cockburn): the sim asks an AnchorProbe whether a fired grapple
// finds something to attach to in a given direction within reach. The
// probe is implemented by engine/rapierAnchorProbe.ts in production
// (Rapier raycast) and by a fake in tests. The sim never sees the word
// "ray" — that's adapter vocabulary.
//
// Discriminated union: the hit point only exists when found is true,
// so the sim cannot accidentally read a phantom anchor on a miss.

export type AnchorHit =
  | Readonly<{ found: false }>
  | Readonly<{ found: true; point: Vec3 }>

export type AnchorProbe = {
  readonly findAnchor: (
    origin: Vec3,
    direction: Vec3,
    maxRange: number,
  ) => AnchorHit
}
