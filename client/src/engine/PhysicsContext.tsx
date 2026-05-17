import { createContext, type ReactNode, useContext } from 'react'
import type { PhysicsWorld } from './physicsWorld'

const PhysicsContext = createContext<PhysicsWorld | null>(null)

export type PhysicsProviderProps = {
  readonly value: PhysicsWorld
  readonly children: ReactNode
}

export const PhysicsProvider = ({ value, children }: PhysicsProviderProps) => (
  <PhysicsContext.Provider value={value}>{children}</PhysicsContext.Provider>
)

export const usePhysics = (): PhysicsWorld => {
  const ctx = useContext(PhysicsContext)
  if (!ctx) {
    throw new Error('usePhysics must be called inside <PhysicsProvider>')
  }
  return ctx
}
