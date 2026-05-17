import RAPIER from '@dimforge/rapier3d-compat'

export type PhysicsWorld = {
  readonly world: RAPIER.World
  readonly cube: RAPIER.RigidBody
}

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

  return { world, cube: cubeBody }
}
