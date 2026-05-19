import { expect, test } from 'vitest'
import { createPhysicsWorld } from '../../src/engine/physicsWorld'
import { createRapierAnchorProbe } from '../../src/engine/rapierAnchorProbe'

// Smoke test for the rapierAnchorProbe adapter (Cockburn): proves the
// AnchorProbe port is wired to real Rapier WASM and returns a hit
// against real arena geometry. Sim-side AnchorProbe behaviour (miss
// handling, range filtering, etc.) is driven by unit tests in
// tests/unit/sim/** against a FakeAnchorProbe — this one's job is the
// adapter wiring, not the protocol.
//
// Ray geometry:
//   arena.ts:   WALL_CENTER  = (0, 2.5, -10)
//               WALL_HALF_EXTENTS = (3, 2.5, 0.25)
//               → wall occupies x ∈ [-3, 3], y ∈ [0, 5], z ∈ [-10.25, -9.75]
//   origin = (2, 1, 0): x = 2 sidesteps the player capsule at the origin
//                       (capsule radius 0.3, so any |x| > 0.3 clears it),
//                       y = 1 falls inside the wall's y range,
//                       x = 2 falls inside the wall's x range.
//   direction = (0, 0, -1): ray points straight at the wall's near face.
//   expected hit.point.z ≈ -9.75 (the near face).

test('findAnchor returns the hit point on the arena wall', async () => {
  const world = await createPhysicsWorld()
  // Rapier populates its broad-phase / query pipeline during world.step().
  // In production, rapierAdapter.tryMove steps every tick before anything
  // queries the world. The smoke test has no such loop, so we step once
  // to bring the query pipeline online.
  world.world.step()
  const probe = createRapierAnchorProbe(world)

  const hit = probe.findAnchor([2, 1, 0], [0, 0, -1], 20)

  expect(hit.found).toBe(true)
  if (hit.found) {
    expect(hit.point[2]).toBeCloseTo(-9.75, 1)
  }
})
