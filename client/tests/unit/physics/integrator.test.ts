import { describe, expect, it } from 'vitest'
import { step } from '../../../src/physics/integrator'
import type { KinematicState } from '../../../src/physics/types'

const atRest = (overrides: Partial<KinematicState> = {}): KinematicState => ({
  position: [0, 10, 0],
  velocity: [0, 0, 0],
  ...overrides,
})

describe('kinematic step', () => {
  it('accelerates a free-falling body downward by gravity·dt', () => {
    const next = step(atRest(), { gravity: -9.81, dt: 0.05 })

    expect(next.velocity[1]).toBeCloseTo(-0.4905, 4)
  })

  it('advances vertical position using the post-update velocity (semi-implicit Euler)', () => {
    const next = step(atRest(), { gravity: -9.81, dt: 0.05 })

    expect(next.position[1]).toBeCloseTo(10 + -0.4905 * 0.05, 6)
  })

  it('advances horizontal position by velocity·dt when gravity is zero', () => {
    const moving = atRest({ velocity: [2, 0, -3] })

    const next = step(moving, { gravity: 0, dt: 0.5 })

    expect(next.position[0]).toBeCloseTo(1, 6)
    expect(next.position[2]).toBeCloseTo(-1.5, 6)
  })
})
