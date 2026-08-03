# ISSUE-012: Reconcile Status Of Implemented Open Issues (007/009/011)

## Background

Three open issues appear to be implemented on `main` but are still listed under
"Open — follow-up work" in `issues/README.md`, and their issue files do not
record a resolving commit. The README contract says Done issues "each have a
`## Status` section with the resolving commit, the source files, and the
tests", so these are out of sync with the contract.

## Evidence (observed, read-only)

- `issues/README.md:19-22` lists ISSUE-007 / 008 / 009 / 011 as Open.
- ISSUE-007 "DSL Layout, Help, And Tour Blocks":
  - implementation: `src/dsl/opsui.js:417` `parseLayout`, `:569` `parseHelpBlock`,
    `:635` `parseTour` (commit `e4d55e8` on `main`)
  - tests: `tests/opsui-layout-help-tour.test.js` (4 tests, passing)
  - example: `examples/full-app.opsui` exercises the blocks
  - issue file has **no** `## Status` section
- ISSUE-009 "Grow The Builtin Renderer Set":
  - implementation: `src/renderers/field-renderers.js:83` `jsonEditor`;
    `src/renderers/result-renderers.js:41` `jsonLines`, `:57` `text`,
    `:64` `inlineSvg`; `src/renderers/time-series.js` `timeSeries`
    (commit `aba7a56` on `main`)
  - tests: `tests/renderers-extra.test.js` (6 tests, passing)
  - issue file has **no** `## Status` section
- ISSUE-011 "Guided Tour For Feature Explanation":
  - implementation: `src/tour/handlers.js:57` `focusSelector` handler,
    `:24-27` `kind: 'selector'` target (commit `08b5467` on `main`)
  - tests: `tests/tour.test.js` (7 tests, passing)
  - issue file has a `## Status` section but it says "Open（未着手）" (line 67),
    which contradicts the merged implementation
- Full suite: `npm test` = 71 tests / 15 files, all pass (verified this audit).

Note: an earlier audit draft claimed all three issue files lack a `## Status`
section. That is inaccurate for ISSUE-011, which does have one (marked Open). The
underlying discrepancy (implemented but not marked Done) still holds for all
three.

## Goal

Bring the issue tracker in sync with `main` for the three implemented issues:
either mark them Done with a resolving commit reference, or explicitly record
why they stay open (e.g. partial implementation, scope left for later).

ISSUE-008 (headless browser smoke harness) is genuinely unimplemented and stays
Open; it is out of scope for this issue.

## Scope

- For each of ISSUE-007 / 009 / 011, decide Done vs still-open:
  - if Done: add a `## Status` section (resolving commit, source files, tests)
    matching the format used by ISSUE-001..006, and move the README entry from
    "Open" to "Done".
  - if still open (e.g. partial scope): update the `## Status` section to say
    what is done and what remains, and keep it in "Open".
- Update `issues/README.md` to reflect the decision.

## Out of scope

- any code changes to the implementations themselves
- ISSUE-008
- re-validating acceptance criteria beyond what the merged code + passing tests
  already show

## Acceptance criteria

- ISSUE-007 / 009 / 011 each have a `## Status` section that matches the actual
  state on `main`.
- `issues/README.md` categorization matches the Status sections.
- `npm test` still passes (no code changes, so this is a sanity check).

## Human gate

The "Done" call for each issue belongs to the designer / maintainer. This issue
should not auto-close 007/009/011; it records the discrepancy and proposes
Done-with-commit-reference, but the maintainer confirms. Reasons a seemingly
implemented issue might stay Open include: scope deliberately deferred (e.g.
ISSUE-009 "optional: KeyValueEditor"), or acceptance criteria not fully met in
the maintainer's judgment.

## Notes

Keep this to documentation/tracker only. No source changes.
