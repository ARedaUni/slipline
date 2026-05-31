import { describe, expect, it } from 'vitest'
import type { AnchorProbe } from '../../../src/sim/anchorProbe'
import type {
  CharacterBody,
  CollisionResponse,
} from '../../../src/sim/character'
import type { MoveIntent } from '../../../src/sim/intent'
import type { CharacterState, StepTuning } from '../../../src/sim/step'
import { stepCharacter } from '../../../src/sim/step'
import type { Vec3 } from '../../../src/sim/types'

// Mirrors Player.tsx's current constants so behavior is preserved
// between in-component logic and the extracted stepCharacter.
const defaultTuning: StepTuning = {
  gravity: -25,
  jumpSpeed: 7.5,
  groundFriction: 6,
  groundStopSpeed: 1.5,
  groundWishSpeed: 8,
  groundAccel: 10,
  airWishSpeed: 1,
  airAccel: 100,
  grapple: { restLength: 5, stiffness: 40, damping: 4, maxRange: 50 },
}

// Factory: build a MoveIntent with sensible defaults (at rest, no
// inputs, looking forward). Mirrors the state() factory below.
// Extracted from inline literals once the Data Clumps smell became
// concrete during the type-widening commit — the same shape was being
// constructed at six sites, each with a small variation. Beck's Tidy
// First trigger: the next change was awkward without it.
const intent = (overrides: Partial<MoveIntent> = {}): MoveIntent => ({
  wishDir: [0, 0, 0],
  lookDir: [0, 0, -1],
  wantsJump: false,
  wantsCrouch: false,
  firedGrapple: false,
  wantsAttach: false,
  ...overrides,
})

// Null probe: stepCharacter requires a probe for the AnchorProbe port,
// but tests in this file never fire the grapple (firedGrapple is false
// throughout). The probe is wired in but never invoked. Tests that
// care about grapple dispatch should pass their own fakeProbe — see
// grapple.test.ts for the canonical pattern.
const nullProbe: AnchorProbe = { findAnchor: () => ({ found: false }) }

const UP: Vec3 = [0, 1, 0]

// Factory: build a CharacterState with sensible defaults. Tests only
// supply the fields they actually care about; everything else is the
// "at rest, standing on flat ground" baseline.
const state = (overrides: Partial<CharacterState> = {}): CharacterState => ({
  position: [0, 0, 0],
  velocity: [0, 0, 0],
  grounded: false,
  groundNormal: UP,
  grapple: { attached: false },
  wasAttachIntentHeld: false,
  ...overrides,
})

type FakeBody = CharacterBody & {
  readonly lastDesired: () => Vec3 | null
  readonly callCount: () => number
}

// Scripted-response input: callers supply only the contact info; the
// helper fills in `position` so existing tests don't need to repeat
// a placeholder on every call site. Tests that care about position
// can override it explicitly via the second arg.
type ResponseInput =
  | Readonly<{ grounded: false }>
  | Readonly<{ grounded: true; groundNormal: Vec3 }>

// Test adapter: a CharacterBody that records the desired move
// and returns a scripted collision response.
const fakeBody = (
  input: ResponseInput,
  position: Vec3 = [0, 0, 0],
): FakeBody => {
  let last: Vec3 | null = null
  let calls = 0
  const response: CollisionResponse = { ...input, position }
  return {
    tryMove: (desired) => {
      last = desired
      calls += 1
      return response
    },
    lastDesired: () => last,
    callCount: () => calls,
  }
}

describe('stepCharacter (per-tick character integration)', () => {
  it('applies gravity to vertical velocity each tick', () => {
    const body = fakeBody({ grounded: false })

    const next = stepCharacter(
      state(),
      intent(),
      body,
      nullProbe,
      defaultTuning,
      1 / 60,
    )

    // vy += gravity * dt = -25 * (1/60) ≈ -0.4167
    expect(next.velocity[1]).toBeCloseTo(-25 / 60, 6)
  })

  it('jumps when grounded + wantsJump: sets vy to jumpSpeed and ungrounds', () => {
    const body = fakeBody({ grounded: true, groundNormal: UP })

    const next = stepCharacter(
      state({ grounded: true }),
      intent({ wantsJump: true }),
      body,
      nullProbe,
      defaultTuning,
      1 / 60,
    )

    // jump sets vy=7.5, then collision response says grounded=true
    // (but the jump already ungrounded us inside the step — final grounded
    // is whatever the body reports after move; here body still says grounded)
    expect(next.velocity[1]).toBeGreaterThan(0)
    expect(next.velocity[1]).toBeCloseTo(7.5, 6)
  })

  it('ignores jump when airborne (no double-jump)', () => {
    const body = fakeBody({ grounded: false })

    const next = stepCharacter(
      state(),
      intent({ wantsJump: true }),
      body,
      nullProbe,
      defaultTuning,
      1 / 60,
    )

    // vy is only gravity, jump did not fire
    expect(next.velocity[1]).toBeCloseTo(-25 / 60, 6)
  })

  it('on ground branch: applies friction (horizontal velocity decays)', () => {
    const body = fakeBody({ grounded: true, groundNormal: UP })

    const next = stepCharacter(
      state({ velocity: [8, 0, 0], grounded: true }),
      intent(),
      body,
      nullProbe,
      defaultTuning,
      1 / 60,
    )

    // friction must reduce |v_horizontal| from 8 toward 0
    expect(next.velocity[0]).toBeLessThan(8)
    expect(next.velocity[0]).toBeGreaterThan(0)
  })

  it('on air branch: never applies friction (horizontal velocity preserved)', () => {
    const body = fakeBody({ grounded: false })

    const next = stepCharacter(
      state({ velocity: [8, 0, 0] }),
      intent(),
      body,
      nullProbe,
      defaultTuning,
      1 / 60,
    )

    // no input, no friction in air → horizontal vx unchanged
    expect(next.velocity[0]).toBeCloseTo(8, 6)
  })

  it('asks body to move by velocity * dt', () => {
    const body = fakeBody({ grounded: false })
    const dt = 1 / 60

    stepCharacter(
      state({ velocity: [4, 0, -3] }),
      intent(),
      body,
      nullProbe,
      defaultTuning,
      dt,
    )

    const desired = body.lastDesired()
    expect(desired).not.toBeNull()
    // vx unchanged in air, vy = gravity*dt
    expect(desired?.[0]).toBeCloseTo(4 * dt, 6)
    expect(desired?.[1]).toBeCloseTo((-25 / 60) * dt, 6)
    expect(desired?.[2]).toBeCloseTo(-3 * dt, 6)
  })

  it('zeroes downward vy on landing (prevents gravity accumulation while grounded)', () => {
    const body = fakeBody({ grounded: true, groundNormal: UP })

    const next = stepCharacter(
      state({ velocity: [0, -10, 0] }),
      intent(),
      body,
      nullProbe,
      defaultTuning,
      1 / 60,
    )

    // we were falling at -10, body says we landed → vy clamped to 0
    expect(next.grounded).toBe(true)
    expect(next.velocity[1]).toBe(0)
  })

  it('does not clamp upward vy on landing (a jump frame should rise)', () => {
    const body = fakeBody({ grounded: true, groundNormal: UP })

    // edge case: we're already moving up but body still reports grounded
    // (e.g. mid-jump, before kcc has registered separation).
    // Upward motion must survive.
    const next = stepCharacter(
      state({ velocity: [0, 5, 0], grounded: true }),
      intent({ wantsJump: true }),
      body,
      nullProbe,
      defaultTuning,
      1 / 60,
    )

    // jump sets vy=7.5; gravity hasn't applied yet in this branch order...
    // (gravity is applied BEFORE jump in current code, so vy goes
    //  5 + gravity*dt → then jump overrides to 7.5)
    expect(next.velocity[1]).toBeCloseTo(7.5, 6)
  })

  it('calls body.tryMove exactly once per step', () => {
    const body = fakeBody({ grounded: false })

    stepCharacter(state(), intent(), body, nullProbe, defaultTuning, 1 / 60)

    expect(body.callCount()).toBe(1)
  })

  it('stores the groundNormal from the body response on the next state', () => {
    const slope: Vec3 = [-0.5, 0.866, 0]
    const body = fakeBody({ grounded: true, groundNormal: slope })

    const next = stepCharacter(
      state(),
      intent(),
      body,
      nullProbe,
      defaultTuning,
      1 / 60,
    )

    expect(next.groundNormal[0]).toBeCloseTo(slope[0], 6)
    expect(next.groundNormal[1]).toBeCloseTo(slope[1], 6)
    expect(next.groundNormal[2]).toBeCloseTo(slope[2], 6)
  })
})

describe('stepCharacter — slide branch (grounded + wantsCrouch)', () => {
  const crouchIntent: MoveIntent = intent({ wantsCrouch: true })

  it('skips ground friction on flat ground: horizontal momentum preserved', () => {
    const body = fakeBody({ grounded: true, groundNormal: UP })

    const next = stepCharacter(
      state({ velocity: [8, 0, 0], grounded: true }),
      crouchIntent,
      body,
      nullProbe,
      defaultTuning,
      1 / 60,
    )

    // ground branch friction reduces vx; the slide skips friction entirely
    expect(next.velocity[0]).toBeCloseTo(8, 6)
  })

  it('projects velocity onto the slope tangent (gravity tangent → downslope accel)', () => {
    // ramp tilted 25° around +Z: normal = (-sinθ, cosθ, 0)
    const angle = (25 * Math.PI) / 180
    const sn = Math.sin(angle)
    const cn = Math.cos(angle)
    const normal: Vec3 = [-sn, cn, 0]
    const body = fakeBody({ grounded: true, groundNormal: normal })

    const next = stepCharacter(
      state({ grounded: true, groundNormal: normal }),
      crouchIntent,
      body,
      nullProbe,
      defaultTuning,
      1 / 60,
    )

    // After projecting gravity·dt onto the tangent plane, velocity gains
    // a vector of magnitude |g|·sinθ·dt aligned with the downhill tangent
    // (-cosθ, -sinθ, 0). Tolerance accounts for slide friction (small).
    const dvMag = Math.abs(defaultTuning.gravity) * sn * (1 / 60)
    expect(next.velocity[0]).toBeCloseTo(-cn * dvMag, 3)
    expect(next.velocity[1]).toBeCloseTo(-sn * dvMag, 3)
    expect(next.velocity[2]).toBeCloseTo(0, 6)
  })

  it('does not zero vy on landing while sliding (slope motion preserves slope vy)', () => {
    const angle = (25 * Math.PI) / 180
    const normal: Vec3 = [-Math.sin(angle), Math.cos(angle), 0]
    const body = fakeBody({ grounded: true, groundNormal: normal })

    // already sliding fast downhill with non-zero vy
    const sliding: Vec3 = [-5, -2, 0]
    const next = stepCharacter(
      state({ velocity: sliding, grounded: true, groundNormal: normal }),
      crouchIntent,
      body,
      nullProbe,
      defaultTuning,
      1 / 60,
    )

    // vy must remain negative — the slope demands downward motion to stay on it
    expect(next.velocity[1]).toBeLessThan(0)
  })

  it('crouch in air is ignored (no slide projection while ungrounded)', () => {
    const body = fakeBody({ grounded: false })

    const next = stepCharacter(
      state({ velocity: [8, 0, 0] }),
      crouchIntent,
      body,
      nullProbe,
      defaultTuning,
      1 / 60,
    )

    // air branch ignores crouch; same as no-crouch air behaviour
    expect(next.velocity[0]).toBeCloseTo(8, 6)
    expect(next.velocity[1]).toBeCloseTo(-25 / 60, 6)
  })
})

describe('stepCharacter — grapple input edges (hold-to-grapple)', () => {
  // Falling edge: wantsAttach was true last tick (recorded as
  // wasAttachIntentHeld in the state we entered with), is false this tick.
  // stepCharacter must detach the grapple — the player let go of the rope.
  // releaseGrapple does this without consulting the probe; the probe-free
  // signature is what makes this branch testable without a fakeProbe.
  it('releases an attached grapple on the falling edge of wantsAttach', () => {
    const body = fakeBody({ grounded: false })

    const next = stepCharacter(
      state({
        grapple: { attached: true, anchor: [0, 0, -10] },
        wasAttachIntentHeld: true,
      }),
      intent({ wantsAttach: false }),
      body,
      nullProbe,
      defaultTuning,
      1 / 60,
    )

    expect(next.grapple).toEqual({ attached: false })
  })
})

describe('stepCharacter — grapple composition', () => {
  // Bullet (c) foundation: when state.grapple is attached, the damped
  // spring acceleration from sim/grapple composes into velocity each
  // tick. Anchor 10m along +x, restLength 5, stiffness 40 → extension
  // 5, spring magnitude k·x = 200 along +x̂. Zero velocity means the
  // damping term is zero, so dv = 200·dt cleanly.
  it('applies grapple spring acceleration to velocity when attached', () => {
    const body = fakeBody({ grounded: false })
    const dt = 1 / 60

    const next = stepCharacter(
      state({
        position: [0, 0, 0],
        velocity: [0, 0, 0],
        grapple: { attached: true, anchor: [10, 0, 0] },
      }),
      intent(),
      body,
      nullProbe,
      defaultTuning,
      dt,
    )

    expect(next.velocity[0]).toBeCloseTo(200 * dt, 6)
  })
})

describe('stepCharacter — deterministic scenarios', () => {
  it('30-frame straight-up jump reaches expected apex (sim-only, no Rapier)', () => {
    // Scripted: ground at y=0, jump on frame 0, then track vy over time.
    // With gravity=-25 and jumpSpeed=7.5, time to apex ≈ 7.5/25 = 0.3s = 18 frames.
    // At 60Hz, after ~18 ticks vy should hit zero (apex).
    const airBody = fakeBody({ grounded: false })
    let s: CharacterState = state({ grounded: true })

    // tick 0: jump
    s = stepCharacter(
      s,
      intent({ wantsJump: true }),
      // for the jump tick, fake-body grounded=true (we're on the floor)
      fakeBody({ grounded: true, groundNormal: UP }),
      nullProbe,
      defaultTuning,
      1 / 60,
    )
    // jump sets vy=7.5, body says grounded (we haven't moved up yet visually)
    // but next tick we're airborne in the sim
    s = { ...s, grounded: false }

    // simulate falling: 17 more frames, body says NOT grounded
    for (let i = 0; i < 17; i++) {
      s = stepCharacter(s, intent(), airBody, nullProbe, defaultTuning, 1 / 60)
    }

    // after 17 ticks of gravity, vy = 7.5 + (-25)*(17/60) ≈ 7.5 - 7.083 ≈ 0.417
    // close to apex; one more tick crosses zero
    expect(s.velocity[1]).toBeCloseTo(7.5 - 25 * (17 / 60), 4)
  })
})
