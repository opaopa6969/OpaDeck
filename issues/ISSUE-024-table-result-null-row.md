# ISSUE-024: tableResult Renderer Throws On A Null/Non-Object Row

GitHub: #62

## Summary

The `tableResult` result renderer (`src/renderers/result-renderers.js`)
dereferenced each row with `row[col]` without checking that the row is a
plain object first. `canRender` only checks that the top-level value
resolved by `resolveRows()` is an `Array` — it never checks each element.
Any response whose JSON body is an array mixing object rows with
`null`/primitive entries (a real possibility from an upstream API, not just
malformed input) hit an uncaught `TypeError` deep inside `render()`, taking
down the whole result panel instead of degrading gracefully.

This is the same bug class already fixed six times in validators
(`isPlainObject` guards) and once in the tour runtime
(`issues/ISSUE-023-tour-runtime-null-step.md`, GitHub #59) — this render path
was missed because null-checking was only applied at validation time, not at
render time, and `tableResult` sits entirely outside `validateApp()`'s scope
(it renders live response data, not authored DSL content).

## Reproduction

```js
import { createBuiltinResultRenderers } from './src/index.js';

const renderer = createBuiltinResultRenderers().find((r) => r.id === 'tableResult');
renderer.render({ document, bodyJson: [null, { id: 1 }] });
// threw: Cannot read properties of null (reading 'id')
```

## Acceptance criteria

- Rendering a `tableResult` table whose rows array contains `null` or a
  non-object primitive does not throw; such a row renders as an empty row
  (blank cells) instead of crashing the whole result panel.
- Regression test in `tests/renderers.test.js` covers a rows array mixing
  `null`, a string, a number, and a well-formed object.
- `npm test` passes without adding dependencies.

## Scope

Kept the change within `src/renderers/result-renderers.js`'s `tableResult`
cell-value lookup (`row && typeof row === 'object' ? row[col] : undefined`,
reusing the existing `formatCell()` helper which already renders `undefined`
as an empty string) and its test. No dependency, runtime API surface, or
data migration change was needed.

## Status

Done on `main` (GitHub #62, resolving commit TBD after merge).

- `src/renderers/result-renderers.js`: `tableResult.render` now guards the
  per-cell lookup so a non-object row degrades to blank cells instead of
  throwing.
- `tests/renderers.test.js` adds `tableResult tolerates null/non-object rows
  mixed with object rows`, asserting no throw, correct inferred columns from
  the valid row only, and blank cells for the non-object rows.
