# OpaDeck Implementation Status

## 目的

この文書は、incubation repository に **いま何が実装されているか** をまとめる。

roadmap ではない。
現時点の実装 snapshot と、意図的に未実装のものを分けて示す文書である。

## 現在実装されているもの

## 1. Closed-core helper + companion validator

closed core は意図的に狭く、app / group / operation / request / field / datasource だけを知る。
layout / help / tour / geoScene の検証は companion モジュールに分離し、`validateApp` が合成する。
境界テスト(`tests/core-boundary.test.js`)が「`src/core/` は companion/edge を import しない」ことを機械的に保証する。

core file:

- [src/core/normalize-app.js](../../src/core/normalize-app.js) — groups + dataSources のみ normalize
- [src/core/problem.js](../../src/core/problem.js)
- [src/core/ids.js](../../src/core/ids.js) — 共有 id/ref helper(core と companion が再利用)
- [src/core/validate-app.js](../../src/core/validate-app.js) — `validateAppDefinition`(core チェックのみ)

companion validator + 合成:

- [src/layout/validate-layout.js](../../src/layout/validate-layout.js) — `validateLayouts`
- [src/help/validate-help.js](../../src/help/validate-help.js) — `validateHelp`(help + tour)
- [src/geo/validate-geo.js](../../src/geo/validate-geo.js) — `validateGeoScene`
- [src/validate.js](../../src/validate.js) — `validateApp` が core + companion を合成

`validateAppDefinition`(core)が検証するもの:

- id 重複
- operation/group mismatch
- raw body field の欠落
- field datasource 参照欠落

`validateApp` が追加で検証するもの(app が同梱していれば):

- layout/panel binding 不正(layout companion)
- help target / tour target 不正(help companion)
- geoScene options/layers の最低要件(geo companion)

## 2. Runtime service

file:

- [src/runtime/bus.js](../../src/runtime/bus.js)
- [src/runtime/clock.js](../../src/runtime/clock.js)
- [src/runtime/scheduler.js](../../src/runtime/scheduler.js)
- [src/runtime/selection-store.js](../../src/runtime/selection-store.js)
- [src/runtime/execution-store.js](../../src/runtime/execution-store.js)
- [src/runtime/services.js](../../src/runtime/services.js)

実装済み:

- small typed local bus
- system clock
- manual test clock
- `after`, `every`, `frame` を持つ scheduler
- selection store
- execution store with history
- runtime service の集約

未実装:

- real HTTP execution pipeline
- cancellation/abort integration
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

未実装:

- browser 向け builtin renderer 群
- help/tour registry
- registry capability diagnostics

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
- guided tour overlay
- mock execution simulation

この showcase は意図的に static で、framework を人間に説明することを目的にしている。
runtime の全 edge case を証明するためのものではない。

## 5. Local serving helper

file:

- [scripts/serve.py](../../scripts/serve.py)

目的:

- 外部依存なしで showcase directory を配信する

制約:

- 現在の sandbox では socket bind が禁止されているため、ここでは実行確認できていない

## 検証状況

## この環境で確認できたもの

- `py_compile` による Python server script の syntax
- static file の存在
- HTML 構造に対する tour selector の整合
- showcase から validator logic が参照されていること

## この環境で確認できなかったもの

- Node ベースの test
- showcase の browser 実行
- 実際の HTTP serving

理由:

- この環境には `node` / `npm` が無い
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

1. real request execution
2. 最初の browser renderer 群
3. real `geoScene`
4. DSL loader または compiler

残作業は [`issues/`](../../issues) に issue document として分解してある。
