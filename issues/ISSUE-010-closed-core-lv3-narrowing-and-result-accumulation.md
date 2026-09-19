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

Done on `main`. Resolving commit: `7253774` ("refactor(core): narrow closed
core to Lv3, add field fragments and result accumulation"). `main` tracks
`origin/main` and is pushed; there is no outstanding local-only diff for this
work.

## Follow-ups / handoff

1. ~~commit / push の判断~~ — resolved: landed as `7253774` on `main`.
2. ~~**host への配線**~~ — resolved: `src/app/workbench.js` の `renderResults()` が
   `result { options { accumulate false } }` を読んで `resultLimitFor()` で表示件数を
   最新 1 件に絞り、各結果カードに dismiss(×)ボタンを追加して `executions.remove(id)`
   (execution-store の `remove`)を呼ぶようになった。`createWorkbench` が実際の
   3 面ホスト実装であり(`showcase/app.js` は手組みのデモページで `createWorkbench` を
   使っていない別物)、テスト付きで配線できる箇所としてこちらを採用した。
   `tests/workbench.test.js` に dismiss と accumulate:false の回帰テストを追加。
   `showcase/app.js` 自体は `createWorkbench` を使うよう書き換えていない(この follow-up の
   スコープ外; 既存のデモ挙動を変えないための判断)。
3. ~~**vacant port の残り 9 group**~~ — resolved: 代表 5 group で十分とし、残り 9 group は
   移植しない。理由: 5 group(core / index / building / hierarchy / microProfile)は
   `examples/vacant-ops.opsui` 冒頭のコメントの通り「埋め込みクエリ URL + raw body +
   select query」「pure REST path」「同一 URL を method で多重定義」「fieldset/include
   による field 再利用」「presentation 属性の非表現」という *構造的な変種* をすでに
   網羅しており、残り 9 group(company / verify / index 残 / indexPointer / zip /
   building 残 / ziptraining / microProfile 残 / mail / poisonPill)は同じ変種の
   繰り返しで新しい round-trip パターンを追加しない。`compileOpsui` の回帰カバレッジと
   ドキュメントの実例としての価値に対して移植コストが見合わないため見送り、
   必要になれば(=新しい構造パターンが必要になれば)個別に追加する方針とする。
4. ~~**docs 追記**: `fieldset` / `include` と result accumulation / dismiss のドキュメント化~~
   — resolved: `f6e6a85`("docs: document fieldset/include DSL sugar and result
   accumulate/dismiss")で `docs/{en,ja}/DSL.md`(fieldset/include)と
   `docs/{en,ja}/CORE_MODEL.md`(result accumulation/dismiss)に追記済み。当初案の
   `COMPONENTS.md` ではなく `CORE_MODEL.md` を選んだのは、accumulate/dismiss が
   現状モデルのみの機能で `.opsui` 側の構文を持たないため(下記 #6 参照)。
5. ~~HANDOFF.md の更新~~ — resolved alongside this change; see `HANDOFF.md`.
6. **`result { options { accumulate false } }` の `.opsui` 構文化** — 現状は
   `src/app/workbench.js` 側のモデルのみの機能で、DSL パーサ(`src/dsl/opsui.js`)に
   対応する構文がない(`tests/workbench.test.js` でモデルレベルのみ検証)。DSL 経由で
   authoring したい要求が出たら着手する。
