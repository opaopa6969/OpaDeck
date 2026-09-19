# Progressive Builder — tour runtime の null step ガード（反復 1/3）

記録日: 2026-09-20 (JST)。対象: OpaDeck のみ。GitHub issue: #59。
Builder PR: #60。

## 観測事実

- 開始時の `HEAD` / `origin/main` は `77add65`（PR #58 の merge commit）。
  `gh issue list --state open` / `gh pr list --state open` はいずれも0件
  だった（引継ぎなし、前回反復のGitHub接続不能問題も解消済み）。
  `gh workflow list` は空で GitHub Actions は存在しない。
- `AGENTS.md` / `docs/product-brief.md` は repo に存在しない（`find` で
  確認）。`CLAUDE.md` はユーザーのグローバル設定のみで repo 内にはない。
  README、`HANDOFF.md`（2026-09-20付けで最新、follow-up #6まで反映済み）、
  `issues/README.md`、既存コードとテストを製品方針の根拠にした。
- open issueが0件だったため、`issues/` 配下22件のStatusフッターを全件
  確認し全て解決済みであることを確認した上で、既存コードを直接調査して
  未修正のバグを探した。Explore agentによる横断調査と自分での再現確認を
  併用した。
- 過去の反復で同じバグクラス（groups/operations/fields配列のnull/非
  オブジェクト要素でTypeError）が6箇所修正されている
  （`src/core/validate-app.js`, `src/core/normalize-app.js`,
  `src/registry/validate-capabilities.js`, `src/geo/validate-geo.js`,
  `src/layout/validate-layout.js`, `src/help/validate-help.js`、いずれも
  `isPlainObject` ガード）ことを `grep -rn isPlainObject src/` で確認した。
  これらは全て「検証器」であり、`src/tour/runtime.js` の実行パス自体には
  同じガードが欠けていることを見つけた。
- 再現を独立に確認した:
  `createTourRuntime({}).play({ id:'t', steps:[null] }, {})` は
  `enter()` 内の `step.commands || []`（修正前）で
  `TypeError: Cannot read properties of null (reading 'commands')` を投げた
  （`node --input-type=module` での実測、スタックトレースで確認）。
  `src/help/validate-help.js` は同じ入力形状に `tour-step.invalid` の
  診断を積むが、配列から不正要素を除去しないため、検証結果を確認せずに
  再生するとクラッシュする。

## 仮説と選択理由

open issueが無い状態での自律開発では、既存のバグクラスを再発見するのが
最も安全な選択だと判断した。理由: (1) 同種の修正が6件既にmergeされて
おり、レビュー基準・パターン・テストの書き方が確立している、(2) 新機能の
追加は要求元の解像度が低いまま拡張判断を迫られるが、既存バグの穴埋めは
受入条件が「クラッシュしない」で自明、(3) 依存・公開API・実行基盤を
変えない。

修正方針は `enter()` の先頭で `isPlainObject` ガードを通し、不正な step
を空オブジェクト `{}` として扱う（コマンド無し、スポットライト無し、だが
`tour.stepChanged` は発火し続けて `next()`/`prev()` のナビゲーションは
壊さない）案を採用した。他の6箇所と同じ「診断はするが実行は継続する」
思想に合わせた。別案（`load()` で例外を投げて呼び出し側に検証を強制する）
は、他の5箇所（validate-app等）が「診断してスキップ」であるのに対して
一貫性が無く、既存の呼び出し側（showcase等）に新たな try/catch を強いる
ため見送った。Rust優先方針に対しては、既存ESM製品への局所的なバグ修正で
あり、全面移植を伴わない。

GitHub issue #59 を先に作成し、repo の確立された慣習
（`issues/ISSUE-0NN-*.md` + GitHub issue + `fix/issue-N-*` ブランチ +
`Closes #N` の PR）に厳密に合わせた。これは過去22件全てがこの形式を
踏襲しているため、独立Judgeが検収しやすい形を優先した。

## 実施内容と終了要件

- `src/tour/runtime.js`: `enter()` が `steps[index]` を直接使う代わりに、
  `isPlainObject(rawStep) ? rawStep : {}` で正規化してから `.commands` /
  `stepInfo()` 経由の `.id`/`.title`/`.narration` を読む。`isPlainObject`
  は既存の `src/core/ids.js` からimport（他の6箇所と同じヘルパーを再利用、
  新規ロジックの重複なし）。
- `tests/tour.test.js`: `steps: [null, {...}]` の tour を再生し、(a) 例外が
  発生しない、(b) 1番目の `tour.stepChanged` イベントが
  `{id:undefined, title:undefined, narration:undefined, index:0}` を返す、
  (c) `next()` で2番目の正常な step に到達し `id:'s2'` を確認する回帰
  テストを追加した。
- `issues/ISSUE-023-tour-runtime-null-step.md` を新規作成し
  `issues/README.md` の Done リストに追記した（既存22件と同じ形式）。
- 公開されている `createTourRuntime` / `play()` / `next()` / `prev()` /
  `goTo()` の外部シグネチャ、`tour.*` バスイベントの種別・発火条件は
  変更していない。

## 検証結果と再現手順

```bash
npm test
```

- `npm test`: 154 passed / 0 failed / 0 skipped（既存153 + 新規1）。
- 修正前の再現: `node --input-type=module -e` で
  `createTourRuntime({}).play({id:'t', steps:[null]}, {})` を呼び、
  `TypeError: Cannot read properties of null (reading 'commands')` が
  スタックトレース付きで発生することを確認した（未修正のコードに対して
  実行、修正後は再実行せず新規テストでカバー）。
- 修正後、同じ入力形状を新規テストとして `tests/tour.test.js` に追加し
  `npm test` の一部として合格することを確認した。
- browser smoke: 対象外（`src/tour/runtime.js` のロジック変更のみで、
  overlay/DOM配線やイベント種別は変更していない）。

## 次の判断と反転方法

独立 Judge が issue #59 の受入条件、差分、テスト証拠、PR本文を検査する。
repair の場合は更新された終了要件を反映して再検証する。accept の場合のみ
Finalizer が `gh pr merge --merge --delete-branch` を実行し、merge後に
issue #59 が自動closeすることを確認する（`Closes #59` により）。

反転は単一コミットの revert PR（`git revert <merge-commit>`）と issue #59
の reopen で完結する。データ移行、依存追加、公開APIの変更は無いため
補償コストは低い。

次候補: 本反復完了時点で他に open issue は存在しない。次反復では
open issueの有無を再確認し、無ければ同じ手法（既知バグクラスの横断調査）
を継続するか、`docs/en/IMPLEMENTATION.md` の "Not yet automated"
（実サーバー結合テスト）のような、より規模の大きい既知ギャップの着手を
検討する。

## 参照記録

取得日: 2026-09-20。対象repo自身の情報だけを参照し、第三者コード・素材・
市場情報は利用していない。repo に LICENSE ファイルはなく、ライセンスは
未確認。ユーザーが承認したrepo範囲内でのみ利用した。

- https://github.com/opaopa6969/OpaDeck/issues/59 — 本反復で作成した
  issue。再現: `gh issue view 59 --json body,comments,state,url`
- https://github.com/opaopa6969/OpaDeck/pull/60 — 本反復のPR。
  再現: `gh pr view 60 --json state,mergeable,statusCheckRollup,url`
- https://github.com/opaopa6969/OpaDeck/commits/main — 最近の変更。
  再現: `git log --oneline -10 origin/main`
- https://github.com/opaopa6969/OpaDeck/actions — CI workflow 0件。
  再現: `gh workflow list`

Builder: Claude (claude-sonnet-5)。記録時刻: 2026-09-20 (JST)。
