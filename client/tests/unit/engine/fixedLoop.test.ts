import { describe, expect, it } from 'vitest'
import { advanceFixedLoop } from '../../../src/engine/fixedLoop'

const opts = { dt: 1 / 60, maxStepsPerFrame: 5 }

describe('advanceFixedLoop (Fiedler accumulator with step cap)', () => {
  it('does not step when delta is below dt; accumulates instead', () => {
    let steps = 0
    const newAcc = advanceFixedLoop(0, opts.dt * 0.5, () => steps++, opts)

    expect(steps).toBe(0)
    expect(newAcc).toBeCloseTo(opts.dt * 0.5, 8)
  })

  it('steps once when delta equals dt and returns zero accumulator', () => {
    let steps = 0
    const newAcc = advanceFixedLoop(0, opts.dt, () => steps++, opts)

    expect(steps).toBe(1)
    expect(newAcc).toBeCloseTo(0, 8)
  })

  it('steps twice when delta equals 2*dt', () => {
    let steps = 0
    const newAcc = advanceFixedLoop(0, opts.dt * 2, () => steps++, opts)

    expect(steps).toBe(2)
    expect(newAcc).toBeCloseTo(0, 8)
  })

  it('carries the fractional remainder into the returned accumulator', () => {
    let steps = 0
    const newAcc = advanceFixedLoop(0, opts.dt * 2.5, () => steps++, opts)

    expect(steps).toBe(2)
    expect(newAcc).toBeCloseTo(opts.dt * 0.5, 8)
  })

  it('clamps absurd deltas to maxStepsPerFrame * dt (prevents spiral-of-death)', () => {
    // simulate a tab that froze for 1 second at 60Hz
    let steps = 0
    advanceFixedLoop(0, 1.0, () => steps++, opts)

    expect(steps).toBe(opts.maxStepsPerFrame)
  })

  it('continues a previous frame remainder (prev=0.9*dt + delta=0.2*dt → 1 step, remainder 0.1*dt)', () => {
    let steps = 0
    const newAcc = advanceFixedLoop(
      opts.dt * 0.9,
      opts.dt * 0.2,
      () => steps++,
      opts,
    )

    expect(steps).toBe(1)
    expect(newAcc).toBeCloseTo(opts.dt * 0.1, 8)
  })
})
