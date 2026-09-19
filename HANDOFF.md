# OpaDeck Handoff

Last updated: 2026-09-20 (JST)

## Repository

- GitHub: https://github.com/opaopa6969/OpaDeck
- Default branch: `main`
- Workflow: short-lived `fix/issue-N-*` or `docs/*` branches, PR per change,
  merged via `gh pr merge --merge --delete-branch` after independent review.

## What exists

- Core docs in English and Japanese (`docs/en/*`, `docs/ja/*`).
- A narrowed **closed core** (`src/core/`): App / Group / Operation / Request /
  Field / DataSource / Problem only. Layout / help / tour / geoScene live in
  companion validators (`src/layout`, `src/help`, `src/geo`) composed by
  `validateApp()` in `src/validate.js` — see `docs/en/CORE_MODEL.md` and
  `issues/ISSUE-010-*.md` for the narrowing history.
- Runtime: typed bus, clock (+ manual test clock), scheduler, selection store,
  execution store (with per-record `remove` and history accumulation), request
  builder, HTTP executor, service aggregation.
- Typed registries plus a builtin browser renderer set (field / result / panel)
  and a data-driven `geoScene` renderer with a Japan tile-cartogram preset.
- A narrow `.opsui` DSL loader (tokenizer + parser + compile-time validation),
  including `fieldset` + `include` compile-time field fragments.
- A registry-driven tour command runtime with a default overlay.
- Showcase app wired onto the shared runtime, builtin result rendering, the
  shared tour runtime, and a live Japan geoScene.
- See `docs/en/IMPLEMENTATION.md` for the detailed status snapshot and
  `issues/README.md` / `issues/ISSUE-*.md` for the per-issue history.

## Issues

Each `issues/ISSUE-00N-*.md` carries its own `## Status` footer with the
resolving commit or PR. As of this update there are no open GitHub issues and
no open PRs (`gh issue list --state open`, `gh pr list --state open`); recent
work has landed as small `fix/issue-N-*` PRs merged individually (see
`git log --oneline` for the current list, most recently PRs up to #51).

## Environment notes (this machine)

- Node.js 18+ is required; the repo ships `.nvmrc` (22); this workspace has
  been exercised with Node v20.20.0 as well.
- `git push` / `gh` work normally: `gh auth status` shows an authenticated
  `opaopa6969` session with `repo` scope.
- `python3 scripts/serve.py` can bind a socket and serve the showcase.

## Verification status

- `npm test` (`node --test`): **149 tests passing**, 0 failing.
- Showcase served over HTTP and the static module graph loads (200s).
- Browser interaction is covered by a manual smoke-test checklist in
  `docs/en/IMPLEMENTATION.md` plus an automated headless smoke harness
  (`npm run test:browser`, `scripts/browser-smoke.mjs`).

## Recommended next steps

1. Wire `execution-store.remove` / `resultStack` `limit` into
   `showcase/app.js` per `issues/ISSUE-010-*.md` follow-up #2
   (`options { accumulate false }` convention).
2. Decide whether to port the remaining vacant-service groups in
   `examples/vacant-ops.opsui` (follow-up #3 in the same issue) or treat the
   5-group sample as sufficient coverage.
3. Document `fieldset` / `include` in `docs/*/DSL.md` and result
   accumulation/dismiss in `docs/*/COMPONENTS.md` (follow-up #4).
