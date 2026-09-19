# Progressive Builder — multipart part injection（反復 1/3）

記録日: 2026-09-19 (JST)。対象: OpaDeck のみ。GitHub issue: #36。
Builder モデル: Claude Opus 5 (1M context)。

## 観測事実

- 専用 worktree `/home/opa/work/.wt/OpaDeck/autonomy-fan-mu8her03-3en` は clean、
  開始時の `HEAD` と `origin/main` はともに `e279fab`。
- 前 job（fan-mu8esovh-qk）が GitHub 接続不能で独立確認できなかった終了条件を、
  接続回復後に再確認した。`gh pr view 35` は `state=MERGED`,
  `mergedAt=2026-09-19T12:40:52Z`、`gh issue view 34` は `state=CLOSED`,
  `closedAt=2026-09-19T12:40:53Z`、`gh pr list --state open` と
  `gh issue list --state open` はいずれも 0 件。`git ls-remote origin` に
  `refs/heads/fix/issue-34-query-before-fragment` は存在せず、リモート作業
  ブランチは削除済み。残っていたのはローカルの同名ブランチ（他 worktree が
  checkout 中）だけで、リモート状態との不整合ではなかった。
- `.github/workflows` は存在せず、CI run もない（この repo の検証は `npm test`）。
- repo に `docs/product-brief.md` は無いため、README、英日 CONSTITUTION /
  IMPLEMENTATION / ROADMAP、issue 台帳、直近履歴を根拠にした。
- 変更前の `npm test` は Node v20.20.0 で 120 passed / 0 failed。
- `buildRequestPreview` の multipart 直列化は、export された固定境界
  `MULTIPART_BOUNDARY` を使い、field name と operator が入力した値をそのまま
  body へ埋め込んでいた。境界はソースに載る定数なので推測不要で、値に境界を
  含めるだけで任意の form-data パートを注入できた。再現では正規の
  `role=user` より前に `role=admin` が挿入され、重複名の先頭を採る server は
  `admin` を受け取る。

## 仮説・選択理由

固定境界は「preview / curl / 実行が byte 単位で一致する」ための設計であり、
purity を捨てずに注入だけを塞ぎたい。境界を乱数化すると preview と実行が
一致しなくなるため採らない。代わりに **直列化済み entry を読んで境界を決定的に
選ぶ**（既定境界が含まれるときだけ数字 suffix を伸ばす）。入力が同じなら出力も
同じで、既定境界を含まない従来入力の出力は 1 byte も変わらない。

field name の `"`・CR・LF は browser の form 直列化と同じく percent-encode する。
RFC 7578 の quoted-string を壊さない最小の扱いで、既存の name 表現も変えない。

既存 JavaScript 製品の局所修正であり、Rust 全面移植や Node/npm 依存の追加は
行わない。

## 実施内容・更新した終了要件

- `selectMultipartBoundary` を追加し、name/value のどれかが候補境界を含む間だけ
  `${MULTIPART_BOUNDARY}${n}` へ伸ばす。
- 選んだ境界を body context 経由で `inferContentType` へ渡し、header と body が
  食い違わないようにした（curl も同じ preview から生成される）。
- `escapeFieldName` で `"` → `%22`、CR → `%0D`、LF → `%0A`。
- 回帰テスト 3 件を追加。テストは raw body の部分文字列ではなく、**advertise された
  境界で body を分割して server が見るパートを検証する**（境界が既定境界を prefix に
  持つため部分文字列比較では守れない）。
- 英日 IMPLEMENTATION と USING-OPADECK、ローカル issue 台帳を契約へ同期。
- Builder は commit / push / PR まで。merge と #36 close は独立 Judge の accept 後に
  Finalizer だけが行う。

## 検証結果・再現手順

追加インストールなし。Node v20.20.0。

```bash
node --test tests/request-builder.test.js   # 13 passed / 0 failed
npm test                                    # 123 passed / 0 failed / 0 skipped
git diff --check
```

注入の再現（修正前は `role=admin` が独立パートになる。修正後は境界が
`----OpaDeckFormBoundary7MA4YWxkTrZu0gW1` へ伸び、注入文字列は `note` の値の
内側に留まる）:

```bash
node -e '
import("./src/runtime/request-builder.js").then(({buildRequestPreview, MULTIPART_BOUNDARY}) => {
  const op = { id:"upload", groupId:"g",
    request:{ method:"POST", url:"/api/upload", body:{ kind:"multipart" } },
    fields:[{id:"note",placement:"body"},{id:"role",placement:"body",defaultValue:"user"}] };
  const evil = `x\r\n--${MULTIPART_BOUNDARY}\r\nContent-Disposition: form-data; name="role"\r\n\r\nadmin`;
  const p = buildRequestPreview(op, { note: evil });
  console.log(p.headers["content-type"]);
  console.log(JSON.stringify(p.bodyText));
});
'
```

## 次の判断・残る不確実性

- 独立 Judge が #36 の受入条件、差分、テスト証拠を検査する。ここで accept を
  自己判定せず、merge と issue close は行わない。
- 残る不確実性: 実際の multipart parser ではなく、advertise された境界で分割する
  テスト内 parser で検証している。RFC 7578 の delimiter は `CRLF--boundary` だが、
  本実装の境界チェックは「境界文字列がどこかに現れるか」で、delimiter 規則より
  厳しい側に倒してある。
- 隣接候補（本 PR では扱わない）: `src/runtime/url-state.js` の `start()` は
  「正規化した URL を history へ書かずに canonicalize する」とコメントするが、
  実際には `location.href` を読み直すだけで address bar を更新しない。別 issue 相当。

反転方法: merge commit を `git revert -m 1 <merge-commit>` する revert PR を作り、
#36 を reopen する。公開 API の削除もデータ移行もないため revert は差分の巻き戻し
だけで完了する。

## 参照記録

取得日: 2026-09-19。対象 repo 自身の GitHub 情報とローカルコード・テストのみを
参照し、第三者コード・素材・市場情報は利用していない。repo に LICENSE ファイルは
なく、ライセンスは未確認。再現: `gh issue view 36`、`gh pr list`、
`git log -8 --oneline`。
