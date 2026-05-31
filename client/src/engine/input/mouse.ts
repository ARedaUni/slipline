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
  // Continuous "primary button held while pointer-lock active" flag.
  // True between primary mousedown and mouseup (or pointer-lock loss);
  // false otherwise. Live read with no consume side-effect, so the sim
  // can poll it every tick to drive hold-to-grapple edge detection.
  // Mousedowns while unlocked are ignored — the first click of a
  // session grabs the lock and must not also fire the grapple.
  readonly isFireHeld: () => boolean
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
  let fireHeld = false

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
    fireHeld = true
  }

  const onMouseUp = (e: MouseEvent) => {
    if (e.button !== 0) return
    fireHeld = false
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('mouseup', onMouseUp)

  return {
    getLook: () => state,
    requestLock: () => {
      element.requestPointerLock()
    },
    isLocked: () => document.pointerLockElement === element,
    isFireHeld: () => fireHeld,
    dispose: () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
    },
  }
}
