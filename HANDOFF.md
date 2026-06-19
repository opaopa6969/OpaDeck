# OpaDeck Handoff

Last updated: 2026-06-19 (JST)

## Repository

- GitHub: https://github.com/opaopa6969/OpaDeck
- Default branch: `main`
- Local workspace: `/home/opa/work/OpaDeck`
- Work branch: `feat/issue-batch`

## What exists

- Core docs in English and Japanese (`docs/en/*`, `docs/ja/*`).
- Closed-core helpers: app normalization, structured problems, app validation.
- Runtime: typed bus, clock (+ manual test clock), scheduler, selection store,
  execution store, request builder, HTTP executor, service aggregation.
- Typed registries plus a builtin browser renderer set (field / result / panel)
  and a data-driven `geoScene` renderer with a Japan tile-cartogram preset.
- A narrow `.opsui` DSL loader (tokenizer + parser + compile-time validation).
- A registry-driven tour command runtime with a default overlay.
- Showcase app wired onto the shared runtime, builtin result rendering, the
  shared tour runtime, and a live Japan geoScene.
- See `docs/en/IMPLEMENTATION.md` for the detailed status snapshot.

## Issues — all six implemented on `feat/issue-batch`

- #1 HTTP Executor And Request Preview — done
- #2 Tour Command Runtime And Help Surface — done
- #3 Geo Scene Renderer With Japan Preset — done
- #4 DSL Loader And Compile-Time Normalization — done
- #5 Browser Test Harness And Runtime Verification — done
- #6 Builtin Renderer Set For Browser Runtime — done

Each `issues/ISSUE-00N-*.md` has a `## Status` footer with the resolving commit.

## Environment notes (this machine)

- Node.js 18+ IS available here (nvm has v22 and v24; the default `node` is the
  old v16, which lacks `node --test`). The repo ships `.nvmrc` (22); run
  `nvm use && npm test`, or call a v22/v24 binary directly.
- `git push` works: `gh` is authenticated as `opaopa6969` and the SSH remote is
  reachable. (The previous sandbox could not push and published via the REST
  API; that constraint no longer applies here.)
- `python3 scripts/serve.py` can bind a socket and serve the showcase.

## Divergent main — read before pushing

Local `main` and `origin/main` have **unrelated histories** (no common
ancestor) but **identical trees** — the remote was first populated through the
GitHub REST API as a parallel mirror. The only content difference is a stray
`scripts/__pycache__/serve.cpython-312.pyc` committed on the remote.

Implication: `feat/issue-batch` cannot fast-forward onto `origin/main`.
Reconciling the histories (e.g. force-pushing local `main`) is a destructive
operation and must be an explicit decision.

## Verification status

- `npm test` (Node >= 18): 43 tests passing.
- Showcase served over HTTP and the static module graph loads (200s).
- Browser interaction is covered by a manual smoke-test checklist in
  `docs/en/IMPLEMENTATION.md`; no headless browser harness yet.

## Recommended next steps

1. Decide the publish path for the divergent history (force-push local `main`,
   or open a PR from `feat/issue-batch`).
2. Extend the `.opsui` DSL to layout / help / tour blocks.
3. Add a headless browser harness to automate the showcase smoke test.
4. Grow the renderer set (JsonEditor, inlineSvg, timeSeries) per COMPONENTS.md.
