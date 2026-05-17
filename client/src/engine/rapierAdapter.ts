import type { PhysicsWorld } from '../physics/world'
import type { CharacterBody } from '../sim/character'

// Adapter (Cockburn): implements the sim's CharacterBody port against
// Rapier's KinematicCharacterController + RigidBody. The sim never sees
// any Rapier types — it only knows it has a CharacterBody it can tryMove.

// biome-ignore format: multi-line signature keeps typed params readable
export const createRapierCharacterBody = (
  physics: PhysicsWorld,
): CharacterBody => ({
  tryMove: (desired) => {
    physics.kcc.computeColliderMovement(physics.playerCollider, {
      x: desired[0],
      y: desired[1],
      z: desired[2],
    })
    const corrected = physics.kcc.computedMovement()
    const pos = physics.player.translation()
    physics.player.setNextKinematicTranslation({
      x: pos.x + corrected.x,
      y: pos.y + corrected.y,
      z: pos.z + corrected.z,
    })
    physics.world.step()
    return { grounded: physics.kcc.computedGrounded() }
  },
})
