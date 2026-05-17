import { createContext, type ReactNode, useContext } from 'react'
import type { Keyboard } from './keyboard'
import type { Mouse } from './mouse'

export type Input = {
  readonly keyboard: Keyboard
  readonly mouse: Mouse
}

const InputContext = createContext<Input | null>(null)

export type InputProviderProps = {
  readonly value: Input
  readonly children: ReactNode
}

export const InputProvider = ({ value, children }: InputProviderProps) => (
  <InputContext.Provider value={value}>{children}</InputContext.Provider>
)

export const useInput = (): Input => {
  const ctx = useContext(InputContext)
  if (!ctx) {
    throw new Error('useInput must be called inside <InputProvider>')
  }
  return ctx
}
