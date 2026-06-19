# OpaDeck Extensions

## 目的

OpaDeck は拡張点を持つべきだが、最初から **full plugin platform** にはしない。

設計判断はこれ。

- closed semantic core
- open typed registries at the edges

こうすると framework を小さく保ったまま成長できる。

## ここでいう “extension” の意味

OpaDeck v1 における extension とは、次を意味する。

- typed interface
- ローカルコードで登録する
- id で解決する

含まないもの:

- 任意 package からの dynamic loading
- version negotiation
- marketplace/distribution
- sandboxed third-party execution

## なぜ registry-based architecture なのか

次の領域はアプリごとの差が出るのが分かっている。

- field widget
- result rendering
- panel rendering
- remote datasource の fetch/mapping
- help の見せ方
- tour command の実行

一方、semantic core は固定したい。

registry は host shell から供給される runtime service を使ってよい。
ただし自前の bus/clock/scheduler 層をそれぞれが持つべきではない。

## Registry 一覧

最初に持つべき registry:

- `FieldRendererRegistry`
- `ResultRendererRegistry`
- `PanelRendererRegistry`
- `DataSourceAdapterRegistry`

後から追加候補:

- `HelpRendererRegistry`
- `TourCommandHandlerRegistry`

## 1. Field renderer registry

役割:

- `FieldDefinition` を描画する
- user input を受ける
- focus/open state など UI 局所状態を扱う

```ts
interface FieldRenderer {
  id: string;
  supports(field: FieldDefinition): boolean;
  render(ctx: FieldRenderContext): RenderOutput;
}

interface FieldRenderContext {
  app: AppDefinition;
  operation: OperationDefinition;
  field: FieldDefinition;
  value: unknown;
  options?: OptionItem[];
  problems: ProblemEntry[];
  disabled: boolean;
  runtime: RuntimeServices;
  onChange(value: unknown): void;
}
```

例:

- text
- textarea
- checkbox
- select
- autocomplete
- code/json editor

## 2. Result renderer registry

役割:

- operation result payload を描画する
- content type や explicit result definition に応じて挙動を決める

```ts
interface ResultRenderer {
  id: string;
  canRender(ctx: ResultRenderContext): boolean;
  render(ctx: ResultRenderContext): RenderOutput;
}

interface ResultRenderContext {
  operation: OperationDefinition;
  resultView?: ResultViewDefinition;
  execution?: ExecutionRecord;
  status: number;
  statusText: string;
  contentType: string | null;
  bodyText: string;
  bodyJson?: unknown;
  problems?: ProblemEntry[];
  runtime: RuntimeServices;
}
```

例:

- `jsonFoldable`
- `jsonLines`
- `htmlFrame`
- `inlineSvg`
- `text`
- custom stats view

## 3. Panel renderer registry

役割:

- `PanelNode` から panel を描画する
- `selection`, `results`, `allGroups` などの binding を具体 view に接続する

```ts
interface PanelRenderer {
  id: string;
  render(ctx: PanelRenderContext): RenderOutput;
}

interface PanelRenderContext {
  app: AppDefinition;
  panel: PanelNode;
  selection: UiSelection;
  layoutState: LayoutRuntimeState;
  executions: ExecutionStore;
  runtime: RuntimeServices;
}
```

例:

- `groupNav`
- `groupCards`
- `operationTiles`
- `operationDetail`
- `groupSections`
- `resultStack`
- `helpPanel`
- `markdown`

## 4. Data-source adapter registry

役割:

- `DataSourceDefinition` を解決する
- remote fetch を実行する
- 出力を `OptionItem[]` に正規化する

```ts
interface DataSourceAdapter {
  id: string;
  resolve(ctx: DataSourceResolveContext): Promise<DataSourceResolvedValue>;
}

interface DataSourceResolveContext {
  app: AppDefinition;
  dataSource: DataSourceDefinition;
  operation: OperationDefinition;
  field?: FieldDefinition;
  params: Record<string, unknown>;
}

type DataSourceResolvedValue =
  | { kind: 'options'; items: OptionItem[] };
```

例:

- `options.static`
- `options.remote`

将来:

- cached remote variant
- custom mapping adapter

## Optional registry

## Help renderer registry

help の見せ方が複数必要になったときだけ追加する。

```ts
interface HelpRenderer {
  id: string;
  render(ctx: HelpRenderContext): RenderOutput;
}
```

最初の usable version では不要な可能性が高い。

## Tour command handler registry

tour が runtime capability ごとに振る舞いを変えるなら有効。

```ts
interface TourCommandHandler<C = TourCommand> {
  kind: C['kind'];
  run(ctx: TourCommandContext, command: C): Promise<void> | void;
}
```

用途:

- `focusOperation`
- `focusField`
- `submitOperation`
- `waitResult`
- panel/tab 操作

## Registry に入れないもの

次は closed core に残すべき。

- `AppDefinition`
- `OperationDefinition`
- `FieldDefinition`
- `DataSourceDefinition`
- dependency graph
- validator
- selection model
- layout AST
- request execution contract

ここまで extension 化すると framework の一貫性が崩れる。

## Registration model

最初の登録モデルは単純でよい。

```ts
registerFieldRenderer(renderer)
registerResultRenderer(renderer)
registerPanelRenderer(renderer)
registerDataSourceAdapter(adapter)
```

runtime marketplace は不要。  
dynamic remote plugin loading も不要。  
`hooks` だけの loosely-typed object も避ける。

## Validation obligation

構造検証の責任は validator が持ち続ける。

registry は capability check を足してもよいが、core check の代わりにはならない。

例:

- unknown `result.renderer`
- unknown panel renderer id
- unknown datasource adapter kind
- 対応 renderer が存在しない field type

## 設計ルール

正しいメンタルモデルはこれ。

- “plugin system” ではなく
- “typed extension points”

この言い方の方が、期待を盛りすぎずに済む。

## 実務上の推奨順

最初に持つべきなのはこの4つ。

1. field renderer registry
2. result renderer registry
3. panel renderer registry
4. datasource adapter registry

help/tour registry は core flow が固まってからでいい。
