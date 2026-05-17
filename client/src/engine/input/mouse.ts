export type LookState = {
  yaw: number
  pitch: number
}

const PITCH_LIMIT = Math.PI / 2 - 0.01

export const applyMouseDelta = (
  current: Readonly<LookState>,
  dx: number,
  dy: number,
  sensitivity: number,
): LookState => {
  const yaw = current.yaw - dx * sensitivity
  const rawPitch = current.pitch - dy * sensitivity
  const pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, rawPitch))
  return { yaw, pitch }
}

export type Mouse = {
  readonly getLook: () => Readonly<LookState>
  readonly requestLock: () => void
  readonly isLocked: () => boolean
  readonly dispose: () => void
}

export type MouseOptions = {
  readonly sensitivity?: number
  readonly element?: HTMLElement
}

const DEFAULT_SENSITIVITY = 0.002

export const createMouse = (opts: MouseOptions = {}): Mouse => {
  const sensitivity = opts.sensitivity ?? DEFAULT_SENSITIVITY
  const element = opts.element ?? document.body

  let state: LookState = { yaw: 0, pitch: 0 }

  const onMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== element) return
    state = applyMouseDelta(state, e.movementX, e.movementY, sensitivity)
  }

  document.addEventListener('mousemove', onMove)

  return {
    getLook: () => state,
    requestLock: () => {
      element.requestPointerLock()
    },
    isLocked: () => document.pointerLockElement === element,
    dispose: () => {
      document.removeEventListener('mousemove', onMove)
    },
  }
}
