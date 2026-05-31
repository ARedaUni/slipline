import type { Vec3 } from './types'

export type IntentInput = Readonly<{
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  jump: boolean
  crouch: boolean
  // Edge pulse: true on exactly the tick a fire-grapple event happened
  // (e.g. mousedown on the client). The engine input adapter is
  // responsible for translating its medium's native edges (DOM events,
  // network commands, …) into this single-tick flag. The sim does not
  // track input history.
  fireGrapple: boolean
  yaw: number
  pitch: number
}>

export type MoveIntent = Readonly<{
  wishDir: Vec3
  // World-space unit vector the player is aiming at (eye direction).
  // Used by the sim to dispatch the grapple raycast. Computed in
  // buildIntent from yaw + pitch under Three.js's YXZ Euler convention:
  // at (yaw=0, pitch=0) the player looks down -Z. Positive pitch looks
  // up; positive yaw rotates view to the left (camera-space convention).
  lookDir: Vec3
  wantsJump: boolean
  wantsCrouch: boolean
  firedGrapple: boolean
  // Continuous "fire button held" flag for the hold-to-grapple model.
  // stepCharacter edge-detects against state.wasAttachIntentHeld:
  // rising edge (false→true) dispatches fireGrapple, falling edge
  // (true→false) dispatches releaseGrapple, steady-state is a no-op.
  // Coexists with firedGrapple during the wiring transition.
  wantsAttach: boolean
}>

const EPSILON = 1e-6

// biome-ignore format: multi-line signature keeps typed params readable
export const buildIntent = (
  input: IntentInput,
): MoveIntent => {
  const fwd = (input.forward ? 1 : 0) - (input.back ? 1 : 0)
  const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const cosY = Math.cos(input.yaw)
  const sinY = Math.sin(input.yaw)
  const wishX = fwd * -sinY + strafe * cosY
  const wishZ = fwd * -cosY + strafe * -sinY
  const len = Math.sqrt(wishX * wishX + wishZ * wishZ)
  const wishDir: Vec3 =
    len > EPSILON ? [wishX / len, 0, wishZ / len] : [0, 0, 0]
  // YXZ-Euler view-forward: at (yaw=0, pitch=0) we point down -Z. Pitch
  // rotates around the X axis (positive = look up → +Y component);
  // yaw rotates around the Y axis (positive = camera turns left → forward
  // gains a -X component). Same sign convention as the wishDir math
  // above. Always unit-length because (cosP, sinP) and (cosY, sinY) are
  // each unit pairs; the AnchorProbe contract relies on this.
  const cosP = Math.cos(input.pitch)
  const sinP = Math.sin(input.pitch)
  const lookDir: Vec3 = [-sinY * cosP, sinP, -cosY * cosP]
  return {
    wishDir,
    lookDir,
    wantsJump: input.jump,
    wantsCrouch: input.crouch,
    firedGrapple: input.fireGrapple,
    wantsAttach: false,
  }
}
