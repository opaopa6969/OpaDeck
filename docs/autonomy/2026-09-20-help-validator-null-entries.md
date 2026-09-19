# Progressive Builder — help/tour validator の null entries 診断化（反復 1/3）

記録日: 2026-09-20 (JST)。対象: OpaDeck のみ。GitHub issue: #49。

## 観測事実

- 開始時の `HEAD` / `origin/main` は `f1b24b2`（PR #50 の merge commit）。
  `gh pr list --state open` は0件、`gh issue list --state open` は #49 の1件
  のみ。GitHub Actions の workflow は0件（`gh workflow list` が空）。
  今回の反復では GitHub 接続は正常だった（前回反復の引継ぎ質問にあった
  「GitHub接続不能」は解消済み）。
- `docs/product-brief.md` は repo に存在しない（過去の反復記録と同じ）。
  README、`HANDOFF.md`（内容は 2026-08-01 時点で古い）、`issues/` 配下の
  ドキュメント、直近の `docs/autonomy/*.md` 記録、既存コードとテストを根拠に
  した。
- issue #49 の再現を独立に確認した:
  `validateApp({ id:'a', groups:[], help:{ entries:[null], tours:[] } })` は
  修正前は `TypeError: Cannot read properties of null (reading 'target')`
  を投げた（issue本文の再現例と一致）。
- issue が指す4箇所（`validateHelpEntries` / `validateTours` の tour ループ /
  同 step ループ / `collectReferences` の `layout.root` 直参照）を
  `src/help/validate-help.js` で確認し、いずれも `#48`
  （`src/layout/validate-layout.js` の `layout.invalid` パターン、
  `docs/autonomy/2026-09-20-validator-null-entries.md` で導入した
  `isPlainObject` ガード）と同じバグクラスであることを確認した。

## 仮説と選択理由

同じ `isPlainObject` ガードパターンを4箇所に適用すれば、依存・公開APIの
シグネチャ・実行基盤を一切変えずに受入条件を満たせると判断した。範囲拡大を
避けるため、以下の設計判断はすべて既存コードの命名慣習からの機械的な延長
とし、独自の新設計は避けた:

- 診断コード名は issue 本文が例示した `help-entry.invalid` /
  `tour.invalid` / `tour-step.invalid` をそのまま採用（既存の
  `group.invalid` / `operation.invalid` / `field.invalid` / `layout.invalid`
  と一貫）。
- `target` の形は `layout.invalid`（`{ kind: 'layout', layoutIndex }`）に
  倣い、index を含めた（`{ kind: 'help-entry', entryIndex }` 等）。
- 4番目（`collectReferences` 内の `layout.root` 直参照）は issue 本文が
  示した通り、`validateLayouts`（`src/layout/validate-layout.js`）側が
  同じ非オブジェクト layout に対してすでに `layout.invalid` を返すため、
  ここでは新規の診断コードを追加せず `isPlainObject` で読み飛ばすだけに
  した（二重報告を避ける）。これは受入条件の「layouts 側のガードで
  既にカバーされていることの確認」に対応する判断。

Rust優先方針に対しては、既存ESM製品への局所的なバグ修正であり、全面移植は
伴わない。Node/npm の新規導入もしていない。

## 実施内容と終了要件

- `src/help/validate-help.js`:
  - `validateHelpEntries`: `help.entries` を `forEach` に変え、
    非オブジェクト要素に `help-entry.invalid`（`entryIndex` 付き）を積んで
    `continue` 相当（`return` in forEach callback）、以降の要素の検証は継続。
  - `validateTours`: `tours` を `forEach` に変え、非オブジェクト tour に
    `tour.invalid`（`tourIndex` 付き）を積んで次の tour へ。tour 内の
    `steps` も `forEach` に変え、非オブジェクト step に `tour-step.invalid`
    （`tourId` + `stepIndex` 付き）を積んで次の step へ。
  - `collectReferences`: layouts ループに `isPlainObject(layout)` ガードを
    追加し、非オブジェクト layout は読み飛ばす（`validateLayouts` 側が
    別途 `layout.invalid` を報告する）。
- 既存の問題コード・メッセージ・`validateApp` の公開シグネチャは変更して
  いない。
- 新規回帰テストを `tests/validate-malformed-entries.test.js` に追加:
  - `help-entry.invalid` が非オブジェクトの help entry に対して返り、
    兄弟の正しい entry は引き続き検証される（`help.target.invalid` も出る）
    ことを確認。
  - `tour.invalid` が非オブジェクトの tour に対して返り、兄弟 tour は
    引き続き検証されることを確認。
  - `tour-step.invalid` が非オブジェクトの step に対して返り、
    `tourId`/`stepIndex` が正しく、兄弟 step のコマンド検証
    （`tour.command.operation.missing`）も継続することを確認。
  - null layout + help（panel 参照）を組み合わせても throw せず、
    `layout.invalid` のみが出て `help.target.invalid` の誤検知が出ない
    こと（4番目の項目の二重報告なしの確認）を検証。

## 検証結果と再現手順

Node.js の既存環境（`.nvmrc` = 22、実行は v20.20.0 で確認）を使用し、
依存追加は行っていない。

```bash
node --input-type=module -e "
import { validateApp } from './src/index.js';
console.log(validateApp({ id: 'a', groups: [], help: { entries: [null], tours: [] } }));
"
npm test
```

- 手動再現: issue本文の再現例が例外なく `help-entry.invalid` を返すことを
  確認した。4番目の項目（null layout + help）も例外なく `layout.invalid`
  のみを返すことを確認した。
- `npm test`: 149 passed / 0 failed / 0 skipped（既存142 + 新規7、内訳は
  上記4テスト + 導入前の既存ケース）。
- browser smoke: 対象外（構造検証のみの変更で DOM/showcase に影響しない）。

## 次の判断と反転方法

独立 Judge が issue #49 の受入条件（4箇所すべての非例外化、構造化診断、
命名の一貫性、既存要素の検証継続、回帰テスト）、差分、テスト証拠、PR本文を
検査する。repair の場合は更新された終了要件を反映して再検証する。accept の
場合のみ Finalizer が `gh pr merge --merge --delete-branch` を実行する。

反転は merge commit を `git revert -m 1 <merge-commit>` する revert PR と
issue #49 の reopen。データ移行はない。

## 参照記録

取得日: 2026-09-20。対象repo自身の情報だけを参照し、第三者コード・素材・
市場情報は利用していない。repo に LICENSE ファイルはなく、ライセンスは
未確認。ユーザーが承認した repo 範囲内でのみ利用した。

- https://github.com/opaopa6969/OpaDeck/issues/49 — 問題と受入条件。
  再現: `gh issue view 49 --json body,comments,state,url`
- https://github.com/opaopa6969/OpaDeck/commits/main — 直近の変更。
  再現: `git log --oneline -10 origin/main`
- https://github.com/opaopa6969/OpaDeck/actions — CI workflow 0件。
  再現: `gh workflow list`

Builder: Claude (claude-sonnet-5)。記録時刻: 2026-09-20 (JST)。
