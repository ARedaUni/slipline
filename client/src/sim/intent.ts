import type { Vec3 } from './types'

export type IntentInput = Readonly<{
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  jump: boolean
  yaw: number
}>

export type MoveIntent = Readonly<{
  wishDir: Vec3
  wantsJump: boolean
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
  return { wishDir, wantsJump: input.jump }
}
