# Progressive Builder — inlineSvg SMIL サニタイズ（反復 1/3）

記録日: 2026-09-20 (JST)。対象: OpaDeck のみ。GitHub issue: #39。

## 観測事実

- 開始時の `HEAD` / `origin/main` は `6540471`（PR #43 の merge commit）。
  open PR は0件、GitHub Actions の run も0件だった。
- 指定された `docs/product-brief.md` と repo 内の `AGENTS.md` / `CLAUDE.md`
  は存在しないため、README、Constitution、Roadmap、Implementation Status、
  open issue、既存コードとテストを製品方針の根拠にした。
- `inlineSvg` sanitizer は静的な `href` / `xlink:href` の `javascript:` URLを
  除去するが、実行時に属性を変更できる `animate` / `set` /
  `animateTransform` / `animateMotion` を保持していた。修正前の再現では4要素が
  すべて1件ずつ残った。

## 仮説と選択理由

issue #39 は既存の防御契約に対する確認済みの抜けであり、依存、公開API、実行
基盤を変えずに閉じられる。SMIL要素を deny-list に追加する案は、SVG全体の
allow-list 化より小さく、安全で可逆なため本反復で選んだ。Rust優先方針に対して
は、既存ESM製品の局所的なセキュリティ修正であり、全面移植を伴わない。

## 実施内容と終了要件

- `inlineSvg` sanitizer が `animate`、`set`、`animateTransform`、
  `animateMotion` を再帰的に除去する。
- 回帰テストが4要素の除去、`href` / `xlink:href` を狙うpayload、安全な静的
  `href` の保持を検証する。
- 英日 Components / Extensions に、除去対象と「一般的なSVG allow-listでは
  ない」という保証範囲を記録する。
- 全テスト成功後に commit / push / PR を作成し、独立 Judge の accept 後だけ
  Finalizer が merge と issue close を行う。

## 検証結果と再現手順

Node.js の既存環境を使用し、依存追加は行っていない。

```bash
node --test tests/renderers-extra.test.js
npm test
npm run test:browser
```

- 対象テスト: 10 passed / 0 failed。
- 全体: 132 passed / 0 failed / 0 skipped。
- browser smoke: Playwright 未導入のため `SKIP`。Node/npm の新規導入禁止方針に
  従い、追加インストールは行っていない。

## 次の判断と反転方法

独立 Judge が issue #39 の受入条件、差分、テスト証拠、PR本文を検査する。
repair の場合は更新された終了要件を反映して再検証する。accept の場合のみ
Finalizer が `gh pr merge --merge --delete-branch` を実行する。

反転は merge commit を `git revert -m 1 <merge-commit>` する revert PR と
issue #39 の reopen。データ移行はない。次候補は open issue #38、#41、#42。

## 参照記録

取得日: 2026-09-20。対象repo自身の情報だけを参照し、第三者コード・素材・市場
情報は利用していない。repo に LICENSE ファイルはなく、ライセンスは未確認。
ユーザーが承認したrepo範囲内でのみ利用した。

- https://github.com/opaopa6969/OpaDeck/issues/39 — 問題と受入条件。
  再現: `gh issue view 39 --json body,comments,state,url`
- https://github.com/opaopa6969/OpaDeck/commits/main — 最近の変更。
  再現: `git log --oneline -12 origin/main`
- https://github.com/opaopa6969/OpaDeck/actions — CI run 0件。
  再現: `gh run list --limit 15`

Builder: Codex。記録時刻: 2026-09-20 00:38 JST。
