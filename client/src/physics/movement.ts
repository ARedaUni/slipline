import type { Vec3 } from './types'

export type FrictionParams = {
  readonly friction: number
  readonly stopSpeed: number
  readonly dt: number
}

export type AccelerateParams = {
  readonly wishDir: Vec3
  readonly wishSpeed: number
  readonly accel: number
  readonly dt: number
}

const EPSILON = 1e-6

// biome-ignore format: multi-line signature keeps typed params readable
export const applyFriction = (
  velocity: Vec3,
  params: FrictionParams,
): Vec3 => {
  const [vx, vy, vz] = velocity
  const speed = Math.sqrt(vx * vx + vz * vz)
  if (speed < EPSILON) {
    return [0, vy, 0]
  }
  const control = Math.max(speed, params.stopSpeed)
  const drop = control * params.friction * params.dt
  const newSpeed = Math.max(speed - drop, 0)
  const scale = newSpeed / speed
  return [vx * scale, vy, vz * scale]
}

// biome-ignore format: multi-line signature keeps typed params readable
export const accelerate = (
  velocity: Vec3,
  params: AccelerateParams,
): Vec3 => {
  const [vx, vy, vz] = velocity
  const [wx, wy, wz] = params.wishDir
  const currentSpeed = vx * wx + vy * wy + vz * wz
  const addSpeed = params.wishSpeed - currentSpeed
  if (addSpeed <= 0) {
    return velocity
  }
  const accelSpeed = Math.min(
    params.accel * params.dt * params.wishSpeed,
    addSpeed,
  )
  return [
    vx + wx * accelSpeed,
    vy + wy * accelSpeed,
    vz + wz * accelSpeed,
  ]
}
