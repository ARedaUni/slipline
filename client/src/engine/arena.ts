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

const RAMP_COLOR = '#4a6e8a'
const STAIR_COLOR = '#5a5a5a'
const WALL_COLOR = '#8a6e4a'
const GAP_COLOR = '#6a6a4a'
const GRAPPLE_COLOR = '#aa4a2a'

// Ramp battery generator — low end sits on the floor (center.y = 3·sin θ).
const makeRamp = (
  id: string,
  x: number,
  z: number,
  degrees: number,
): ArenaPiece => {
  const rad = (degrees * Math.PI) / 180
  return {
    id,
    halfExtents: { x: 3, y: 0.1, z: 1.5 },
    center: { x, y: 3 * Math.sin(rad), z },
    rotationZ: rad,
    color: RAMP_COLOR,
  }
}

// Stair-step generator — each box rises from the floor to its top surface.
const makeStair = (
  id: string,
  x: number,
  z: number,
  topY: number,
): ArenaPiece => ({
  id,
  halfExtents: { x: 2, y: topY / 2, z: 0.2 },
  center: { x, y: topY / 2, z },
  color: STAIR_COLOR,
})

// Wall-height battery generator.
const makeWall = (
  id: string,
  x: number,
  z: number,
  topY: number,
): ArenaPiece => ({
  id,
  halfExtents: { x: 1, y: topY / 2, z: 0.15 },
  center: { x, y: topY / 2, z },
  color: WALL_COLOR,
})

// Gap-row platform generator — sits at the same height as the main floor.
const makeGapPlatform = (id: string, x: number, z: number): ArenaPiece => ({
  id,
  halfExtents: { x: 3, y: 0.1, z: 1.5 },
  center: { x, y: -0.1, z },
  color: GAP_COLOR,
})

// Tall pillar (grapple target). Rises from the floor to topY.
const makePillar = (
  id: string,
  x: number,
  z: number,
  topY: number,
): ArenaPiece => ({
  id,
  halfExtents: { x: 0.4, y: topY / 2, z: 0.4 },
  center: { x, y: topY / 2, z },
  color: GRAPPLE_COLOR,
})

// The blockout. Player spawns at (0, 0.9, 0) facing -Z. Stations radiate out
// from spawn: ramps +X, stairs -X, anchor wall straight ahead, walls behind,
// gap row south, grapple targets above and around.
export const ARENA: readonly ArenaPiece[] = [
  // Main floor — 50×50 slab, shifted slightly forward so stations have room.
  {
    id: 'floor-main',
    halfExtents: { x: 25, y: 0.1, z: 25 },
    center: { x: 0, y: -0.1, z: -5 },
    color: '#2a2d36',
    castShadow: false,
  },

  // Anchor wall — preserved at (0, 2.5, -10) so rapierAnchorProbe's smoke
  // test continues to hit its expected anchor at z ≈ -9.75.
  {
    id: 'wall',
    halfExtents: { x: 3, y: 2.5, z: 0.25 },
    center: { x: 0, y: 2.5, z: -10 },
    color: WALL_COLOR,
  },

  // Ramp battery — five angles on the +X side. Tests when the controller
  // stops walking up (snap-to-ground vs. slide vs. refuse).
  makeRamp('ramp-15', 10, -2, 15),
  makeRamp('ramp-25', 10, -6, 25),
  makeRamp('ramp-35', 10, -10, 35),
  makeRamp('ramp-45', 10, -14, 45),
  makeRamp('ramp-60', 10, -18, 60),

  // Stair stack — six 0.2m-rise × 0.4m-deep steps on the -X side. Tests
  // step-up behaviour: do you climb smoothly or snag at every edge?
  makeStair('stair-1', -10, -3.0, 0.2),
  makeStair('stair-2', -10, -3.4, 0.4),
  makeStair('stair-3', -10, -3.8, 0.6),
  makeStair('stair-4', -10, -4.2, 0.8),
  makeStair('stair-5', -10, -4.6, 1.0),
  makeStair('stair-6', -10, -5.0, 1.2),

  // Wall-height battery — four walls behind spawn (-X +Z). With jumpSpeed
  // 7.5 m/s and gravity -25 m/s², the apex is ~1.13 m, so 0.5 and 1.0 should
  // be jumpable; 1.5 borderline; 2.0 a hard no.
  makeWall('wall-0.5', -12, 8, 0.5),
  makeWall('wall-1.0', -9, 8, 1.0),
  makeWall('wall-1.5', -6, 8, 1.5),
  makeWall('wall-2.0', -3, 8, 2.0),

  // Gap row — 4 platforms south of the main floor with progressively wider
  // gaps (2 / 3 / 4 / 5 m). Tests jump distance: with groundWishSpeed 8 m/s
  // and air time ~0.6 s, the theoretical max horizontal jump is ~4.8 m, so
  // the 5 m gap should fail without strafe-jump tricks.
  makeGapPlatform('gap-2m', 15, 23.5),
  makeGapPlatform('gap-3m', 15, 29.5),
  makeGapPlatform('gap-4m', 15, 36.5),
  makeGapPlatform('gap-5m', 15, 44.5),

  // Grapple pillars — tall narrow columns at varying distances from spawn.
  // pillar-distant sits just outside the 20 m grapple maxRange when measured
  // from spawn, so it tests the out-of-range failure path.
  makePillar('pillar-near', -8, -14, 8),
  makePillar('pillar-mid', 8, -18, 8),
  makePillar('pillar-tall', 0, -22, 12),
  makePillar('pillar-distant', -18, 14, 8),

  // Ceiling beam — high horizontal bar to grapple up to / swing under.
  {
    id: 'beam',
    halfExtents: { x: 10, y: 0.2, z: 0.5 },
    center: { x: 0, y: 10, z: -18 },
    color: GRAPPLE_COLOR,
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
