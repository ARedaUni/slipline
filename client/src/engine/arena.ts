import RAPIER from '@dimforge/rapier3d-compat'

// Arena dimensions. Single source of truth — the scene meshes
// import these so the visual geometry matches the collision geometry.

export const FLOOR_HALF_EXTENTS = { x: 10, y: 0.1, z: 10 } as const
export const FLOOR_CENTER = { x: 0, y: -0.1, z: 0 } as const

export const RAMP_HALF_EXTENTS = { x: 3, y: 0.1, z: 1.5 } as const
export const RAMP_CENTER = { x: 6, y: 1.2, z: -3 } as const
// rotation around +Z by RAMP_ANGLE makes the box tilt down toward -X
export const RAMP_ANGLE_RAD = (25 * Math.PI) / 180

export const WALL_HALF_EXTENTS = { x: 3, y: 2.5, z: 0.25 } as const
export const WALL_CENTER = { x: 0, y: 2.5, z: -10 } as const

const axisAngleZ = (radians: number) => ({
  x: 0,
  y: 0,
  z: Math.sin(radians / 2),
  w: Math.cos(radians / 2),
})

// Builds the static arena geometry inside an existing Rapier world.
// Returns the created colliders so callers can dispose them if needed;
// at the moment nothing does — the world is created once per session.
export const createArena = (
  world: RAPIER.World,
): ReadonlyArray<RAPIER.Collider> => {
  const floor = RAPIER.ColliderDesc.cuboid(
    FLOOR_HALF_EXTENTS.x,
    FLOOR_HALF_EXTENTS.y,
    FLOOR_HALF_EXTENTS.z,
  ).setTranslation(FLOOR_CENTER.x, FLOOR_CENTER.y, FLOOR_CENTER.z)

  const ramp = RAPIER.ColliderDesc.cuboid(
    RAMP_HALF_EXTENTS.x,
    RAMP_HALF_EXTENTS.y,
    RAMP_HALF_EXTENTS.z,
  )
    .setTranslation(RAMP_CENTER.x, RAMP_CENTER.y, RAMP_CENTER.z)
    .setRotation(axisAngleZ(RAMP_ANGLE_RAD))

  const wall = RAPIER.ColliderDesc.cuboid(
    WALL_HALF_EXTENTS.x,
    WALL_HALF_EXTENTS.y,
    WALL_HALF_EXTENTS.z,
  ).setTranslation(WALL_CENTER.x, WALL_CENTER.y, WALL_CENTER.z)

  return [
    world.createCollider(floor),
    world.createCollider(ramp),
    world.createCollider(wall),
  ]
}
