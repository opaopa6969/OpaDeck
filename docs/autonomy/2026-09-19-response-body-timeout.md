# Progressive Builder — response body timeout/cancellation（反復 1/3）

記録日: 2026-09-19 (JST)。対象: OpaDeck のみ。GitHub issue: #31。

## 観測事実

- 専用worktreeはcleanで、開始時の `HEAD` / `origin/main` は `510d0e4`。
  同一テーマのopen issue/PR、CI runはなく、`.github/workflows` も存在しない。
- repo内に `AGENTS.md` / `CLAUDE.md` / `docs/product-brief.md` はなかったため、
  README、設計文書、issue台帳、既存コード・テスト・直近履歴を根拠にした。
- `createHttpExecutor` は `fetch` がresponse headerを返した直後、
  `readResponse` より前にtimeout timerと外部signal listenerを解除していた。
  したがって、header後に本文がstallするとtimeout/cancelが効かなかった。
- 変更前の `npm test` は116 passed。前回の自律記録にも本件が隣接候補として
  残されており、今回コードを再確認して実行経路を確定した。

## 仮説・選択理由

HTTP実行が本文待機で無期限に残るのはoperation-centric workbenchの回復性を
直接損なう。cleanupをterminal pathへ移すだけで公開API・依存・データ移行なしに
直せ、revertも容易である。既存JavaScript製品の局所修正であり、Rust全面移植や
Node/npm依存の追加は行わない。

## 実施内容・更新した終了要件

- `runRequest` のcleanupを `finally` に集約し、通常本文とNDJSON streamの読了、
  例外、timeout、cancelの全terminal pathで一度だけ実行する。
- header受信後の本文待機中timeout/cancel、NDJSON待機中timeout、成功時のtimerと
  外部listener解除を決定的なmanual-clockテストで固定する。
- 英日Implementation文書とローカルissue台帳を実装契約へ同期する。
- Builderはcommit/push/PRまで。独立Judgeのaccept後だけFinalizerがmergeし、
  #31 closeとself-authored open PR 0件を確認する。

## 検証結果・再現手順

追加インストールなし。

```bash
node --test tests/http-executor.test.js tests/http-executor-streaming.test.js
npm test
git diff --check
```

- focused: 15 passed / 0 failed
- full suite: 119 passed / 0 failed / 0 skipped
- whitespace errors: none

## 次の判断・残る不確実性

独立Judgeが #31 の受入条件、差分、テスト証拠を検査する。ここではacceptを
自己判定せず、merge/issue closeは行わない。実ネットワーク上のstallは使わず、
Fetch/AbortController契約を注入可能なfake responseで再現した点は残るが、既存の
executorテスト方式と同じであり、分岐・timer・signal cleanupを直接観測している。

反転方法: merge commitを `git revert -m 1 <merge-commit>` するrevert PRを作り、
#31をreopenする。データ移行は不要。

## 参照記録

取得日: 2026-09-19。対象repo自身のGitHub情報とローカルコード・テストのみを
参照し、第三者コード・素材・市場情報は利用していない。repoにLICENSEファイルは
なく、ライセンスは未確認。再現: `gh issue view 31`、`gh pr list`、
`gh run list`、`git log -8 --oneline`。

Builderモデル: Codex (GPT-5系)。記録時点の反復: 1/3。
