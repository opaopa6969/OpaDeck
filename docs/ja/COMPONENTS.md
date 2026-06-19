# OpaDeck Components

## 目的

この文書は OpaDeck の **component catalog** を定義する。

単に widget を並べるのが目的ではない。
どの runtime concept と contract が本当に必要かを可視化するのが目的。

## コンポーネントの層

OpaDeck の component は4層に分かれる。

- field component
- panel component
- result renderer
- assist/system component

この分離は重要。

map は field ではない。
request preview は result renderer ではない。
help launcher は operation そのものではない。

全部を `field` に押し込むと、framework はすぐに形を失う。

## V1 の core component

## 1. Operation list 系

役割:

- operation を見つけやすくする
- 同じ semantic object に複数の entry shape を与える

component:

- `GroupNav`
- `GroupSections`
- `OperationTiles`
- `GroupCards`
- `SearchResults`

メモ:

- これは主に panel renderer であり、field renderer ではない
- Volta 的 card launcher は `OperationTiles` に置くのが自然

## 2. Operation form

役割:

- 単一 operation を描画する
- field、submit control、preview、validation、result entry を抱える

ここが OpaDeck の中心 interaction surface になる。

subpart:

- `FieldStack`
- `RequestPreview`
- `SubmitBar`
- `ProblemsPanel`

## 3. Field renderer 群

builtin V1 field:

- `text`
- `textarea`
- `checkbox`
- `select`
- `hidden`

builtin V1 specialization:

- `JsonEditor`
- `KeyValueEditor`

メモ:

- `JsonEditor` はかなり早い段階で first-class にした方がよい
- raw JSON body を `textarea` 扱いで済ませるのは弱い

## 4. Result renderer 群

builtin V1 result:

- `jsonFoldable`
- `jsonLines`
- `text`
- `htmlFrame`
- `inlineSvg`
- `tableResult`

メモ:

- internal API は record 配列を返しがちなので `tableResult` は早めに価値がある
- `inlineSvg` は今の `vacant-service` の custom renderer と素直につながる

## 5. Help と tour

builtin V1 help surface:

- `InlineHelp`
- `OperationHelpPanel`
- `TourLauncher`
- `TourOverlay`

メモ:

- help は app のおまけではなく framework の一部
- help target は `operation.id` と `field.id` に依存するので stable である必要がある

## 6. Layout runtime

builtin V1 layout primitive:

- `split`
- `stack`
- `tabs`
- `panel`

builtin V1 preset:

- `classicTwoPane`
- `opsThreePane`
- `opsWorkbench`
- `focusMode`

## 7. Geo と chart

builtin V1 map/chart surface:

- `geoScene`
- `timeSeries`

`geoScene` は最低限これを持つべき。

- `baseMap: "japan"`
- `choropleth`
- `points`
- `lines`
- pan / zoom / click selection

理由:

- 日本の internal tool では都道府県別表示、拠点 pin、サービス coverage、障害 overlay がよくある
- `tetsugo` が data-driven な SVG 日本地図の実用性を既に示している

## Assist/system component

これは飾りではない。
operator の安全性と速度を支える component。

V1 assist/system component:

- `RequestPreview`
- `SubmitBar`
- `ExecutionBadge`
- `ProblemsPanel`
- `ActivityLog`
- `GlobalRequestContext`
- `ConfirmDanger`
- `HistoryPanel`

`GlobalRequestContext` は poison-context header のようなものを一般化した概念。

## V1.5 または early V2

- `Autocomplete`
- `DrilldownSelect`
- `ArrayField`
- `FileUploadField`
- `ResultTabs`
- `DiffView`
- `FavoriteOperations`
- `RecentOperations`
- `CommandPalette`

## Later

- `WizardOperation`
- `BatchRunner`
- `GraphView`
- `EditableGrid`
- `SchemaExplorer`
- `PluginInspector`

これらは本物の need だが、最初の usable architecture を歪めるべきではない。

## component 設計から見えてくること

component catalog を作ると、いくつか足りない runtime model が見える。

## 1. Execution state を明示化する必要がある

`SubmitBar`, `ExecutionBadge`, `HistoryPanel`, `ResultTabs` が存在するなら、
framework は explicit な execution model を持つべき。

候補 shape:

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

## 2. Problems を統一する必要がある

`ProblemsPanel` は次をまとめて扱うべき。

- schema validation
- required field 不足
- datasource error
- dangerous operation warning
- feature gate

つまり ad hoc な文字列ではなく、共有 `ProblemEntry` model が必要。

## 3. Request preview は独立した model である

request preview、curl copy、execution history があるなら、
preview は incidental な UI string では済まない。

候補 shape:

```ts
interface RequestPreviewModel {
  method: string;
  url: string;
  headers: Record<string, string>;
  bodyText?: string;
  curl?: string;
}
```

## 4. Geo は単なる custom result ではない

`geoScene` があるなら、それは次の3箇所で使えるべき。

- result renderer
- panel renderer
- help/tour target

なので dedicated な `GeoSceneDefinition` を持つ方向が強い。

## 5. component 境界は extension 境界を明確にする

catalog を作ると registry の分け方もはっきりする。

- field widget は `FieldRendererRegistry`
- operation list や card は `PanelRendererRegistry`
- JSON、table、SVG、map、HTML は置き場所に応じて result renderer か panel renderer

これで「全部 plugin」化する drift を防げる。

## 実装順の推奨

1. `OperationForm`
2. `FieldRenderer` 群
3. `JsonEditor`
4. `RequestPreview`
5. `SubmitBar`
6. `ResultView`
7. `ProblemsPanel`
8. `Help/Tour`
9. `OperationTiles`
10. `geoScene`

## Bottom line

component catalog から確認できることは3つ。

- OpaDeck は単なる form renderer ではない
- map と result は first-class surface である
- execution, problems, preview の runtime model は explicit であるべき
