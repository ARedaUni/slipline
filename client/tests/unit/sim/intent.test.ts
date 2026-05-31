import { describe, expect, it } from 'vitest'
import { buildIntent } from '../../../src/sim/intent'

const baseInput = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  crouch: false,
  fireGrapple: false,
  fireHeld: false,
  yaw: 0,
  pitch: 0,
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

  // Grapple fire is an edge event at the DOM layer (mousedown). The engine
  // input adapter is responsible for translating "click happened" into a
  // single-tick pulse on IntentInput.fireGrapple; buildIntent just forwards
  // that pulse onto MoveIntent.firedGrapple. The sim never sees input
  // history — it sees a flag that already means "fire this tick".
  it('forwards fireGrapple pulse as firedGrapple=true', () => {
    const intent = buildIntent({ ...baseInput, fireGrapple: true })

    expect(intent.firedGrapple).toBe(true)
  })

  // Continuous "fire held" → wantsAttach passthrough. The sim
  // edge-detects against state.wasAttachIntentHeld; buildIntent just
  // reports the current live state of the button. Same passthrough
  // shape as wantsJump / wantsCrouch (live keyboard state).
  it('forwards fireHeld as wantsAttach=true', () => {
    const intent = buildIntent({ ...baseInput, fireHeld: true })

    expect(intent.wantsAttach).toBe(true)
  })

  // lookDir uses Three.js's YXZ-Euler view-forward convention: at rest the
  // camera looks down -Z. The sim consumes lookDir as a unit ray direction
  // for AnchorProbe.findAnchor, so getting the sign convention right is
  // load-bearing — a flipped axis would aim the grapple backward.
  it('produces lookDir = [0, 0, -1] at rest (yaw=0, pitch=0)', () => {
    const intent = buildIntent(baseInput)

    expect(intent.lookDir[0]).toBeCloseTo(0, 6)
    expect(intent.lookDir[1]).toBeCloseTo(0, 6)
    expect(intent.lookDir[2]).toBeCloseTo(-1, 6)
  })

  // Positive pitch tilts the camera up. At pitch=π/2 the player looks
  // straight up — lookDir = +Y. Mouse.applyMouseDelta clamps pitch
  // below π/2 in practice, but the math should still produce the
  // limit value correctly.
  it('maps pitch=π/2 to lookDir = [0, 1, 0] (straight up)', () => {
    const intent = buildIntent({ ...baseInput, pitch: Math.PI / 2 })

    expect(intent.lookDir[0]).toBeCloseTo(0, 6)
    expect(intent.lookDir[1]).toBeCloseTo(1, 6)
    expect(intent.lookDir[2]).toBeCloseTo(0, 6)
  })

  // yaw=π/2 turns the camera 90° left. Forward should rotate from -Z
  // to -X. Same sign convention the wishDir math uses (see the
  // "W at yaw=π/2 points toward world -X" test).
  it('maps yaw=π/2 to lookDir = [-1, 0, 0] (looking left)', () => {
    const intent = buildIntent({ ...baseInput, yaw: Math.PI / 2 })

    expect(intent.lookDir[0]).toBeCloseTo(-1, 6)
    expect(intent.lookDir[1]).toBeCloseTo(0, 6)
    expect(intent.lookDir[2]).toBeCloseTo(0, 6)
  })

  // Diagonal aim (pitch=π/4 = 45° up): unit-length invariant must hold,
  // and the components factor cleanly as -sinY·cosP, sinP, -cosY·cosP.
  // The AnchorProbe contract depends on |lookDir| = 1 so that the
  // adapter's maxToi maps directly to world-space distance.
  it('keeps lookDir unit-length on a diagonal aim (pitch=π/4)', () => {
    const intent = buildIntent({ ...baseInput, pitch: Math.PI / 4 })

    const len = Math.hypot(
      intent.lookDir[0],
      intent.lookDir[1],
      intent.lookDir[2],
    )
    expect(len).toBeCloseTo(1, 6)
    expect(intent.lookDir[1]).toBeCloseTo(Math.SQRT1_2, 6)
    expect(intent.lookDir[2]).toBeCloseTo(-Math.SQRT1_2, 6)
  })
})
