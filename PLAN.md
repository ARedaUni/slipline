# Floating Flamingo — 3D Multiplayer Arena, Built for Scale

## Context

You want a multi-week project that flexes **scalable real-time systems design**, with a game as the vehicle. The chosen shape:

- 3D shared-arena game (React Three Fiber client, Go backend)
- Momentum-driven movement: **sliding + grappling hook** (think Titanfall × agar.io)
- Designed to support **~10k concurrent players** through horizontal scaling
- We will _architect_ for 10k(yes sorry incremental design bros but I'm tryna do this a bit faster :D) from day one but _build_ outward in tight increments — each phase ends in a runnable game

Working dir holds a scaffolded client (Vite + React 19 + R3F + vanilla Rapier) with CI in place. First slice (1.1) merged via PR #7 — see "Phased Execution" for current state.

Outcome: a deployed (or deploy-ready) 3D arena game that you understand end-to-end across browser physics, authoritative server simulation, matchmaking, pub/sub, persistence, and horizontal scale-out.

---

## Game Concept (just enough to drive architecture)

- **Arena**: closed 3D map, ~50 players per instance. Many simultaneous instances.
- **Mechanics**: WASD + jump + crouch-slide (downhill momentum) + grappling hook (Spider-Man swing). Some objective layer — points for tagging others, or last-flamingo-standing.
- **Match length**: ~5 min. Quick re-queue. (Short matches make load-testing easier and scale stories cleaner.)
- **Server-authoritative**: server runs the physics simulation; clients predict and reconcile. This is non-negotiable for grappling/sliding because client-authoritative physics + competition = trivial cheating.

The mechanics list is intentionally open. You'll iterate on feel in Phase 1.

---

## Architecture (the load-bearing decisions)

```
   ┌──────────────┐         ┌─────────────┐
   │  Browser     │ ─wss──▶ │  Gateway    │ ── HTTP ─▶ Matchmaker
   │ (R3F +       │         │  (Go)       │              │
   │  Rapier)     │ ◀─wss── │             │              ▼
   └──────────────┘         └──────┬──────┘         ┌─────────┐
                                   │                 │  Redis  │ ◀── pub/sub
                                   ▼                 │ / NATS  │     + presence
                            ┌─────────────┐          └────┬────┘     + sessions
                            │ Game Server │ ◀────────────┘
                            │  (Go)       │
                            │  ┌────────┐ │          ┌──────────┐
                            │  │ Room 1 │ │ ── SQL ─▶│ Postgres │
                            │  │ Room 2 │ │          │ (accts,  │
                            │  │ …      │ │          │  stats)  │
                            │  └────────┘ │          └──────────┘
                            └─────────────┘
```

**Key decisions & why:**

1. **Three-tier service split: Gateway / Matchmaker / Game Server.** Each scales independently. Gateways are stateless (easy). Matchmaker is light state (queue) → single instance or sharded by region. Game servers are heavy stateful, scale by count.
2. **Sticky websockets via gateway → game server handoff.** Client connects to gateway over wss; gateway calls matchmaker, gets a `{gameServerAddr, roomId, token}` reply, then **proxies the websocket** to the chosen game server (or returns the address for a direct second connection — simpler, recommended).
3. **One Go goroutine per room tick loop.** Goroutines + channels are the killer feature here — 100 rooms × 50 players on a single beefy node is trivially achievable.
4. **20 Hz server tick, 60 Hz client render.** Client uses entity interpolation (~100ms behind server) + local prediction for own player + reconciliation. This is the canonical Valve / Glenn Fiedler model.
5. **Snapshot delta-compression over websocket binary frames.** Start with JSON for dev (debuggable), switch to protobuf or a hand-rolled binary format once shape stabilizes. Don't pre-optimize.
6. **Pub/sub (Redis or NATS)** for: matchmaker → game-server room assignments, cross-server chat/presence, leaderboard updates, graceful shutdown drains.
7. **Postgres for cold state** (accounts, match history, cosmetics). Redis for **hot ephemeral** (sessions, presence, matchmaking queue, leaderboards via sorted sets). No game-tick state ever touches a DB — only memory.
8. **Server-side physics**: custom, _constrained to what the game needs_ (capsule character controller, raycast for grapple, swept-sphere collisions vs static arena geo). Do **not** port Rapier/Bullet to Go — too much yak-shaving. Reuse: client uses Rapier.js for prediction, server runs a Go re-implementation of the _same equations_ so prediction matches.
9. **Observability from week 2**: structured logs (slog), Prometheus metrics (tick duration, ws msg/sec, room count, dropped packets), pprof endpoint always on. You cannot reason about scale without seeing it.
10. **Physics simulation lives outside React's lifecycle.** The Rapier world is a module-level singleton bootstrapped once in `main.tsx` via `await createPhysicsWorld()`, then handed to the tree via a `<PhysicsProvider>` + `usePhysics()` hook. _Why:_ React's contract (UI = pure function of state, mounts/unmounts cheaply) is incompatible with physics' contract (sequential, non-idempotent state machine that must never be reset). StrictMode's intentional double-mount caused real WASM traps when the world was owned by `useEffect`. The DI-via-Context pattern keeps the seam clean — tests inject mock worlds at the Provider, future replay/spectator scopes can mount a separate world subtree, and non-React code (a Web Worker bootstrap later) can import the same factory.
11. **Movement model: Quake/Source equations on top of Rapier primitives.** Rapier handles solved-problem geometry (capsule-vs-mesh sweep, raycasts, collision response via `KinematicCharacterController`). We write the velocity equations ourselves — input → friction → ground/air acceleration → slide impulse → grapple spring. This is what every shooter does; movement _feel_ is the game and no library provides it. Canonical references: Quake3 `bg_pmove.c`, Source `gamemovement.cpp`. Total custom physics we own: ~500 lines, scoped to player + grapple. We use **vanilla `@dimforge/rapier3d-compat`**, not `@react-three/rapier` — the wrapper has a known StrictMode bug (issue #118) and hides the imperative seam we need for snapshot replay and reconciliation.
12. **Fixed-dt accumulator at 60 Hz on the client; 20 Hz authoritative server tick.** Pattern from Glenn Fiedler's "Fix Your Timestep!" Client steps physics at 60 Hz inside `useFrame` with `while (acc >= dt) step()` and a per-frame step cap to prevent the spiral-of-death on slow tabs. Same semi-implicit Euler equations will be byte-identical on the Go server. `client/src/physics/integrator.ts` is deliberately framework-free for exactly this port.

---

## Architectural conventions (decided, enforced from Slice 1.1)

These emerged from the first runnable slice and apply for the rest of the project. Violations should be treated as bugs.

- **Physics is owned outside React.** Singleton in `main.tsx`, Context for delivery, `usePhysics()` hook for access. Tests inject worlds via the Provider — never via `vi.mock`.
- **Pure modules are framework-free.** `physics/integrator.ts` (and future `physics/movement.ts`, `physics/snapshot.ts`) import nothing from React/Three/Rapier. They are the layer that ports verbatim to the Go server.
- **React must not re-render in the tick loop.** Per-frame entity transforms are written imperatively to `ref.current.position` / `.quaternion` inside `useFrame`. React reconciles only when entities enter/leave the scene (mount/unmount), never when they move.
- **TDD non-negotiable for physics & netcode.** Every equation, every snapshot encode/decode, every reconciliation rewind has a failing test before the code. The integrator's three RED-GREEN tests are the template.
- **Test architecture: jsdom for pure modules, Playwright (`vitest-browser-react`) for canvas + integration.** Pure module tests run in <100ms; we keep them fast and ubiquitous. Browser tests bootstrap real Rapier WASM (~800ms) — slower but high-fidelity.
- **Wire protocol versions before code stabilises.** JSON during dev (debuggable), protobuf at the end of Phase 2. Hand-rolled binary only if benchmarks demand it.
- **Server authority is the only anti-cheat.** Client predicts, server validates and reconciles. No client trusts another client. Ever.
- **Formatter strict on readability over terseness.** Biome `lineWidth: 80` — multi-arg typed function signatures wrap naturally; single-line collapse is rejected.

---

## Tech Stack

**Client** (`/client`):

- TypeScript (strict mode), Vite, React 19
- **React Three Fiber** for declarative scene composition. React lives only at the UI / scene-graph layer — never inside the physics tick loop.
- **`@dimforge/rapier3d-compat`** (vanilla, _not_ `@react-three/rapier`). Reasons in decision #11.
- **Biome** for lint + format (`lineWidth: 80`, multi-line typed signatures enforced).
- **Vitest** — unit (jsdom) for pure modules, browser (Playwright via `vitest-browser-react`) for canvas mount + integration.
- **Stryker** mutation testing wired in (`pnpm stryker`) for high-value pure modules — pays off once netcode logic lands in Phase 2.
- Plain WebSocket API (no socket.io — it abstracts away exactly what we want to learn).

**Server** (`/server`):

- Go 1.22+
- `nhooyr.io/websocket` (modern, context-aware) — _not_ gorilla/websocket
- `github.com/jackc/pgx/v5` for Postgres
- `github.com/redis/go-redis/v9` or NATS Go client
- `log/slog` (stdlib) for structured logging
- Prometheus client library
- `github.com/google/uuid`

**Infra** (`/infra`):

- Docker Compose for local dev (Postgres, Redis, NATS, 2× game server, 1× matchmaker, 1× gateway)
- Production deferred until Phase 4 — keep options open (Fly.io, Railway, or hand-rolled on a few VPSes; _not_ k8s unless you specifically want that learning).

**Repo layout (monorepo):**

```
/client                            R3F + Rapier + TS
  /src
    /physics                       pure modules + Rapier world factory + DI provider
      integrator.ts                semi-implicit Euler (pure, ports to Go)
      types.ts                     Vec3, KinematicState, IntegrationParams
      world.ts                     createPhysicsWorld() factory
      PhysicsContext.tsx           <PhysicsProvider> + usePhysics() hook
      movement.ts                  (Slice 1.2) Quake/Source velocity equations
      snapshot.ts                  (Phase 2) entity snapshot + delta
    /scene                         R3F Canvas + per-entity components
      Scene.tsx                    <Canvas>, lights, camera, useFrame tick
    main.tsx                       async bootstrap: createPhysicsWorld → render
    App.tsx                        thin root, renders <Scene />
  /tests
    /unit                          jsdom; pure module tests (<100ms)
    /browser                       Playwright; canvas mount + integration
/server                            (Phase 2+)
  /cmd
    /gateway                       edge ws handler
    /matchmaker                    queue & room assignment
    /gameserver                    room host (tick loop)
  /internal
    /game                          shared sim code (physics, entities, snapshot)
    /proto                         wire protocol
    /transport                     ws helpers
/infra                             docker-compose, scripts (Phase 3+)
```

---

## Phased Execution

Each phase ends with **a runnable game**. Do not advance until current phase plays end-to-end.

### Phase 1 — Single-player feel (week 1)

Goal: nail the movement before anything multiplayer matters. If the game doesn't feel good solo, multiplayer won't save it.

**Slice 1.1 — Scaffold (DONE ✅, PR #7)**

- R3F `<Canvas>` mounts a scene with a Rapier-driven falling cube on a static floor
- Pure `integrator.ts` module with semi-implicit Euler — 3 TDD'd unit tests (gravity acceleration; vertical position via post-update velocity; horizontal position·dt)
- Physics bootstrapped once outside React (`createPhysicsWorld()` in `main.tsx`); delivered via `<PhysicsProvider>` + `usePhysics()` — fixes the StrictMode double-mount WASM trap
- Browser smoke test (Playwright) asserts canvas mounts under the Provider
- Fixed-dt accumulator (60 Hz) in `useFrame` with a per-frame step cap

**Slice 1.2 — Kinematic player controller (NEXT)**

- Player as a capsule using Rapier's `KinematicCharacterController` (collision response against arena geo)
- Input layer: WASD key state + pointer lock + mouselook (yaw + pitch). Module-level singleton, exposed via a hook for the player component.
- Velocity update written **test-first** against canonical Quake/Source equations in a new `physics/movement.ts`:
  - Ground friction (linear decay below max speed)
  - Ground acceleration (clamp to max speed along input direction)
  - Air acceleration (the famous Quake "strafe-jump" formulation — accel only in the _new_ direction, preserves momentum)
  - Jump impulse + gravity from Rapier
- First-person camera follows the capsule via imperative ref-sync in `useFrame` (no React re-render on movement)

Verify: capsule moves smoothly, collides correctly with the floor, cannot fall through. Strafe-jump preserves horizontal momentum across consecutive jumps. Movement equations unit-tested independent of Rapier.

**Slice 1.3 — Arena + slide + grapple**

- Replace the placeholder floor with a small hand-built arena (boxes, ramps, a wall worth grappling onto). One mesh; no procedural generation.
- **Crouch-slide**: friction reduction + downslope-projected impulse (constant force along the slope tangent)
- **Grapple hook**: raycast → attach point → spring force. First pass: hand-rolled Hookean spring on the capsule's velocity (`F = -k·Δx - c·v`); reuse Rapier joint only if the hand-rolled spring feels wrong.
- Movement-tuning HUD (React DOM overlay _outside_ the Canvas — keeps physics clean): sliders for friction, slide impulse magnitude, grapple stiffness/damping.

Verify: you can run a loop around the arena in under 30s using slide+grapple chains and it feels juicy. Tuning sliders dialed in. Recordings of "feels good" sessions saved for regression-by-eye in Phase 2.

### Phase 2 — Authoritative server, single room (week 2)

Goal: prove the netcode model on one room before scaling out.

- Go game server, one hardcoded room, 20 Hz tick
- Port your physics equations from Phase 1 into Go (`/internal/game`)
- WebSocket binary protocol (start with JSON, swap to protobuf at end of phase)
- Client: prediction + server reconciliation + entity interpolation for other players
- Stress test: 2 → 8 → 20 players in one room (use headless bot clients in Go)
- Prometheus + Grafana running locally; watch tick duration as players join

Verify: 20 bots + you in one room sustain <50ms input-to-screen on localhost, server tick <5ms p99.

### Phase 3 — Matchmaker + multi-room + horizontal scale (week 3)

Goal: actually exercise the scale architecture.

- Split into Gateway / Matchmaker / Game Server services
- Redis (or NATS) for pub/sub & matchmaking queue
- Matchmaker assigns players to rooms; rooms auto-spawn on demand, die when empty
- Run **2 game server instances** in docker-compose; verify players get distributed
- Headless bot fleet: ramp 100 → 500 → 1000 simulated connections
- Identify the first bottleneck honestly (it will be physics CPU, ws fan-out, or GC)

Verify: 1000 bots distributed across 2 game servers, sustained 20 Hz tick, no dropped frames.

### Phase 4 — Persistence, accounts, polish, deploy (week 4+)

Goal: make it real.

- Postgres: accounts, match history, basic stats
- Redis sorted set for leaderboard
- OAuth or magic-link auth (whichever is faster)
- Graceful drain: SIGTERM → finish current matches → deregister → exit
- Deploy: 1× gateway, 1× matchmaker, 2× game server, managed Postgres + Redis
- Public load test from a separate machine
- Write a postmortem doc on what your bottleneck _actually_ was vs what you predicted

Verify: a stranger can sign up, queue, play a match, see their rank go up. Two game servers handle the load without manual intervention.

---

## Critical Patterns to Study (don't reinvent these)

- **Glenn Fiedler — "Game Networking" series** (gafferongames.com): snapshot interpolation, client prediction, lag compensation. The canon. Read before Phase 2.
- **Valve "Source Multiplayer Networking"** — short, dense, foundational.
- **Gabriel Gambetta — "Fast-Paced Multiplayer"** — clearest visual explanation of client-side prediction & reconciliation.
- **Riot — "Peeking into Valorant's netcode"** — modern production write-up.

Reuse these _concepts_; do not pull a netcode library. The whole point is to internalise them.

---

## Critical Files

**Client (exists today, Slice 1.1)**

- `client/src/physics/integrator.ts` — pure kinematic step (semi-implicit Euler). Framework-free. Mirrors what `server/internal/game/physics.go` will run.
- `client/src/physics/types.ts` — `Vec3`, `KinematicState`, `IntegrationParams`. Readonly tuples and objects only.
- `client/src/physics/world.ts` — Rapier world factory (`createPhysicsWorld()`). Called once from `main.tsx`. Will grow to own the player body, arena colliders, joints.
- `client/src/physics/PhysicsContext.tsx` — DI provider + `usePhysics()` hook. The seam tests inject through.
- `client/src/scene/Scene.tsx` — R3F `<Canvas>`. Owns camera, lighting, per-entity components. Imperative ref-sync inside `useFrame`.
- `client/src/main.tsx` — async bootstrap: awaits `createPhysicsWorld()` before the first React render.

**Client (next slices)**

- `client/src/physics/movement.ts` (Slice 1.2) — Quake/Source velocity equations. Pure. Will be ported to Go.
- `client/src/input/keyboard.ts` (Slice 1.2) — key-state singleton, exposed via a hook.
- `client/src/physics/grapple.ts` (Slice 1.3) — raycast + spring constraint.

**Server (Phase 2+)**

- `server/internal/game/physics.go` — Go port of `integrator.ts` and `movement.ts`. Must match byte-for-byte for prediction to reconcile.
- `server/internal/game/snapshot.go` — entity snapshot + delta encoding.
- `server/internal/game/room.go` — tick loop, the heart of the server.
- `server/internal/proto/` — wire protocol (JSON → protobuf).

**Infra (Phase 3+)**

- `infra/docker-compose.yml` — local multi-service rig (gateway, matchmaker, game servers, Redis, Postgres).

---

## Verification (end-to-end, by phase)

| Phase | How you'll know it works                                                           |
| ----- | ---------------------------------------------------------------------------------- |
| 1     | Solo speedrun feels good; movement tuning sliders dialed in                        |
| 2     | 20 bots in one room, tick <5ms p99, prediction errors visibly resolve              |
| 3     | 1000 bots across 2 servers under docker-compose; metrics dashboard green           |
| 4     | Public match with a friend you didn't share docs with; leaderboard updates persist |

Run targets: `make dev` (compose up), `make bots N=500` (spawn bot fleet), `make stress` (predefined load scenario).

---

## What we are explicitly _not_ doing

- No k8s, no service mesh, no event sourcing, no CQRS. They're irrelevant at 10k CCU.
- No anti-cheat beyond server authority. (Real anti-cheat is a project on its own.)
- No procedural arenas. One hand-built map is enough.
- No mobile. Desktop browser only.
- No OOP for OOP's sake — Go's struct+interface composition will dominate; TS classes used pragmatically.
