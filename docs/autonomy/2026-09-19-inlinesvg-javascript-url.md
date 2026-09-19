# Progressive Builder — inlineSvg javascript: URL サニタイズ（反復 1/3）

記録日: 2026-09-19 (JST)。対象: OpaDeck のみ。GitHub issue: #29。

## 観測事実

- 専用 worktree は clean で、開始時の `HEAD` / `origin/main` は
  `93b3067`（PR #28 マージ直後）。同一テーマの open PR、open issue、GitHub
  Actions の run はなかった（`gh pr list` / `gh issue list` / `gh run list`
  いずれも該当なし。`.github/workflows` も存在しない）。
- `AGENTS.md` / `CLAUDE.md` / `docs/product-brief.md` は作業ツリーにない。
  README、`issues/README.md`（全項目 実装済み）、`docs/en/IMPLEMENTATION.md`、
  既存コード・テスト・直近コミット履歴を根拠にした。
- 調査（codex subagent, read-only）で、`inlineSvg` 結果レンダラーの
  `sanitizeSvgElement`（`src/renderers/result-renderers.js`）が
  `<script>`/`<foreignObject>` の除去と `on*` 属性の除去のみを行い、
  `href` / `xlink:href` の `javascript:` スキームを見落としていることを
  発見。実際に再現した:
  ```js
  const el = renderer.render({ document, contentType: 'image/svg+xml',
    bodyText: '<svg><a href="javascript:alert(1)"><circle r="2"/></a>'
      + '<use xlink:href="javascript:alert(2)"/></svg>' });
  el.querySelector('a').getAttribute('href');        // "javascript:alert(1)"
  el.querySelector('use').getAttribute('xlink:href'); // "javascript:alert(2)"
  ```
- `issues/ISSUE-015-inline-svg-markup-injection-contract.md` の「Option B」
  本文自体が "`xlink:href` to javascript: URIs" の除去を明記していたが、
  実装（PR #19, commit `ba33254`）はそれを実装していなかった。既存テスト
  （`tests/renderers-extra.test.js`）もこの属性を検査していなかった。

## 仮説・選択理由

ISSUE-015 で既に合意された方向性（サニタイズで防ぐ）の未完了部分を埋める、
純粋な defense-in-depth の追加。新しい依存・実行基盤・公開APIの変更は不要で、
`sanitizeSvgElement` の属性ループに1条件を足すだけなので小さく安全で可逆。
Rust優先の方針との関係では、対象は既存ESM製品のセキュリティ修正であり、
全面移植は本反復の範囲外と判断した。

他の候補（HTTPタイムアウトが本文待機前に解除される／連続実行時の
ExecutionRecordの取り違え／DSL `tabs.defaultTab` の不在参照チェック漏れ）も
調査で見つかったが、実害の種類（XSSは既存ISSUE-015の延長で影響が明確）と
差分の小ささを比較し、本件を最優先候補として選んだ。他の3件は別issueとして
切り出す価値があるが、本反復では着手しない。

## 実施内容・更新した終了要件

- `src/renderers/result-renderers.js`: `sanitizeSvgElement` に
  `URL_ATTR`（`href` / `xlink:href`、大文字小文字を無視）チェックを追加し、
  `isUnsafeUrl()` で空白・制御文字を除去してから `javascript:` プレフィクス
  を判定、該当すれば属性を削除。安全な URL（`https://...` 等）は保持する。
- `tests/renderers-extra.test.js`: `javascript:` 直書き、`xlink:href`、
  空白/タブで難読化した `Java\tScript:` の3パターンが除去され、安全な
  `href` は保持されることを固定するテストを追加。
- GitHub issue #29 を作成し、受入条件・スコープ・reproを記録した。
- Builder は commit / push / PR まで行う。独立 Judge の accept 後だけ
  Finalizer が merge し、#29 の close と self-authored open PR 0件を確認する。

## 検証結果・再現手順

Node v20.20.0（既存環境）で実施。追加インストールなし。

```bash
npm test
```

- full suite: 116 passed / 0 failed / 0 skipped（変更前は115 passed）。
- 手動再現スクリプト（上記の観測事実の再現コード）で、修正後は
  `getAttribute('href')` / `getAttribute('xlink:href')` がいずれも `null`
  （属性削除）になり、安全な `href="https://example.com/safe"` は保持される
  ことを確認した。

## 次の判断・残る不確実性

独立 Judge が #29 の受入条件、差分、テスト証拠を検査する。ここでは accept を
自己判定せず、merge / issue close は行わない。

スコープ外として残した既知の隣接論点（別issue化候補、本反復では未着手）:

1. `src/runtime/http-executor.js` — レスポンス本文の読み取り待機中は
   `timeoutMs` が効かない可能性（本文受信前に `cleanup()` される経路）。
2. `src/runtime/execution-store.js` — 同一ストアで2つの実行が未解決のまま
   重なると、先に解決した方が誤った操作に紐付く可能性。
3. `src/dsl/opsui.js` / `src/layout/validate-layout.js` — `tabs` の
   `defaultTab` が存在しない panel id を参照してもコンパイルエラーに
   ならない。

反転方法: merge commit を `git revert -m 1 <merge-commit>` する revert PR を
作り、merge 後に #29 を reopen する。データ移行は不要。

## 参照記録

取得日: 2026-09-19。対象 repo 自身の GitHub 情報とローカルコード・テストの
みを参照し、第三者コード・素材・市場情報は利用していない。repo に LICENSE
ファイルはなく、ライセンスは未確認。ユーザーが承認した対象 repo の作業範囲内
で利用した。

- https://github.com/opaopa6969/OpaDeck/issues/29 — 本件の問題、受入条件。
  再現: `gh issue view 29 --json body,comments,state`
- https://github.com/opaopa6969/OpaDeck/issues/15 相当
  （`issues/ISSUE-015-inline-svg-markup-injection-contract.md`）— 既存の
  サニタイズ方針と「Option B」で明記されていた未実装項目の根拠。
- https://github.com/opaopa6969/OpaDeck/commits/main — 直近の変更。
  再現: `git log -12 --oneline origin/main`
- https://github.com/opaopa6969/OpaDeck/actions — CI run は0件。
  再現: `gh run list --limit 15`

モデル: Claude Sonnet 5（claude-sonnet-5）。調査補助に codex subagent
（codex exec, read-only）を使用。Builder 記録時刻: 2026-09-19 (JST)。
