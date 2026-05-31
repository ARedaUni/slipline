import RAPIER from '@dimforge/rapier3d-compat'

// Arena geometry, expressed as a list of convex boxes — the same discipline
// as Quake's brush-based mapping (see CLAUDE.md → "What good looks like"):
// every piece is convex, so its visual mesh and its collider can share one
// shape. Both `createArena` (this file) and `<Arena/>` (scene) iterate the
// same list — there is no second source of truth that can drift.

export type Vec3Lit = {
  readonly x: number
  readonly y: number
  readonly z: number
}

export type ArenaPiece = {
  readonly id: string
  readonly halfExtents: Vec3Lit
  readonly center: Vec3Lit
  // Rotation around the piece's own Z axis, in radians. Used for ramps.
  readonly rotationZ?: number
  readonly color: string
  // Defaults to true. Set false for floor-like pieces whose cast shadows
  // would only fall on themselves.
  readonly castShadow?: boolean
}

const axisAngleZ = (radians: number) => ({
  x: 0,
  y: 0,
  z: Math.sin(radians / 2),
  w: Math.cos(radians / 2),
})

const RAMP_ANGLE_RAD = (25 * Math.PI) / 180

export const ARENA: readonly ArenaPiece[] = [
  {
    id: 'floor',
    halfExtents: { x: 10, y: 0.1, z: 10 },
    center: { x: 0, y: -0.1, z: 0 },
    color: '#2a2d36',
    castShadow: false,
  },
  {
    id: 'ramp',
    halfExtents: { x: 3, y: 0.1, z: 1.5 },
    center: { x: 6, y: 1.2, z: -3 },
    rotationZ: RAMP_ANGLE_RAD,
    color: '#4a6e8a',
  },
  {
    id: 'wall',
    halfExtents: { x: 3, y: 2.5, z: 0.25 },
    center: { x: 0, y: 2.5, z: -10 },
    color: '#8a6e4a',
  },
]

const pieceToColliderDesc = (piece: ArenaPiece): RAPIER.ColliderDesc => {
  const desc = RAPIER.ColliderDesc.cuboid(
    piece.halfExtents.x,
    piece.halfExtents.y,
    piece.halfExtents.z,
  ).setTranslation(piece.center.x, piece.center.y, piece.center.z)
  return piece.rotationZ === undefined
    ? desc
    : desc.setRotation(axisAngleZ(piece.rotationZ))
}

// Builds the static arena geometry inside an existing Rapier world.
// Returns the created colliders so callers can dispose them if needed;
// at the moment nothing does — the world is created once per session.
export const createArena = (
  world: RAPIER.World,
): ReadonlyArray<RAPIER.Collider> =>
  ARENA.map((piece) => world.createCollider(pieceToColliderDesc(piece)))
