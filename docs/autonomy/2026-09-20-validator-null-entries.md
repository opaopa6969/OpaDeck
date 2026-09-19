# Progressive Builder — null groups/operations/fields 診断化（反復 1/3）

記録日: 2026-09-20 (JST)。対象: OpaDeck のみ。GitHub issue: #41。

## 観測事実

- 開始時の `HEAD` / `origin/main` は `98072f2`（PR #45 の merge commit）。
  open PR は0件、GitHub Actions の workflow は0件（`gh workflow list` が空）。
  open issue は #38 と #41 の2件のみ。
- `docs/product-brief.md` は repo に存在しない（前回反復と同じ状況）。README、
  Constitution、Roadmap、Implementation Status、open issue、既存コードとテスト
  を根拠にした。
- issue #41 の再現を独立に確認した:
  `validateAppDefinition({ id:'a', groups:[null] })` →
  `TypeError: Cannot read properties of null (reading 'operations')`、
  `validateAppDefinition({ id:'a', groups:[{ id:'g', operations:[null] }] })` →
  `TypeError: Cannot read properties of null (reading 'fields')`。
- issue #41 は file:line で `src/core/normalize-app.js:31` /
  `src/core/validate-app.js:10` のみを指すが、受入条件文は
  「`validateApp` and `normalizeApp` never throw」と、コアだけでなく
  `src/index.js` がエクスポートする合成版 `validateApp`
  （`src/validate.js`）を指す語で書かれている。実際に確認すると、
  `validateApp` が呼ぶコンパニオン検証（`validateLayouts` /
  `validateHelp` / `validateGeoScene` / `validateCapabilities`）も同じ
  「groups/operations が常にオブジェクトである」という前提を持ち、
  同じ入力（`{ groups: [null] }`）で同様に `TypeError` を投げることを
  確認した。

## 仮説と選択理由

issue 本文の見積り（20〜30行、ローカルで可逆）はコアファイルのみを想定した
ものだが、受入条件を文字通り満たすには合成 `validateApp` も throw しない
必要がある。コアだけ直して合成版を直さないと、実際に使われる公開APIの
契約（`src/validate.js` のコメント: 「Use this (not the bare core
validateAppDefinition) when you want the full diagnostic surface」）は
直らず、独立 Judge が合成版で再現した場合に repair 差し戻しになる可能性が
高い。依存・公開シグネチャ・実行基盤を変えずに、共有ガード関数
`isPlainObject`（`src/core/ids.js`）を追加し、それをコアと4つの
コンパニオン検証に同じパターンで適用する方が、範囲拡大ではなく受入条件の
充足だと判断した。差分は各ファイルへの局所的なガード追加のみで、
リバートは単純な diff rollback。Rust優先方針に対しては、既存ESM製品への
局所的なバグ修正であり、全面移植を伴わない。

## 実施内容と終了要件

- `src/core/ids.js`: `isPlainObject` を追加してエクスポートし、
  `hasField` / `hasById` / `collectOperations` / `collectOperationIds` を
  null/非オブジェクトの要素に対して安全にした。
- `src/core/normalize-app.js`: `normalizeGroup` / `normalizeOperation` が
  非オブジェクトの入力をそのまま通し、`normalizeAppDefinition` 内のループも
  非オブジェクトの group/operation をスキップする。
- `src/core/validate-app.js`: 非オブジェクトの group / operation / field を
  検出して `group.invalid` / `operation.invalid` / `field.invalid`
  という構造化 `ProblemEntry`（index 付き）を積み、残りの要素の検証を続行する。
- `src/layout/validate-layout.js` / `src/help/validate-help.js` /
  `src/geo/validate-geo.js` / `src/registry/validate-capabilities.js`:
  同じ `isPlainObject` ガードを適用し、合成 `validateApp` 全体が
  非オブジェクトの group/operation/field に対して throw しないようにした。
- 既存の問題コード・メッセージ・`validateApp`/`validateAppDefinition` の
  公開シグネチャは変更していない。
- 新規回帰テスト `tests/validate-malformed-entries.test.js` が
  null な group/operation/field で `normalizeAppDefinition` が
  throw しないこと、`validateAppDefinition` が対応する `*.invalid` を
  返しつつ兄弟要素の検証を継続すること、引数そのものが非オブジェクト
  （`null` や文字列）の場合は引き続き `TypeError` を投げること
  （エントリポイントの型チェックは仕様通り温存）、合成 `validateApp`
  （layout/help バインディングを含む）も throw しないことを検証する。

## 検証結果と再現手順

Node.js の既存環境（`.nvmrc` = 22）を使用し、依存追加は行っていない。

```bash
node -e "
import('./src/index.js').then(async ({ validateApp, validateAppDefinition, normalizeAppDefinition }) => {
  const cases = [
    ['null group', { id:'a', groups: [null] }],
    ['null operation', { id:'a', groups: [{ id:'g', operations: [null] }] }],
  ];
  for (const [label, app] of cases) {
    console.log(label, validateApp(app).map(p => p.code));
  }
});
"
npm test
```

- 手動再現: 上記2ケースとも例外なく `group.invalid` / `operation.invalid`
  を含む構造化 problem 配列を返すことを確認した（コア版・合成版の両方）。
- `npm test`: 140 passed / 0 failed / 0 skipped（既存134 + 新規6）。
- browser smoke: 対象外（構造検証のみの変更で DOM/showcase に影響しない）。

## 次の判断と反転方法

独立 Judge が issue #41 の受入条件、差分、テスト証拠、PR本文を検査する。
repair の場合は更新された終了要件を反映して再検証する。accept の場合のみ
Finalizer が `gh pr merge --merge --delete-branch` を実行する。

反転は merge commit を `git revert -m 1 <merge-commit>` する revert PR と
issue #41 の reopen。データ移行はない。次候補は open issue #38
（ExecutionStore の並行実行クロスアトリビュート、issue 本文が
「別PRにすべき大きめの変更」と明記しているため本反復では見送った）。

## 参照記録

取得日: 2026-09-20。対象repo自身の情報だけを参照し、第三者コード・素材・市場
情報は利用していない。repo に LICENSE ファイルはなく、ライセンスは未確認。
ユーザーが承認したrepo範囲内でのみ利用した。

- https://github.com/opaopa6969/OpaDeck/issues/41 — 問題と受入条件。
  再現: `gh issue view 41 --json body,comments,state,url`
- https://github.com/opaopa6969/OpaDeck/commits/main — 最近の変更。
  再現: `git log --oneline -12 origin/main`
- https://github.com/opaopa6969/OpaDeck/actions — CI workflow 0件。
  再現: `gh workflow list`

Builder: Claude (claude-sonnet-5)。記録時刻: 2026-09-20 (JST)。
