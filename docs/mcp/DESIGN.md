# OpaDeck MCP 化設計（Phase 2）

Phase 1 調査（`docs/mcp/survey.json` / `docs/mcp/SURVEY.md`）に基づく設計。判定は **skill-only**（割当表 #47, namespace `opadeck`, port なし）。

## 1. namespace と種別

- **namespace**: `opadeck`
- **種別**: `skill-only`（サーバを持たない）

OpaDeck は ESM ライブラリ（`private:true`, `v0.0.1`）。`.opsui` DSL のコンパイル・バリデーション・リクエストプレビュー構築は1秒以内の純粋関数。常駐プロセスを立てるオーバーヘッドが割に合わないため、手続き知識を **skill** として配り、純粋関数はエージェントが `node -e` で直接叩く運用にする。

## 2. tools 表

Phase 1 で候補を挙げたが、**現状では常駐させず** skill-only とする。需要が明確になれば `wrap`（薄い MCP サーバで包む）へ移行できる。

| name | 目的 | 入力 schema 要点 | 出力の形 | 副作用 | dry-run | job 型 | 所要 | min_role | 対応 |
|------|------|------------------|----------|--------|----------|--------|------|----------|------|
| `compile` | `.opsui` DSL をコンパイル（正規化＋バリデーション） | `{ source: string }` | `{ app: AppDefinition\|null, problems: ProblemEntry[] }` | none | — | no | <1s | VIEWER | `src/dsl/opsui.js:compileOpsui()` |
| `validate` | AppDefinition をバリデート | `{ app: AppDefinition }` | `ProblemEntry[]` | none | — | no | <1s | VIEWER | `src/core/validate-app.js:validateAppDefinition()` |
| `build_request_preview` | Operation + fieldState から HTTP リクエスト形状を構築 | `{ operation, fieldState, options? }` | `{ method, url, headers, bodyText, curl }` | none | — | no | <1s | VIEWER | `src/runtime/request-builder.js:buildRequestPreview()` |

これらはサーバ化しない。エージェントが `node -e "import('opadeck').then(m=>console.log(JSON.stringify(m.compileOpsui('app X v1{}'))))"` の形で直接呼ぶ。skill（§4）がその手順を案内する。

## 3. resources 表

| uri | 内容 | mime | 備考 |
|-----|------|------|------|
| `opadeck://spec` | Core Model / DSL 仕様（機械可読） | `application/json` | §2.2 形式 |
| `opadeck://guide` | DSL 書き方・使い方（人間可読） | `text/markdown` | SKILL.md と重複する部分は skill へ誘導 |

サーバを持たないため resource は配信しない。spec/guide の内容は **skill 本文**（`volta://skills/opadeck/write-opsui-app`）として配り、ファサード経由で読める形にする。需要が顕在化して `wrap` に移行するときに resource を実装する。

## 4. prompts / skills

### skill: `write-opsui-app`

| 項目 | 値 |
|------|----|
| name | `write-opsui-app` |
| 用途 | `.opsui` DSL で OpaDeck アプリを記述・コンパイル・バリデートする手順 |
| locality | `repo` |
| applies_when | `repo.has_file: package.json` 且つ `repo.name: OpaDeck`（または `.opsui` ファイルが存在） |
| requires | `tools: []`（純粋関数を `node -e` で呼ぶため MCP tool 不要） |
| min_role | `viewer` |
| export | `allowed` |

このリポジトリでしか意味を持たない手順（DSL 文法・バリデーション規則・レイアウトプリミティブ・renderer 登録）を SKILL.md 形式で配る。配置は 2 箇所:

- **OpaDeck 側**: `docs/skills/write-opsui-app/SKILL.md`（真実源）
- **volta-mcp 側**: `docs/skills/opadeck__write-opsui-app/SKILL.md`（ファサードが配信。SPEC-skills-over-mcp §7 方法 C）

## 5. 組み合わせ例

### 例 1: .opsui ファイルの検証
```
1. skill__resolve(goal=".opsui アプリを書きたい") → write-opsui-app の本文を取得
2. skill 本文の手順で .opsui を記述
3. node -e で compileOpsui() を呼ぶ → { app, problems } を確認
4. problems が空なら validateAppDefinition() で再確認
5. 結果を agent-log-broker（あれば）に記録
```

### 例 2: リクエスト形状の確認と住所正規化
```
1. .opsui を compileOpsui() でコンパイル → app.groups[].operations[] を取得
2. buildRequestPreview(operation, fieldState) でリクエスト形状を確認
3. リクエストの URL に住所パラメータがあれば adoyose__normalize で正規化
4. 正規化済み住所を fieldState に戻して再度 buildRequestPreview で確認
```

### 例 3: geoScene レイヤーへのデータ流し込み
```
1. .opsui の result.renderer: geoScene を宣言（options.layers を設定）
2. validateAppDefinition() で geoScene.layers.missing が出ないことを確認
3. japan-map-viewer（jmap__*）で地図データを取得
4. geoScene renderer の mapFactory に japan-map-viewer のエンジンを注入
```

## 6. 依存と協調

Phase 1 調査の通り、他リポジトリの MCP 入口に依存しない（japan-map-viewer / tetsugo への言及はコード上の設計コメントであり、実行時依存ではない）。**issue-hub に協調 issue を立てない。**

## 7. 非対応にした候補と理由

| 候補 | 非対応理由 |
|------|------------|
| renderer / workbench / tour の MCP tool 化 | DOM 依存。ヘッドレスで DOM を偽造する保守コストが高い割にエージェントが呼びたい操作にならない |
| 純粋関数の常駐サーバ化 | 起動1秒以内の処理。プロセス・ポート・healthz の維持が割に合わない |
| geoScene SVG 描画の tool 化 | ヘッドレス DOM が必要。japan-map-viewer と重複する懸念 |

Phase 1 からの差分なし。

## 8. 参加方法

skill-only のため、`volta.service.json`・`deploy/<id>.service`・`run.sh`・`/healthz`・gateway ルートは **不要**。

- **manifest**: なし（サーバなし）
- **ポート**: なし（割当表 #47 は port なし）
- **ホスト**: なし
- **runtime**: なし
- **auth**: なし
- **skill 配信**: volta-mcp リポジトリの `docs/skills/opadeck__write-opsui-app/SKILL.md`（frontmatter `volta.namespace: opadeck`）に commit & push。ファサードの `skill__list` / `skill__resolve` で配信される。

## 9. テスト方針

サーバを持たないため e2e（healthz / tools/list / MCP クライアント）は不要。以下を確認する:

1. **SKILL.md 形式**: frontmatter が SPEC-skills-over-mcp §4 の形式に従う
2. **skill__list で見える**: `volta_skill__list(namespace="opadeck")` で `write-opsui-app` が返る
3. **skill__resolve で取れる**: `volta_skill__resolve(goal=".opsui アプリを書きたい")` で本文が返る
4. **既存テストが壊れない**: OpaDeck の `node --test` が通る（SKILL.md 追加で壊れることはないが確認）
5. **純粋関数が動く**: skill 本文に書いた `node -e` 手順が実際に動く

## 10. 将来の移行

需要が顕在化したときの移行パス:

- **skill-only → wrap**: 薄い MCP サーバ（`/mcp` + `/healthz` + PORT）を `mcp/server.mjs` に追加。`compile` / `validate` / `build_request_preview` を tool として公開。`volta.service.json` を作成し `volta__svc_add` で登録。estimated_effort: S（Phase 1 調査と一致）。
