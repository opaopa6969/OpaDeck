# ISSUE-016: HTTP 304 Not Modified Is Recorded As An Error

[glm-hunt]

## Summary

`createHttpExecutor` treats an HTTP `304 Not Modified` response as a failure.
A conditional GET (`If-None-Match` / `If-Modified-Since`) that correctly returns
`304` is recorded with `status: 'error'` and problem code `execution.http.status`,
even though `304` is a successful "use your cached copy" response. The operator
sees a healthy conditional request as a failed execution.

## Reproduction

```js
import { createHttpExecutor } from './src/runtime/http-executor.js';
import { createExecutionStore } from './src/runtime/execution-store.js';
import { createManualClock } from './src/runtime/clock.js';

const clock = createManualClock({ startAt: 0 });
clock.schedule = (fn) => () => {};
const executions = createExecutionStore({ clock });

// Standard fetch semantics: response.ok is true only for 2xx. A 304 has ok=false.
const fetchImpl = async () => ({
  ok: false, status: 304, statusText: 'Not Modified',
  headers: { get: () => null }, text: async () => '',
});

const exec = createHttpExecutor({ executions, clock, fetch: fetchImpl, AbortController: globalThis.AbortController });
const rec = await exec.execute({ id: 'lookup', request: { method: 'GET', url: '/x' } }, {});
console.log(rec.status); // 'error'   (expected: 'success')
```

Observed output:

```
record.status: error
problems: [{ code: 'execution.http.status', severity: 'error', message: 'Request failed with HTTP 304 Not Modified.' }]
response.status: 304
```

## Affected file

`src/runtime/http-executor.js:76-85`

```js
if (response.ok) {
  return executions.succeed(snapshot);
}
return executions.fail(snapshot, {
  problems: createProblem('execution.http.status', 'error', ...),
});
```

`response.ok` is only true for 2xx (per the Fetch standard), so any 3xx that
`fetch` does not auto-follow — most notably `304` — falls through to `fail`.

## Expected vs actual

- **Expected:** a `304` response finalizes the execution as `success` (the
  resource is unchanged; the caller should use its cached copy).
- **Actual:** the execution is finalized as `error` with problem code
  `execution.http.status`.

## Why this slips through the tests

`tests/http-executor.test.js:39-49` `fakeResponse` computes `ok` as
`status >= 200 && status < 400`, which marks `304` as `ok: true`. That diverges
from the real `fetch` standard (`ok` is 2xx only), so the unit suite never
exercises the `304` path through `response.ok`.

## Acceptance criteria

- A `304` response finalizes the execution as `success` (no
  `execution.http.status` problem).
- Existing 2xx success and 4xx/5xx error behavior is unchanged.
- A test in `tests/http-executor.test.js` covers the `304` path using a fake
  response whose `ok` matches the Fetch standard (`ok: false` for `304`).
- `npm test` passes.

## Out of scope

- Other 3xx status codes (301/302/308 are normally auto-followed by `fetch`;
  decide separately whether to treat non-redirected 3xx as success).
- Changing the test fake's `ok` computation globally (that would invalidate
  other tests; add a 304-specific fake instead).

## Notes

The fix is one line in `runRequest` (treat `304` — and decide on the broader
3xx policy — as success before the `response.ok` check). The test fake's `ok`
should match the Fetch standard so this class of bug is caught going forward;
but changing the shared `fakeResponse` affects every existing test, so a
dedicated fake for the `304` case is the lower-risk path.
