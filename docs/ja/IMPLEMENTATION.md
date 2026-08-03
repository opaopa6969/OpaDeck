# OpaDeck Implementation Status

## 目的

この文書は、incubation repository に **いま何が実装されているか** をまとめる。

roadmap ではない。
現時点の実装 snapshot と、意図的に未実装のものを分けて示す文書である。

## 現在実装されているもの

## 1. Closed-core helper

file:

- [src/core/normalize-app.js](../../src/core/normalize-app.js)
- [src/core/problem.js](../../src/core/problem.js)
- [src/core/validate-app.js](../../src/core/validate-app.js)

現在の scope:

- group/operation 関係の normalize
- structured な `ProblemEntry` 相当 object の生成
- app model の一部 basic validation

いま検証しているもの:

- id 重複
- operation/group mismatch
- raw body field の欠落
- field datasource 参照欠落
- geoScene の最低要件
- layout binding 不正
- help target 不正
- tour target 不正

## 2. Runtime service

file:

- [src/runtime/bus.js](../../src/runtime/bus.js)
- [src/runtime/clock.js](../../src/runtime/clock.js)
- [src/runtime/scheduler.js](../../src/runtime/scheduler.js)
- [src/runtime/selection-store.js](../../src/runtime/selection-store.js)
- [src/runtime/execution-store.js](../../src/runtime/execution-store.js)
- [src/runtime/request-builder.js](../../src/runtime/request-builder.js)
- [src/runtime/http-executor.js](../../src/runtime/http-executor.js)
- [src/runtime/services.js](../../src/runtime/services.js)

実装済み:

- small typed local bus
- system clock
- manual test clock
- `after`, `every`, `frame` を持つ scheduler
- selection store
- execution store with history
- request preview（query/path/header、raw/form/multipart body、curl）
- injectable fetch による HTTP 実行、timeout/cancel、execution.* event
- NDJSON/JSON Lines の `onProgress` による逐次受信
- runtime service の集約

意図的に未提供:

- history/selection の persistence

## 3. Typed registry

file:

- [src/registry/id-registry.js](../../src/registry/id-registry.js)
- [src/registry/field-renderer-registry.js](../../src/registry/field-renderer-registry.js)
- [src/registry/result-renderer-registry.js](../../src/registry/result-renderer-registry.js)
- [src/registry/panel-renderer-registry.js](../../src/registry/panel-renderer-registry.js)
- [src/registry/data-source-adapter-registry.js](../../src/registry/data-source-adapter-registry.js)

実装済み:

- id ベースの local registration
- adapter/renderer 必須メソッドの検証
- field/result/data-source の match helper
- field/result/panel の builtin renderer 群
- geoScene と Japan preset

## 4. Showcase application

file:

- [showcase/index.html](../../showcase/index.html)
- [showcase/style.css](../../showcase/style.css)
- [showcase/app.js](../../showcase/app.js)

実装済み:

- feature card launcher
- selected-feature detail surface
- runtime inspector panel
- sample validator invocation
- Japan geoScene
- guided tour overlay
- mock execution simulation

この showcase は意図的に static で、framework を人間に説明することを目的にしている。
runtime の全 edge case を証明するためのものではない。

## 5. DSL loader

file:

- [src/dsl/opsui.js](../../src/dsl/opsui.js)

実装済み:

- app / datasource / group / operation / field / request / result
- layout / help / tour block の parse
- normalize と compile-time の reference validation
- `examples/full-app.opsui` による layout/help/tour の検証

## 6. Tour runtime

実装済み:

- operation / field / panel / selector の focus
- submit / waitResult command
- scheduler と bus を使う user-paced tour runtime
- default DOM overlay

## 7. Local serving helper

file:

- [scripts/serve.py](../../scripts/serve.py)

目的:

- 外部依存なしで showcase directory を配信する

制約:

- 現在の sandbox では socket bind が禁止されているため、ここでは実行確認できていない

## 8. App shell と URL state

実装済み:

- `createWorkbench` による nav → detail/form → results の3面配線
- `makeFullscreenable` による Fullscreen API / CSS fallback
- `createGeoMapPanelRenderer` による map engine の注入
- `createUrlState` による adapter 式の History API 連携（初期URL、push/replace、popstate）

これらは host application の状態や地図エンジンをコアが直接所有しないための薄い境界である。

## 検証状況

## この環境で確認できたもの

- `npm test`（Node.js >= 18、71 tests）
- static file の存在
- HTML 構造に対する tour selector の整合
- showcase から validator logic が参照されていること

## この環境で確認できなかったもの

- showcase の browser 実行
- 実際の HTTP serving

理由:

- sandbox policy が local socket bind を塞いでいる

## 設計判断

この実装で十分に示せたこと:

- runtime の shape は成立する
- typed registry は実用的
- execution と selection は explicit に持つべき
- showcase/tour も同じ minimal runtime の上に載る

まだ主張できないこと:

- DSL が安定した
- renderer contract が確定した
- browser runtime が production-ready

## 次の焦点

次に価値が高いのは、設計文書を増やすことではない。
現在の foundation を browser-usable runtime に変えること。

1. headless browser smoke test
2. 実 API に対する serving/execution の確認
3. DSL と renderer contract の安定化

残作業は [`issues/`](../../issues) に issue document として分解してある。
