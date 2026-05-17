# Floating Flamingo — Project Conventions

Strategy and phasing live in `PLAN.md`. This file is the rulebook for **how** code is written in this repo. Read this before touching client code.

## Architecture: four layers, one direction of dependency

```
composition  →  scene  →  engine  →  sim
  (root)        (R3F)     (adapters)  (pure domain)
```

The dependency arrow is **strictly one-way**. Inner layers do not know that outer layers exist. The discipline behind this is Cockburn's *Hexagonal Architecture / Ports & Adapters*: the domain (sim) owns its interfaces, written in its own vocabulary; outer layers implement them. Swapping React, swapping Rapier, or porting the sim to a Go server should each be a single-layer concern.

```
client/src/
  main.tsx, App.tsx            composition root — wires Providers, mounts <App/>
  scene/                       React + Three (R3F)
    Scene.tsx                  <Canvas>, lights, static meshes
    Player.tsx                 useFrame driver, camera sync, pointer-lock
  engine/                      runtime adapters + framework-free plumbing
    fixedLoop.ts               Fiedler accumulator (pure)
    rapierAdapter.ts           Rapier → sim's CharacterBody port
    physicsWorld.ts            Rapier World factory
    PhysicsContext.tsx         React DI for PhysicsWorld
    input/
      keyboard.ts, mouse.ts    DOM adapters (key state, pointer-lock)
      InputContext.tsx         React DI for Input
  sim/                         pure domain — zero React, Three, or Rapier
    types.ts                   Vec3, KinematicState, IntegrationParams
    intent.ts                  MoveIntent + buildIntent (input → intent)
    character.ts               CharacterBody port (interface)
    step.ts                    stepCharacter (per-tick integration)
    movement.ts                applyFriction, accelerate (Quake/Source eqs)
    integrator.ts              semi-implicit Euler (will port to Go)
```

## What each layer is allowed to import

| Layer | May import from | Must NOT import |
|---|---|---|
| `sim/` | `sim/` only | `react`, `three`, `@react-three/fiber`, `@dimforge/rapier3d-compat`, `engine/`, `scene/` |
| `engine/` | `sim/`, `react`, `@dimforge/rapier3d-compat`, DOM globals | `three`, `@react-three/fiber`, `scene/` |
| `scene/` | `engine/`, `sim/`, `react`, `@react-three/fiber`, `three` | direct framework primitives bypassing the engine adapters |
| `main.tsx`, `App.tsx` | anything (this is the composition root) | — |

Before adding any cross-layer import, ask: "does this make the arrow point the wrong way?" If yes, the fix is either to relocate the file or to introduce a port in the inner layer that the outer layer implements.

## Where to put new code

Decision tree for any new file:

1. **Does the logic make sense without React, Three, or Rapier?** → `sim/`. (Will it port to a Go server? Yes → `sim/`.)
2. **Does it wrap a runtime (Rapier, DOM, WebSocket, React Context)?** → `engine/`. Define the port in `sim/` first; implement it here.
3. **Does it mount Three objects via R3F?** → `scene/`.
4. **Does it wire providers, mount the root, or bootstrap async deps (Rapier WASM)?** → `main.tsx` / `App.tsx`.

If a new feature spans layers (e.g. "grapple hook"): the math is `sim/grapple.ts` (pure, tested), the raycast adapter is `engine/rapierRaycast.ts` (implements a port from `sim/`), the visual rope is `scene/Grapple.tsx`. Three files, three tests, three roles.

## Testing strategy

| Test kind | Tool | Where | What it tests |
|---|---|---|---|
| Pure unit | Vitest (`vitest run --project=unit`) | `tests/unit/sim/**`, `tests/unit/engine/**` | sim logic + framework-free engine helpers. Sub-100ms. Run constantly. |
| Browser smoke | Vitest browser + Playwright | `tests/browser/**` | The full React + R3F + real Rapier WASM mount. Slow (~1s); keep small. |

**The discipline that makes this work:**

- Sim tests use **`FakeCharacterBody`** (or any test double) injected as a port impl. They never boot Rapier. See `tests/unit/sim/step.test.ts` for the canonical pattern.
- Engine adapter behaviour is exercised through the browser smoke test, not a unit test. Adapters wrap a library; testing them in isolation just tests that mocks are called.
- React components are tested via the browser test, mounting through real Providers. **Do not `vi.mock` the world** — inject via the Provider.

## Discipline

### TDD is non-negotiable
Every line of production logic lands in response to a failing test. The exception is pure file moves and import-path edits (tidy commits), which are verified by the existing test suite remaining green.

### Tidy First (Beck)
Structural changes (extract function, move file, rename) and behavioural changes (new feature, bug fix) go in **separate commits**. The commit message should make the kind explicit: "Extract X" vs "Add X".

### Refactor before adding (Beck / Fowler)
When a new feature is hard to add cleanly, the first commit is a refactor that makes it easy, and the second is the feature. This rule is what kept `Player.tsx` from becoming an 800-line god component.

### One physics world, owned outside React
The Rapier world is created **once** in `main.tsx` (`await createPhysicsWorld()`) and delivered through `PhysicsContext`. StrictMode's double-mount caused real WASM traps when the world was owned by `useEffect`; the DI seam fixes it. Never recreate the world inside a component.

### React must not re-render in the tick loop
Per-frame entity transforms are written imperatively to `ref.current.position` / `.quaternion` inside `useFrame`. React reconciles only on entity mount/unmount, never on movement. Any `setState` inside a tick loop is a bug.

### Fixed-dt physics, render-rate presentation
Physics steps at a fixed 60 Hz using `advanceFixedLoop`'s accumulator (Fiedler's *Fix Your Timestep!*). Rendering runs at the monitor's rate. Mixing them produces frame-pacing jitter and breaks the future Go-server determinism.

## Anti-patterns (treat as bugs)

- A `sim/` file with `import { … } from '@dimforge/rapier3d-compat'` or `from 'react'`. The arrow is wrong.
- A `scene/` component that calls Rapier APIs directly instead of going through an `engine/` adapter.
- `vi.mock('../engine/physicsWorld')` in a sim test. Sim tests use a fake passed through the port, not a mocked module.
- Constants buried in components (e.g. `JUMP_SPEED` inside `Player.tsx`). Tuning lives in a `StepTuning` object owned by the sim.
- A useFrame body longer than 30 lines. Extract a function and name it for what it does.
- Single-line collapsed function signatures with multiple typed params. Biome enforces `lineWidth: 80`; multi-line signatures stay readable.

## Commands

```
pnpm dev              vite dev server
pnpm test             unit + browser (full suite)
pnpm test:unit        sim + engine pure tests only (fast)
pnpm test:browser     R3F + real Rapier WASM (slow)
pnpm typecheck        tsc -b
pnpm check            biome lint + format
pnpm check:fix        biome auto-fix
pnpm stryker          mutation testing on high-value pure modules
```

## References

- `PLAN.md` — phased strategy and architectural rationale
- Cockburn, *Hexagonal Architecture* (2005) — https://alistair.cockburn.us/hexagonal-architecture/
- Fowler, *Refactoring* 2nd ed. (2018) — the smell catalogue and the named transformations
- Beck, *Tidy First?* (2023) — structural vs behavioural change discipline
- Fiedler, *Fix Your Timestep!* — https://gafferongames.com/post/fix_your_timestep/
- Nystrom, *Game Programming Patterns* — https://gameprogrammingpatterns.com/
