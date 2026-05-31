import RAPIER from '@dimforge/rapier3d-compat'
import type { AnchorHit, AnchorProbe } from '../sim/anchorProbe'
import type { Vec3 } from '../sim/types'
import type { PhysicsWorld } from './physicsWorld'

// Adapter (Cockburn): implements the sim's AnchorProbe port against
// Rapier's castRay. The sim never sees a Rapier type — it only knows
// it has an AnchorProbe it can findAnchor against.
//
// solid=true: if the ray origin sits inside a collider, the ray treats
// that collider as plain and returns timeOfImpact=0. Combined with
// filterExcludeCollider=playerCollider (sixth positional arg), a grapple
// fired from inside the player's capsule passes through the player and
// reports the first non-player hit instead.
//
// timeOfImpact: scalar t such that hit = origin + direction*t. Rapier
// docs: "limits the length of the ray to ray.dir.norm() * maxToi" —
// so the sim's maxRange maps to Rapier's maxToi only when direction is
// unit-length, which is the contract the sim (grapple.ts) already
// upholds at the call site.

// biome-ignore format: multi-line signature keeps typed params readable
export const createRapierAnchorProbe = (
  physics: PhysicsWorld,
): AnchorProbe => ({
  findAnchor: (origin, direction, maxRange): AnchorHit => {
    const ray = new RAPIER.Ray(
      { x: origin[0], y: origin[1], z: origin[2] },
      { x: direction[0], y: direction[1], z: direction[2] },
    )
    const hit = physics.world.castRay(
      ray,
      maxRange,
      true,
      undefined,
      undefined,
      physics.playerCollider,
    )
    if (!hit) return { found: false }
    const t = hit.timeOfImpact
    const point: Vec3 = [
      origin[0] + direction[0] * t,
      origin[1] + direction[1] * t,
      origin[2] + direction[2] * t,
    ]
    return { found: true, point }
  },
})
