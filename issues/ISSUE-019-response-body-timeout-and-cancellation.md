# ISSUE-019: Keep Timeout And Cancellation Active Through Response Body Reads

GitHub: #31

## Summary

`createHttpExecutor` releases its timeout timer and external cancellation
listener as soon as `fetch` returns response headers. Response bodies are read
after that cleanup, so a server that sends headers and then stalls can leave an
operation running indefinitely.

## Acceptance criteria

- The configured timeout remains active until the full response body, including
  an NDJSON stream, has been consumed.
- External cancellation remains active until body consumption finishes.
- A body-read abort is recorded as `execution.timeout` or
  `execution.cancelled`, according to its cause.
- Successful and failed terminal paths release the timer and external signal
  listener.
- Regression tests cover timeout and cancellation after headers arrive.
- `npm test` passes.

## Scope

Keep the change within the existing HTTP executor and its tests. No dependency,
runtime, or public API change is needed.

## Status

Implemented by `fix/issue-31-response-body-timeout`; GitHub #31 closes when the
reviewed PR merges.

- `src/runtime/http-executor.js` defers timeout/cancellation cleanup until the
  response body terminal path completes.
- `tests/http-executor.test.js` covers post-header timeout, cancellation, and
  successful cleanup.
- `tests/http-executor-streaming.test.js` covers timeout during an NDJSON read.
