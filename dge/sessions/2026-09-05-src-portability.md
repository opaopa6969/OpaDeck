# DGE セッション: OpaDeck の配布契約と「体感できる価値」

- 日付: 2026-09-05 (JST)
- テーマ: 利用者・運用者が体感できる非自明な設計 Gap を発見し、1 つを最小・安全・可逆に実装する
- 対象 revision: `1af1409` (main)
- 手法: DxE 方法論による対話劇。volta MCP の `dxe` namespace を展開し
  `dxe__list_patterns` のプリセットを採用（`security-adversary` / `role-contrast` /
  `cross-persona-conflict` / `before-after` / `migration-path`）。
  `dxe__recommend_characters` と `dxe__record_session` は
  バックエンドが `DGE DB not found` を返したため、キャラクターは本ファイルで定義し、
  記録は repo 内 `dge/` に置く（instruction 2 のフォールバック手順）。

## 登場人物

| 記号 | 役 | 立場 |
|---|---|---|
| 簡 | 単純化役 | 「その抽象は要るのか」「一番小さい形は何か」を問う |
| 疑 | 前提を疑う役 | ドキュメントの主張と実物の一致を疑う |
| 実 | 実利用者 | OpaDeck を vendoring して社内ツールを作る開発者 |
| 運 | 運用者 | 社内 ops 担当・CI 管理者。手元と CI で動くことに責任を持つ |
| 専 | テーマ専門家 | ESM 配布・パッケージング・ブラウザ module 解決の専門家 |

---

## 幕1: 「依存なし」という主張を疑う（pattern: before-after）

**疑**: `docs/en/USING-OPADECK.md` の冒頭にこう書いてある。
「OpaDeck は依存なしの素の ESM で、CSS も同梱しない」。取り込み方は
「`src/*` をそのまま import する（npm 未公開なので vendoring か submodule）」。
README も「no dependency install is needed」と言う。これは今も本当か。

**運**: 本当じゃない。今この repo を clone して `npm test` を打つと落ちる。

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'kazu'
  imported from src/geo/japan-preset.js
```

**簡**: `npm install` すれば済む話では。

**運**: 済まない。

```
npm error code EALLOWGIT
npm error Refusing to fetch "kazu@git+https://github.com/opaopa6969/kazu.git#..."
```

git 依存を禁じた環境（社内 registry proxy、多くの CI の既定、この作業環境）では
install そのものが通らない。しかも `gh repo view opaopa6969/kazu` は
`"isPrivate": true` を返す。**private repo への依存**だ。

**専**: つまり OpaDeck は今、`opaopa6969/kazu` への読み取り権限を持たない人間には
**一行も動かない**。3 コミット前（`a0e7365` "refactor: migrate numeric utilities to kazu v1"）
までは、clone して `node --test` を打つだけで 71 本通っていた。

**疑**: では「依存なし」は主張ではなく、破れた契約だ。

---

## 幕2: 誰が最初に転ぶか（pattern: role-contrast）

**実**: 私が一番早く転ぶ。ドキュメントが指示するとおり `src/*` を自分の repo に
vendoring する。コピーした瞬間に `import { clamp01 } from 'kazu'` が付いてくる。
これはブラウザでは bare specifier だから、import map なしでは解決できない。
私のアプリは**モジュールのロード時点で死ぬ**。エラーは私の repo に出るのに、
原因は私が読んでいないファイルにある。

**専**: しかも解決策が利用者側に漏れている。showcase は自分で逃げ道を作った。

```html
<script type="importmap">{"imports":{"kazu":"/node_modules/kazu/index.js"}}</script>
```

これは「OpaDeck を使う全ての HTML に import map を書け、かつ `/node_modules` を
配信せよ」という要求だ。`scripts/serve.py` が repo root を配ってくれる showcase では
成立するが、ビルド済み静的サイトや別 origin の配信では成立しない。
ライブラリが host の配信レイアウトに口を出している。

**運**: 私は CI で転ぶ。`npm test` を回す job が、コードの中身と無関係に
GitHub の private repo 認証情報を必要とするようになった。CI に
デプロイキーを配る話になる。テストを 1 本も足していないのに、だ。

**簡**: 対価は何だ。この依存が repo に入れている価値は何行分だ。

**疑**: 1 箇所、1 関数。`src/geo/japan-preset.js` の `clamp01` だけだ。
移行コミットの diff はこうだった。

```diff
+import { clamp01 } from 'kazu';
...
-function clamp01(value) {
-  if (!Number.isFinite(value)) return 0;
-  if (value < 0) return 0;
-  if (value > 1) return 1;
-  return value;
-}
```

**簡**: 5 行の数値ユーティリティと引き換えに、private repo への
実行時依存と、全利用者への import map 要求と、CI の認証要求を買った。
これは割に合わない取引だ。

---

## 幕3: 反論 —— 共通化そのものは正しい（pattern: cross-persona-conflict）

**専**: 待った。kazu への集約を「間違い」と切って捨てるのは乱暴だ。
`clamp01` の重複実装が複数 repo に散るほうが長期的には高くつく。
`a0e7365` はその整理の wave3 で、意図がある。

**疑**: 同意する。争点は「共通化するか」ではない。
**共通化したコードが置かれてよい場所はどこか**だ。
OpaDeck には 2 種類のコードがある。

- `src/**` = 利用者の環境で、利用者のブラウザが、そのまま読むコード（配布物）
- `tests/**` `scripts/**` `showcase/**` = この repo の中でしか動かないコード（開発物）

kazu を後者で使うのは何の問題もない。前者に入れた瞬間だけ契約が壊れる。

**実**: それなら私は文句がない。私が受け取るのは `src/**` だけだから。

**簡**: では規則は 1 行で書ける。
**`src/**` は相対 import と `node:` 組み込み以外を import しない。**

**専**: それが「vendorable ESM」の実体的な定義だ。今まで散文でしか書かれていなかった。

**運**: 散文だったから壊れた、という順序だと思う。
`a0e7365` は review を通って merge されている。誰も悪くない。
**契約が機械で検査されていなかった**だけだ。

**疑**: 憲法を見てほしい。原則は 7 つある。Operation first、意味層を先に、
stable id、convention より validation、help は companion、layout も companion、
スコープは狭く。—— **配布形態の原則がひとつも無い**。
OpaDeck の一番外側の約束（依存なしで持ち出せる）が、憲法に書かれていない。

**簡**: 原則 4 が既に答えを言っている。「convention より validation」。
配布契約だけが convention のまま放置されていた。

---

## 幕4: 攻撃者の視点（pattern: security-adversary）

**専**: 供給網の観点でもう一段悪い。bare specifier `'kazu'` は
「解決先を実行環境に委ねる」という意味だ。
利用者が import map を書く、あるいは bundler の resolve に任せる。
その名前を誰が埋めるかを OpaDeck は制御していない。
npm public registry に `kazu` という名前のパッケージが存在すれば、
利用者の環境ではそちらが読まれうる。

**疑**: 実害の確率は低いが、**ライブラリ側で防げる**類の話だ。
`src/**` に外部 specifier が 1 つも無ければ、この面は最初から存在しない。

**運**: 私の関心はもっと即物的だ。今この瞬間、テストが 1 本も走らない。
どんな設計論よりこれが先だ。

---

## 幕5: 他の Gap も並べる（pattern: escalation / 網羅）

**運**: 配布の話ばかりでは偏る。運用の現場で刺さるものも挙げておきたい。
`buildRequestPreview` は `placement: 'header'` の field 値をそのまま
`curl` 文字列に埋める。ops workbench で header field といえば、まず認証トークンだ。
その curl は `createWorkbench` が画面の `<details>` に描き、
`ExecutionStore` が履歴として最大 `historyLimit` 件保持する。
運用者はその curl をチケットや chat に貼る。**資格情報がそのまま流れる。**

**専**: repo 全体を grep しても `secret` / `redact` / `mask` は 1 件も無い。
field type は text / hidden / textarea / checkbox / select / file / json。
機微入力の概念が型にも DSL にも無い。しかも `type text` は素の
`<input type="text">` を描くから、画面共有や、この repo が docs 用に
撮っている**スクリーンショットにも平文で写る**。

**簡**: それは重い。だが今回の 1 件にするには重すぎる。
DSL 文法・validation・field renderer・curl 生成・履歴保持・URL state の
6 箇所に触る。最小・安全・可逆ではない。

**疑**: 分けるべきだ。ただし「見つけた」という事実は残す。
これは次に取るべき最有力候補として記録する。

**専**: 副産物の Gap も 1 つ。kazu 移行で `clamp01` の意味が変わっている。
旧: 非有限入力 → `0`。新（kazu）: `clamp(NaN,0,1)` → `NaN` が伝播する。
移行コミットは `assert.ok(Number.isNaN(baseMap.project(NaN, 35.68).x))` を足して
これを**仕様として固定した**。つまり不正座標の geo layer は、
以前は左上隅に静かに描かれ、今は NaN 属性で静かに消える。
どちらも運用者に問題として届かない。

**簡**: それは今回触らない。今回の変更で意味を**変えない**ことが安全側だ。
`clamp01` を repo 内に戻すときも、kazu と同一の挙動にする。
場所だけを直し、振る舞いは 1 ビットも動かさない。

**運**: 実行キャンセルも無い。`createHttpExecutor` は `callOptions.signal` を
受けられるのに、`createWorkbench` はそれを配線していない。
長い運用オペレーションを止める手段が UI に無い。これも別件。

---

## 幕6: tramli / tramli-appspec の適合性（pattern: migration-path）

**専**: 指示どおり tramli 系の採否を評価する。カタログはこう言っている。

- `tramli`: "Constrained flow engine — state machines that prevent invalid transitions (Java, TypeScript, Rust)"
- `tramli-appspec`: ApplicationSpec の検証・YAML/JSON 出力・プレビュー・パイプライン実行を提供する **Java** の MCP サーバ（`https://appspec.unlaxer.org`, min_role MEMBER, カタログ上 `enabled: false`）

判定軸で見る。

| 判定軸 | 本件に必要か | 根拠 |
|---|---|---|
| human-in-the-loop | 不要 | 今回の変更は import 解決の静的検査。承認点が無い |
| 長期状態 | 不要 | 実行履歴はプロセス内のリングバッファ。永続状態を持たない |
| 補償 | 不要 | 補償対象のトランザクションが無い。revert は `git revert` 一発 |
| 外部 event | 不要 | `createRuntimeBus` はプロセス内。外部 event source が無い |
| requires/produces 契約 | 不要 | フロー間の成果物受け渡しではなく、単一 repo 内の import 規則 |

**疑**: さらに決定的な理由がある。今回採用する Gap は
「`src/**` に外部依存を持ち込まないこと」そのものだ。
そこに tramli（Java/TS/Rust の実行エンジン）を導入すれば、
**修正しようとしている病そのものを重症化させる**。

**簡**: 抽象化のためだけの導入はしない。**不採用**。
tramli-appspec の公開 API 差分確認も、依存しない以上は不要
（namespace `appspec` はカタログ上 `enabled: false`、min_role MEMBER。
本件は同 namespace の tool を 1 つも呼ばない）。

---

## 幕7: 実装形（pattern: 最小・安全・可逆）

**簡**: 最小形を確定させる。

1. `src/geo/japan-preset.js` の `clamp01` を repo 内の private function に戻す。
   **kazu v1 と同一挙動**（`x < lo ? lo : x > hi ? hi : x`、NaN 伝播）にする。
   既存テスト `canonical clamp01 propagates NaN` は無修正で通る。
2. `package.json` / `package-lock.json` から `dependencies.kazu` を外す。
   `npm install` が git 依存なしで通るようになる。
3. `showcase/index.html` / `components.html` の import map を消す。
   host に `/node_modules` 配信を要求しなくなる。
4. **契約を機械で検査する**。`tests/portability.test.js` を追加し、
   `src/**` の全 `import` / `export ... from` / 動的 `import()` を走査して、
   相対 specifier と `node:` 以外を検出したら失敗させる。
   既存 `tests/core-boundary.test.js` の「不変条件をテストで固定する」様式に揃える。
5. 憲法に原則 8「配布可能性は契約である」を追加（en / ja）。
   README と USING-OPADECK の記述を実物と一致させる。

**運**: 4 が本体だ。1〜3 は今日の傷の手当てで、4 が明日の再発を止める。

**実**: 5 も要る。私は憲法を読んで「持ち出してよい」と判断する。
そこに書いてなければ、次の wave4 でまた同じことが起きる。

**専**: 可逆性は完全だ。全部が加算的か削除で、公開 API の signature は
1 つも変わらない。kazu へ戻したくなれば `git revert` 一発で戻る。
戻したときに落ちるのは新しい `portability.test.js` だけで、
それは「戻すと契約が破れる」ことを正しく報告している。

**簡**: 採用。

---

## Gap 一覧

| ID | Gap | Observe / Suggest / Act | Category | Severity | 判定 | 理由 |
|---|---|---|---|---|---|---|
| GAP-01 | `src/geo/japan-preset.js` が private repo `opaopa6969/kazu` への bare specifier を持ち、vendoring 利用者・ブラウザ・git 依存禁止環境で解決できない | **Act** | 配布契約 / 可搬性 | **Critical** | **採用** | 権限の無い利用者・CI では OpaDeck が一切動かない。実際に本作業環境で `npm test` が全落ちしている |
| GAP-02 | 「依存なしの vendorable ESM」という最外周の契約が散文にしか無く、憲法にも機械検査にも存在しない | **Act** | 契約の成文化 / 検査 | **High** | **採用** | GAP-01 が review を通過した根本原因。憲法原則 4「convention より validation」の適用漏れ。GAP-01 と同一実装単位 |
| GAP-03 | header field の値（＝多くの場合 auth token）が curl プレビュー・実行履歴・画面・docs スクショに平文露出。`secret` の概念が型にも DSL にも無い | **Suggest** | セキュリティ / 運用 | **High** | **保留** | 価値は高いが DSL・validation・field renderer・curl・履歴・URL state の 6 箇所に及び、最小・安全・可逆に収まらない。次の最有力候補として別 issue 化を推奨 |
| GAP-04 | kazu 移行で `clamp01` の非有限入力の意味が `0` → `NaN` 伝播に変化。不正座標の geo layer が旧は左上隅に誤描画、新は無言で消滅。どちらも問題として運用者に届かない | **Observe** | 正当性 / 可観測性 | **Medium** | **保留** | 今回は挙動を 1 ビットも変えないことが安全側。geo 座標の不正値を `problem` として上げる設計は別途 |
| GAP-05 | README「no dependency install is needed」/ USING-OPADECK「依存なしの素の ESM」が実物と矛盾（doc drift） | **Act** | ドキュメント整合 | **Medium** | **採用** | GAP-01 の修正で記述が再び真になる。真になったことを明記する |
| GAP-06 | showcase の import map が「利用者側 HTML に import map を書き `/node_modules` を配信する」ことを暗黙要求している | **Act** | 配布契約 | **Medium** | **採用** | GAP-01 の修正で不要になり削除できる。ライブラリが host の配信レイアウトに干渉しなくなる |
| GAP-07 | `createHttpExecutor` は `signal` を受けられるのに `createWorkbench` が配線しておらず、長時間オペレーションを UI から中断できない | **Suggest** | 運用 UX | **Medium** | **保留** | 独立した価値。今回のスコープ外 |
| GAP-08 | tramli / tramli-appspec の採否 | **Observe** | アーキテクチャ | — | **不採用** | human-in-the-loop / 長期状態 / 補償 / 外部 event / requires-produces のいずれも該当せず。加えて tramli は Java/TS/Rust の外部エンジンであり、`src/**` から外部依存を排除するという本件の目的に真正面から反する。抽象化のためだけには導入しない |

## 採用

**GAP-01 + GAP-02（+ 従属する GAP-05 / GAP-06）** を 1 つの実装単位として採用する。

設計判断は `dge/decisions/DD-001-src-portability-contract.md`、
実装仕様は `dge/specs/SPEC-001-src-portability-contract.md` に記録する。
