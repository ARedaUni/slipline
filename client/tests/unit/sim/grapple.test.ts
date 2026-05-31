import { describe, expect, it } from 'vitest'
import type { AnchorHit, AnchorProbe } from '../../../src/sim/anchorProbe'
import {
  fireGrapple,
  type GrappleState,
  type GrappleTuning,
  grappleAcceleration,
  releaseGrapple,
} from '../../../src/sim/grapple'
import type { Vec3 } from '../../../src/sim/types'

// A FakeAnchorProbe lets the sim test express "the world says yes/no"
// without booting Rapier. The probe ignores its inputs and returns the
// canned hit it was constructed with — exactly the shape adapters are
// allowed to vary on.
const fakeProbe = (hit: AnchorHit): AnchorProbe => ({
  findAnchor: () => hit,
})

const ZERO: Vec3 = [0, 0, 0]

const defaultTuning: GrappleTuning = {
  restLength: 5,
  stiffness: 40,
  damping: 4,
  maxRange: 50,
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

describe('fireGrapple', () => {
  // Bullets (a) + (e): fire from an origin in a direction; when the
  // AnchorProbe reports a hit, the resulting state is attached at the
  // hit point. The sim relays the question to its port — it does NOT
  // decide what counts as reachable. That decision belongs to the
  // adapter (Rapier raycast filters, mask, fixture flags) — keeping
  // engine concepts out of the domain (bullet (d)).
  it('attaches at the hit point when the probe finds an anchor', () => {
    const state: GrappleState = { attached: false }
    const probe = fakeProbe({ found: true, point: [10, 5, 0] })

    const next = fireGrapple(state, [0, 0, 0], [1, 0, 0], 50, probe)

    expect(next).toEqual({ attached: true, anchor: [10, 5, 0] })
  })

  // The other side of bullet (a): firing into empty space stays
  // detached. This is what makes (b) load-bearing — without an anchor,
  // grappleAcceleration has no spring to apply, so no pull happens.
  it('stays detached when the probe finds no anchor', () => {
    const state: GrappleState = { attached: false }
    const probe = fakeProbe({ found: false })

    const next = fireGrapple(state, [0, 0, 0], [1, 0, 0], 50, probe)

    expect(next).toEqual({ attached: false })
  })

  // Idempotency / re-probe rule: re-firing while already attached must
  // re-ask the probe, not return the prior state. This test would FAIL
  // under a plausibly-wrong "no-op when already attached" implementation
  // (if (state.attached) return state) — which is exactly the kind of
  // optimisation a future change might mistakenly add.
  it('overwrites the old anchor when re-fired and the probe hits', () => {
    const state: GrappleState = { attached: true, anchor: [10, 5, 0] }
    const probe = fakeProbe({ found: true, point: [-3, 8, 2] })

    const next = fireGrapple(state, [0, 0, 0], [-1, 0, 0], 50, probe)

    expect(next).toEqual({ attached: true, anchor: [-3, 8, 2] })
  })

  // Idempotency continued: re-firing while attached and missing
  // clears the prior anchor — the player drops. Without this rule,
  // a miss while already attached would silently preserve the rope,
  // which is the wrong feel: pressing fire is a request to re-resolve,
  // and a re-resolve that finds nothing means there's nothing to hold.
  it('detaches when re-fired and the probe misses', () => {
    const state: GrappleState = { attached: true, anchor: [10, 5, 0] }
    const probe = fakeProbe({ found: false })

    const next = fireGrapple(state, [0, 0, 0], [0, 1, 0], 50, probe)

    expect(next).toEqual({ attached: false })
  })
})

// releaseGrapple is the falling-edge half of the hold-to-grapple input
// model: while wantsAttach is true, fireGrapple resolves an anchor; when
// wantsAttach transitions back to false, releaseGrapple drops it. The
// signature deliberately omits the AnchorProbe — detaching is a pure
// state transition that does not consult the world. The type system
// carries that proof: no probe parameter, no possible world query.
describe('releaseGrapple', () => {
  it('detaches an attached grapple without consulting the probe', () => {
    const state: GrappleState = { attached: true, anchor: [10, 5, 0] }

    const next = releaseGrapple(state)

    expect(next).toEqual({ attached: false })
  })
})
