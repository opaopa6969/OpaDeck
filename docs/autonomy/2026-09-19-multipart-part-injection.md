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

---

# Progressive Builder — 反復 2/3（Judge 差し戻しへの対応）

記録日: 2026-09-19 (JST)。同一 PR #37 に追加 commit。新規 PR は立てない。

## 観測事実

- Judge が独立再現した抜け穴: 反復 1 は境界を `inferContentType` 経由でのみ
  伝えていたため、`request.contentType` で multipart の content-type を明示した
  operation では **header が既定境界を advertise したまま body だけ伸びた境界を
  使う**。server は advertise された境界で分割するので、注入パート
  (`role=admin`) が再び独立パートとして見える。同じ経路が header field で
  content-type を入力した場合にも存在する（`buildHeadersAndBody` の
  `request.contentType` 分岐と `hasHeader` ガードが `inferContentType` を迂回する）。
- `issues/README.md` は ISSUE-021 を Open の `[ ]` に置いたままで、
  `issues/ISSUE-021-*.md` の `## Status`（Implemented）および ISSUE-020 の
  慣行（同一 commit で Done に `[x]`）と矛盾していた。

## 仮説・選択理由

境界は body 側が唯一の真実（衝突回避のため伸ばすのは body 直列化だけ）。
よって header 側を後から body に合わせる。採った案は
`forceMultipartBoundary(headers, boundary)` で、**content-type の media type が
`multipart/` のときだけ** 既存の `boundary` パラメータを除去して実際の境界を
付け直す。

- 明示された content-type 自体（media type や `charset` などの他パラメータ）は
  保持する。operator の宣言を尊重しつつ、server が分割に使う値だけ正す。
- `multipart/` 以外の content-type には触れない。宣言と body 種別の不一致は
  本 issue の範囲外で、勝手に境界を足す方が驚きが大きい。
- `boundary` が未指定の `multipart/form-data` には付け足す（従来は server が
  parse 不能だった。可逆な改善）。
- 代案「明示 content-type を無視して常に infer する」は operator の宣言を
  黙って捨てるため不採用。

## 実施内容

- `src/runtime/request-builder.js`: `forceMultipartBoundary` を追加し、
  multipart body を作った場合は `request.contentType` / header field / 推論の
  どの経路でも advertise される境界を body の境界へ揃える。
- `tests/request-builder.test.js`: 回帰テスト 4 件を追加。
  (1) operation が multipart content-type を宣言していても注入パートが
  server から見えないこと、(2) header field で宣言した場合も同じで、他の
  パラメータ（`charset`）が残り content-type header が重複しないこと、
  (3) `boundary` 無しの `multipart/form-data` に境界が付くこと、
  (4) 非 multipart の宣言 content-type は不変であること。
  テスト側の境界読み取りも、パラメータ順・引用符・header 名の大小に依存しない
  `multipartBoundary()` に置き換えた。
- `issues/README.md`: ISSUE-021 を Done の `[x]` へ移動（Open は `_None._`）。
- 英日 IMPLEMENTATION と ISSUE-021 の `## Status` に本契約を追記。

## 検証結果・再現手順

```bash
npm test   # 127 passed / 0 failed / 0 skipped （反復 1 は 123）
git diff --stat origin/main -- package.json package-lock.json   # 出力なし＝依存追加なし
```

Judge の再現ケース（`request.contentType` 明示）を修正後コードで実行:

```bash
node --input-type=module -e "
import { buildRequestPreview, MULTIPART_BOUNDARY } from './src/index.js';
const op = { id:'u', groupId:'b', request:{ method:'POST', url:'/api/upload',
  contentType: \`multipart/form-data; boundary=\${MULTIPART_BOUNDARY}\`, body:{kind:'multipart'} },
  fields:[{id:'note',name:'note',type:'text',placement:'body'},
          {id:'role',name:'role',type:'text',placement:'body',defaultValue:'user'}] };
const forged = 'x\r\n--' + MULTIPART_BOUNDARY + '\r\nContent-Disposition: form-data; name=\"role\"\r\n\r\nadmin';
const p = buildRequestPreview(op, { note: forged });
const b = /boundary=(.*)\$/.exec(p.headers['content-type'])[1];
console.log(p.headers['content-type']);
console.log(p.bodyText.split('--'+b).slice(1,-1).map(c=>/name=\"([^\"]*)\"/.exec(c)[1]));
"
# => multipart/form-data; boundary=----OpaDeckFormBoundary7MA4YWxkTrZu0gW1
# => [ 'note', 'role' ]   （注入された role=admin は note の値の内側に留まる）
```

## 次の判断・残る不確実性

- codex 由来の #38〜#42 は本 PR に混ぜない。独立した小さく可逆な単位として
  次反復以降に扱う。
- 残る不確実性: 実 parser ではなくテスト内 parser（advertise された境界で分割）
  での検証である点は反復 1 から変わらない。
- merge と #36 close は Judge の accept 後に Finalizer のみが行う。反転方法は
  反復 1 と同じ（merge commit の `git revert -m 1`、#36 reopen）。

## 反復 3/3（Judge 差し戻しへの対応）

### 観測事実

独立 Judge が反復 2 の残存経路を再現した。`request.contentType` と
**大小が異なる `Content-Type` header field を同時に持つ** operation では、
`buildHeadersAndBody` が `headers['content-type']` を無条件に追加するため
content-type が 2 本になる。`forceMultipartBoundary` は最初に見つけた 1 本しか
書き換えないので、もう 1 本は**エスカレーション前の境界を advertise したまま**残る:

```
Content-Type: multipart/form-data; boundary=----...gW1   ← body と一致
content-type: multipart/form-data; boundary=----...gW    ← 古い境界
```

curl は同名 header を大小を無視して**後勝ちで置換**するため、生成された curl は
`...gW` を送り、`role=admin` の注入が成立する。fetch の `Headers` は 2 値を
カンマ連結するので境界が不定になる。

### 仮説

content-type だけを特別扱いするのではなく、**header の書き込み自体を
「大小を無視して既存キーを置換する」** に変えれば、経路（`request.contentType` /
header field / 推論 / `accept`）に関わらず重複が構造的に発生しなくなる。

### 実施内容

- `setHeader(headers, name, value)` を追加。大小を無視して既存キーを探し、
  見つかればそのキーの**表記を保ったまま**値を置換する。header field ループ・
  `accept`・`content-type`（宣言・推論の両方）をこの setter 経由にした。
  - 表記を保つのは、operator が入力した `Content-Type` の見た目を preview と
    curl で変えないため。既存テスト（header field 単独ケース）もこれで不変。
  - 優先順位は従来と同じ「後の書き込みが勝つ」＝ `request.contentType` が
    header field を上書きする。大小が一致する場合の従来挙動と同じなので、
    大小違いのケースだけが揃った形になる（可逆・驚きが小さい）。
  - 代案「content-type のときだけ重複を削除する」は、`accept` や任意の header
    で同じ不整合が残るため不採用。
- 回帰テスト 2 件を追加:
  (1) `request.contentType` と大小違いの `Content-Type` header field が併存する
      multipart で、content-type header が 1 本だけになり、**生成された curl を
      curl の後勝ち規則で読み直して**分割しても注入パートが見えないこと。
  (2) 大小だけ異なる 2 つの header field が最後の 1 本に collapse すること。
- 英日 IMPLEMENTATION に「header 名は大小無視で 1 本」の契約を追記。

### 検証結果

```bash
npm test   # 129 passed / 0 failed / 0 skipped （反復 2 は 127）
git diff --stat origin/main -- package.json package-lock.json   # 出力なし＝依存追加なし
```

修正を一時的に戻して新テストが落ちることも確認した（fail 2 / pass 17 → fail 0 / pass 19）:

```bash
cp src/runtime/request-builder.js /tmp/rb.keep
sed -i "s|      setHeader(headers, 'content-type', request.contentType);|      headers['content-type'] = request.contentType;|" src/runtime/request-builder.js
sed -i "s|      setHeader(headers, serializedKey(field), String(value));|      headers[serializedKey(field)] = String(value);|" src/runtime/request-builder.js
node --test tests/request-builder.test.js   # not ok 18, not ok 19
cp /tmp/rb.keep src/runtime/request-builder.js
```

新テスト (1) は preview.headers ではなく **`preview.curl` を再パースして** curl が
実際に送る header と body を復元するため、「header が 1 本」という前提自体を
テストが仮定していない。

### 次の判断・残る不確実性

- 残る不確実性: 検証は実 HTTP server ではなくテスト内 parser（advertise された
  境界で分割 / curl の後勝ち規則を適用）である点。反復 1・2 と同じ限界。
- codex 由来の #38〜#42 は本 PR に混ぜていない。
- merge と #36 close は Judge の accept 後に Finalizer のみが行う。
