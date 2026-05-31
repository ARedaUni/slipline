import RAPIER from '@dimforge/rapier3d-compat'
import { createArena } from './arena'

export type PhysicsWorld = {
  readonly world: RAPIER.World
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

  createArena(world)

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
    player: playerBody,
    playerCollider,
    kcc,
  }
}
