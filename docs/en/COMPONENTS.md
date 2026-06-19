# OpaDeck Components

## Intent

This document defines the **component catalog** for OpaDeck.

The goal is not to enumerate widgets for their own sake.
The goal is to expose which runtime concepts and contracts the framework really needs.

## Component layers

OpaDeck components fall into four layers:

- field components
- panel components
- result renderers
- assist/system components

This separation matters.

A map is not a field.
A request preview is not a result renderer.
A help launcher is not an operation.

If everything collapses into "fields", the framework loses shape quickly.

## V1 core components

## 1. Operation list family

Purpose:

- help the user find operations
- provide multiple entry shapes for the same semantic objects

Components:

- `GroupNav`
- `GroupSections`
- `OperationTiles`
- `GroupCards`
- `SearchResults`

Notes:

- these are mostly panel renderers, not field renderers
- `OperationTiles` is where a Volta-like card launcher belongs

## 2. Operation form

Purpose:

- render a single operation
- host fields, submit controls, preview, validation, and result entry

This is the main interaction surface of OpaDeck.

Subparts:

- `FieldStack`
- `RequestPreview`
- `SubmitBar`
- `ProblemsPanel`

## 3. Field renderer set

Builtin V1 fields:

- `text`
- `textarea`
- `checkbox`
- `select`
- `hidden`

Builtin V1 specializations:

- `JsonEditor`
- `KeyValueEditor`

Notes:

- `JsonEditor` should be treated as first-class early
- operations often carry raw JSON bodies; pretending this is just a `textarea` is too weak

## 4. Result renderer set

Builtin V1 results:

- `jsonFoldable`
- `jsonLines`
- `text`
- `htmlFrame`
- `inlineSvg`
- `tableResult`

Notes:

- `tableResult` is worth including early because many internal APIs return arrays of records
- `inlineSvg` is a strong bridge from the current `vacant-service` custom renderers

## 5. Help and tour

Builtin V1 help surfaces:

- `InlineHelp`
- `OperationHelpPanel`
- `TourLauncher`
- `TourOverlay`

Notes:

- help is part of the framework, not an app extra
- `operation.id` and `field.id` must remain stable because help targets depend on them

## 6. Layout runtime

Builtin V1 layout primitives:

- `split`
- `stack`
- `tabs`
- `panel`

Builtin V1 presets:

- `classicTwoPane`
- `opsThreePane`
- `opsWorkbench`
- `focusMode`

## 7. Geo and chart surfaces

Builtin V1 map/chart surfaces:

- `geoScene`
- `timeSeries`

`geoScene` should support:

- `baseMap: "japan"`
- `choropleth`
- `points`
- `lines`
- pan / zoom / click selection

Why:

- Japanese internal tools often need prefecture-level views, office pins, service coverage, or incident overlays
- `tetsugo` already proves that a data-driven SVG Japan map is viable

## Assist/system components

These are not decorative. They carry operator safety and speed.

V1 assist/system components:

- `RequestPreview`
- `SubmitBar`
- `ExecutionBadge`
- `ProblemsPanel`
- `ActivityLog`
- `GlobalRequestContext`
- `ConfirmDanger`
- `HistoryPanel`

`GlobalRequestContext` is the generalized version of things like poison-context headers.

## V1.5 or early V2 components

- `Autocomplete`
- `DrilldownSelect`
- `ArrayField`
- `FileUploadField`
- `ResultTabs`
- `DiffView`
- `FavoriteOperations`
- `RecentOperations`
- `CommandPalette`

## Later components

- `WizardOperation`
- `BatchRunner`
- `GraphView`
- `EditableGrid`
- `SchemaExplorer`
- `PluginInspector`

These are real needs, but they should not distort the first usable architecture.

## What designing the component set reveals

The component catalog implies a few missing runtime models.

## 1. Execution state must be explicit

Once `SubmitBar`, `ExecutionBadge`, `HistoryPanel`, and `ResultTabs` exist, the framework needs an explicit execution model.

Candidate shape:

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

## 2. Problems must be unified

`ProblemsPanel` should unify:

- schema validation
- missing required fields
- data-source errors
- dangerous operation warnings
- feature gating

This suggests a shared `ProblemEntry` model instead of ad hoc strings.

## 3. Request preview is a real model

If request preview, curl copy, and execution history all exist, preview cannot remain an incidental UI string.

Candidate shape:

```ts
interface RequestPreviewModel {
  method: string;
  url: string;
  headers: Record<string, string>;
  bodyText?: string;
  curl?: string;
}
```

## 4. Geo is not just a custom result

Once `geoScene` exists, it should be usable as:

- a result renderer
- a panel renderer
- a help/tour target

This strongly suggests a dedicated `GeoSceneDefinition`.

## 5. Component boundaries clarify extension boundaries

The catalog sharpens the registry split:

- field widgets belong to `FieldRendererRegistry`
- operation lists and cards belong to `PanelRendererRegistry`
- JSON, table, SVG, map, HTML belong to `ResultRendererRegistry` or panel renderers depending on placement

This prevents "everything is a plugin" drift.

## Recommended first implementation order

1. `OperationForm`
2. `FieldRenderer` set
3. `JsonEditor`
4. `RequestPreview`
5. `SubmitBar`
6. `ResultView`
7. `ProblemsPanel`
8. `Help/Tour`
9. `OperationTiles`
10. `geoScene`

## Bottom line

The component catalog confirms three things:

- OpaDeck is not just a form renderer
- maps and results are first-class surfaces
- runtime models for execution, problems, and preview must be explicit
