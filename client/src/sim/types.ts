export type Vec3 = readonly [number, number, number]

export type KinematicState = {
  readonly position: Vec3
  readonly velocity: Vec3
}

export type IntegrationParams = {
  readonly gravity: number
  readonly dt: number
}
