# OpaDeck Implementation Status

## Intent

This document describes what has been implemented in the incubation repository so far.

It is not a roadmap.
It is a snapshot of what exists now and what is still intentionally missing.

## Implemented now

## 1. Closed-core helpers

Files:

- [src/core/normalize-app.js](../../src/core/normalize-app.js)
- [src/core/problem.js](../../src/core/problem.js)
- [src/core/validate-app.js](../../src/core/validate-app.js)

Current scope:

- normalize group/operation relationships (groupId is injected only when the
  author omitted it; a declared-but-mismatched groupId is preserved so it can be
  reported instead of silently rewritten)
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

- [src/runtime/bus.js](../../src/runtime/bus.js)
- [src/runtime/clock.js](../../src/runtime/clock.js)
- [src/runtime/scheduler.js](../../src/runtime/scheduler.js)
- [src/runtime/selection-store.js](../../src/runtime/selection-store.js)
- [src/runtime/execution-store.js](../../src/runtime/execution-store.js)
- [src/runtime/request-builder.js](../../src/runtime/request-builder.js)
- [src/runtime/http-executor.js](../../src/runtime/http-executor.js)
- [src/runtime/services.js](../../src/runtime/services.js)

Implemented:

- small typed local bus
- system clock + manual test clock
- scheduler with `after`, `every`, and `frame`
- selection store
- execution store with history
- **request builder** (ISSUE-001): serializes an operation + field state into a
  `RequestPreviewModel` (query serialization, path params, header fields,
  raw/form bodies, content-type inference, curl). Body kinds: `none` / `rawField`
  / `form` (urlencoded) / **`multipart`** (fixed boundary so preview/curl/execute
  stay byte-identical). Checkbox fields serialize with HTML semantics via
  **`field.checkedValue` / `uncheckedValue`** (unchecked omits the param instead
  of leaking the literal `"true"`/`"false"`).
- **HTTP executor** (ISSUE-001): runs the preview through an injectable `fetch`
  with AbortController-based timeout (driven by the clock) and external cancel,
  mapping outcomes onto the execution store (success / error / timeout /
  cancelled) and publishing the `execution.*` bus events. An optional
  **`onProgress`** hook reads NDJSON/JSON Lines responses incrementally via
  `getReader()` (newline boundaries, partial-line buffered) so hosts can render
  partial results while the store still only sees begin → succeed.
- runtime service aggregation

## 3. Typed registries and builtin renderers

Files:

- [src/registry/*.js](../../src/registry)
- [src/renderers/*.js](../../src/renderers)
- [src/geo/*.js](../../src/geo)

Implemented:

- local registration by id, validation of required methods, matching helpers
- **builtin field renderers** (ISSUE-006): `text`, `textarea`, `checkbox`,
  `select`
- **builtin result renderers** (ISSUE-006): `jsonFoldable` (real foldable tree),
  `tableResult` (records -> table)
- **builtin panel renderers** (ISSUE-006): `groupNav`, `operationTiles`,
  `operationDetail`, `resultStack`
- **geoScene** (ISSUE-003): a generic, data-driven SVG renderer (choropleth /
  points / lines, pan/zoom, click selection) usable as both a result and a panel
  renderer, with a Japan tile-cartogram preset dataset
- `registerBuiltinRenderers()` registers the whole set
- renderers advertise stable `[data-op-id]` / `[data-field-id]` /
  `[data-panel-id]` targets, which the tour runtime resolves

## 4. DSL loader

File:

- [src/dsl/opsui.js](../../src/dsl/opsui.js)

Implemented (ISSUE-004):

- a tokenizer + recursive-descent parser for the documented `.opsui` subset
  (app / datasource / group / operation / field / request / result)
- compiles to a normalized `AppDefinition`, injects groupId, and runs
  `validateAppDefinition` so reference problems surface as `ProblemEntry`
- parse failures are reported as a single located `dsl.parse.error` problem

Not parsed yet (still authored as JS objects): layout / help / tour blocks.

## 5. Tour runtime

Files:

- [src/tour/*.js](../../src/tour)

Implemented (ISSUE-002):

- `TourCommandHandlerRegistry` (resolves handlers by command kind)
- default handlers: `focusOperation` / `focusField` / `focusPanel` (update
  selection + resolve a stable target), `submitOperation` (delegated to the
  host, so the tour never owns operation semantics), `waitResult` (resolves on a
  matching execution bus event with an optional timeout)
- `createTourRuntime` sequences a `TourSpec` from `HelpModel.tours`, emits
  `tour.started` / `tour.stepChanged` / `tour.finished`, and is user-paced
- a default DOM overlay

## 6. Showcase application

Files:

- [showcase/index.html](../../showcase/index.html)
- [showcase/style.css](../../showcase/style.css)
- [showcase/app.js](../../showcase/app.js)

Implemented:

- feature card launcher and detail surface
- runtime inspector panel
- sample validator invocation
- **a live Japan geoScene** for the geo-scene feature
- result rendering through the shared `jsonFoldable` builtin (no longer a
  hand-written JSON dump)
- the guided tour now runs on the **shared tour runtime** + default overlay
  instead of bespoke tour code

## 7. Local serving helper

File:

- [scripts/serve.py](../../scripts/serve.py)

Serves the showcase directory without external dependencies.

## 8. Post-incubation additions

Driven by the first real consumers (an admin console + a Japan address map):

- **App shell** ([src/app/workbench.js](../../src/app/workbench.js)):
  `createWorkbench({ document, app, mounts, executor, executions, ... })` wires an
  AppDefinition into a running three-surface shell (nav → detail+form → results)
  so callers stop hand-assembling the builtin panel renderers, per-operation field
  state, the live request preview, and the execution subscription. The live
  preview is updated without re-rendering the form (inputs keep focus).
  `renderResult` / `filterMatch` are overridable.
- **Fullscreen interface** ([src/app/fullscreen.js](../../src/app/fullscreen.js)):
  `makeFullscreenable(element, { onChange })` — Fullscreen API with a CSS-overlay
  fallback, ESC to exit, a toggle button, and an `onChange(isFullscreen)` for
  canvas/WebGL renderers to recompute size.
- **geoMap renderer** ([src/renderers/geomap.js](../../src/renderers/geomap.js)):
  `createGeoMapPanelRenderer({ mapFactory })` mounts a pluggable map engine into a
  panel/result rect. The core stays free of three.js / map assets; the host injects
  `mapFactory(canvas, { data, onPick })`. Fullscreen is built in.
- **Renderer fixes/additions**: `jsonFoldable` no longer swallows NDJSON/JSON Lines
  (content-type containing `json` but line-delimited falls through to `jsonLines`).
- **Tour**: a `focusSelector` command + `kind:'selector'` target spotlights any CSS
  selector (elements not tied to operation/field/panel — view chips, map layer UI).

## Verification status

## Verified by automated tests

Run on Node.js >= 18 (`npm test`, which invokes `node --test`): 69 tests across

- core validation rules (`tests/validate-app.test.js`)
- runtime stores and scheduler (`tests/runtime.test.js`)
- typed registries (`tests/registry.test.js`)
- request builder bodies/checkbox (`tests/request-builder.test.js`)
- request builder + HTTP executor (`tests/http-executor.test.js`)
- NDJSON streaming via `onProgress` (`tests/http-executor-streaming.test.js`)
- the app-shell workbench (`tests/workbench.test.js`)
- the geoMap renderer + fullscreen (`tests/geomap.test.js`)
- the `.opsui` compiler (`tests/opsui.test.js`)
- the tour runtime + `focusSelector` (`tests/tour.test.js`)
- the builtin renderers (`tests/renderers.test.js`, `tests/renderers-extra.test.js`)
- the geoScene renderer + Japan preset (`tests/geo-scene.test.js`)

DOM-facing renderers are exercised headlessly against a minimal fake DOM
(`tests/helpers/fake-dom.js`).

See the repository [README](../../README.md#testing) for the exact commands and
the `.nvmrc`-based Node selection.

## Browser smoke-test checklist

The showcase is served with `python3 scripts/serve.py` and opened at
`http://127.0.0.1:8077/showcase/`. A short manual pass:

1. The page loads with no console errors.
2. Clicking a feature card updates the detail panel and the runtime selection
   inspector; selecting **Geo Scene** draws the Japan map.
3. **Simulate Execution** moves the execution inspector through `running` then
   `success`, renders the response under "Latest Result", and the event log
   shows `execution.started` / `execution.success`.
4. **Validate Sample App** reports the expected problem rows (or "valid").
5. **Start Tour** opens the overlay, spotlights each target, and Next/Back/Close
   behave; the event log shows `tour.started` / `tour.stepChanged` /
   `tour.finished`.

## Not yet automated

- headless browser execution of the showcase (manual checklist above stands in)
- actual HTTP serving against a live backend

## Design judgment

This implementation is now enough to claim that:

- the runtime shape is viable and execution/selection stay explicit
- typed registries are practical and carry a real builtin renderer set
- maps are a first-class, data-driven surface (generic renderer, Japan dataset)
- the `.opsui` compile path is proven for a narrow subset

It is still not enough to claim that the DSL is complete (no layout/help/tour
blocks yet) or that the renderer contracts are final.
