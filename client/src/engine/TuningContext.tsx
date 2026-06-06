import { createContext, type ReactNode, useContext } from 'react'
import type { TuningStore } from './tuning'

const TuningContext = createContext<TuningStore | null>(null)

export type TuningProviderProps = {
  readonly value: TuningStore
  readonly children: ReactNode
}

export const TuningProvider = ({ value, children }: TuningProviderProps) => (
  <TuningContext.Provider value={value}>{children}</TuningContext.Provider>
)

export const useTuning = (): TuningStore => {
  const ctx = useContext(TuningContext)
  if (!ctx) {
    throw new Error('useTuning must be called inside <TuningProvider>')
  }
  return ctx
}
