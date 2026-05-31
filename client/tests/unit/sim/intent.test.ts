import { describe, expect, it } from 'vitest'
import { buildIntent } from '../../../src/sim/intent'

const baseInput = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  crouch: false,
  yaw: 0,
}

describe('buildIntent (input → domain MoveIntent)', () => {
  it('produces zero wishDir and wantsJump=false when no keys are held', () => {
    const intent = buildIntent(baseInput)

    expect(intent.wishDir[0]).toBeCloseTo(0, 6)
    expect(intent.wishDir[1]).toBeCloseTo(0, 6)
    expect(intent.wishDir[2]).toBeCloseTo(0, 6)
    expect(intent.wantsJump).toBe(false)
  })

  it('maps W at yaw=0 to world -Z (camera default look direction)', () => {
    // fwd=1, strafe=0, cosY=1, sinY=0
    // wishX = 1 * -0 + 0 * 1 = 0
    // wishZ = 1 * -1 + 0 * -0 = -1
    const intent = buildIntent({ ...baseInput, forward: true })

    expect(intent.wishDir[0]).toBeCloseTo(0, 6)
    expect(intent.wishDir[2]).toBeCloseTo(-1, 6)
  })

  it('maps S at yaw=0 to world +Z', () => {
    const intent = buildIntent({ ...baseInput, back: true })

    expect(intent.wishDir[0]).toBeCloseTo(0, 6)
    expect(intent.wishDir[2]).toBeCloseTo(1, 6)
  })

  it('maps D at yaw=0 to world +X', () => {
    const intent = buildIntent({ ...baseInput, right: true })

    expect(intent.wishDir[0]).toBeCloseTo(1, 6)
    expect(intent.wishDir[2]).toBeCloseTo(0, 6)
  })

  it('maps A at yaw=0 to world -X', () => {
    const intent = buildIntent({ ...baseInput, left: true })

    expect(intent.wishDir[0]).toBeCloseTo(-1, 6)
    expect(intent.wishDir[2]).toBeCloseTo(0, 6)
  })

  it('normalises diagonals so W+D has unit length (no √2 speed advantage)', () => {
    // fwd=1, strafe=1 → raw (1, -1), length √2 → normalised (1/√2, -1/√2)
    const intent = buildIntent({
      ...baseInput,
      forward: true,
      right: true,
    })

    const len = Math.hypot(intent.wishDir[0], intent.wishDir[2])
    expect(len).toBeCloseTo(1, 6)
    expect(intent.wishDir[0]).toBeCloseTo(Math.SQRT1_2, 6)
    expect(intent.wishDir[2]).toBeCloseTo(-Math.SQRT1_2, 6)
  })

  it('rotates wishDir by yaw (W at yaw=π/2 points toward world -X)', () => {
    // yaw=+π/2 turns the camera 90° left; W = "into the screen" = world -X
    const intent = buildIntent({
      ...baseInput,
      forward: true,
      yaw: Math.PI / 2,
    })

    expect(intent.wishDir[0]).toBeCloseTo(-1, 6)
    expect(intent.wishDir[2]).toBeCloseTo(0, 6)
  })

  it('cancels to zero when opposing keys are both held (W+S)', () => {
    const intent = buildIntent({
      ...baseInput,
      forward: true,
      back: true,
    })

    expect(intent.wishDir[0]).toBeCloseTo(0, 6)
    expect(intent.wishDir[2]).toBeCloseTo(0, 6)
  })

  it('always sets wishDir[1] to zero (sim handles vertical motion separately)', () => {
    const intent = buildIntent({
      ...baseInput,
      forward: true,
      right: true,
      yaw: 1.23,
    })

    expect(intent.wishDir[1]).toBe(0)
  })

  it('forwards Space as wantsJump=true', () => {
    const intent = buildIntent({ ...baseInput, jump: true })

    expect(intent.wantsJump).toBe(true)
  })

  it('forwards crouch as wantsCrouch=true', () => {
    const intent = buildIntent({ ...baseInput, crouch: true })

    expect(intent.wantsCrouch).toBe(true)
  })

  it('defaults wantsCrouch to false when crouch is not held', () => {
    const intent = buildIntent(baseInput)

    expect(intent.wantsCrouch).toBe(false)
  })
})
