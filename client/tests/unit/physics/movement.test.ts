import { describe, expect, it } from 'vitest'
import { accelerate, applyFriction } from '../../../src/physics/movement'
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

describe('accelerate (Quake/Source PM_Accelerate)', () => {
  it('adds speed in the wish direction when below the cap', () => {
    // velocity=[0,0,0], wishDir=[1,0,0], wishSpeed=320, accel=10, dt=0.016
    // currentSpeed = 0
    // addSpeed    = 320
    // accelSpeed  = min(10*0.016*320, 320) = min(51.2, 320) = 51.2
    const next = accelerate([0, 0, 0], {
      wishDir: [1, 0, 0],
      wishSpeed: 320,
      accel: 10,
      dt: 0.016,
    })

    expect(next[0]).toBeCloseTo(51.2, 4)
    expect(next[2]).toBeCloseTo(0, 6)
  })

  it('does not exceed wishSpeed in the wish direction (clamp via addSpeed)', () => {
    // velocity already at the cap in the wish direction → addSpeed=0 → no change
    const next = accelerate([320, 0, 0], {
      wishDir: [1, 0, 0],
      wishSpeed: 320,
      accel: 10,
      dt: 0.016,
    })

    expect(next[0]).toBeCloseTo(320, 4)
  })

  it('never subtracts speed when current speed already exceeds wishSpeed', () => {
    // velocity boosted past cap (e.g. by jump pad). addSpeed negative → no-op.
    const next = accelerate([500, 0, 0], {
      wishDir: [1, 0, 0],
      wishSpeed: 320,
      accel: 10,
      dt: 0.016,
    })

    expect(next[0]).toBeCloseTo(500, 4)
  })

  it('adds full accel perpendicular to high-speed velocity (strafe-jump mechanic)', () => {
    // The whole point of air-accel with low wishSpeed=30:
    // currentSpeedInWishDir is 0 (perpendicular), so addSpeed = 30 = full air accel.
    // The forward velocity is untouched — net speed magnitude increases.
    const next = accelerate([500, 0, 0], {
      wishDir: [0, 0, 1],
      wishSpeed: 30,
      accel: 10,
      dt: 0.016,
    })

    expect(next[0]).toBeCloseTo(500, 4)
    expect(next[2]).toBeCloseTo(4.8, 4)
  })

  it('does nothing when there is no input (wishSpeed=0)', () => {
    const next = accelerate([100, -5, 50], {
      wishDir: [0, 0, 0],
      wishSpeed: 0,
      accel: 10,
      dt: 0.016,
    })

    expect(next[0]).toBeCloseTo(100, 6)
    expect(next[1]).toBeCloseTo(-5, 6)
    expect(next[2]).toBeCloseTo(50, 6)
  })
})
