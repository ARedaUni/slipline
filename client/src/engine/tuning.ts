import type { StepTuning } from '../sim/step'

// Runtime store for designer-dialled tuning values. The sim consumes
// snapshots via get() each tick; the HUD subscribes for re-renders and
// produces new snapshots via set(updater). Snapshots are immutable —
// callers receive the current Readonly<StepTuning> reference, never a
// live object that can mutate underneath them.
export type TuningStore = {
  readonly get: () => StepTuning
  readonly set: (updater: (prev: StepTuning) => StepTuning) => void
  readonly subscribe: (listener: () => void) => () => void
}

export const createTuningStore = (initial: StepTuning): TuningStore => {
  let snapshot: StepTuning = initial
  const listeners = new Set<() => void>()
  return {
    get: () => snapshot,
    set: (updater) => {
      snapshot = updater(snapshot)
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
