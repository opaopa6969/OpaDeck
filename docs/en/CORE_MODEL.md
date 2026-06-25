# OpaDeck Core Model

## Intent

This document defines the **closed core** of OpaDeck.

The rule is simple:

- the core defines meaning
- registries define rendering and integration at the edges

Only types that are part of the semantic truth of an application belong here.
**The core stays focused on the meaning needed to run an operation.**

## Companion layers (optional / non-core)

The following are **not** part of the closed core. They are optional companion
layers that sit on top of the operation core. Their type details live in
`EXTENSIONS.md` and in each companion module; the core does not know about them.

- **layout** (presentation tree: `RenderNode` / `PanelBinding` / `PanelChrome`) — `src/layout/`
- **help / tour** (`HelpModel` / `HelpEntry` / `HelpTarget` / `HelpWhen` / `OperationHelpBlock` / `TourSpec` / `TourStep` / `TourCommand`) — `src/help/`
- **geoScene** (the `GeoSceneDefinition` family) — one result-renderer implementation, `src/geo/`
- **card** (`CardSpec`) and the `icon` / `tone` / `featured` / `tags` hints on operations/groups — launcher/discovery display metadata
- **UI selection** (`UiSelection`) — shared runtime/UI state

An app object may carry these optionally, but they are validated by companion
validators (`validateLayouts` / `validateHelp` / `validateGeoScene`), composed by
`validateApp` — not by the core. See "Boundary of the core" below.

## Top-level model

```ts
interface AppDefinition {
  id: string;
  version: number;
  title: string;
  groups: GroupDefinition[];
  dataSources: DataSourceDefinition[];
}
```

## Group

Groups are logical categories of operations.

```ts
interface GroupDefinition {
  id: string;
  label: string;
  summary?: string;
  operations: OperationDefinition[];
}
```

## Operation

Operation is the primary unit of OpaDeck.

```ts
interface OperationDefinition {
  id: string;               // stable within a group
  groupId: string;          // injected/normalized at compile time
  title: string;
  summary?: string;
  request: RequestDefinition;
  fields: FieldDefinition[];
  result?: ResultViewDefinition;
}
```

Fully-qualified operation id:

```txt
<groupId>.<operationId>
```

## Request

```ts
interface RequestDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  timeoutMs?: number;
  contentType?: string;
  body?: RequestBodyDefinition;
  accept?: string[];
}

type RequestBodyDefinition =
  | { kind: 'none' }
  | { kind: 'form' }
  | { kind: 'rawField'; fieldId: string };
```

## Field

```ts
interface FieldDefinition {
  id: string;
  name: string;  // serialized key, defaults to id
  type: FieldType;
  placement: FieldPlacement;
  label?: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: PrimitiveValue | PrimitiveValue[];
  visibility?: VisibilityRule;
  enabledWhen?: EnableRule;
  behavior?: FieldBehavior;
  source?: FieldSourceBinding;
  options?: OptionItem[];
}

type FieldType =
  | 'text'
  | 'textarea'
  | 'checkbox'
  | 'select'
  | 'hidden';

type FieldPlacement =
  | 'query'
  | 'body'
  | 'header'
  | 'path'
  | 'state';

type PrimitiveValue = string | number | boolean | null;
```

### Why both `id` and `name`?

- `id` is the stable internal key
- `name` is the serialized HTTP key

This avoids coupling the UI identity to wire format.

## Field behavior

```ts
interface FieldBehavior {
  clearOnParentChange?: boolean;
  preserveIfValid?: boolean;
  autoSelectIfSingle?: boolean;
  multiple?: boolean;
}
```

## Data source

Data sources are first-class primitives, but not the center of the model.

```ts
interface DataSourceDefinition {
  id: string;
  kind: DataSourceKind;
  params?: DataSourceParam[];
  cache?: boolean;
  staticOptions?: OptionItem[];
  remote?: RemoteSourceDefinition;
}

type DataSourceKind =
  | 'options.static'
  | 'options.remote';

interface DataSourceParam {
  id: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
}

interface RemoteSourceDefinition {
  method: 'GET' | 'POST';
  url: string;
  query?: QueryBinding[];
  body?: BodyBinding[];
}

interface QueryBinding {
  target: string;
  from: BindingRef;
}

interface BodyBinding {
  target: string;
  from: BindingRef;
}
```

### Binding references

```ts
type BindingRef =
  | { kind: 'field'; operationId: string; fieldId: string }
  | { kind: 'param'; paramId: string }
  | { kind: 'literal'; value: PrimitiveValue };
```

## Option shape

All select-like sources normalize to this shape.

```ts
interface OptionItem {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  group?: string;
}
```

## Result view

```ts
interface ResultViewDefinition {
  renderer: string;            // an open registry id (registered per EXTENSIONS)
  options?: unknown;           // interpreted/validated by the renderer; opaque to the core
}
```

`renderer` is **not** a closed enum — it is an **open string id**. The core does
not interpret its value. Built-in renderers (`tableResult`, `jsonFoldable`,
`geoScene`, …) are registered through the same edge mechanism and are not part of
the core (see `EXTENSIONS.md`).

The meaning of `options` is defined by each renderer. For example, the geoScene
renderer expects a `GeoSceneDefinition` (baseMap / layers / …), and that shape is
validated by the geo companion (`validateGeoScene`), not by the core.

## Problem contract

Problems are a shared contract between validation, execution, help, and rendering.

```ts
interface ProblemEntry {
  code: string;
  severity: 'info' | 'warning' | 'error';
  target?: ProblemTarget;
  message: string;
  detail?: string;
}

type ProblemTarget =
  | { kind: 'app'; appId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'operation'; operationId: string }
  | { kind: 'field'; operationId: string; fieldId: string }
  | { kind: 'dataSource'; dataSourceId: string }
  | { kind: 'panel'; panelId: string };
```

## Core validation targets

**The core (`validateAppDefinition`) validates only:**

- duplicate ids (group / operation / field / data-source)
- groupId mismatch
- missing `rawField` body references
- missing field data-source references

Companion-layer checks live outside the core. `validateApp` (`src/validate.js`)
composes them based on what the app actually carries:

- **invalid panel bindings** → `validateLayouts` (`src/layout/validate-layout.js`)
- **invalid help / tour targets** → `validateHelp` (`src/help/validate-help.js`)
- **invalid geoScene options** → `validateGeoScene` (`src/geo/validate-geo.js`)

The DSL compiler (`compileOpsui`) and the showcase call `validateApp` for the
full diagnostic surface.

## Boundary of the core

### Closed core

- app/group/operation/field/data-source model
- request contract
- result-view contract (renderer is an open id)
- validation rules (core checks only, as above)

layout / help / tour / geoScene / card / selection are companion layers, not the
core (see "Companion layers" at the top).

### Runtime-side companion models

The following are required by the runtime, but are not part of the closed semantic core:

- `RequestPreviewModel`
- `ResponseSnapshot`
- `ExecutionRecord`
- `ExecutionStore`
- `RuntimeServices`

### Open edge

- field renderers
- result renderers
- panel renderers
- data-source adapters
- help renderers
- tour command handlers

That open edge is defined in `EXTENSIONS.md`.
