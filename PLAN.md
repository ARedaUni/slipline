# Floating Flamingo — 3D Multiplayer Arena, Built for Scale

## Context

You want a multi-week project that flexes **scalable real-time systems design**, with a game as the vehicle. The chosen shape:

- 3D shared-arena ".io-style" game (Three.js client, Go backend)
- Momentum-driven movement: **sliding + grappling hook** (think Titanfall × agar.io)
- Designed to support **~10k concurrent players** through horizontal scaling
- We will *architect* for 10k from day one but *build* outward in tight increments — each phase ends in a runnable game

Working dir is empty (`/Users/jimmy/Desktop/personal_engineering/game`) — true greenfield.

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
   │ (Three.js +  │         │  (Go)       │              │
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
8. **Server-side physics**: custom, *constrained to what the game needs* (capsule character controller, raycast for grapple, swept-sphere collisions vs static arena geo). Do **not** port Rapier/Bullet to Go — too much yak-shaving. Reuse: client uses Rapier.js for prediction, server runs a Go re-implementation of the *same equations* so prediction matches.
9. **Observability from week 2**: structured logs (slog), Prometheus metrics (tick duration, ws msg/sec, room count, dropped packets), pprof endpoint always on. You cannot reason about scale without seeing it.

---

## Tech Stack

**Client** (`/client`):
- TypeScript (strict), Vite
- Three.js for rendering
- Rapier.js (WASM) for client-side physics prediction
- Plain WebSocket API (no socket.io — it abstracts away exactly what we want to learn)

**Server** (`/server`):
- Go 1.22+
- `nhooyr.io/websocket` (modern, context-aware) — *not* gorilla/websocket
- `github.com/jackc/pgx/v5` for Postgres
- `github.com/redis/go-redis/v9` or NATS Go client
- `log/slog` (stdlib) for structured logging
- Prometheus client library
- `github.com/google/uuid`

**Infra** (`/infra`):
- Docker Compose for local dev (Postgres, Redis, NATS, 2× game server, 1× matchmaker, 1× gateway)
- Production deferred until Phase 4 — keep options open (Fly.io, Railway, or hand-rolled on a few VPSes; *not* k8s unless you specifically want that learning).

**Repo layout (monorepo):**
```
/client          Three.js + TS
/server
  /cmd
    /gateway     edge ws handler
    /matchmaker  queue & room assignment
    /gameserver  room host (tick loop)
  /internal
    /game        shared sim code (physics, entities, snapshot)
    /proto       wire protocol
    /transport   ws helpers
/infra           docker-compose, scripts
```

---

## Phased Execution

Each phase ends with **a runnable game**. Do not advance until current phase plays end-to-end.

### Phase 1 — Single-player feel (week 1)
Goal: nail the movement before anything multiplayer matters. If the game doesn't feel good solo, multiplayer won't save it.
- Three.js scene: simple arena (boxes, ramps, a few platforms)
- Capsule character controller with Rapier.js
- WASD + mouselook + jump + **crouch-slide** (apply downhill momentum, reduce friction)
- **Grappling hook**: raycast → attach point → spring constraint → release
- Movement-tuning UI (sliders for friction, slide impulse, grapple stiffness)

Verify: you can run a loop around the arena in under 30s using slide+grapple chains and it feels juicy.

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
- Write a postmortem doc on what your bottleneck *actually* was vs what you predicted

Verify: a stranger can sign up, queue, play a match, see their rank go up. Two game servers handle the load without manual intervention.

---

## Critical Patterns to Study (don't reinvent these)

- **Glenn Fiedler — "Game Networking" series** (gafferongames.com): snapshot interpolation, client prediction, lag compensation. The canon. Read before Phase 2.
- **Valve "Source Multiplayer Networking"** — short, dense, foundational.
- **Gabriel Gambetta — "Fast-Paced Multiplayer"** — clearest visual explanation of client-side prediction & reconciliation.
- **Riot — "Peeking into Valorant's netcode"** — modern production write-up.

Reuse these *concepts*; do not pull a netcode library. The whole point is to internalise them.

---

## Critical Files (will exist; none yet)

- `client/src/physics.ts` — character controller, must match server math exactly
- `server/internal/game/physics.go` — Go port of same equations
- `server/internal/game/snapshot.go` — entity snapshot + delta encoding
- `server/internal/game/room.go` — tick loop, the heart of the server
- `server/internal/proto/` — wire protocol
- `infra/docker-compose.yml` — local multi-service rig

---

## Verification (end-to-end, by phase)

| Phase | How you'll know it works |
|---|---|
| 1 | Solo speedrun feels good; movement tuning sliders dialed in |
| 2 | 20 bots in one room, tick <5ms p99, prediction errors visibly resolve |
| 3 | 1000 bots across 2 servers under docker-compose; metrics dashboard green |
| 4 | Public match with a friend you didn't share docs with; leaderboard updates persist |

Run targets: `make dev` (compose up), `make bots N=500` (spawn bot fleet), `make stress` (predefined load scenario).

---

## What we are explicitly *not* doing

- No k8s, no service mesh, no event sourcing, no CQRS. They're irrelevant at 10k CCU.
- No anti-cheat beyond server authority. (Real anti-cheat is a project on its own.)
- No procedural arenas. One hand-built map is enough.
- No mobile. Desktop browser only.
- No OOP for OOP's sake — Go's struct+interface composition will dominate; TS classes used pragmatically.
