export type FixedLoopOptions = Readonly<{
  dt: number
  maxStepsPerFrame: number
}>

// Fiedler "Fix Your Timestep!" accumulator with a per-frame step cap.
// Pure: returns the new accumulator value; calls `step` for each
// full dt that fits inside (prevAccumulator + clampedDelta).
//
// The cap on delta prevents the spiral-of-death: if a frame stalls
// (background tab, GC pause, devtools), we step at most maxStepsPerFrame
// times this frame and drop the rest of the time rather than running
// physics arbitrarily long inside one render frame.

// biome-ignore format: multi-line signature keeps typed params readable
export const advanceFixedLoop = (
  prevAccumulator: number,
  delta: number,
  step: () => void,
  opts: FixedLoopOptions,
): number => {
  const clampedDelta = Math.min(delta, opts.maxStepsPerFrame * opts.dt)
  let acc = prevAccumulator + clampedDelta
  while (acc >= opts.dt) {
    step()
    acc -= opts.dt
  }
  return acc
}
