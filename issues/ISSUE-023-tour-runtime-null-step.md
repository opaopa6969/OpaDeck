# ISSUE-023: Tour Runtime Throws On A Null/Non-Object Step

GitHub: #59

## Summary

`createTourRuntime().play(tour, context)` dereferenced each `tour.steps[i]`
without guarding against a null/non-object entry. `src/help/validate-help.js`
already flags such entries as a `tour-step.invalid` diagnostic (added for
GitHub #49), but that only produces a `ProblemEntry` — it does not remove the
malformed entry from the array. Any caller that plays a `TourSpec` loaded
from JSON/API data (not routed through the `.opsui` compiler, which cannot
produce `null` steps) without first checking `validateApp()`'s problem list
hit an uncaught `TypeError` deep inside `enter()`.

This is the same bug class already fixed in six other places
(`src/core/validate-app.js`, `src/core/normalize-app.js`,
`src/registry/validate-capabilities.js`, `src/geo/validate-geo.js`,
`src/layout/validate-layout.js`, `src/help/validate-help.js`) via an
`isPlainObject` guard — the tour *runtime* execution path was missed because
those six are all *validators*, not the thing that actually plays a tour.

## Reproduction

```js
import { createTourRuntime } from './src/tour/runtime.js';

const rt = createTourRuntime({});
const tour = { id: 't', steps: [null] };
rt.play(tour, {}); // threw: Cannot read properties of null (reading 'commands')
```

`enter()` in `src/tour/runtime.js` did `step.commands || []` and
`stepInfo(step, index)` read `step.id` / `step.title` / `step.narration`
without checking that `step` is a plain object first.

## Acceptance criteria

- Playing a tour whose `steps` array contains a `null` or non-object entry
  does not throw; the malformed step is treated as an empty step (no
  commands run, no spotlight, `tour.stepChanged` still fires so `next()` /
  `prev()` navigation stays consistent).
- Regression test in `tests/tour.test.js` covers a `null` step.
- `npm test` passes without adding dependencies.

## Scope

Kept the change within `src/tour/runtime.js` (reusing the existing
`isPlainObject` helper from `src/core/ids.js`, same as the six prior fixes)
and its tests. No dependency, runtime API surface, or data migration change
was needed.

## Status

Implemented by `fix/issue-59-tour-runtime-null-step`; GitHub #59 closes when
the reviewed PR merges.

- `src/tour/runtime.js`: `enter()` now coerces a non-plain-object step to `{}`
  via `isPlainObject` before reading `.commands` / `.id` / `.title` /
  `.narration`, so a malformed step degrades to a no-op step instead of
  throwing.
- `tests/tour.test.js` adds a regression test playing a tour with a `null`
  first step, asserting no throw and that `next()` still reaches the
  well-formed second step.
