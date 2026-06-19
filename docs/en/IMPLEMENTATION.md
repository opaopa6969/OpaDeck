# OpaDeck Implementation Status

## Intent

This document describes what has been implemented in the incubation repository so far.

It is not a roadmap.
It is a snapshot of what exists now and what is still intentionally missing.

## Implemented now

## 1. Closed-core helpers

Files:

- [src/core/normalize-app.js](/tmp/OpaDeck/src/core/normalize-app.js)
- [src/core/problem.js](/tmp/OpaDeck/src/core/problem.js)
- [src/core/validate-app.js](/tmp/OpaDeck/src/core/validate-app.js)

Current scope:

- normalize group/operation relationships
- create structured `ProblemEntry`-style objects
- validate a basic subset of the app model

Validated today:

- duplicate ids
- operation/group mismatches
- missing raw body fields
- missing field data-source references
- basic geoScene requirements
- invalid layout bindings
- invalid help targets
- invalid tour targets

## 2. Runtime services

Files:

- [src/runtime/bus.js](/tmp/OpaDeck/src/runtime/bus.js)
- [src/runtime/clock.js](/tmp/OpaDeck/src/runtime/clock.js)
- [src/runtime/scheduler.js](/tmp/OpaDeck/src/runtime/scheduler.js)
- [src/runtime/selection-store.js](/tmp/OpaDeck/src/runtime/selection-store.js)
- [src/runtime/execution-store.js](/tmp/OpaDeck/src/runtime/execution-store.js)
- [src/runtime/services.js](/tmp/OpaDeck/src/runtime/services.js)

Implemented:

- small typed local bus
- system clock
- manual test clock
- scheduler with `after`, `every`, and `frame`
- selection store
- execution store with history
- runtime service aggregation

Not implemented yet:

- real HTTP execution pipeline
- cancellation/abort integration
- persistence for history/selection

## 3. Typed registries

Files:

- [src/registry/id-registry.js](/tmp/OpaDeck/src/registry/id-registry.js)
- [src/registry/field-renderer-registry.js](/tmp/OpaDeck/src/registry/field-renderer-registry.js)
- [src/registry/result-renderer-registry.js](/tmp/OpaDeck/src/registry/result-renderer-registry.js)
- [src/registry/panel-renderer-registry.js](/tmp/OpaDeck/src/registry/panel-renderer-registry.js)
- [src/registry/data-source-adapter-registry.js](/tmp/OpaDeck/src/registry/data-source-adapter-registry.js)

Implemented:

- local registration by id
- validation of required adapter/renderer methods
- matching helpers for field/result/data-source resolution

Not implemented yet:

- browser-facing builtin renderer library
- help/tour registries
- registry capability diagnostics

## 4. Showcase application

Files:

- [showcase/index.html](/tmp/OpaDeck/showcase/index.html)
- [showcase/style.css](/tmp/OpaDeck/showcase/style.css)
- [showcase/app.js](/tmp/OpaDeck/showcase/app.js)

Implemented:

- feature card launcher
- selected-feature detail surface
- runtime inspector panel
- sample validator invocation
- guided tour overlay
- mock execution simulation

This showcase is intentionally static and self-explanatory.
It is meant to explain the framework to a human, not to prove every runtime edge case.

## 5. Local serving helper

File:

- [scripts/serve.py](/tmp/OpaDeck/scripts/serve.py)

Purpose:

- serve the showcase directory without external dependencies

Constraint:

- the current sandbox does not permit socket bind, so the server could not be exercised here

## Verification status

## Verified in this environment

- Python server script syntax via `py_compile`
- static file presence
- tour selector consistency against the HTML structure
- validator logic exists and is referenced by the showcase

## Not verified in this environment

- Node-based tests
- browser execution of the showcase
- actual HTTP serving

Reason:

- this environment does not currently provide `node` / `npm`
- sandbox policy blocks local socket bind

## Design judgment

This implementation is enough to prove that:

- the runtime shape is viable
- typed registries are practical
- execution and selection should remain explicit
- showcase/tour can be built on top of the same minimal runtime

It is not yet enough to claim that:

- the DSL is stable
- the renderer contracts are final
- the browser runtime is production-ready

## Next focus

The next high-value step is not more design prose.
It is turning the current foundation into a browser-usable runtime with:

1. real request execution
2. a first browser renderer set
3. a real `geoScene`
4. a DSL loader or compiler

The remaining work has been broken into issue documents under [`issues/`](../../issues).
