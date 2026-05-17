export type Action = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'crouch'

export type KeyState = {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  jump: boolean
  crouch: boolean
}

const KEY_MAP: Readonly<Record<string, Action>> = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
  ShiftLeft: 'crouch',
  ShiftRight: 'crouch',
}

export const codeToAction = (code: string): Action | null =>
  KEY_MAP[code] ?? null

export type Keyboard = {
  readonly getKeys: () => Readonly<KeyState>
  readonly dispose: () => void
}

const emptyKeys = (): KeyState => ({
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  crouch: false,
})

export const createKeyboard = (target: Window = window): Keyboard => {
  const state = emptyKeys()

  const set = (code: string, down: boolean) => {
    const action = codeToAction(code)
    if (action === null) return
    state[action] = down
  }

  const onDown = (e: KeyboardEvent) => set(e.code, true)
  const onUp = (e: KeyboardEvent) => set(e.code, false)
  const onBlur = () => {
    // when window loses focus, treat all keys as released — prevents "stuck key"
    for (const k of Object.keys(state) as Array<keyof KeyState>) {
      state[k] = false
    }
  }

  target.addEventListener('keydown', onDown)
  target.addEventListener('keyup', onUp)
  target.addEventListener('blur', onBlur)

  return {
    getKeys: () => state,
    dispose: () => {
      target.removeEventListener('keydown', onDown)
      target.removeEventListener('keyup', onUp)
      target.removeEventListener('blur', onBlur)
    },
  }
}
