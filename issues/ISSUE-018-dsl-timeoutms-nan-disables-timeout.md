# ISSUE-018: DSL `timeoutMs` With A Non-Numeric Token Parses As NaN And Silently Disables The Timeout

[glm-hunt]

## Summary

In the `.opsui` DSL, a `timeoutMs` token that is not a valid number is coerced
with `Number(...)` and stored as `NaN` with **no validation error**. At runtime,
`resolveTimeout` turns `NaN` into `0`, which means **no timeout** — the author's
intent is silently dropped. A typo like `timeoutMs 5OO` (letter O instead of
zero) produces a request that never times out, with zero feedback at parse or
validation time.

## Reproduction

```js
import { compileOpsui } from './src/index.js';

const src = `app Demo v1 {
  group g {
    operation op {
      request { method GET url "/x" timeoutMs abc }
      field f : text in query {}
    }
  }
}`;
const { app, problems } = compileOpsui(src);
console.log('app present:', app !== null);   // true
console.log('problems:', JSON.stringify(problems));  // []  -- no error
console.log('timeoutMs:', app.groups[0].operations[0].request.timeoutMs); // NaN
```

Observed output:

```
app present: true
problems: []
timeoutMs: NaN
```

At runtime, the `NaN` becomes `0` (no timeout):

```js
// resolveTimeout, src/runtime/http-executor.js:209-211
const fromOperation = operation && operation.request && operation.request.timeoutMs;
if (fromOperation != null) {           // NaN != null is true, so enters branch
  return Math.max(0, Number(fromOperation) || 0);  // Math.max(0, NaN || 0) === 0
}
```

A valid value (`timeoutMs 500`) parses correctly; only non-numeric tokens are
broken.

## Affected files

- `src/dsl/opsui.js:352-354` — parses `timeoutMs` with no numeric validation:

```js
case 'timeoutMs':
  request.timeoutMs = Number(this.expectWord().value);  // NaN for non-numeric, no error
  break;
```

- `src/runtime/http-executor.js:205-214` — `resolveTimeout` collapses `NaN` to
  `0` (no timeout) instead of rejecting it.

## Expected vs actual

- **Expected:** a non-numeric `timeoutMs` token produces a located
  `dsl.parse.error` (the parser already rejects unknown field types, bad split
  directions, and bad body kinds this way), and the app does not compile.
- **Actual:** the app compiles with `request.timeoutMs === NaN`, zero problems,
  and the runtime silently disables the timeout.

## Impact

An authoring typo silently removes the request timeout. In an ops workbench
where a hung request blocks the operator, this is a behavioral regression with
no feedback at any stage (parse, validate, or runtime).

## Acceptance criteria

- A non-numeric `timeoutMs` token (e.g. `timeoutMs abc`) produces a located
  `dsl.parse.error` and `compileOpsui` returns `app: null` with the problem in
  `problems`.
- A valid numeric `timeoutMs` (e.g. `timeoutMs 500`) still compiles and behaves
  as before.
- A test in `tests/opsui.test.js` (or `tests/opsui-layout-help-tour.test.js`)
  covers the non-numeric `timeoutMs` rejection.
- `npm test` passes.

## Out of scope

- Validating `timeoutMs` at runtime in `resolveTimeout` (the parse-time check is
  the right layer; the runtime already handles a missing `timeoutMs` as `0`).
- Tightening `resolveTimeout` to reject `NaN` (optional defense-in-depth; the
  parse-time fix removes the source of `NaN`).
- Other numeric DSL fields (e.g. layout `sizes`) that have the same
  `Number(word)` pattern — note them in a follow-up if desired, but this issue
  is scoped to `timeoutMs` because it has a concrete runtime consequence
  (timeout disabled).

## Notes

The fix is to validate the token in `parseRequest` (reject non-numeric words
with a located `dsl.parse.error`, mirroring `expectBoolean` at
`src/dsl/opsui.js:743-752`). A related, *separate* gap is that layout `sizes`
(`src/dsl/opsui.js:507`) uses the same `Number(word)` pattern and also stores
`NaN` without error — file a follow-up if that is worth catching too.
