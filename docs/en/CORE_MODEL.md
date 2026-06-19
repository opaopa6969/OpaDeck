# OpaDeck Core Model

## Intent

This document defines the **closed core** of OpaDeck.

The rule is simple:

- the core defines meaning
- registries define rendering and integration at the edges

If a type is part of the semantic truth of an application, it belongs here.

## Top-level model

```ts
interface AppDefinition {
  id: string;
  version: number;
  title: string;
  groups: GroupDefinition[];
  dataSources: DataSourceDefinition[];
  layouts: LayoutDefinition[];
  defaultLayoutId: string;
  help?: HelpModel;
}
```

## Group

Groups are logical categories of operations.

```ts
interface GroupDefinition {
  id: string;
  label: string;
  summary?: string;
  icon?: string;
  card?: CardSpec;
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
  icon?: string;
  tone?: 'default' | 'info' | 'success' | 'warning' | 'danger';
  featured?: boolean;
  tags?: string[];
  request: RequestDefinition;
  fields: FieldDefinition[];
  result?: ResultViewDefinition;
  help?: OperationHelpBlock;
  card?: CardSpec;
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
  renderer: ResultRendererId;
  options?: Record<string, unknown>;
}

type ResultRendererId =
  | 'auto'
  | 'jsonFoldable'
  | 'jsonLines'
  | 'htmlFrame'
  | 'inlineSvg'
  | 'tableResult'
  | 'geoScene'
  | 'text'
  | 'custom';
```

If `renderer === 'geoScene'`, `options` should conform to `GeoSceneDefinition`.

```ts
interface GeoSceneDefinition {
  baseMap: string; // e.g. "japan"
  layers: GeoLayerDefinition[];
  initialView?: GeoViewState;
  selectionMode?: 'none' | 'single' | 'multiple';
}

type GeoLayerDefinition =
  | GeoChoroplethLayer
  | GeoPointsLayer
  | GeoLinesLayer;

interface GeoChoroplethLayer {
  kind: 'choropleth';
  source: string;
  keyField: string;
  valueField: string;
  palette?: string;
}

interface GeoPointsLayer {
  kind: 'points';
  source: string;
  xField?: string;
  yField?: string;
  latField?: string;
  lngField?: string;
  labelField?: string;
}

interface GeoLinesLayer {
  kind: 'lines';
  source: string;
  fromField: string;
  toField: string;
}

interface GeoViewState {
  x?: number;
  y?: number;
  zoom?: number;
}
```

## Help model

```ts
interface HelpModel {
  entries: HelpEntry[];
  tours: TourSpec[];
}

interface OperationHelpBlock {
  title?: string;
  body?: string;
  danger?: string;
}
```

### Help entries

```ts
interface HelpEntry {
  id: string;
  target: HelpTarget;
  kind: 'inline' | 'tooltip' | 'panel' | 'empty-state' | 'danger' | 'troubleshooting';
  title?: string;
  body: string;
  when?: HelpWhen;
}

type HelpTarget =
  | { kind: 'app'; appId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'operation'; operationId: string }
  | { kind: 'field'; operationId: string; fieldId: string }
  | { kind: 'panel'; panelId: string }
  | { kind: 'result'; operationId?: string };

interface HelpWhen {
  mode?: 'always' | 'idle' | 'error' | 'success' | 'empty';
  validationCodes?: string[];
  resultStatuses?: number[];
}
```

## Tour model

```ts
interface TourSpec {
  id: string;
  title: string;
  description?: string;
  startFrom?: 'current-state' | 'known-state';
  steps: TourStep[];
}

interface TourStep {
  id: string;
  title: string;
  narration?: string;
  commands: TourCommand[];
}
```

Tour commands are part of the semantic/help model, but their execution is handled by an extension registry.

## Layout model

Layout is not semantic truth. It is a presentation tree.

```ts
interface LayoutDefinition {
  id: string;
  title?: string;
  root: RenderNode;
}

type RenderNode =
  | SplitNode
  | StackNode
  | TabsNode
  | PanelNode;

interface SplitNode {
  kind: 'split';
  id: string;
  direction: 'row' | 'column';
  sizes?: [number, number];
  children: [RenderNode, RenderNode];
}

interface StackNode {
  kind: 'stack';
  id: string;
  gap?: 'none' | 'sm' | 'md' | 'lg';
  children: RenderNode[];
}

interface TabsNode {
  kind: 'tabs';
  id: string;
  defaultTabId?: string;
  tabs: PanelNode[];
}

interface PanelNode {
  kind: 'panel';
  id: string;
  renderer: PanelRendererId;
  binding: PanelBinding;
  props?: Record<string, unknown>;
  chrome?: PanelChrome;
}
```

### Panel binding

```ts
type PanelBinding =
  | { kind: 'allGroups' }
  | { kind: 'group'; groupId: string }
  | { kind: 'selection' }
  | { kind: 'results'; scope: 'global' | 'selection' | 'operation'; operationId?: string }
  | { kind: 'help'; scope: 'app' | 'selection' | 'operation'; operationId?: string }
  | { kind: 'markdown'; content: string };

interface PanelChrome {
  title?: string;
  icon?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  closable?: boolean;
  resizable?: boolean;
  minSize?: number;
}
```

## Card metadata

Cards are launcher/discovery metadata, not the primary interaction model.

```ts
interface CardSpec {
  title: string;
  summary?: string;
  tone?: 'default' | 'info' | 'success' | 'warning' | 'danger';
  icon?: string;
  badge?: string;
  featured?: boolean;
  tags?: string[];
}
```

## UI selection model

Selection is shared app state, not panel-local state.

```ts
interface UiSelection {
  groupId: string | null;
  operationId: string | null;
  fieldId: string | null;
  resultId: string | null;
  panelId: string | null;
}
```

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

The core model must be validated for at least:

- duplicate ids
- missing references
- invalid body field references
- invalid panel bindings
- data-source dependency cycles
- invalid help targets
- invalid tour targets

## Boundary of the core

### Closed core

- app/group/operation/field/data-source model
- request contract
- result-view contract
- help/tour model
- layout AST
- selection model
- validation rules

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
