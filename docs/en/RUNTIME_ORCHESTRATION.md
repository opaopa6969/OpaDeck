# OpaDeck Runtime Orchestration

## Intent

This document defines the runtime services that sit **below rendering** and **above the semantic core**.

The main question is:

- does OpaDeck need a software bus
- does it need clock/sync infrastructure
- where should those concerns stop

## Decision summary

Short answer:

- yes to a **small typed runtime bus**
- yes to a **clock abstraction**
- yes to a **scheduler**
- maybe later to **sync domains**
- no to a full **genlock/media-sync framework** in the first core

OpaDeck is an internal ops workbench, not a DAW, not a game engine, and not a distributed event platform.

## 1. Runtime bus: yes, but very small

OpaDeck needs a bus because these parts should remain decoupled:

- selection changes
- field changes
- data-source loads
- operation execution lifecycle
- result arrival
- help/tour actions
- layout state changes

Without a bus, panel renderers and helpers will couple directly to one another.

That becomes brittle quickly.

## What this bus is

- in-process
- local to one OpaDeck runtime instance
- typed
- synchronous by default
- used for UI/runtime coordination

## What this bus is not

- not a distributed event bus
- not message persistence
- not cross-tab sync by default
- not a plugin marketplace protocol
- not enterprise middleware

## Candidate shape

```ts
interface RuntimeBus {
  publish<E extends RuntimeEvent>(event: E): void;
  subscribe<E extends RuntimeEventKind>(
    kind: E,
    handler: (event: RuntimeEventByKind<E>) => void
  ): Unsubscribe;
}

type Unsubscribe = () => void;
```

## Event families

The event catalog should stay narrow.

Suggested families:

- `selection.changed`
- `field.changed`
- `field.focused`
- `datasource.loading`
- `datasource.resolved`
- `datasource.failed`
- `execution.started`
- `execution.succeeded`
- `execution.failed`
- `execution.cancelled`
- `result.rendered`
- `help.opened`
- `tour.started`
- `tour.stepChanged`
- `layout.changed`

## Rule of use

Use the bus for coordination.
Do not use the bus as hidden business logic.

Good:

- the result panel learns that an execution finished
- the tour overlay reacts to operation focus
- a history panel records executions

Bad:

- field A silently mutates field B through opaque handlers
- request semantics are encoded in subscriptions

Semantic rules belong in the core runtime, not in bus listeners.

## 2. Clock abstraction: yes

OpaDeck should define a clock abstraction early.

Why:

- tours may need timed steps
- execution history needs timestamps
- loading and retry states need elapsed time
- charts and maps may later animate
- tests need deterministic time

## Candidate shape

```ts
interface Clock {
  now(): number;
  schedule(task: () => void, delayMs: number): Cancel;
}

type Cancel = () => void;
```

Prefer a monotonic clock for durations.

If wall time is needed for display, that should be a separate concern.

## 3. Scheduler: yes

The clock alone is too raw for UI/runtime work.

OpaDeck should also define a tiny scheduler service.

Candidate shape:

```ts
interface Scheduler {
  after(delayMs: number, task: () => void): Cancel;
  every(periodMs: number, task: () => void): Cancel;
  frame?(task: (ts: number) => void): Cancel;
}
```

Notes:

- `after` and `every` are enough for help/tour and polling
- `frame` is optional and useful for SVG/map/animation surfaces

## 4. Sync domains: maybe later

If OpaDeck adds more time-sensitive surfaces, a single app-wide clock may become too coarse.

That is where `SyncDomain` becomes useful.

Example domains:

- `ui`
- `tour`
- `map`
- `chart`
- `audio`

Candidate shape:

```ts
interface SyncDomain {
  id: string;
  clock: Clock;
  scheduler: Scheduler;
}
```

This is still much smaller than a full media framework.

## 5. Genlock: not in core v1

Full genlock-style synchronization is overkill for OpaDeck v1.

Reasons:

- most operations are request/response oriented
- most results are static or lightly interactive
- there is no evidence yet that multiple renderers need frame-perfect lockstep

Possible future triggers:

- synchronized map + chart playback
- timeline-driven incident replay
- audio/tour/visual cue synchronization

Until then, a scheduler plus optional `frame()` callback is enough.

## 6. Where these runtime services belong

These services belong in the **runtime package**, not the semantic core.

Closed semantic core:

- app definitions
- operation definitions
- field definitions
- layout AST
- request execution contract

Runtime orchestration layer:

- bus
- clock
- scheduler
- execution store
- selection store
- layout runtime state

This keeps the constitution intact.

## 7. Runtime state contracts

These models are standardized by the runtime layer.

## Request preview

```ts
interface RequestPreviewModel {
  method: string;
  url: string;
  headers: Record<string, string>;
  bodyText?: string;
  curl?: string;
}
```

## Response snapshot

```ts
interface ResponseSnapshot {
  status: number;
  statusText: string;
  contentType: string | null;
  bodyText: string;
  bodyJson?: unknown;
  receivedAt: number;
  durationMs: number;
}
```

## Execution record

```ts
interface ExecutionRecord {
  id: string;
  operationFqid: string;
  startedAt: number;
  finishedAt?: number;
  status: 'idle' | 'running' | 'success' | 'error' | 'cancelled' | 'timeout';
  requestPreview: RequestPreviewModel;
  response?: ResponseSnapshot;
  problems: ProblemEntry[];
}
```

## Stores

```ts
interface ExecutionStore {
  current(): ExecutionRecord | null;
  history(): ExecutionRecord[];
  subscribe(listener: () => void): Unsubscribe;
}

interface SelectionStore {
  get(): UiSelection;
  set(next: Partial<UiSelection>): void;
  subscribe(listener: () => void): Unsubscribe;
}
```

These stores are runtime state, not semantic core.

## 8. Relationship to registries

Registries may use runtime services, but should not own them.

Examples:

- a `geoScene` panel renderer may use `frame()`
- a `TourCommandHandler` may publish runtime events
- a `ResultRenderer` may subscribe to selection state indirectly through context

But the bus and clock should be provided by the runtime shell, not reimplemented by plugins.

## 9. Testing payoff

The bus/clock/scheduler layer is valuable mostly because it improves tests.

Benefits:

- deterministic tour tests
- deterministic retry/loading tests
- deterministic animation or timed-help tests
- clear execution lifecycle assertions

This is a strong argument for adding the abstraction early, even if implementations stay tiny.

## Recommended v1 runtime surface

```ts
interface RuntimeServices {
  bus: RuntimeBus;
  clock: Clock;
  scheduler: Scheduler;
  selection: SelectionStore;
  executions: ExecutionStore;
}
```

That is enough for:

- tours
- execution history
- selection coordination
- map/chart animation hooks
- predictable tests

## Bottom line

OpaDeck should have a runtime orchestration layer, but it should be small.

Build:

- a typed local runtime bus
- a clock abstraction
- a small scheduler

Do not build:

- a distributed software bus
- a media engine
- a genlock framework

If deeper synchronization becomes real later, add `SyncDomain` on top of the same runtime foundation.
