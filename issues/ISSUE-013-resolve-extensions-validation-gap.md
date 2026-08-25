# ISSUE-013: Resolve EXTENSIONS.md Extension Validation Gap

## Background

`docs/en/EXTENSIONS.md` "Validation obligations for extensions" (lines 268-279)
says the validator "should still own structural validation" and lists four
example checks:

- unknown `result.renderer`
- unknown panel renderer id
- unknown data-source adapter kind
- field type with no matching renderer

`src/core/validate-app.js` does not perform any of these four. It validates id
uniqueness, reference integrity (groups, operations, fields, panels, data
sources, help/tour targets), layout bindings, and tour command targets — but
not renderer/adapter/type registration. The spec and the implementation are
therefore out of sync.

The same section also says "Registries may add capability checks, but they
should not replace core checks", which leaves open where these checks belong.

## Evidence (observed, read-only)

- `docs/en/EXTENSIONS.md:269-279` lists the four validator obligations.
- `src/core/validate-app.js:4-15` wires only: `validateTopLevelIds`,
  `validateGroups`, `validateLayouts`, `validateHelp`, `validateTours`.
  Grep for `result.renderer` / panel renderer id / `dataSource.kind` /
  field type registration in this file returns no matches.
- `docs/ja/EXTENSIONS.md` mirrors the English spec (needs the same resolution).

## Goal

Make the spec and the implementation consistent. There are two valid
resolutions; the maintainer picks one:

- **Option A (implement)**: add the four unknown-checks to
  `validate-app.js`, so an app referencing an unregistered renderer/adapter or
  a field type with no renderer produces a `ProblemEntry`. This requires the
  validator to know the registered renderer ids / adapter kinds / field types,
  i.e. the registry state must be reachable from validation (either passed in,
  or validated against a fixed builtin set).
- **Option B (re-spec)**: change EXTENSIONS.md to state that capability checks
  for unknown renderer/adapter/type live in the registry layer, and the core
  validator intentionally does not cover them. Update both en/ja EXTENSIONS.md.

## Scope

- exactly one of Option A or Option B, applied consistently
- if Option A: new `ProblemEntry` codes, a test in `tests/validate-app.test.js`,
  and a decision on how the validator learns the registry state (inject vs
  builtin defaults)
- if Option B: spec text change in `docs/en/EXTENSIONS.md` and
  `docs/ja/EXTENSIONS.md`, and a note in `docs/en/IMPLEMENTATION.md` if it
  currently implies these checks exist
- keep the existing validator checks intact (id uniqueness, reference
  integrity, layout/help/tour targets)

## Out of scope

- adding new renderers or adapters
- changing the registry API shape beyond what the chosen option requires
- runtime (browser) behavior; this is a compile/validation-time concern

## Acceptance criteria

- The four items in EXTENSIONS.md are either all implemented in the core
  validator with tests, or all moved out of the "validator obligations" wording
  in both en and ja EXTENSIONS.md.
- `npm test` passes.
- No contradiction remains between EXTENSIONS.md's "Validation obligations"
  section and `validate-app.js`.

## Human gate

The choice between Option A and Option B is a design decision:
- where should "unknown renderer/adapter/type" be caught — at app-definition
  validation time (core), or at registration/lookup time (registry)?
- if Option A, is the validator allowed to depend on registry state, and does
  that break the "core validator has no runtime deps" property implied by the
  current shape?
- this affects EXTENSIONS.md and possibly the validation pipeline contract, so
  it needs maintainer approval before implementation.

## Notes

This issue is about closing a spec/impl gap, not about adding features. Either
resolution is acceptable; the goal is consistency.
