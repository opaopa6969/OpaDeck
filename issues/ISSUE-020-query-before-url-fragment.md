# ISSUE-020: Insert Dynamic Query Parameters Before URL Fragments

GitHub: #34

## Summary

`buildRequestPreview` appends generated query parameters to the end of the URL.
When an operation URL contains a fragment, the parameters therefore become part
of the fragment and are not sent in the HTTP request.

## Acceptance criteria

- Generated query parameters are inserted before a URL fragment.
- Existing static query parameters are preserved.
- URLs without a fragment retain their current behavior.
- Regression tests cover fragments with and without an existing query string.
- The implementation-status documentation records the request-builder contract.
- `npm test` passes without adding dependencies.

## Scope

Keep the change within the existing JavaScript request builder, tests, and
documentation. No dependency, runtime API, or data migration is needed.

## Status

Implemented by `fix/issue-34-query-before-fragment`; GitHub #34 closes when the
reviewed PR merges.

- `src/runtime/request-builder.js` inserts generated query parameters before the
  fragment while preserving any static query string.
- `tests/request-builder.test.js` covers both fragment forms and the existing
  no-fragment behavior.
- English and Japanese implementation-status documents record the contract.
