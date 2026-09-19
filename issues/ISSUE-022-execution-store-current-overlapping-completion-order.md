# ISSUE-022: `current()` Drops An Earlier Still-Running Execution Once A Later One Finishes

GitHub: #57

## Summary

`createExecutionStore().current()` tracked "the current execution" via a
single `lastBegunId` field that was only ever written in `begin()`. When two
executions overlap and the one started *later* finishes *first*, `current()`
incorrectly reported `null` even though an earlier-started execution was
still running.

## Reproduction

1. `store.begin({...})` → A starts, becomes "current".
2. `store.begin({...})` → B starts, becomes "current" (A is still running).
3. `store.succeed(b.id, ...)` → B finishes and is removed from the running set.
4. `store.current()` → returned `null`, even though A is still running.

`src/app/workbench.js` renders `executions.current()` as the in-flight card,
so this made an in-progress execution silently disappear from the UI as soon
as a later-started sibling execution completed.

## Acceptance criteria

- `current()` returns the most recently begun execution that is still
  running, not just whichever one was begun last overall.
- Regression test covers the reversed-completion-order case.
- `npm test` passes without adding dependencies.

## Scope

Keep the change within `src/runtime/execution-store.js` and its tests. No
dependency, runtime API surface, or data migration is needed.

## Status

Done on `main` (GitHub #57, merged via PR #58, resolving commit `77add65`).

- `src/runtime/execution-store.js`: `currentRecord()` now derives "current"
  from the insertion-ordered `running` Map (the last surviving entry) instead
  of a single `lastBegunId` pointer, so it stays correct regardless of
  completion order.
- `tests/runtime.test.js` adds a regression test for the reversed-completion
  overlap case.
