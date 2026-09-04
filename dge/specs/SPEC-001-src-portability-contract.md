# SPEC-001: `src/**` 可搬性契約の実装仕様

- 対応決定: `dge/decisions/DD-001-src-portability-contract.md`
- 対応セッション: `dge/sessions/2026-09-05-src-portability.md`

## 契約（normative）

`src/**` 配下の全 `.js` ファイルは、**相対 specifier**（`./` または `../` で
始まるもの）のみを参照してよい。

これ以外はすべて**禁止**。

| 禁止する形 | 理由 |
|---|---|
| bare specifier（`'kazu'`, `'lodash'`） | 利用者が持っていない resolver を要求する |
| `node:` 組み込み（`'node:fs'`） | ブラウザに存在しない。`src/**` は現在 1 つも使っていない |
| 絶対パス（`'/x/y.js'`） | 利用者の配信レイアウトを固定する |
| URL（`'https://...'`） | 同上、かつ外部ネットワーク依存になる |

対象となる参照形式（すべて検査する）:

- `import defaultExport from '...'`
- `import { named } from '...'`
- `import * as ns from '...'`
- `import '...'`（副作用のみの import）
- `export { x } from '...'` / `export * from '...'`
- 動的 `import('...')`（リテラル引数のとき）

適用範囲は `src/**` のみ。`tests/**` / `scripts/**` / `showcase/**` /
`examples/**` は対象外。

## 変更内容

### 1. `src/geo/japan-preset.js`

`import { clamp01 } from 'kazu';` を削除し、private function として復活させる。
**kazu v1 と同一挙動**とする。

```js
// Inlined on purpose: src/** must stay resolvable with no package manager and
// no import map (see docs/en/CONSTITUTION.md principle 8). Behavior is kept
// identical to the canonical clamp01 — NaN propagates rather than snapping to 0.
function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
```

既存の `tests/geo-scene.test.js:37` のアサーション
（`canonical clamp01 propagates NaN`）は無修正で通ること。

### 2. `package.json` / `package-lock.json`

`dependencies.kazu` を削除する。`devDependencies.playwright` は維持。
lock からも `node_modules/kazu` エントリと root の `dependencies` を削除する。

結果として `npm install` は git 依存を要求しなくなり、
`npm test` は依存インストールなしで通る（README の記述が再び真になる）。

### 3. `showcase/index.html` / `showcase/components.html`

`<script type="importmap">{"imports":{"kazu":"/node_modules/kazu/index.js"}}</script>`
を削除する。showcase は `/node_modules` の配信を要求しなくなる。

### 4. `tests/portability.test.js`（新規・本仕様の中核）

既存 `tests/core-boundary.test.js` の様式（不変条件を node:test で固定する）に揃える。

純粋関数 `findExternalSpecifiers(source)` を定義し、
テスト内で 3 系統を検証する。

| 系統 | 検証内容 |
|---|---|
| 正常系 | 実際の `src/**` を再帰走査し、外部 specifier が 0 件であること。違反時は `path -> specifier` を出す |
| 境界値 | 相対 (`./x.js`, `../a/b.js`) を全 import 形式で正しく拾うこと。テンプレート/変数の動的 import（リテラルでないもの）は specifier として扱わないこと。`Array.from('x')` / `Buffer.from('x')`、行コメント・ブロックコメント内の import 風記述、`'https://a//b'` のような URL 文字列、`/["\\]/g` のような正規表現リテラルで誤検出しないこと |
| 失敗系 | `import x from 'kazu'`、`import 'side-effect-pkg'`、`export * from 'lodash'`、`await import('chalk')`、`import fs from 'node:fs'`、`import x from '/abs/path.js'`、`import x from 'https://cdn/x.js'` をすべて検出すること。さらに実ファイル `src/geo/japan-preset.js` に kazu import を差し戻した文字列で、契約違反が実際に報告されること |

走査は `src/` を再帰的に辿り `.js` のみ対象とする
（`readdirSync(dir, { withFileTypes: true })`）。

### 5. 憲法（`docs/en/CONSTITUTION.md` / `docs/ja/CONSTITUTION.md`）

原則 8 を追加する。

- en: `### 8. Portability is a contract`
- ja: `### 8. 可搬性は契約である`

内容: `src/**` は配布物であり、package manager も import map も bundler も無い環境で
そのまま解決できなければならない。module specifier は相対のみ許す。
共有ユーティリティは `tests/` `scripts/` `showcase/` では自由に使ってよいが
`src/**` には入れない。この規則は `tests/portability.test.js` が強制する。

### 6. ドキュメント整合

- `README.md`: テスト節に「`src/**` は外部依存を持たないため install 不要であり、
  それを `tests/portability.test.js` が強制している」旨を追記
- `docs/en/USING-OPADECK.md`: 取り込み節に、vendoring した `src/*` が
  そのまま解決できること（import map 不要）を明記

## 非目標（今回やらないこと）

- `clamp01` の挙動変更（NaN 伝播はそのまま維持する）
- kazu をこの repo の他の場所（tests / scripts / showcase）で使うことの禁止
- GAP-03（secret field）、GAP-04（geo 不正座標の problem 化）、
  GAP-07（実行キャンセル UI）の実装

## 受け入れ条件

1. `npm install` が git 依存なしで完了する（playwright のみ）
2. `node --test` が依存インストールなしで全件通る
3. `tests/portability.test.js` が `src/**` の外部 specifier 0 件を確認する
4. `import { clamp01 } from 'kazu'` を `src/` に戻すと 3 が失敗する（検査が効いている）
5. `tests/geo-scene.test.js` の NaN 伝播アサーションが無修正で通る
6. 公開 API の signature 変更が無い
7. showcase が import map なしで動作する
