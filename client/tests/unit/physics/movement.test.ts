import { describe, expect, it } from 'vitest'
import { applyFriction } from '../../../src/physics/movement'
import type { Vec3 } from '../../../src/physics/types'

describe('applyFriction (Quake/Source ground friction)', () => {
  it('decays speed using max(speed, stopSpeed) when above stopSpeed', () => {
    // speed=400, friction=4, dt=0.1, stopSpeed=100
    // control = max(400, 100) = 400
    // drop    = 400 * 4 * 0.1 = 160
    // newSpd  = 240
    const velocity: Vec3 = [400, 0, 0]

    const next = applyFriction(velocity, {
      friction: 4,
      stopSpeed: 100,
      dt: 0.1,
    })

    expect(next[0]).toBeCloseTo(240, 4)
    expect(next[2]).toBeCloseTo(0, 4)
  })

  it('uses stopSpeed as the floor when current speed is below it (anchors slow motion)', () => {
    // speed=50, friction=4, dt=0.1, stopSpeed=100
    // control = max(50, 100) = 100
    // drop    = 100 * 4 * 0.1 = 40
    // newSpd  = 10
    const velocity: Vec3 = [50, 0, 0]

    const next = applyFriction(velocity, {
      friction: 4,
      stopSpeed: 100,
      dt: 0.1,
    })

    expect(next[0]).toBeCloseTo(10, 4)
  })

  it('clamps to zero when friction drop exceeds current speed', () => {
    // speed=5, friction=4, dt=0.1, stopSpeed=100
    // drop = 100 * 4 * 0.1 = 40, which is > 5 → newSpeed clamped to 0
    const velocity: Vec3 = [5, 0, 0]

    const next = applyFriction(velocity, {
      friction: 4,
      stopSpeed: 100,
      dt: 0.1,
    })

    expect(next[0]).toBeCloseTo(0, 6)
    expect(next[2]).toBeCloseTo(0, 6)
  })

  it('preserves vertical velocity (friction only affects the horizontal plane)', () => {
    // gravity has authority over Y; friction must not touch it
    const velocity: Vec3 = [400, -9.81, 0]

    const next = applyFriction(velocity, {
      friction: 4,
      stopSpeed: 100,
      dt: 0.1,
    })

    expect(next[1]).toBeCloseTo(-9.81, 6)
  })

  it('preserves direction when scaling speed (diagonal motion decays uniformly)', () => {
    // Equal x and z components → after friction, x/z ratio unchanged
    const velocity: Vec3 = [300, 0, 300]

    const next = applyFriction(velocity, {
      friction: 4,
      stopSpeed: 100,
      dt: 0.1,
    })

    // |v| = sqrt(2)*300 ≈ 424.26
    // control = max(424.26, 100) = 424.26
    // drop = 424.26 * 4 * 0.1 = 169.71
    // newSpeed = 254.56
    // scale = newSpeed / oldSpeed = 0.6
    // next x = 300 * 0.6 = 180, next z = 300 * 0.6 = 180
    expect(next[0]).toBeCloseTo(180, 2)
    expect(next[2]).toBeCloseTo(180, 2)
  })
})
