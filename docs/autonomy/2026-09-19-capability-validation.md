# Progressive Builder 引継ぎ — 反復 1/3

記録日: 2026-09-19 (JST)。対象: OpaDeck のみ。

## 観測事実

- handoff #24 の worktree は clean で、`fix/issue-13-capability-validation`
  の `8f2715c` は push 済み。open PR はなかったため、このブランチを継続した。
- `origin/main` は `d65c061`。直近では #22 が `src/**` の相対 import 契約を
  復元しており、core と portability の既存境界を維持する必要がある。
- `AGENTS.md` / `CLAUDE.md` / `docs/product-brief.md` は作業ツリーにない。
  会話の指示、#23 の受入条件、README、憲法、EXTENSIONS を今回の根拠とした。
- GitHub Actions の実行履歴は 0 件、`.github` の追跡ファイルはなし。
  CI 成功を推測せず、ローカルの検証結果を提示する。

## 仮説と選択理由

レジストリの登録漏れをアプリ定義の検証時に報告すれば、実行時まで原因に
気づけない問題を減らせる。既存の呼び出しと core の境界を保つため、前回の
任意指定の companion validator を採用する。製品は既存の JavaScript
ライブラリなので、その最小差分を引き継ぐ。Node/npm や依存を新規導入せず、
Rust への全面移植や実行基盤の新設は行わない。

## 実施内容と更新した終了要件

- 未登録の result renderer / panel renderer / data-source kind と、対応する
  field renderer のないフィールドを各 `ProblemEntry` で返す。
- `validateApp` / `compileOpsui` はレジストリを渡した場合だけ上記を合成する。
  未指定のレジストリのチェックは省略し、`result.renderer: 'auto'` は有効とする。
- 構造チェックを維持し、field renderer は id や固定型一覧でなく
  `supports(field)` で判定する。これらを引継ぎ後の追加テストで確認した。
- en/ja の EXTENSIONS と IMPLEMENTATION、および DSL skill の説明を揃える。
- Builder は commit / push / PR と証拠の記録まで。独立 Judge の accept 後に
  Finalizer が merge し、#23 と #24 の close を確認して全体の終了となる。

## 検証結果と再現手順

Node v20.20.0（既存環境）で実施。追加インストールなし。

```bash
git switch fix/issue-13-capability-validation
npm test
git diff --check origin/main...HEAD
gh api repos/opaopa6969/OpaDeck/actions/runs --jq .total_count
gh pr list --repo opaopa6969/OpaDeck --state open
```

- 引継ぎ時: `node --test` は 112 passed / 0 failed / 0 skipped。
- 追加検証後: `npm test` は 114 passed / 0 failed / 0 skipped。
- `git diff --check` は問題なし。
- ブラウザ smoke は未実行。今回の変更はコンパイル・検証 API のみであり、
  DOM や描画の変更はない。テストでは renderer の `render()` を呼ばないことも確認。

## 次の判断・残る不確実性

独立 Judge に受入条件、差分、再現可能なテストを検査してもらう。ここでは
accept を自己判定せず、merge / issue close は未実施。brief 不在のため
製品全体の優先順位までは判断せず、既存 #23 の範囲で引継ぎを完結させる。
リモート CI による検証証拠はない。

反転方法: merge commit を `git revert -m 1 <merge-commit>` する専用ブランチから
revert PR を作り、merge 後に #23 / #24 を reopen する。データ移行は不要。

## 参照記録

取得日はいずれも 2026-09-19。GitHub CLI により取得した対象 repo 自身の情報。
対象 repo の LICENSE ファイルは見つからず、ライセンスは未確認。
ユーザーによる対象 repo の作業許可の範囲で参照し、第三者コード・素材の転用はない。

- https://github.com/opaopa6969/OpaDeck/issues/24 — 前回引継ぎ。
  再取得: `gh issue view 24 --repo opaopa6969/OpaDeck --json body,comments`
- https://github.com/opaopa6969/OpaDeck/issues/23 — 方針・受入条件。
  再取得: `gh issue view 23 --repo opaopa6969/OpaDeck --json body,comments`
- https://github.com/opaopa6969/OpaDeck/pull/22 — 直近の変更。
  再取得: `git log -5 --oneline origin/main`
- https://api.github.com/repos/opaopa6969/OpaDeck/actions/runs — CI 履歴。
  再取得: 上記 `gh api` コマンド。

モデル: このセッションの Codex（正確なモデル ID・token 使用量は未取得）。
Builder 作業開始: 2026-09-19 08:22 UTC。所要時間は PR の引継ぎコメントに記録する。
