import type { IntegrationParams, KinematicState } from './types'

export const step = (
  state: KinematicState,
  params: IntegrationParams,
): KinematicState => {
  const [vx, vy, vz] = state.velocity
  const [px, py, pz] = state.position
  const nextVy = vy + params.gravity * params.dt
  return {
    velocity: [vx, nextVy, vz],
    position: [px + vx * params.dt, py + nextVy * params.dt, pz + vz * params.dt],
  }
}
