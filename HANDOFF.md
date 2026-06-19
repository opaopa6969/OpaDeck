# OpaDeck Handoff

Last updated: 2026-06-19 (JST)

## Repository

- GitHub: https://github.com/opaopa6969/OpaDeck
- Default branch: `main`
- Published commit: `9e6636f018575917245021815955a0716c6fb0c7`
- Local workspace: `/tmp/OpaDeck`

## What exists

- Core docs in both English and Japanese:
  - `docs/en/*`
  - `docs/ja/*`
- Runtime skeleton:
  - typed runtime bus
  - clock and scheduler
  - selection store
  - execution store
  - typed registries
  - basic app validation
- Showcase app:
  - feature overview
  - runtime inspector
  - sample validation output
  - guided tour overlay
- Backlog tracked both in-repo and on GitHub:
  - local: `issues/*.md`
  - GitHub issues: `#1` to `#6`

## GitHub Issues

- #1 HTTP Executor And Request Preview
- #2 Tour Command Runtime And Help Surface
- #3 Geo Scene Renderer With Japan Preset
- #4 DSL Loader And Compile-Time Normalization
- #5 Browser Test Harness And Runtime Verification
- #6 Builtin Renderer Set For Browser Runtime

## Important constraints discovered

- Normal `git push` was not usable in this environment.
  - SSH key `id_ed25519_github_opa` authenticated as `opa-caulis`, not `opaopa6969`.
  - `git remote-https` helper is missing from this sandbox, so HTTPS push also fails here.
- Publication to GitHub was done through the GitHub REST API instead of a normal push.
- `node`, `npm`, `bun`, `deno`, and `qjs` were not available here.
- Binding a local HTTP server socket was blocked by the sandbox, so browser-level runtime checks could not be completed here.

## Verification status

- Confirmed local repo is clean on `main`.
- Confirmed GitHub repo exists and `main` was populated.
- Confirmed GitHub issues `#1` to `#6` were created.
- Confirmed `scripts/serve.py` compiles with `python3 -m py_compile`.
- Static tour selector consistency was checked earlier during implementation.

## Recommended next steps

1. Implement the real HTTP execution path and request preview from issue `#1`.
2. Land the tour/help runtime from issue `#2` so the showcase can use framework-native tours.
3. Add the DSL loader and normalization pipeline from issue `#4`.
4. Add browser-based tests once a normal JS runtime is available, per issue `#5`.
5. Decide whether the canonical publish path should be:
   - proper git SSH with the correct `opaopa6969` key, or
   - GitHub CLI / HTTPS with a working `remote-https` helper.

## Notes for the next agent

- The local git remote is currently `origin https://github.com/opaopa6969/OpaDeck.git`.
- If this same sandbox is used again, GitHub API publication may still be the most reliable path.
- If a proper `git push` path is restored later, local history currently contains:
  - `a6ec194 Bootstrap OpaDeck runtime and showcase`
  - `b89391b Add handoff notes`
