# OpaDeck Core Model

## 目的

この文書は OpaDeck の **closed core** を定義する。

原則は単純。

- core は意味を定義する
- registry は edge の描画や統合を定義する

アプリの semantic truth に属する型だけをここに置く。**core は operation を実行する意味に集中する**。

## Companion layers(optional / non-core)

次は closed core には**含めない**。operation core の上に載る optional な companion 層であり、
型の詳細は `EXTENSIONS.md` と各 companion モジュールが持つ。core はこれらを知らない。

- **layout**(presentation tree: `RenderNode` / `PanelBinding` / `PanelChrome`) — `src/layout/`
- **help / tour**(`HelpModel` / `HelpEntry` / `HelpTarget` / `HelpWhen` / `OperationHelpBlock` / `TourSpec` / `TourStep` / `TourCommand`) — `src/help/`
- **geoScene**(`GeoSceneDefinition` 一式) — result renderer の一実装。`src/geo/`
- **card**(`CardSpec`)、operation/group の `icon` / `tone` / `featured` / `tags` — launcher/discovery 用の表示メタ
- **UI selection**(`UiSelection`) — runtime/UI 層の共有状態

app オブジェクトはこれらを optional に同梱してよいが、検証は core ではなく companion validator が行う
(`validateLayouts` / `validateHelp` / `validateGeoScene`。`validateApp` が合成する。下記「core の境界」参照)。

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

group は operation の論理カテゴリ。

```ts
interface GroupDefinition {
  id: string;
  label: string;
  summary?: string;
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
  request: RequestDefinition;
  fields: FieldDefinition[];
  result?: ResultViewDefinition;
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
  renderer: string;            // open な registry id(EXTENSIONS の registry で登録)
  options?: unknown;           // renderer 自身が解釈・検証する。core は不透明として扱う
}
```

`renderer` は closed enum ではなく **open な文字列 id**。core は値を解釈しない。
組み込み renderer(`tableResult` / `jsonFoldable` / `geoScene` など)も同じ仕組みで登録される
edge であって、core の一部ではない(`EXTENSIONS.md` 参照)。

`options` の意味は各 renderer が定義する。たとえば geoScene renderer は `GeoSceneDefinition`
(baseMap / layers …)を期待し、その検証は geo companion(`validateGeoScene`)が担う。core は関与しない。

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

**core(`validateAppDefinition`)が検証するのは次だけ。**

- id 重複(group / operation / field / datasource)
- groupId mismatch
- body field 参照切れ(`rawField`)
- field の datasource 参照切れ

companion 層の検証は core の外に分離されている。`validateApp`(`src/validate.js`)が
app の同梱内容に応じて合成する。

- **layout binding 不正** → `validateLayouts`(`src/layout/validate-layout.js`)
- **help target 不正 / tour target 不正** → `validateHelp`(`src/help/validate-help.js`)
- **geoScene options 不正** → `validateGeoScene`(`src/geo/validate-geo.js`)

DSL コンパイラ(`compileOpsui`)と showcase は full な診断のため `validateApp` を呼ぶ。

## core の境界

### Closed core

- app/group/operation/field/datasource model
- request contract
- result-view contract(renderer は open id)
- validation rules(上記 core 分のみ)

layout / help / tour / geoScene / card / selection は core ではなく companion 層
(冒頭「Companion layers」参照)。

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
