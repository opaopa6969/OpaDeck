# Progressive Builder — layout sizes validation（反復 1/3）

記録日: 2026-09-19 (JST)。対象: OpaDeck のみ。GitHub issue: #27。

## 観測事実

- 専用 worktree は clean で、開始時の `HEAD` / `origin/main` は `48187a3`。
  同一テーマの open PR、open issue、GitHub Actions の run はなかった。
- `AGENTS.md` / `CLAUDE.md` / `docs/product-brief.md` は作業ツリーにない。
  会話の指示、README、日英 DSL 文書、既存コードとテストを根拠にした。
- `split` の `sizes` だけが `Number(this.expectWord().value)` を直接使い、
  `sizes wide 2` をエラーなしでコンパイルして `[NaN, 2]` を生成した。
  JSON 化するとこの値は `[null, 2]` になり、不正値を発見しにくい。
- 同じ parser には `timeoutMs` 用に有限性を検査する `expectNumber()` がある。

## 仮説・選択理由

既存の数値 reader を `sizes` にも使えば、DSL 作者の typo を位置付きで早期に
報告できる。新しい依存、実行基盤、範囲制約は不要で、1行を戻せば反転できる。
Rust は優先候補だが、現行 ESM 製品の parser defect を直すための全面移植は
小さく可逆な成果にならないため、この反復では行わない。

## 実施内容・更新した終了要件

- `sizes` の2値を既存 `expectNumber()` で読み、非有限値を located
  `dsl.parse.error` として拒否する。
- 第1値・第2値・`Infinity` の拒否を自動テストで固定する。
- 有効な `sizes 1 2` の既存挙動を維持し、日英 DSL 文書に有限数の契約を記す。
- Builder は commit / push / PR まで行う。独立 Judge の accept 後だけ
  Finalizer が merge し、#27 の close と self-authored open PR 0件を確認する。

## 検証結果・再現手順

Node v20.20.0（既存環境）で実施。追加インストールなし。

```bash
node --test tests/opsui-layout-help-tour.test.js
npm test
git diff --check
```

- focused test: 5 passed / 0 failed / 0 skipped。
- full suite: 115 passed / 0 failed / 0 skipped（変更前は114 passed）。
- `git diff --check`: 問題なし。
- browser smoke は未実行。変更範囲は DSL parser とその仕様で、DOM・描画・
  browser依存経路を変更していない。

## 次の判断・残る不確実性

独立 Judge が #27 の受入条件、差分、テスト証拠、仕様同期を検査する。
ここでは accept を自己判定せず、merge / issue close は行わない。有限であること
以外（正数、非ゼロなど）の新しい制約は現行仕様に根拠がないため導入していない。

反転方法: merge commit を `git revert -m 1 <merge-commit>` する revert PR を
作り、merge 後に #27 を reopen する。データ移行は不要。

## 参照記録

取得日: 2026-09-19。対象 repo 自身の GitHub 情報のみを参照し、第三者コード・
素材・市場情報は利用していない。repo に LICENSE ファイルはなく、ライセンスは
未確認。ユーザーが承認した対象 repo の作業範囲内で利用した。

- https://github.com/opaopa6969/OpaDeck/issues/27 — 問題、判断、受入条件。
  再現: `gh issue view 27 --json body,comments,state`
- https://github.com/opaopa6969/OpaDeck/commits/main — 最近の変更。
  再現: `git log -12 --oneline origin/main`
- https://github.com/opaopa6969/OpaDeck/actions — CI run は0件。
  再現: `gh run list --limit 15`

モデル: このセッションの Codex（正確なモデル ID・token 使用量は未取得）。
Builder 記録時刻: 2026-09-19 10:16 UTC。
