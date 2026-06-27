# ISSUE-011: Guided Tour For Feature Explanation

## Background

OpaDeck はすでにツアー基盤を持つ（ISSUE-002: `TourCommandHandlerRegistry` /
`createTourRuntime` / 既定オーバーレイ、`focusOperation` / `focusField` /
`focusPanel` / `submitOperation` / `waitResult` の各ハンドラ）。一方で実アプリ
（vacant-service の OpaDeck 管理コンソール、tetsugo のエラー住所マップ）では、
増えた機能（operation 一覧、フォーム、ライブ request プレビュー、結果カードの
view 切替 = auto/table/cards/raw/map、geoMap パネル、2D/3D 切替、都道府県/市区町村
コロプレス、空き家率の色スケール、全画面）を**初見の人に説明する導線が無い**。

ツアー基盤を使って「各機能をハイライトしながら順に説明する」ガイドツアーを
組めれば、オンボーディングとデモが一気にかっこよくなる。

## Goal

既存のツアーランタイムを土台に、アプリの主要機能を順番にスポットライト＋ナレーション
で解説する「機能説明ツアー」を、宣言的に書けるようにする。

- アプリ作者が `TourSpec`（steps: focus 対象 + ナレーション + 任意のデモ操作）を
  宣言するだけでツアーが回る
- 「ツアー開始」ボタン → オーバーレイがステップごとに対象をスポットライト →
  Next/Back/Close → 完了
- ステップは operation / field / panel / 任意セレクタ要素を対象にできる
- 任意で「デモ実行」（サンプル値で operation を submit して結果を見せる）を挟める

## Scope

- 既存 `createTourRuntime` + 既定オーバーレイの活用（再実装しない）
- 任意 DOM セレクタを focus 対象にできる新ハンドラ（例: `focusSelector`）。
  geoMap パネルや結果カードの view チップ等、operation/field/panel に紐づかない
  要素もハイライトしたいため
- ナレーションのリッチ表示（タイトル + 本文、コード断片可）
- ツアー定義の例を 1 本同梱（showcase もしくは vacant-service コンソール向け）
- ステップ対象が DOM 上に存在しない場合のスキップ/フォールバック

## Out of scope

- ツアーの永続化・進捗保存（「見たことがある」判定）
- 多言語化フレームワーク（本文は呼び出し側が文字列で渡す）
- アプリ固有のツアー内容そのもの（本 issue は基盤＋例まで。各アプリの完全な
  ツアー文面は各アプリ側で）

## Notes / 実装の勘所

- ハンドラは `TourCommandHandlerRegistry`（ISSUE-002）に `register` で追加できる。
  `focusSelector` は `document.querySelector(step.selector)` を解決して
  既定オーバーレイのスポットライト対象に渡す形が素直。
- `data-op-id` / `data-field-id` / `data-panel-id` は既存レンダラが付与済みなので、
  operation/field/panel ターゲットはそのまま使える。geoMap は `data-panel-id` を持つ。
- 結果カードの view チップや 2D/3D セグメントには安定したセレクタ（class）を
  与えると focus しやすい。
- ISSUE-007（DSL に tour ブロック）と合流すると、`.opsui` だけでツアーまで書ける。

## 想定アプリ側の例（vacant-service コンソール）

1. 左 nav（操作一覧）をハイライト「ここから操作を選びます」
2. フォーム + ライブ request プレビュー「入力すると下に実 request と curl が出ます」
3. Run → 結果カード「結果はここに新しい順で積まれます」
4. view チップ（auto/table/cards/raw/map）「同じ結果を表で/カードで/地図で」
5. map view + geoMap「エラー住所を日本地図に種別色分け。全画面・2D/3D・コロプレス」
6. コロプレス select + 色スケール凡例「都道府県/市区町村で空き家率やエラー密度を塗り分け」

## Status

Open（未着手）。基盤は ISSUE-002 で実装済み。
