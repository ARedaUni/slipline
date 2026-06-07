import { describe, expect, it, vi } from 'vitest'
import { createTuningStore } from '../../../src/engine/tuning'
import { DEFAULT_TUNING } from '../../../src/sim/step'

describe('createTuningStore', () => {
  it('get() returns the initial snapshot', () => {
    const store = createTuningStore(DEFAULT_TUNING)

    expect(store.get()).toBe(DEFAULT_TUNING)
  })

  it('set(updater) replaces the snapshot returned by get()', () => {
    const store = createTuningStore(DEFAULT_TUNING)

    store.set((prev) => ({ ...prev, gravity: -10 }))

    expect(store.get().gravity).toBe(-10)
  })

  it('subscribe(fn) calls fn after every set', () => {
    const store = createTuningStore(DEFAULT_TUNING)
    const listener = vi.fn()
    store.subscribe(listener)

    store.set((prev) => ({ ...prev, gravity: -10 }))

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('subscribe returns an unsubscribe that silences the listener', () => {
    const store = createTuningStore(DEFAULT_TUNING)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    unsubscribe()
    store.set((prev) => ({ ...prev, gravity: -10 }))

    expect(listener).not.toHaveBeenCalled()
  })
})
