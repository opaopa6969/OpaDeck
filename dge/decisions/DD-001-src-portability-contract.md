# DD-001: `src/**` の可搬性を契約として成文化し、機械で検査する

- 日付: 2026-09-05 (JST)
- 起点セッション: `dge/sessions/2026-09-05-src-portability.md`
- 対応 Gap: GAP-01 (Critical) / GAP-02 (High) / GAP-05 (Medium) / GAP-06 (Medium)
- 状態: 採択

## 決定

**`src/**` は OpaDeck の配布物であり、module specifier はすべて相対でなければ
ならない。この規則をテストで機械的に強制する。**

当初案では `node:` 組み込みも許容する予定だったが、実装時の独立検査で
`src/**` は現在 `node:` を **1 つも import していない**（ブラウザで直接実行可能な構成）
ことが確認できたため、契約を「相対のみ」へ強めた。`node:fs` の import は
bare specifier とまったく同じようにブラウザでのロードを壊すので、
許容する理由が無い。

規則の適用範囲は `src/**` のみ。`tests/**` / `scripts/**` / `showcase/**` は
この repo の中でしか動かない開発物であり、外部依存を自由に使ってよい。

## 背景（何が壊れていたか）

`a0e7365` "refactor: migrate numeric utilities to kazu v1"（PR #20, 3 コミット前）で
`src/geo/japan-preset.js` に `import { clamp01 } from 'kazu'` が入った。
`kazu` は `git+https://github.com/opaopa6969/kazu.git#v1.0.0` を指す
**private repository** である（`gh repo view opaopa6969/kazu` → `"isPrivate": true`）。

結果として、以下がすべて成立しなくなった。

| 壊れたもの | 症状 |
|---|---|
| `npm test` | `ERR_MODULE_NOT_FOUND: Cannot find package 'kazu'` で全ファイル失敗 |
| `npm install` | git 依存を禁じた環境で `npm error code EALLOWGIT` |
| vendoring（docs が指示する取り込み方法） | コピーした `src/*` に解決不能な bare specifier が同梱される |
| ブラウザ直接ロード | bare specifier は import map なしで解決できずモジュールロード時に失敗 |
| showcase | 逃げ道として import map を追加。利用者側 HTML への import map 記述と `/node_modules` 配信を暗黙に要求 |
| CI | コードと無関係に private repo への認証情報が必要 |

対価は `clamp01` 1 関数・1 呼び出し箇所のみ。

## 検討した選択肢

### 案 A: `kazu` を公開 registry へ publish して依存を維持
**却下。** 本 repo の権限外（外部公開範囲の変更）であり、instruction 9 の
「公開範囲変更はしない」に該当する。また publish しても bare specifier が
ブラウザで解決できない問題（import map 要求）は残る。

### 案 B: `src/` に kazu を vendoring（`src/vendor/kazu.js`）
**却下。** 1 関数のためにベンダリング層を作るのは単純化役の反対に合う。
上流更新の追随責任も生まれる。抽象化のためだけの構造は入れない。

### 案 C: import map をライブラリの前提として docs に明記
**却下。** 「依存なしで持ち出せる」という OpaDeck 最外周の価値を放棄する。
利用者の配信レイアウトにライブラリが干渉し続ける。

### 案 D（採択）: `clamp01` を `src/` 内に戻し、`kazu` 依存を外し、規則をテストで固定する
最小・安全・可逆。公開 API の signature は 1 つも変わらない。

## 挙動の扱い（重要）

`clamp01` の意味は kazu 移行で変わっている。

- 移行前（OpaDeck 内製）: `Number.isFinite(value)` でない入力 → `0`
- 移行後（kazu v1）: `x < lo ? lo : x > hi ? hi : x` → `NaN` は `NaN` のまま伝播

移行コミットは `tests/geo-scene.test.js` に
`assert.ok(Number.isNaN(baseMap.project(NaN, 35.68).x), 'canonical clamp01 propagates NaN')`
を追加し、NaN 伝播を**仕様として固定した**。

本決定は**場所だけを直し、振る舞いは変えない**。repo 内に戻す `clamp01` は
kazu v1 と同一挙動とし、既存アサーションを無修正で通す。
非有限座標が運用者に問題として届かない件（GAP-04）は別 issue とする。

## 憲法への追加

憲法の原則は 7 つあり、そのいずれも**配布形態**に触れていなかった。
最外周の約束が成文化されていなかったことが、この regression が review を
通過した根本原因である。原則 4「convention より validation」の適用漏れでもある。

原則 8「配布可能性は契約である（Portability is a contract）」を en / ja 双方に追加する。

## tramli / tramli-appspec の採否

**不採用。**

| 判定軸 | 該当 | 根拠 |
|---|---|---|
| human-in-the-loop | なし | 本件は import 解決の静的検査であり承認点が無い |
| 長期状態 | なし | `ExecutionStore` はプロセス内リングバッファ。永続状態を持たない |
| 補償 | なし | 補償対象のトランザクションが無い。取り消しは `git revert` |
| 外部 event | なし | `createRuntimeBus` はプロセス内。外部 event source が無い |
| requires / produces 契約 | なし | フロー間の成果物受け渡しではなく単一 repo 内の import 規則 |

加えて決定的な理由として、tramli は Java / TypeScript / Rust の外部フローエンジンであり、
tramli-appspec は Java の MCP サーバ（`https://appspec.unlaxer.org`、min_role MEMBER、
カタログ上 `enabled: false`）である。本決定の目的は
**`src/**` から外部依存を排除すること**であり、そこに外部エンジンを導入するのは
自己矛盾である。抽象化のためだけには導入しない。

tramli-appspec の公開 API との差分確認は、本件が namespace `appspec` の tool を
1 つも呼ばず、進行中成果に一切依存しないため不要と判断した。

## 可逆性

- 変更はすべて「削除」または「加算」で、公開 API の signature 変更なし
- kazu へ戻す場合は `git revert <merge commit>` 一発
- revert 時に失敗するのは新規 `tests/portability.test.js` のみで、
  これは「戻すと配布契約が破れる」ことを正しく報告している

## 保留した Gap（別 issue 候補）

- **GAP-03 (High)**: header field（＝認証トークン）が curl プレビュー・実行履歴・
  画面・docs スクリーンショットに平文露出。`secret` の概念が型にも DSL にも無い
- **GAP-04 (Medium)**: geo 座標の非有限値が問題として運用者に届かない
- **GAP-07 (Medium)**: `createWorkbench` が executor の `signal` を配線しておらず
  実行を UI から中断できない
