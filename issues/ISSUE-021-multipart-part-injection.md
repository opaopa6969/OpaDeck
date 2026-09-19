# ISSUE-021: Multipart Body Values Can Inject Extra Form-Data Parts

GitHub: #36

## Summary

`buildRequestPreview` serializes `multipart` bodies with the fixed, exported
`MULTIPART_BOUNDARY` and interpolates field names and operator-typed values into
the body without checking that they do not contain that boundary. A value
containing the boundary therefore injects arbitrary additional form-data parts,
and a server that takes the first occurrence of a repeated name receives the
injected value. A `"`, CR, or LF in a field name likewise breaks out of the
`Content-Disposition` quoted string.

## Acceptance criteria

- A multipart body is never emitted with a boundary that occurs in any
  serialized field name or value.
- The `content-type` header, the preview body, and the `curl` rendering use the
  same boundary, and serialization stays pure and deterministic.
- Field names are escaped in `Content-Disposition` so that `"`, CR, and LF
  cannot terminate the quoted string or start a new header line.
- The default boundary and the existing multipart output are unchanged for
  inputs that do not contain the boundary.
- Regression tests cover a colliding value, a value that also takes the first
  escalated candidate, and a field name with a quote and a newline.
- The implementation-status documentation records the contract.
- `npm test` passes without adding dependencies.

## Scope

Keep the change inside the existing JavaScript request builder, its tests, and
the documentation. No dependency, public API removal, or data migration.

## Status

Implemented by `fix/issue-21-multipart-part-injection`; GitHub #36 closes when
the reviewed PR merges.

- `src/runtime/request-builder.js` picks the boundary from the serialized
  entries (`selectMultipartBoundary`) and percent-encodes `"`, CR, and LF in
  field names (`escapeFieldName`). The chosen boundary is threaded to
  `inferContentType`, and `forceMultipartBoundary` rewrites the `boundary`
  parameter of a multipart content-type that the operation declares
  (`request.contentType`) or an operator types into a header field, so the
  header and the body never disagree on either path.
- `tests/request-builder.test.js` parses the body with the advertised boundary
  and asserts on the parts a server would see, including the declared-content-type
  and header-field paths.
- English and Japanese implementation-status documents record the contract.
