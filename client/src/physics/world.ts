import RAPIER from '@dimforge/rapier3d-compat'

export type PhysicsWorld = {
  readonly world: RAPIER.World
  readonly cube: RAPIER.RigidBody
  readonly player: RAPIER.RigidBody
  readonly playerCollider: RAPIER.Collider
  readonly kcc: RAPIER.KinematicCharacterController
}

const PLAYER_RADIUS = 0.3
const PLAYER_HALF_HEIGHT = 0.6
const PLAYER_SPAWN_Y = PLAYER_HALF_HEIGHT + PLAYER_RADIUS
const KCC_OFFSET = 0.01

export const createPhysicsWorld = async (): Promise<PhysicsWorld> => {
  await RAPIER.init()
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })

  const groundDesc = RAPIER.ColliderDesc.cuboid(10, 0.1, 10)
  groundDesc.setTranslation(0, -0.1, 0)
  world.createCollider(groundDesc)

  const cubeDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0)
  const cubeBody = world.createRigidBody(cubeDesc)
  const cubeColliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
  world.createCollider(cubeColliderDesc, cubeBody)

  const playerDesc =
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      0,
      PLAYER_SPAWN_Y,
      0,
    )
  const playerBody = world.createRigidBody(playerDesc)
  const playerColliderDesc = RAPIER.ColliderDesc.capsule(
    PLAYER_HALF_HEIGHT,
    PLAYER_RADIUS,
  )
  const playerCollider = world.createCollider(playerColliderDesc, playerBody)

  const kcc = world.createCharacterController(KCC_OFFSET)
  kcc.setUp({ x: 0, y: 1, z: 0 })

  return {
    world,
    cube: cubeBody,
    player: playerBody,
    playerCollider,
    kcc,
  }
}
