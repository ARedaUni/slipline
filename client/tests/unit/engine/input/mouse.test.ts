import { describe, expect, it } from 'vitest'
import {
  applyMouseDelta,
  type LookState,
} from '../../../../src/engine/input/mouse'

const atRest = (overrides: Partial<LookState> = {}): LookState => ({
  yaw: 0,
  pitch: 0,
  ...overrides,
})

describe('applyMouseDelta (yaw/pitch accumulator)', () => {
  it('decreases yaw when the mouse moves right (camera turns right)', () => {
    // Three.js: +yaw rotates camera left; mouse +dx = move right → camera right
    const next = applyMouseDelta(atRest(), 100, 0, 0.01)

    expect(next.yaw).toBeCloseTo(-1, 6)
    expect(next.pitch).toBeCloseTo(0, 6)
  })

  it('decreases pitch when the mouse moves down (camera looks down)', () => {
    // browser dy is positive going down; +pitch rotates camera up → subtract
    const next = applyMouseDelta(atRest(), 0, 100, 0.01)

    expect(next.pitch).toBeCloseTo(-1, 6)
    expect(next.yaw).toBeCloseTo(0, 6)
  })

  it('accumulates yaw across calls without clamping (free spin)', () => {
    // 4 quarter-turns of dx should add up to roughly 4 * (-π/2)
    let state = atRest()
    const dx = Math.PI / 2 / 0.01 // 157.08 px to rotate 90°
    state = applyMouseDelta(state, dx, 0, 0.01)
    state = applyMouseDelta(state, dx, 0, 0.01)
    state = applyMouseDelta(state, dx, 0, 0.01)
    state = applyMouseDelta(state, dx, 0, 0.01)

    expect(state.yaw).toBeCloseTo(-2 * Math.PI, 4)
  })

  it('clamps pitch just shy of +π/2 (cannot look straight up past it)', () => {
    // big negative dy → upward look → pitch tries to exceed +π/2
    const next = applyMouseDelta(atRest(), 0, -10000, 0.01)

    const PITCH_LIMIT = Math.PI / 2 - 0.01
    expect(next.pitch).toBeCloseTo(PITCH_LIMIT, 4)
  })

  it('clamps pitch just shy of -π/2 (cannot look straight down past it)', () => {
    const next = applyMouseDelta(atRest(), 0, 10000, 0.01)

    const PITCH_LIMIT = Math.PI / 2 - 0.01
    expect(next.pitch).toBeCloseTo(-PITCH_LIMIT, 4)
  })

  it('treats sensitivity as radians-per-pixel multiplier', () => {
    const sens = 0.005
    const next = applyMouseDelta(atRest(), 200, 50, sens)

    expect(next.yaw).toBeCloseTo(-200 * sens, 6)
    expect(next.pitch).toBeCloseTo(-50 * sens, 6)
  })
})
