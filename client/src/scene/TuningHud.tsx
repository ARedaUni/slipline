import { useSyncExternalStore } from 'react'
import { useTuning } from '../engine/TuningContext'
import type { TuningStore } from '../engine/tuning'
import type { StepTuning } from '../sim/step'

// Dev-only DOM overlay for dialling movement/grapple numbers at runtime.
// Lives in scene/ because it's a React component, but renders OUTSIDE
// <Canvas> (sibling in App.tsx) so it does not participate in the R3F
// tree — no per-frame coupling, no risk of triggering a Canvas re-render.

type SliderRow = Readonly<{
  label: string
  min: number
  max: number
  step: number
  read: (t: StepTuning) => number
  write: (t: StepTuning, n: number) => StepTuning
}>

const ROWS: readonly SliderRow[] = [
  {
    label: 'ground friction',
    min: 0,
    max: 20,
    step: 0.1,
    read: (t) => t.groundFriction,
    write: (t, n) => ({ ...t, groundFriction: n }),
  },
  {
    label: 'ground accel',
    min: 0,
    max: 50,
    step: 0.5,
    read: (t) => t.groundAccel,
    write: (t, n) => ({ ...t, groundAccel: n }),
  },
  {
    label: 'grapple rest length',
    min: 0,
    max: 20,
    step: 0.1,
    read: (t) => t.grapple.restLength,
    write: (t, n) => ({ ...t, grapple: { ...t.grapple, restLength: n } }),
  },
  {
    label: 'grapple stiffness (k)',
    min: 0,
    max: 200,
    step: 1,
    read: (t) => t.grapple.stiffness,
    write: (t, n) => ({ ...t, grapple: { ...t.grapple, stiffness: n } }),
  },
  {
    label: 'grapple damping (c)',
    min: 0,
    max: 30,
    step: 0.1,
    read: (t) => t.grapple.damping,
    write: (t, n) => ({ ...t, grapple: { ...t.grapple, damping: n } }),
  },
  {
    label: 'grapple max range',
    min: 0,
    max: 50,
    step: 0.5,
    read: (t) => t.grapple.maxRange,
    write: (t, n) => ({ ...t, grapple: { ...t.grapple, maxRange: n } }),
  },
]

const CONTAINER_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  right: 12,
  padding: '10px 12px',
  background: 'rgba(20, 22, 30, 0.78)',
  color: '#e6e8ee',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  borderRadius: 6,
  width: 260,
  pointerEvents: 'auto',
  zIndex: 10,
}

const ROW_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'center',
  gap: 4,
  marginTop: 6,
}

const useTuningSnapshot = (store: TuningStore): StepTuning =>
  useSyncExternalStore(store.subscribe, store.get)

type SliderProps = Readonly<{
  row: SliderRow
  tuning: StepTuning
  store: TuningStore
}>

const Slider = ({ row, tuning, store }: SliderProps) => {
  const value = row.read(tuning)
  return (
    <label style={{ display: 'block' }}>
      <div style={ROW_STYLE}>
        <span>{row.label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={row.min}
        max={row.max}
        step={row.step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          store.set((prev) => row.write(prev, n))
        }}
        style={{ width: '100%' }}
      />
    </label>
  )
}

export const TuningHud = () => {
  const store = useTuning()
  const tuning = useTuningSnapshot(store)
  return (
    <div style={CONTAINER_STYLE} data-testid="tuning-hud">
      <strong>tuning</strong>
      {ROWS.map((row) => (
        <Slider key={row.label} row={row} tuning={tuning} store={store} />
      ))}
    </div>
  )
}
