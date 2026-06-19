# ISSUE-001: HTTP Executor And Request Preview

## Background

The current runtime has an `ExecutionStore`, but it does not yet execute real HTTP requests.
The showcase only simulates executions.

## Goal

Implement a real request execution layer that:

- serializes an operation definition and field state into an HTTP request
- builds a `RequestPreviewModel`
- executes via `fetch`
- stores `ResponseSnapshot`
- reports lifecycle events through the runtime bus

## Scope

- GET query serialization
- raw field body support
- request headers
- timeout handling
- error capture
- curl generation

## Out of scope

- multipart upload
- streaming request bodies
- auth plugins

## Acceptance criteria

- an operation can be executed with real `fetch`
- request preview is shown before execution
- success/error/timeout/cancel all map into `ExecutionRecord`
- the bus publishes `execution.started`, `execution.success`, `execution.error`, `execution.timeout`, `execution.cancelled`

## Notes

This issue unlocks the framework as an actual operator console instead of a design prototype.

## Status

Resolved on branch `feat/issue-batch` (6519536). Request builder + HTTP executor with injectable fetch, timeout/cancel/error mapping, curl, and `execution.*` events. See `src/runtime/request-builder.js`, `src/runtime/http-executor.js`, `tests/http-executor.test.js`.
