import { describe, expect, it } from 'vitest'
import { createPhysicsWorld } from '../../../src/physics/world'

describe('createPhysicsWorld — kinematic player capsule', () => {
  it('exposes a kinematic-position-based rigid body as `player`', async () => {
    const physics = await createPhysicsWorld()

    expect(physics.player).toBeDefined()
    expect(physics.player.isKinematic()).toBe(true)
    // position-based (not velocity-based): bodyType() === KinematicPositionBased (2)
    expect(physics.player.bodyType()).toBe(2)
  })

  it('spawns the player capsule so its base rests on the ground (y = 0)', async () => {
    const physics = await createPhysicsWorld()
    const t = physics.player.translation()

    // capsule center is at halfHeight + radius above the ground
    expect(t.y).toBeCloseTo(0.9, 6)
    expect(t.x).toBeCloseTo(0, 6)
    expect(t.z).toBeCloseTo(0, 6)
  })

  it('attaches a capsule collider to the player body', async () => {
    const physics = await createPhysicsWorld()

    expect(physics.playerCollider).toBeDefined()
    expect(physics.playerCollider.parent()).toBe(physics.player)
    // capsule has halfHeight 0.6 and radius 0.3
    expect(physics.playerCollider.halfHeight()).toBeCloseTo(0.6, 6)
    expect(physics.playerCollider.radius()).toBeCloseTo(0.3, 6)
  })

  it('creates a KinematicCharacterController with up = +Y and a small offset', async () => {
    const physics = await createPhysicsWorld()

    expect(physics.kcc).toBeDefined()
    const up = physics.kcc.up()
    expect(up.x).toBeCloseTo(0, 6)
    expect(up.y).toBeCloseTo(1, 6)
    expect(up.z).toBeCloseTo(0, 6)
    // small skin-width gap, not zero
    expect(physics.kcc.offset()).toBeGreaterThan(0)
    expect(physics.kcc.offset()).toBeLessThan(0.1)
  })
})
