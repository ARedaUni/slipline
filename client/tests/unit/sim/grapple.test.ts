import { describe, expect, it } from 'vitest'
import {
  type GrappleState,
  type GrappleTuning,
  grappleAcceleration,
} from '../../../src/sim/grapple'
import type { Vec3 } from '../../../src/sim/types'

const ZERO: Vec3 = [0, 0, 0]

const defaultTuning: GrappleTuning = {
  restLength: 5,
  stiffness: 40,
  damping: 4,
}

describe('grappleAcceleration', () => {
  it('returns zero when the grapple is not attached', () => {
    const state: GrappleState = { attached: false }

    const a = grappleAcceleration(state, [0, 0, 0], [0, 0, 0], defaultTuning)

    expect(a).toEqual(ZERO)
  })

  // A rope can pull but cannot push. When the player is closer to the
  // anchor than restLength, the rope is slack — no spring, no damping,
  // regardless of which way the player is moving.
  it('returns zero when attached but rope is slack (L < restLength)', () => {
    const state: GrappleState = { attached: true, anchor: [3, 0, 0] }
    const position: Vec3 = [0, 0, 0] // distance 3, restLength 5 → slack
    const velocity: Vec3 = [5, 0, 0] // moving fast — irrelevant when slack

    const a = grappleAcceleration(state, position, velocity, defaultTuning)

    expect(a).toEqual(ZERO)
  })

  // Anchor 10m along +x, restLength 5 → extension x = 5.
  // Spring force F = k·x along the unit vector toward the anchor (+x).
  // a = (40)(5)(+x̂) = [200, 0, 0]. Velocity is zero → no damping term.
  it('pulls toward the anchor when stretched (pure spring, no velocity)', () => {
    const state: GrappleState = { attached: true, anchor: [10, 0, 0] }
    const position: Vec3 = [0, 0, 0]
    const velocity: Vec3 = [0, 0, 0]

    const a = grappleAcceleration(state, position, velocity, defaultTuning)

    expect(a[0]).toBeCloseTo(200, 6)
    expect(a[1]).toBeCloseTo(0, 6)
    expect(a[2]).toBeCloseTo(0, 6)
  })

  // 3D direction check: anchor diagonally up-and-forward; unit vector
  // toward it is normalised. Tests that the math respects direction,
  // not just magnitude along an axis.
  it('pulls along the unit vector toward an off-axis anchor', () => {
    // anchor 6m away in direction (3,4,0)/5 = (0.6, 0.8, 0)
    // extension = 6 - 5 = 1; |a| = 40·1 = 40; a = 40 · (0.6, 0.8, 0)
    const state: GrappleState = { attached: true, anchor: [3.6, 4.8, 0] }
    const position: Vec3 = [0, 0, 0]

    const a = grappleAcceleration(state, position, [0, 0, 0], defaultTuning)

    expect(a[0]).toBeCloseTo(40 * 0.6, 5)
    expect(a[1]).toBeCloseTo(40 * 0.8, 5)
    expect(a[2]).toBeCloseTo(0, 6)
  })

  // Damping opposes RADIAL velocity (motion along the rope). Moving
  // toward the anchor while stretched should subtract from the inward
  // pull. Anchor at +x10, vel +x5 → v_radial = +5. Damping = -c·v_r·û
  // = -4·5·(1,0,0) = (-20,0,0). Spring = (200,0,0). Net = (180,0,0).
  it('damps inward radial motion (slows you as you swing toward anchor)', () => {
    const state: GrappleState = { attached: true, anchor: [10, 0, 0] }
    const position: Vec3 = [0, 0, 0]
    const velocity: Vec3 = [5, 0, 0]

    const a = grappleAcceleration(state, position, velocity, defaultTuning)

    expect(a[0]).toBeCloseTo(200 - 20, 5)
    expect(a[1]).toBeCloseTo(0, 6)
    expect(a[2]).toBeCloseTo(0, 6)
  })

  // Moving AWAY from anchor while stretched → damping adds to the pull
  // (both forces point toward anchor). v = -5 along û → v_r = -5 →
  // damping = -4·(-5)·(1,0,0) = (+20,0,0). Spring = (200,0,0). Net = 220.
  it('damps outward radial motion (extra pull when fleeing the anchor)', () => {
    const state: GrappleState = { attached: true, anchor: [10, 0, 0] }
    const position: Vec3 = [0, 0, 0]
    const velocity: Vec3 = [-5, 0, 0]

    const a = grappleAcceleration(state, position, velocity, defaultTuning)

    expect(a[0]).toBeCloseTo(200 + 20, 5)
  })

  // CRITICAL feel test: velocity perpendicular to rope should not be
  // damped at all. This is what lets the player SWING on the grapple —
  // tangential motion is preserved, only radial oscillation bleeds off.
  // If you damp all velocity, the grapple feels like glue.
  it('does not damp velocity perpendicular to the rope', () => {
    const state: GrappleState = { attached: true, anchor: [10, 0, 0] }
    const position: Vec3 = [0, 0, 0]
    const velocity: Vec3 = [0, 0, 5] // purely tangential

    const a = grappleAcceleration(state, position, velocity, defaultTuning)

    // pure spring, damping term zero because v·û = 0
    expect(a[0]).toBeCloseTo(200, 5)
    expect(a[1]).toBeCloseTo(0, 6)
    expect(a[2]).toBeCloseTo(0, 6)
  })
})
