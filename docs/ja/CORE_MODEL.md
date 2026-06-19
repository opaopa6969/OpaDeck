# OpaDeck Core Model

## 目的

この文書は OpaDeck の **closed core** を定義する。

原則は単純。

- core は意味を定義する
- registry は edge の描画や統合を定義する

アプリの semantic truth に属する型はここに置く。

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

group は operation の論理カテゴリ。

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

OpaDeck の第一単位は operation。

```ts
interface OperationDefinition {
  id: string;
  groupId: string;
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

fully-qualified id:

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
  name: string;
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

### `id` と `name` を分ける理由

- `id` は stable な内部キー
- `name` は HTTP 送信時のキー

これで UI identity と wire format を分離できる。

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

datasource は first-class primitive だが、モデルの中心ではない。

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

### Binding reference

```ts
type BindingRef =
  | { kind: 'field'; operationId: string; fieldId: string }
  | { kind: 'param'; paramId: string }
  | { kind: 'literal'; value: PrimitiveValue };
```

## Option shape

select 系 datasource は最終的にこの shape に正規化する。

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

`renderer === 'geoScene'` のとき、`options` は `GeoSceneDefinition` に従うべき。

```ts
interface GeoSceneDefinition {
  baseMap: string; // 例: "japan"
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

### Help entry

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

tour command の実行は semantic/help model に属するが、実行ロジック自体は extension registry 側で処理する。

## Layout model

layout は semantic truth ではない。presentation tree である。

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

card は primary interaction ではなく、launcher/discovery 用メタデータ。

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

selection は panel-local state ではなく app 全体の共有状態。

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

problem は validation、execution、help、rendering のあいだで共有される contract。

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

## Core validation target

少なくとも次を検証する必要がある。

- id 重複
- 参照切れ
- body field 参照不正
- panel binding 不正
- datasource dependency cycle
- help target 不正
- tour target 不正

## core の境界

### Closed core

- app/group/operation/field/datasource model
- request contract
- result-view contract
- help/tour model
- layout AST
- selection model
- validation rules

### Runtime 側の companion model

次は runtime には必要だが、closed semantic core そのものではない。

- `RequestPreviewModel`
- `ResponseSnapshot`
- `ExecutionRecord`
- `ExecutionStore`
- `RuntimeServices`

### Open edge

- field renderer
- result renderer
- panel renderer
- datasource adapter
- help renderer
- tour command handler

その open edge は `EXTENSIONS.md` で定義する。
