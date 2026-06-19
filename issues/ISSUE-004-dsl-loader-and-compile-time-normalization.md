# ISSUE-004: DSL Loader And Compile-Time Normalization

## Background

The `.opsui` DSL is documented, but there is no parser or compiler.
The runtime currently expects already-formed JS objects.

## Goal

Implement a first DSL loading path with compile-time normalization.

## Scope

- parse a minimal `.opsui` subset
- compile to `AppDefinition`
- inject normalized `groupId`
- validate references
- surface structured compile errors

## Acceptance criteria

- a simple app can be defined in `.opsui`
- the compiler emits normalized JS objects
- compile-time diagnostics align with `ProblemEntry`
- a malformed DSL file reports actionable errors

## Notes

Start narrow.
Do not attempt a full language before the runtime execution path is proven.
