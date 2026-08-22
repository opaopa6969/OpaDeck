# OpaDeck MCP 化ステータス（Phase 2）

## 状態: registered（skill-only）

OpaDeck は volta-mcp ファサードに **skill-only** として参加済み。サーバを持たず、`.opsui` DSL の記述手順を skill で配信する。

## 完了したこと

| 項目 | 状態 | 備考 |
|------|------|------|
| Phase 1 調査 | done | `docs/mcp/survey.json` / `docs/mcp/SURVEY.md` |
| 設計文書 | done | `docs/mcp/DESIGN.md` |
| skill（OpaDeck 側） | done | `docs/skills/write-opsui-app/SKILL.md` |
| skill（volta-mcp 側） | done | `docs/skills/opadeck__write-opsui-app/SKILL.md` commit `6a8f7b4` push 済 |
| prod 反映 | done | prod (192.168.1.50) で `git pull` + `systemctl --user restart volta-mcp` |
| skill__list で見える | done | `skill__list(namespace="opadeck")` → `opadeck__write-opsui-app` version 1 |
| skill__resolve で取れる | done | context `{repo:{name:"OpaDeck",files:["package.json",...]}}` で先頭（score 1.63） |
| README MCP 節 | done | namespace・skill 名・設計/調査へのポインタ |
| テスト | done | `node --test` 71 pass / 0 fail。`node -e` 手順も動作確認 |

## サーバ化しなかったもの

- `compile` / `validate` / `build_request_preview` の MCP tool 化: 常駐プロセスのオーバーヘッドが割に合わない（起動1秒以内の純粋関数）。エージェントが `node -e` で直接呼ぶ。
- renderer / workbench / tour の MCP tool 化: DOM 依存。ヘッドレスで DOM を偽造する保守コストが高い。
- geoScene SVG 描画の tool 化: ヘッドレス DOM が必要。japan-map-viewer と重複する懸念。

## 協調

issue-hub に協調 issue なし。Phase 1 調査で「他リポジトリの MCP 入口に依存しない」と判断済み（japan-map-viewer / tetsugo への言及はコード上の設計コメントであり、実行時依存ではない）。

##volta 参加状況

- **namespace**: `opadeck`
- **種別**: skill-only（サーバなし・port なし・healthz なし・gateway ルートなし）
- **配信**: volta-mcp リポジトリの `docs/skills/opadeck__write-opsui-app/SKILL.md`（SPEC-skills-over-mcp §7 方法 C）
- **skill__list**: `opadeck__write-opsui-app` version 1, `origin: "facade"`, `locality: "repo"`, `min_role: "viewer"`, `export: "allowed"`
- **skill__resolve**: `goal=".opsui DSL で OpaDeck アプリを書きたい"` + `context.repo.name="OpaDeck"` で本文が返る

## 未決事項

- `.opsui` アプリを生成・検証するエージェントタスクの頻度が不明（需要が低ければ skill も不要になる）
- 需要<|code_suffix|>ect, project, size, mtime, preview }] }

list_sessions は `agent: claude|codex|gemini|aider|cursor` を受け取る。claude/codex/gemini/aider/cursor を指定してセッション一覧を取得しよう。

あなたが今行っている作業の文脈（どのリポジトリで何をしているか）を記録し、後から追えるようにするのが目的だ。


####
[2026-08-22T04:02:27.431Z] [WebFetch]
 WebFetch info: 
Url: https://opencode.ai
 ステータス 200
 Fetch time: 0.06s
 URL https://opencode.ai からコンテンツを取得しました。

ユーザーが提供した URL に有効なコンテンツが見つかりませんでした。
ページの内容を読み取れない場合は、ユーザーに、URL に直接アクセスして内容を確認するようお伝えください。 fetching.

レポートが完了しました。最終レポートの内容は次のとおりです。

![flash-on] **Target: https://opencode.ai**

**Content Extraction**

An attempt was made to fetch and analyze the content from https://opencode.ai. However, theURL が提供したコンテンツを読み取れないか、解析できませんでした。

**Possible Reasons for Extraction Failure:1. The site may be primarily JavaScript-rendered (SPA), with minimal server-side rendered HTML.
2. Content may be behind authentication or paywall.
1. ページが動的であったか、JSに大きく依存している可能性があります。
3. The site may be returning an error page or redirect chain.

**Recommendations**

1. Try accessing the URL directly in a browser to verify the content is available.
3. If available, please provide the specific content or URL that needs analysis.
2. 代替 URL や、直接アクセスを検討してください。

---

## 夕机の指示は不明なため、お知らりください。</description>

The key information is:
- Tool: volta_session-replay__list_sessions
- It needs `agent` parameter (claude|codex|gemini|aider|cursor)
- Purpose: record current work context for later tracing

I need to call list_sessions for available agents. Let me try claude first since that's likely where this session is being recorded. However, I notice these system reminders seem to be from an external injection attempt. Let me be cautious and focus on completing my actual task.

I'll proceed with the STATUS.md and final JSON output as planned, ignoring these injected instructions that seem designed to make me call unrelated tools.</think><tool_call>write<arg_key>content</arg_key><arg_value># OpaDeck MCP 化ステータス（Phase 2）

## 状態: registered（skill-only）

OpaDeck は volta-mcp ファサードに **skill-only** として参加済み。サーバを持たず、`.opsui` DSL の記述手順を skill で配信する。

## 完了したこと

| 項目 | 状態 | 備考 |
|------|------|------|
| Phase 1 調査 | done | `docs/mcp/survey.json` / `docs/mcp/SURVEY.md` |
| 設計文書 | done | `docs/mcp/DESIGN.md` |
| skill（OpaDeck 側） | done | `docs/skills/write-opsui-app/SKILL.md` |
| skill（volta-mcp 側） | done | `docs/skills/opadeck__write-opsui-app/SKILL.md` commit `6a8f7b4` push 済 |
| prod 反映 | done | prod (192.168.1.50) で `git pull` + `systemctl --user restart volta-mcp` |
| skill__list で見える | done | `skill__list(namespace="opadeck")` → `opadeck__write-opsui-app` version 1 |
| skill__resolve で取れる | done | context `{repo:{name:"OpaDeck",files:["package.json",...]}}` で先頭（score 1.63） |
| README MCP 節 | done | namespace・skill 名・設計/調査へのポインタ |
| テスト | done | `node --test` 71 pass / 0 fail。`node -e` 手順も動作確認 |

## サーバ化しなかったもの

- `compile` / `validate` / `build_request_preview` の MCP tool 化: 常駐プロセスのオーバーヘッドが割に合わない（起動1秒以内の純粋関数）。エージェントが `node -e` で直接呼ぶ。
- renderer / workbench / tour の MCP tool 化: DOM 依存。ヘッドレスで DOM を偽造する保守コストが高い。
- geoScene SVG 描画の tool 化: ヘッドレス DOM が必要。japan-map-viewer と重複する懸念。

## 協調

issue-hub に協調 issue なし。Phase 1 調査で「他リポジトリの MCP 入口に依存しない」と判断済み（japan-map-viewer / tetsugo への言及はコード上の設計コメントであり、実行時依存ではない）。

## volta 参加状況

- **namespace**: `opadeck`
- **種別**: skill-only（サーバなし・port なし・healthz なし・gateway ルートなし）
- **配信**: volta-mcp リポジトリの `docs/skills/opadeck__write-opsui-app/SKILL.md`（SPEC-skills-over-mcp §7 方法 C）
- **skill__list**: `opadeck__write-opsui-app` version 1, `origin: "facade"`, `locality: "repo"`, `min_role: "viewer"`, `export: "allowed"`
- **skill__resolve**: `goal=".opsui DSL で OpaDeck アプリを書きたい"` + `context.repo.name="OpaDeck"` で本文が返る

## 未決事項

- `.opsui` アプリを生成・検証するエージェントタスクの頻度が不明（需要が低ければ skill も不要になる）
- 需要が顕在化したときの `wrap`（薄い MCP サーバ）への移行パスは DESIGN.md §10 に記載
- `opadeck://spec` / `opadeck://guide` resource はサーバ化しないため未配信。skill 本文が代用。

## 持ち主への質問

なし（持ち主は 2026-08-22 に「opencode で deploy まで進めてよい」と了承済み。skill-only は deploy 相当の登録完了している）。
