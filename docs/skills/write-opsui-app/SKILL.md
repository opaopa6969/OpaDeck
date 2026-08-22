---
name: write-opsui-app
description: OpaDeck の .opsui DSL で運用ワークベンチアプリを記述・コンパイル・バリデートする手順。DSL 文法・バリデーション規則・レイアウトプリミティブ・renderer 登録
volta:
  version: 1
  namespace: opadeck
  locality: repo
  tags: [opadeck, opsui, dsl, workbench, ui]
  applies_when:
    - repo.has_file: package.json
  requires:
    tools: []
    resources: []
  min_role: viewer
  export: allowed
---
# OpaDeck `.opsui` アプリの記述

OpaDeck は operation-centric な内部運用 UI ワークベンチの ESM ライブラリ。`.opsui` DSL でアプリ全体（groups / operations / fields / layouts / help / tour）を宣言的に記述し、`compileOpsui()` で正規化＋バリデーション、`buildRequestPreview()` で HTTP リクエスト形状を組み立てる。

この skill は `.opsui` ファイルをゼロから書くか既存ファイルを修正するときの手順を案内する。DOM 依存の renderer / workbench / tour 実行はブラウザ側の作業であり、ここでは扱わない。

## 1. DSL の全体構造

```
app <id> v<version> {
  title "<タイトル>"
  defaultLayout <layoutId>

  datasource <id> : <kind> {
    option "<value>" label "<label>" description "<desc>"?
    ...
  }

  group <id> {
    label "<label>"
    summary "<summary>"?
    operation <id> { ... }
    ...
  }

  layout <id> {
    title "<title>"?
    <rootNode>
  }

  help {
    entry <id> { ... }
    ...
  }

  tour <id> { ... }
}
```

- トップレベルキーワード: `title` `defaultLayout` `datasource` `group` `layout` `help` `tour`
- `app <id> v<version>` の version は `v1` 形式（`v` + 数字）
- `#` で行コメント。`"..."` で文字列リテラル（`\n` `\t` `\\` `\"` のエスケープ）
- ブロックは `{ }`、キーと値の区切りは `:` または改行後の期待トークン

## 2. datasource ブロック

```
datasource <id> : options.static {
  option "<value>" label "<label>" description "<desc>"? group "<group>"?
}
```

- `kind` は現在 `options.static` のみ対応
- `option` は `value`（文字列リテラル）が必須。`label` `description` `group` は任意順で省略可
- datasource の id はトップレベルで一意（重複すると `data-source.id.duplicate`）

## 3. group / operation ブロック

```
group <id> {
  label "<label>"?
  summary "<summary>"?
  operation <id> {
    title "<title>"?
    summary "<summary>"?
    request { ... }
    field <id> : <type> in <placement> { ... }
    result { renderer <name> }
  }
}
```

- group id はトップレベルで一意。operation id は group 内で一意
- operation は必ず `request` ブロックを持つ（省略時 `GET ""` になるが、通常は指定する）

### 3.1 request ブロック

```
request {
  method <GET|POST|PUT|PATCH|DELETE|HEAD>?
  url "<url>"
  contentType "<content-type>"?
  timeoutMs <ms>?
  accept "<accept>"?
  body <kind>?
}
```

- `body` の kind: `none` / `form` / `raw field <fieldId>`
  - `raw field <fieldId>` は同一 operation にその field が存在する必要がある（`request.body.rawField.missing`）

### 3.2 field ブロック

```
field <id> : <type> in <placement> {
  name "<name>"?
  label "<label>"?
  description "<desc>"?
  required <true|false>?
  placeholder "<placeholder>"?
  source <dataSourceId>?
  default <scalar>?
}
```

- **type**: `text` `textarea` `checkbox` `select` `hidden`
- **placement**: `query` `body` `header` `path` `state`
- `source <dataSourceId>` は `datasource` ブロックで定義済みの id を参照（`field.source.dataSource.missing`）
- `default` はスカラ（文字列 / 数値 / `true` / `false`）。文字列は `"...".` で、それ以外はトークン
- field id は operation 内で一意（`field.id.duplicate`）

### 3.3 result ブロック

```
result {
  renderer <name>
}
```

- `renderer` は任意の文字列。`auto`（省略時）, `jsonFoldable`, `geoScene` 等
- `geoScene` は `options.layers`（配列）が必須。コード経由でのみ設定可能（DSL からは `renderer geoScene` まで。options は正規化後のコードで注入）

## 4. layout ブロック

```
layout <id> {
  title "<title>"?
  <rootNode>
}
```

- layout id はトップレベルで一意。root ノードは1つだけ

### 4.1 layout ノード

| kind | 構文 | 備考 |
|------|------|------|
| `split` | `split <id> <row\|column> { sizes <a> <b>? <child> <child> }` | children はちょうど2つ。`sizes` は任意（2つの数値） |
| `stack` | `stack <id> { gap <gap>? <child>... }` | children は任意数 |
| `tabs` | `tabs <id> { defaultTab <id>? panel <id> <renderer> { ... }... }` | children は panel のみ |
| `panel` | `panel <id> <renderer> { bind <binding>? <chrome>... }` | renderer は任意の文字列 |

- 全ノードの id は layout 内で一意（`layout.panel.id.duplicate`）。split / stack / tabs / panel の id も同じ名前空間

### 4.2 panel binding

```
panel <id> <renderer> {
  bind <bindingKind>
  title "<title>"?
  collapsible <true|false>?
  defaultCollapsed <true|false>?
  closable <true|false>?
  resizable <true|false>?
}
```

binding の種類:

| kind | 構文 | 備考 |
|------|------|------|
| `allGroups` | `bind allGroups` | 全 group を表示 |
| `selection` | `bind selection` | 選択中の operation（省略時の既定） |
| `group` | `bind group <groupId>` | 指定 group（`panel.binding.group.missing`） |
| `markdown` | `bind markdown "<content>"` | 静的 markdown |
| `results` | `bind results <scope> <operationId>?` | `scope` は `operation` のみ。`<operationId>` が必須（`panel.binding.results.operation.missing`） |
| `help` | `bind help <scope> <operationId>?` | `scope` は `operation` のみ。`<operationId>` が必須（`panel.binding.help.operation.missing`） |

## 5. help ブロック

```
help {
  entry <id> {
    target <targetKind> <args>
    kind <inline|panel|tooltip>?
    title "<title>"?
    body "<body>"?
  }
}
```

- entry id は help 内で一意（`help-entry.id.duplicate`）
- target の種類:

| kind | 構文 | 備考 |
|------|------|------|
| `app` | `target app <appId>` | 常に有効 |
| `group` | `target group <groupId>` | group が存在すること（`help.target.invalid`） |
| `operation` | `target operation <operationId>` | operation が存在すること |
| `field` | `target field <operationId> <fieldId>` | field が存在すること |
| `panel` | `target panel <panelId>` | panel が存在すること |
| `result` | `target result operation <operationId>?` | operationId 省略可。指定すれば存在チェック |

## 6. tour ブロック

```
tour <id> {
  title "<title>"?
  description "<desc>"?
  startFrom <stepId>?
  step <id> { ... }
}
```

- tour id / step id はそれぞれのスコープで一意（`tour.id.duplicate` / `tour-step.id.duplicate`）

### 6.1 step ブロック

```
step <id> {
  title "<title>"?
  narration "<narration>"?
  focus <target>
  submit <operationId>
  wait result <operationId>
}
```

- `focus` / `submit` / `wait` はコマンド。1 step に複数コマンドを書ける
- `focus` の対象: `operation <operationId>` / `field <operationId> <fieldId>` / `panel <panelId>`
- `submit <operationId>` は operation を実行
- `wait result <operationId>` は結果を待機
- 全ての operationId / fieldId / panelId は存在チェック（`tour.command.operation.missing` / `tour.command.field.missing` / `tour.command.panel.missing`）

## 7. バリデーション規則（ProblemEntry）

`compileOpsui(source)` は `{ app, problems }` を返す。`problems` は `validateAppDefinition(normalized)` の結果で、以下の ProblemEntry を含む:

| code | 重大度 | 条件 |
|------|--------|------|
| `dsl.parse.error` | error | 構文エラー（`app` は null） |
| `group.id.duplicate` | error | group id 重複 |
| `data-source.id.duplicate` | error | datasource id 重複 |
| `layout.id.duplicate` | error | layout id 重複 |
| `operation.id.duplicate` | error | 同一 group 内で operation id 重複 |
| `operation.groupId.mismatch` | error | operation の groupId が所属 group と不一致 |
| `field.id.duplicate` | error | 同一 operation 内で field id 重複 |
| `request.body.rawField.missing` | error | `body raw field <id>` の field が存在しない |
| `field.source.dataSource.missing` | error | `source <id>` の datasource が存在しない |
| `result.geoScene.options.missing` | error | geoScene renderer に options がない |
| `result.geoScene.layers.missing` | error | geoScene options.layers が空/未配列 |
| `layout.panel.id.duplicate` | error | layout 内でノード id 重複 |
| `panel.binding.group.missing` | error | `bind group <id>` の group が存在しない |
| `panel.binding.results.operation.missing` | error | `bind results operation <id>` の operation が存在しない |
| `panel.binding.help.operation.missing` | error | `bind help operation <id>` の operation が存在しない |
| `help-entry.id.duplicate` | error | help entry id 重複 |
| `help.target.missing` | error | help entry に target がない |
| `help.target.invalid` | error | help target が参照先に存在しない |
| `tour.id.duplicate` | error | tour id 重複 |
| `tour-step.id.duplicate` | error | 同一 tour 内で step id 重複 |
| `tour.command.operation.missing` | error | tour コマンドの operationId が存在しない |
| `tour.command.field.missing` | error | tour focus field の operationId/fieldId が存在しない |
| `tour.command.panel.missing` | error | tour focus panel の panelId が存在しない |

ProblemEntry の形: `{ code, severity, message, target?, detail? }`。`severity` は `error`（現在は error のみ）。

## 8. コンパイルとバリデーションの手順

### 8.1 .opsui ファイルをコンパイルする

```bash
node -e "
import('./src/index.js').then(m => {
  const fs = await import('fs');
  const source = fs.readFileSync('examples/full-app.opsui', 'utf8');
  const { app, problems } = m.compileOpsui(source);
  console.log(JSON.stringify({ app, problems }, null, 2));
});
"
```

または ES module として:

```javascript
import { compileOpsui } from 'opadeck';
import { readFileSync } from 'fs';

const source = readFileSync('my-app.opsui', 'utf8');
const { app, problems } = compileOpsui(source);
if (problems.length > 0) {
  for (const p of problems) {
    console.error(`${p.severity}: ${p.code}: ${p.message}`);
  }
  process.exit(1);
}
console.log('OK', app.id, app.title);
```

- 構文エラー: `app` は null、`problems` に `dsl.parse.error` 1件
- 参照エラー: `app` は正規化済み、`problems` に検出された問題が入る

### 8.2 AppDefinition を個別にバリデートする

```javascript
import { validateAppDefinition } from 'opadeck';
const problems = validateAppDefinition(myApp);
```

- `compileOpsui` と同じ検証を、JSON から構築した AppDefinition に対して走らせる

### 8.3 リクエスト形状をプレビューする

```javascript
import { buildRequestPreview } from 'opadeck';
const operation = app.groups[0].operations[0];
const fieldState = { epCompanyId: '10066', formbody: '{"a":1}' };
const preview = buildRequestPreview(operation, fieldState, { baseUrl: 'https://api.example.com' });
console.log(preview.method, preview.url);
console.log(preview.headers);
console.log(preview.bodyText);
console.log(preview.curl);
```

- `placement: query` → URL のクエリパラメータ
- `placement: path` → URL の `{fieldId}` を置換
- `placement: header` → headers
- `placement: body` → `body kind: form` なら form-urlencoded、`raw field <id>` ならその field の値をそのまま
- `curl` 文字列が便利

## 9. renderer 登録手順（ブラウザ側）

DSL の `result renderer <name>` と `panel <id> <renderer>` の `<renderer>` 名は、実行時に registry に登録された renderer に対応する。

### 9.1 builtin renderer の一括登録

```javascript
import { registerBuiltinRenderers } from 'opadeck';
const registries = {
  fieldRenderers: createFieldRendererRegistry(),
  resultRenderers: createResultRendererRegistry(),
  panelRenderers: createPanelRendererRegistry(),
};
registerBuiltinRenderers(registries);
```

builtin result renderers: `auto`, `jsonFoldable`, `timeSeries`, `geoScene`
builtin panel renderers: `groupNav`, `operationDetail`, `resultStack`, `helpPanel`, `geoMap`

### 9.2 カスタム renderer の追加

```javascript
registries.resultRenderers.register({
  id: 'myCustom',
  render(ctx) {
    const { document, data } = ctx;
    const el = document.createElement('div');
    el.textContent = JSON.stringify(data);
    return el;
  },
});
```

- `id` が DSL の renderer 名に対応
- `render(ctx)` は `{ document, data, operation?, panel?, onPick? }` を受け、DOM 要素を返す

### 9.3 geoMap への mapFactory 注入

```javascript
import { createGeoMapPanelRenderer } from 'opadeck';
const geoMap = createGeoMapPanelRenderer({
  mapFactory: (canvas, { data, onPick }) => myEngine.createRenderer2D(canvas, { model: data, onPick }),
});
registries.panelRenderers.register(geoMap);
```

- `mapFactory(canvas, { data, onPick })` は `{ refresh?, resize?, destroy?, setLayers? }` を返す想定
- tetsugo の mapcore や japan-map-viewer のエンジンを注入できる（実行時依存ではない。host 側の選択）

## 10. 完全な .opsui 例

```
app FullOps v1 {
  title "Full Ops"
  defaultLayout workbench

  datasource epCompanies : options.static {
    option "10066" label "Kansai" description "default"
    option "10067" label "Kanto"
  }

  group index {
    label "Index"

    operation registerDocuments {
      title "Register documents"

      request {
        method POST
        url "./api/index/registerDocuments"
        contentType "text/plain"
        body raw field formbody
      }

      field epCompanyId : select in query {
        label "EP Company"
        source epCompanies
      }

      field formbody : textarea in body {
        label "Document JSON"
        required true
      }

      result {
        renderer jsonFoldable
      }
    }
  }

  layout workbench {
    title "Workbench"
    split root row {
      sizes 1 2
      panel nav groupNav {
        bind group index
        title "Operations"
      }
      tabs main {
        defaultTab detail
        panel detail operationDetail {
          bind selection
        }
        panel results resultStack {
          bind results operation registerDocuments
        }
      }
    }
  }

  help {
    entry registerHelp {
      target operation registerDocuments
      kind panel
      title "Registering documents"
      body "Paste the document JSON into the body field, then run."
    }
    entry bodyHelp {
      target field registerDocuments formbody
      kind tooltip
      body "Raw JSON sent as text/plain."
    }
  }

  tour overview {
    title "Overview"
    description "How to register documents."
    step pick {
      title "Pick the operation"
      narration "Select Register documents from the nav."
      focus operation registerDocuments
    }
    step fill {
      title "Fill the body"
      narration "Put your JSON here."
      focus field registerDocuments formbody
    }
    step run {
      title "Run and watch"
      focus panel results
      submit registerDocuments
      wait result registerDocuments
    }
  }
}
```

この例は `examples/full-app.opsui` に置いてあり、`compileOpsui` で problems なし（0件）で通ることを確認済み。

## 11. よくある間違いと修正

| 症状 | 原因 | 修正 |
|------|------|------|
| `dsl.parse.error` | 構文エラー。`{` `}` の対応、`:` の付け忘れ、文字列リテラルの未閉じ | エラーの line/column を見て修正 |
| `field.source.dataSource.missing` | `source <id>` の id が datasource ブロックで定義されていない | datasource の id を確認 |
| `panel.binding.group.missing` | `bind group <id>` の id が group にない | group id を確認 |
| `tour.command.operation.missing` | tour step の `submit` / `wait result` / `focus operation` の operationId が存在しない | operation id を確認 |
| `operation.groupId.mismatch` | operation に明示的に groupId を書いて group と不一致 | 通常は groupId を書かない（自動注入）。書くなら一致させる |
| `layout.panel.id.duplicate` | split / stack / tabs / panel の id が layout 内で重複 | id を変える |
