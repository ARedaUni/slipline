import {
  FLOOR_CENTER,
  FLOOR_HALF_EXTENTS,
  RAMP_ANGLE_RAD,
  RAMP_CENTER,
  RAMP_HALF_EXTENTS,
  WALL_CENTER,
  WALL_HALF_EXTENTS,
} from '../engine/arena'

// Visual meshes mirror the collider dimensions from engine/arena.ts.
// One source of truth — if the collider moves or resizes, the mesh follows.

const full = (halfExtents: { x: number; y: number; z: number }) =>
  [halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2] as const

const Floor = () => (
  <mesh
    position={[FLOOR_CENTER.x, FLOOR_CENTER.y, FLOOR_CENTER.z]}
    receiveShadow
  >
    <boxGeometry args={full(FLOOR_HALF_EXTENTS)} />
    <meshStandardMaterial color="#2a2d36" />
  </mesh>
)

const Ramp = () => (
  <mesh
    position={[RAMP_CENTER.x, RAMP_CENTER.y, RAMP_CENTER.z]}
    rotation={[0, 0, RAMP_ANGLE_RAD]}
    receiveShadow
    castShadow
  >
    <boxGeometry args={full(RAMP_HALF_EXTENTS)} />
    <meshStandardMaterial color="#4a6e8a" />
  </mesh>
)

const Wall = () => (
  <mesh
    position={[WALL_CENTER.x, WALL_CENTER.y, WALL_CENTER.z]}
    receiveShadow
    castShadow
  >
    <boxGeometry args={full(WALL_HALF_EXTENTS)} />
    <meshStandardMaterial color="#8a6e4a" />
  </mesh>
)

export const Arena = () => (
  <>
    <Floor />
    <Ramp />
    <Wall />
  </>
)
