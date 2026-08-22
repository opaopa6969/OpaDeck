# OpaDeck MCP 化調査（Phase 1）

## 概要

OpaDeck は operation-centric な内部運用 UI ワークベンチの ESM ライブラリ（`package.json` は `private:true`・`type:module`・`v0.0.1`）。サーバを持たず、`src/index.js` から純粋な JS モジュールとして export される。主な構成要素:

- **Core model / validation**: `AppDefinition`（group / operation / field / dataSource / layout / help / tour）の正規化とバリデーション（`src/core/`）
- **DSL**: `.opsui` テキスト DSL の tokenizer + recursive-descent parser → 正規化 + バリデーション（`src/dsl/opsui.js`）
- **Runtime**: typed bus / clock / scheduler / selection store / execution store / request builder / HTTP executor / service aggregation（`src/runtime/`）
- **Registries + renderers**: field / result / panel renderer registries と builtin 実装、geoScene SVG renderer、time-series renderer、geoMap（外部エンジン注入型）（`src/registry/` `src/renderers/` `src/geo/`）
- **App shell**: `createWorkbench` が AppDefinition を3面シェル（nav → detail+form → results）に組み上げる（`src/app/workbench.js`）
- **Tour runtime**: TourSpec のステップ実行・focus/submit/wait コマンド・DOM overlay（`src/tour/`）
- **Showcase**: `python3 scripts/serve.py` で配信する静的デモ（`showcase/`）

大部分の renderer・workbench・tour は `document`（DOM）を要求するクライアントサイド UI コード。

## 判定と理由

**判定: `skill-only`**

純粋関数（`compileOpsui` / `validateAppDefinition` / `buildRequestPreview`）は1秒以内・副作用なし・テキスト in → 構造化 JSON out で MCP tool に適するが、以下の理由で常駐サーバ化は見送る:

- **常駐の価値が薄い**: 起動1秒以内の軽い処理。エージェントが直接 `node -e` で叩けば済む。プロセス・ポート・healthz を維持するオーバーヘッドが割に合わない。
- **DOM 依存コードは MCP に向かない**: renderer / workbench / tour は `document` を要求する。ヘッドレスで DOM を偽造して SVG を出す用途は限定的で、エージェントが「呼びたい」と思う操作ではない。
- **組み合わせ需要が薄い**: 他の MCP サービスと有機的に組み合わせる絵が描きにくい。.opsui のコンパイル結果を別サービスに渡す用途はあるが、頻度が低い。
- **incubation 段階**: v0.0.1・private・DSL と renderer 契約が未確定。早期 MCP 化は契約変更のたびにファサード側の追従を要求する。

一方、OpaDeck アプリを `.opsui` で記述するための手続き知識は skill として配る価値がある:

- **DSL 文法**（app / datasource / group / operation / field / request / result / layout / help / tour block の構文）
- **バリデーション規則**（duplicate id / missing reference / groupId mismatch / invalid panel binding / invalid help/tour target）
- **レイアウトプリミティブ**（split / stack / tabs / panel / binding / chrome）
- **renderer 登録手順**（`registerBuiltinRenderers` / カスタム renderer の追加 / geoMap への mapFactory 注入）

これらを skill（`locality: repo`）として配れば、エージェントが OpaDeck アプリを生成するタスクで参照できる。`spec` / `guide` resource で機械可読仕様と使い方を提供すれば discovery にも貢献する。

## 公開候補

| kind | name | io | 副作用 | 長時間 | 対応 |
|------|------|----|--------|--------|------|
| tool | `compile` | opsui text → { app, problems } | none | no | `src/dsl/opsui.js:compileOpsui()` |
| tool | `validate` | AppDefinition → ProblemEntry[] | none | no | `src/core/validate-app.js:validateAppDefinition()` |
| tool | `build_request_preview` | (Operation, fieldState) → RequestPreview | none | no | `src/runtime/request-builder.js:buildRequestPreview()` |
| resource | `spec` | — | read | no | `opadeck://spec`（Core Model / DSL 仕様） |
| resource | `guide` | — | read | no | `opadeck://guide`（DSL 書き方・使い方） |
| skill | `write-opsui-app` | — | — | no | `locality: repo`（.opsui 記述手順） |

tool は候補として挙げたが、現状では常駐させず `skill-only` とする。需要が明確になれば `wrap`（薄く包む）へ移行できる。

## 組み合わせ例

- `opadeck__compile` → `validate` で `.opsui` ファイルの構文・参照エラーを一括チェックし、結果を `agent-log-broker` に記録する
- `opadeck__build_request_preview` でリクエスト形状を確認 → `adoyose__normalize` で住所を正規化 → opadeck アプリの geoScene レイヤーに流す（手順は skill で案内）

## 依存と協調

| 相手 repo | 方向 | 能力 | 現存 | 備考 |
|-----------|------|------|------|------|
| japan-map-viewer | depends_on | geoMap renderer の `mapFactory` として注入可能な地図エンジン | yes | `src/renderers/geomap.js` コメントで注入例として言及。実行時依存ではなく host 側の選択。japan-map-viewer は MCP を持たない |
| tetsugo | depends_on | geoMap renderer の `mapFactory`（table-engine ベースのボード描画） | yes | `src/renderers/geomap.js` コメントで `mapcore` が mapFactory の想定例として言及。実行時依存ではない。tetsugo は MCP を持たない |

いずれもコード上の設計言及であり、OpaDeck が実行時に相手を呼ぶわけではない。相手側の MCP 入口に依存しないため、このフェーズでは協調 issue 不要。

## ライブラリのサーバ化

不要（`library_serve.needed = false`）。純粋関数は軽く、常駐プロセスを立てるメリットが薄い。需要が顕在化したときに薄い MCP サーバ（healthz + PORT + manifest）を追加する程度で済む（estimated_effort: S）。

## リスク

- DOM 依存の renderer / workbench / tour を MCP tool にすると、ヘッドレス環境で DOM を偽造する必要があり実行・保守コストが高い割にエージェントが呼びたい操作にならない
- 純粋関数を常駐サーバにすると、起動1秒以内の処理のためにプロセス・ポート・healthz を維持するオーバーヘッドが割に合わない
- incubation 段階（v0.0.1・private・DSL・renderer 契約が未確定）。MCP 化すると契約変更のたびにファサード側の追従が必要

## 持ち主への質問

- OpaDeck を使って .opsui アプリを生成・検証するエージェントタスクの頻度はどの程度か（需要が低ければ skill も不要）
- showcase を静的ホスティングして spec/guide resource の配信元にする想定か、それば別の resource ホストを使うか
- geoScene の SVG 描画を「テキスト in → SVG out」の tool にする需要があるか（ヘッドレス DOM が必要、japan-map-viewer と重複する懸念）
