# Progressive Builder — ExecutionStore の並行実行対応（反復 1/3）

記録日: 2026-09-20 (JST)。対象: OpaDeck のみ。GitHub issue: #38。

## 観測事実

- 開始時の `HEAD` / `origin/main` は `e7f8c6d`（PR #46 の merge commit）。
  open PR は0件、GitHub Actions の workflow は0件（`gh workflow list` が空）。
  open issue は #38 の1件のみ。
- `AGENTS.md` / `CLAUDE.md` / `docs/product-brief.md` はいずれも repo に
  存在しない（`find` で確認、前回反復と同じ状況）。README、HANDOFF.md、
  issue本文、既存コードとテストを根拠にした。`HANDOFF.md` は
  2026-08-01付けで直近5件のmergeを反映しておらず、参考程度に留めた。
- 他の autonomy ブランチ（`autonomy/fan-mu8celz6-5h0`,
  `autonomy/fan-mu8esovh-qk`）および `fix/issue-*` ローカルブランチを
  `git log main..<branch>` で確認し、`main` に対して差分を持つものは
  なかった（すべて merge 済みか空）。issue #38 に対する重複実装は
  存在しない。
- issue #38 の再現を独立に確認した: `createExecutionStore` は単一の
  `currentRecord` しか保持せず（`src/runtime/execution-store.js:39`
  相当）、`succeed()`/`fail()` は id を取らずに「現在の」record を
  終端していた。`createHttpExecutor.execute`
  （`src/runtime/http-executor.js:45`）は `begin()` の戻り値を無視して
  いた。2つの `execute()` を重ねて呼び、先に開始した方 (A) を先に
  完了させると、2番目 (B) の record に A の応答が上書きされ、B 自身の
  完了が失われることを、issue に書かれた症状と一致する形で確認した。

## 仮説と選択理由

issue 本文が既に受入条件と規模見積り（40〜80行、独立PR）を明記して
いたため、追加の要件解釈は不要と判断した。選択肢は (a) 単一
`currentRecord` を id 付き `Map` に置き換え、終端メソッドに id を必須
引数として追加する、(b) 内部にキューを持たせて `current()` の意味を
「先頭の実行」に変える、の2つを検討した。(b) は「`current()` は単一
実行の場合に既存の意味を保つ」という受入条件を満たしにくく、複数実行時
の意味も曖昧になるため、(a) を採用した。(a) は依存追加なし・実行基盤の
再実装なしで、差分が `execution-store.js` の内部状態と
`http-executor.js` の呼び出し側に限定され、revert は単純な diff
rollback で済む。呼び出し元（`http-executor.js`, `showcase/app.js`,
既存テスト）を同一コミットで更新することで、公開APIの变更が一貫した
状態を保った。Rust優先方針に対しては、既存ESM製品への局所的なバグ
修正であり、全面移植を伴わない。

## 実施内容と終了要件

- `src/runtime/execution-store.js`: `currentRecord` (単一変数) を
  `running`（`id -> record` の `Map`）と `lastBegunId` に置き換えた。
  `succeed(id, response, options)` / `fail(id, response, options)` /
  `cancel(id, problems)` / `timeout(id, problems)` は id を必須の
  第一引数として要求し、`running` から該当 id の record のみを取り出して
  終端・履行する。未知または既に終端済みの id を指定した場合は `null` を
  返す no-op とし、他の実行を上書きしない。`current()` は
  `lastBegunId` に対応する record が `running` に残っていればそれを返し、
  単一実行の場合の既存の挙動（開始直後は running、終端後は `null`）を
  保つ。
- `src/runtime/http-executor.js`: `execute()` が `begin()` の戻り値
  (`handle`) を保持し、`runRequest` に `executionId` として渡す。
  `succeed`/`fail`/`cancel`/`timeout` の全呼び出しに `executionId` を
  渡すよう更新した。
- `showcase/app.js`: デモ用の `simulateExecution()` も同じパターン
  （`begin()` の戻り値の `id` を `succeed()` に渡す）に更新した
  （テスト対象外だが、公開APIの一貫性のため）。
- `tests/runtime.test.js`: 既存2テストを新シグネチャ
  （`store.succeed(id, ...)`）に更新し、以下の新規回帰テストを追加した:
  - 2つの重複実行を `begin()` し、先に開始した方を先に完了させて、
    各 record が自分の `operationFqid` / `response.bodyText` を保持し
    続けること、`execution.started` / `execution.success` イベントが
    それぞれの id を伴って正しい順序で発火することを検証する。
  - 未知の id、および既に終端済みの id に対する `succeed()` が `null`
    を返す no-op であり、既存履行済み履行 (history) を上書きしないことを
    検証する。
- `tests/http-executor.test.js`: `executor.execute()` を2回重ねて呼び、
  fetch の解決順序を入れ替えて（先に開始した方を先に解決）、issue に
  書かれた「A完了時にBのrecordにA応答が入る」症状が再発しないこと、
  両方の record が最終的に正しい `operationFqid` と `response.bodyText`
  を持ち、`history()` に2件とも残ることを検証する新規回帰テストを追加
  した。
- 公開されている `execution.*` バスイベントの種別・発火回数・
  `current()`/`history()` の外部シグネチャは変更していない
  （`succeed`/`fail`/`cancel`/`timeout` の引数追加のみ）。

## 検証結果と再現手順

Node.js の既存環境（`.nvmrc` = 22、実行は system Node v20.20.0 で確認）を
使用し、依存追加は行っていない。

```bash
npm test
```

- `npm test`: 144 passed / 0 failed / 0 skipped（既存141 + 新規3:
  `runtime.test.js` に2件、`http-executor.test.js` に1件）。
- 手動確認: `src/runtime/execution-store.js` / `src/runtime/http-executor.js`
  / `showcase/app.js` を一時的に `git checkout --` で修正前の内容へ戻し、
  新規3テストのみ (`node --test tests/runtime.test.js
  tests/http-executor.test.js`) を実行して両方が issue と同じ症状
  （2番目の record が1番目の応答で上書きされる）で失敗することを確認した
  上で、修正版を復元して `npm test` が全件成功することを確認した。
- browser smoke: 対象外（`showcase/app.js` の変更は既存のデモ用
  スケジューラ呼び出しパターンをそのまま維持する1行差分のみで、DOM
  構造やイベント配線は変更していない）。

## 次の判断と反転方法

独立 Judge が issue #38 の受入条件、差分、テスト証拠、PR本文を検査する。
repair の場合は更新された終了要件を反映して再検証する。accept の場合のみ
Finalizer が `gh pr merge --merge --delete-branch` を実行する。

反転は merge commit を `git revert -m 1 <merge-commit>` する revert PR と
issue #38 の reopen。データ移行はない。次候補は現時点で他に open issue が
存在しないため、次反復では新規 issue の有無を再確認する。

## 参照記録

取得日: 2026-09-20。対象repo自身の情報だけを参照し、第三者コード・素材・市場
情報は利用していない。repo に LICENSE ファイルはなく、ライセンスは未確認。
ユーザーが承認したrepo範囲内でのみ利用した。

- https://github.com/opaopa6969/OpaDeck/issues/38 — 問題と受入条件。
  再現: `gh issue view 38 --json body,comments,state,url`
- https://github.com/opaopa6969/OpaDeck/commits/main — 最近の変更。
  再現: `git log --oneline -12 origin/main`
- https://github.com/opaopa6969/OpaDeck/actions — CI workflow 0件。
  再現: `gh workflow list`

Builder: Claude (claude-sonnet-5)。記録時刻: 2026-09-20 (JST)。
