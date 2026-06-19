# ISSUE-006: Builtin Renderer Set For Browser Runtime

## Background

The registry model exists, but the actual browser-facing builtin renderer set is still mostly conceptual.

## Goal

Implement the first builtin browser renderer set:

- field renderers
- panel renderers
- result renderers

## Scope

- `text`
- `textarea`
- `checkbox`
- `select`
- `jsonFoldable`
- `tableResult`
- `operationTiles`
- `operationDetail`
- `groupNav`
- `resultStack`

## Acceptance criteria

- a non-trivial app can be rendered without app-local custom renderers
- the showcase can use shared browser renderers instead of hand-written DOM for at least part of its UI
- result rendering is no longer purely illustrative

## Notes

This is the issue that starts turning OpaDeck from a runtime skeleton into a usable framework.

## Status

Resolved on branch `feat/issue-batch` (1dcef6c). Builtin field/result/panel renderer set on a tiny DOM helper, tested via a fake DOM; showcase renders real results through them. See `src/renderers/*`, `tests/renderers.test.js`.
