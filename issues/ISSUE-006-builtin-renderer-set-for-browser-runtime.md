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
