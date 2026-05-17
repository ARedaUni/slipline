import type RAPIER from '@dimforge/rapier3d-compat'
import type { CharacterBody, CollisionResponse } from '../sim/character'
import type { Vec3 } from '../sim/types'
import type { PhysicsWorld } from './physicsWorld'

// Adapter (Cockburn): implements the sim's CharacterBody port against
// Rapier's KinematicCharacterController + RigidBody. The sim never sees
// any Rapier types — it only knows it has a CharacterBody it can tryMove.

const UP: Vec3 = [0, 1, 0]

// Rapier's CharacterCollision.normal1 is the obstacle's outward
// world-space normal at the contact. On a floor that's roughly +Y;
// on a ramp it's the slope normal. We pick the collision whose normal
// points most upward as the "ground" normal — that's what the sim
// projects gravity along to compute downslope slide impulse.
//
// If the KCC reports grounded but produced no collisions (can happen
// on the spawn frame, where the player is resting inside the skin
// offset without having moved into anything), default to straight up.
const queryGroundNormal = (kcc: RAPIER.KinematicCharacterController): Vec3 => {
  let best: Vec3 = UP
  let bestY = -Infinity
  const count = kcc.numComputedCollisions()
  for (let i = 0; i < count; i++) {
    const c = kcc.computedCollision(i)
    if (!c) continue
    const n = c.normal1
    if (n.y > bestY) {
      bestY = n.y
      best = [n.x, n.y, n.z]
    }
  }
  return best
}

// biome-ignore format: multi-line signature keeps typed params readable
export const createRapierCharacterBody = (
  physics: PhysicsWorld,
): CharacterBody => ({
  tryMove: (desired): CollisionResponse => {
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
    if (!physics.kcc.computedGrounded()) {
      return { grounded: false }
    }
    return {
      grounded: true,
      groundNormal: queryGroundNormal(physics.kcc),
    }
  },
})
