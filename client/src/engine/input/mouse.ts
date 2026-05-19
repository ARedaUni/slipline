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
  // Edge-event consumer: returns true on exactly the tick after a
  // primary-button mousedown that happened while pointer-lock was held,
  // and false otherwise. Reading it CLEARS the pulse, so the sim only
  // observes the edge once. Mousedowns while unlocked are ignored — the
  // first click of a session is what grabs the lock, and we do not want
  // that one to fire a grapple.
  readonly consumeFireClick: () => boolean
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
  let pendingFire = false

  const onMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== element) return
    state = applyMouseDelta(state, e.movementX, e.movementY, sensitivity)
  }

  const onMouseDown = (e: MouseEvent) => {
    // Primary (left) button only — secondary buttons are reserved for
    // future actions (right-click release? middle-click utility?).
    if (e.button !== 0) return
    // Ignore mousedowns until pointer-lock is held — the first click
    // grabs the lock and must not also be interpreted as a fire.
    if (document.pointerLockElement !== element) return
    pendingFire = true
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mousedown', onMouseDown)

  return {
    getLook: () => state,
    requestLock: () => {
      element.requestPointerLock()
    },
    isLocked: () => document.pointerLockElement === element,
    consumeFireClick: () => {
      const r = pendingFire
      pendingFire = false
      return r
    },
    dispose: () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mousedown', onMouseDown)
    },
  }
}
