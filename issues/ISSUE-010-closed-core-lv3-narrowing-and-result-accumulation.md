# ISSUE-010: Closed-Core Lv3 Narrowing, Field Fragments, And Result Accumulation

## Background

OpaDeck の発想元は vacant-service の `table_data.js`
(group → requests → {title, action, method, params})。OpaDeck はそれを
「意味 / 表示 / 補助」の層に割って再設計したが、設計が実証を追い越し、
help / tour / card / layout / geoScene まで **closed core** に抱え込んで発散していた
(`IMPLEMENTATION.md` 自身がそれを認めていた)。

このセッションは「奇麗な設計に戻す」=**Lv3(原点回帰)縮約**を行い、合わせて
authoring と runtime の摩擦点を 2 つ解消した。

## Goal

closed core を「operation を実行するのに最小限必要な意味」だけに戻す。表示の種類
(renderer)と補助機能(help / tour / card / layout / geo)は core の外
(open-edge か optional companion 層)へ。**動くものを壊さずに**核を小さくする。

### 北極星(不変条件)

> `src/core/` のどのファイルも layout / help / tour / geoScene / card を参照しない。
> core が知るのは App / Group / Operation / Request / Field / DataSource / Problem だけ。

## What changed (implemented)

### 1. Closed-core Lv3 narrowing

- `src/core/validate-app.js` を **core チェックのみ**に縮小(id 重複 / groupId mismatch /
  raw body field / datasource 参照)。layout / help / tour / geoScene の検証を撤去。
- companion validator を新設:
  - `src/layout/validate-layout.js`(`validateLayouts` + `traverseRenderNode`)
  - `src/help/validate-help.js`(`validateHelp`: help entries + tours)
  - `src/geo/validate-geo.js`(`validateGeoScene`: geoScene options/layers)
- 合成エントリ `src/validate.js` の **`validateApp`** が core + 存在する companion を合成。
  `compileOpsui` と showcase はこれを使う(bare `validateAppDefinition` は core 専用)。
- 共有 util `src/core/ids.js`(`fqid` / `fieldKey` / `pushDuplicateProblems` /
  `collectOperationIds` 等)。依存方向は **companion → core の一方向のみ**。
- `ResultViewDefinition.renderer` は **open な registry id(string)**。closed enum を廃止。
  geoScene は edge renderer の一例で core は知らない。
- `card` / `tone` / `featured` / `tags` / `icon` はコードに無く docs のみだったため
  `CORE_MODEL.md` から撤去。
- docs(ja/en 対)を core/companion 分割に合わせて更新
  (CORE_MODEL / CONSTITUTION / EXTENSIONS / DSL / IMPLEMENTATION)。

### 2. Field fragments (`fieldset` + `include`) — DSL のみ

- `src/dsl/opsui.js` に `fieldset <id> { field... }` ブロックと operation 内 `include <id>` を追加。
- **compile-time マクロ**: `include` は fragment の field を deep-copy して operation.fields に
  splice する。コンパイル後の model は plain field の羅列のみ = **core は fieldset を知らない**。
- 未知 fieldset の include は located な `dsl.parse.error`。二重 include は既存の
  `field.id.duplicate` が捕捉。

### 3. Result accumulation UX(table_data.js driver の比較 UX を移植)

- `src/runtime/execution-store.js` に **`remove(id)`** を追加(`execution.removed` を emit)。
  実行 record は従来どおり history に蓄積される(= 何度叩いても残り比較できる)。
- `src/renderers/panel-renderers.js` の `resultStack` に:
  - 各結果の **dismiss(×)ボタン**(`ctx.onDismiss(record.id)`)
  - **`ctx.limit`**(latest-only にしたいとき N 件に制限。既定は全件=蓄積)
- closed core は無変更(runtime + edge renderer のみ)。

### 4. Dogfooding port

- `examples/vacant-ops.opsui`: vacant-service の `table_data.js` の代表 **5 group / 11 operation**
  を縮約後 core へ移植。`_address_sep`(15 フィールド)は `fieldset addressSep` + `include` で DRY 化。
- `compileOpsui` → **0 problems**。Lv3 core が発想元を round-trip できることを実データで確認。

## Files

- core: `src/core/validate-app.js`, `src/core/normalize-app.js`, `src/core/ids.js`(new)
- companion: `src/layout/validate-layout.js`(new), `src/help/validate-help.js`(new),
  `src/geo/validate-geo.js`(new), `src/validate.js`(new)
- dsl/runtime/renderer: `src/dsl/opsui.js`, `src/runtime/execution-store.js`,
  `src/renderers/panel-renderers.js`
- wiring: `src/index.js`, `showcase/app.js`
- examples: `examples/vacant-ops.opsui`(new)
- tests: `tests/core-boundary.test.js`(new), `tests/validate-app.test.js`,
  `tests/opsui.test.js`, `tests/runtime.test.js`, `tests/renderers.test.js`
- docs: `docs/ja/*`, `docs/en/*`(CORE_MODEL / CONSTITUTION / EXTENSIONS / DSL / IMPLEMENTATION)

## Verification

- `node --test`(Node >= 18; この環境は `~/.nvm/versions/node/v22.14.0/bin/node`): **60 tests passing**。
- `tests/core-boundary.test.js` が北極星(core は companion を import しない / geoScene を
  特別扱いしない)を機械的にガード。
- `examples/index-ops.opsui` / `examples/full-app.opsui` / `examples/vacant-ops.opsui` いずれも
  `compileOpsui` で 0 problems(回帰なし)。

## Status

- 実装・テストは **完了し全 green**。ただし **未コミット**(working tree のみ)。
  この差分は `main` 上にある(前回 `main` は `origin/main` と同一で push 済み)。
  共有状態を変える操作(commit / push / PR)は未実施 — 明示判断待ち。

## Follow-ups / handoff

1. **commit / push の判断**(branch を切るか main 直か。汎用設計ドメインなので本文の言語は任意)。
2. **showcase/host への配線**: `resultStack` と execution-store は dismiss / limit を
   サポート済みだが、host ループ(showcase/app.js)はまだ `store.remove` / `limit` を呼んでいない。
   `result { renderer ... }` に `options { accumulate false }` 規約を設け、host が accumulate=false →
   limit 1 に写すのが自然(`ResultViewDefinition.options` は core から見て不透明なのでここに置ける)。
3. **vacant port の残り 9 group**(company / verify / index 残 / indexPointer / zip / building 残 /
   ziptraining / microProfile 残 / mail / poisonPill / etc)を移植して完全 round-trip を確認するか、
   代表 5 group で十分とするかを決める。
4. **docs 追記**: `fieldset` / `include`(DSL.md)と result accumulation / dismiss(COMPONENTS.md)を
   ドキュメント化。
5. **HANDOFF.md の更新**: 「divergent main(unrelated histories)」の注記は現状と乖離している可能性。
   `main` が `origin/main` を追跡し push 済みの現状に合わせて見直す。
