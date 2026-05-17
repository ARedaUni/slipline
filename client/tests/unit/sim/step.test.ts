import { describe, expect, it } from 'vitest'
import type {
  CharacterBody,
  CollisionResponse,
} from '../../../src/sim/character'
import type { MoveIntent } from '../../../src/sim/intent'
import type { StepTuning } from '../../../src/sim/step'
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
}

const noIntent: MoveIntent = {
  wishDir: [0, 0, 0],
  wantsJump: false,
  wantsCrouch: false,
}

type FakeBody = CharacterBody & {
  readonly lastDesired: () => Vec3 | null
  readonly callCount: () => number
}

// Test adapter: a CharacterBody that records the desired move
// and returns a scripted collision response.
const fakeBody = (response: CollisionResponse): FakeBody => {
  let last: Vec3 | null = null
  let calls = 0
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
      { velocity: [0, 0, 0], grounded: false },
      noIntent,
      body,
      defaultTuning,
      1 / 60,
    )

    // vy += gravity * dt = -25 * (1/60) ≈ -0.4167
    expect(next.velocity[1]).toBeCloseTo(-25 / 60, 6)
  })

  it('jumps when grounded + wantsJump: sets vy to jumpSpeed and ungrounds', () => {
    const body = fakeBody({ grounded: true })

    const next = stepCharacter(
      { velocity: [0, 0, 0], grounded: true },
      { wishDir: [0, 0, 0], wantsJump: true, wantsCrouch: false },
      body,
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
      { velocity: [0, 0, 0], grounded: false },
      { wishDir: [0, 0, 0], wantsJump: true, wantsCrouch: false },
      body,
      defaultTuning,
      1 / 60,
    )

    // vy is only gravity, jump did not fire
    expect(next.velocity[1]).toBeCloseTo(-25 / 60, 6)
  })

  it('on ground branch: applies friction (horizontal velocity decays)', () => {
    const body = fakeBody({ grounded: true })

    const next = stepCharacter(
      { velocity: [8, 0, 0], grounded: true },
      noIntent,
      body,
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
      { velocity: [8, 0, 0], grounded: false },
      noIntent,
      body,
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
      { velocity: [4, 0, -3], grounded: false },
      noIntent,
      body,
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
    const body = fakeBody({ grounded: true })

    const next = stepCharacter(
      { velocity: [0, -10, 0], grounded: false },
      noIntent,
      body,
      defaultTuning,
      1 / 60,
    )

    // we were falling at -10, body says we landed → vy clamped to 0
    expect(next.grounded).toBe(true)
    expect(next.velocity[1]).toBe(0)
  })

  it('does not clamp upward vy on landing (a jump frame should rise)', () => {
    const body = fakeBody({ grounded: true })

    // edge case: we're already moving up but body still reports grounded
    // (e.g. mid-jump, before kcc has registered separation).
    // Upward motion must survive.
    const next = stepCharacter(
      { velocity: [0, 5, 0], grounded: true },
      { wishDir: [0, 0, 0], wantsJump: true, wantsCrouch: false },
      body,
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

    stepCharacter(
      { velocity: [0, 0, 0], grounded: false },
      noIntent,
      body,
      defaultTuning,
      1 / 60,
    )

    expect(body.callCount()).toBe(1)
  })
})

describe('stepCharacter — deterministic scenarios', () => {
  it('30-frame straight-up jump reaches expected apex (sim-only, no Rapier)', () => {
    // Scripted: ground at y=0, jump on frame 0, then track vy over time.
    // With gravity=-25 and jumpSpeed=7.5, time to apex ≈ 7.5/25 = 0.3s = 18 frames.
    // At 60Hz, after ~18 ticks vy should hit zero (apex).
    const body = fakeBody({ grounded: false })
    let state = { velocity: [0, 0, 0] as Vec3, grounded: true }

    // tick 0: jump
    state = stepCharacter(
      state,
      { wishDir: [0, 0, 0], wantsJump: true, wantsCrouch: false },
      // for the jump tick, fake-body grounded=true (we're on the floor)
      fakeBody({ grounded: true }),
      defaultTuning,
      1 / 60,
    )
    // jump sets vy=7.5, body says grounded (we haven't moved up yet visually)
    // but next tick we're airborne in the sim
    state = { ...state, grounded: false }

    // simulate falling: 17 more frames, body says NOT grounded
    for (let i = 0; i < 17; i++) {
      state = stepCharacter(state, noIntent, body, defaultTuning, 1 / 60)
    }

    // after 17 ticks of gravity, vy = 7.5 + (-25)*(17/60) ≈ 7.5 - 7.083 ≈ 0.417
    // close to apex; one more tick crosses zero
    expect(state.velocity[1]).toBeCloseTo(7.5 - 25 * (17 / 60), 4)
  })
})
