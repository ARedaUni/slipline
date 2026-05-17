import RAPIER from '@dimforge/rapier3d-compat'

export type PhysicsWorld = {
  readonly world: RAPIER.World
  readonly cube: RAPIER.RigidBody
}

export const createPhysicsWorld = async (): Promise<PhysicsWorld> => {
  await RAPIER.init()
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })

  const groundCollider = RAPIER.ColliderDesc.cuboid(10, 0.1, 10).setTranslation(0, -0.1, 0)
  world.createCollider(groundCollider)

  const cubeBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0),
  )
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5), cubeBody)

  return { world, cube: cubeBody }
}
