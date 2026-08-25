# ISSUE-009: Grow The Builtin Renderer Set

## Background

ISSUE-006 shipped the first builtin renderer set (text / textarea / checkbox /
select field renderers; jsonFoldable / tableResult result renderers; groupNav /
operationTiles / operationDetail / resultStack panel renderers) and ISSUE-003
added geoScene. `docs/en/COMPONENTS.md` calls for several more first-class
renderers that internal ops tools need early.

## Goal

Add the next tranche of builtin renderers from the component catalog, keeping
them data-driven and on the shared `h` DOM helper so they stay headless-testable.

## Scope

- `JsonEditor` field renderer (raw JSON bodies are common; a plain textarea is
  too weak) -- COMPONENTS.md flags this as first-class early
- `inlineSvg` result renderer (bridge from the existing vacant-service custom
  SVG views)
- `jsonLines` and `text` result renderers (round out the V1 result set)
- `timeSeries` chart surface (sibling of geoScene)
- optional: `KeyValueEditor` field renderer

## Out of scope

- the V1.5+ components (Autocomplete, DrilldownSelect, ArrayField, DiffView,
  CommandPalette, etc.)
- a general charting library; `timeSeries` should stay a narrow, data-driven SVG

## Acceptance criteria

- each new renderer follows the existing contract and registers via
  `registerBuiltinRenderers()`
- field renderers report changes and advertise `[data-field-id]`; result/panel
  renderers advertise their stable targets
- each is covered by a headless test against the fake DOM
- the showcase uses at least one of the new renderers (e.g. JsonEditor for a raw
  body, or inlineSvg / timeSeries for a result)

## Notes

Keep renderers generic and data-driven, following the geoScene precedent
(generic renderer, dataset/props supply the specifics). Prefer extending the
shared `h` helper over reaching for the raw DOM API.

## Status

Done on `main` (optional `KeyValueEditor` deferred). Resolving commit:
`aba7f56` ("feat(renderers): grow the builtin renderer set (ISSUE-009)").

- implementation: `src/renderers/field-renderers.js:83` `jsonEditor`;
  `src/renderers/result-renderers.js:41` `jsonLines`, `:64` `text`,
  `:64` `inlineSvg` (canRender on `image/svg+xml`); `src/renderers/time-series.js`
  `timeSeries`
- registration: all new renderers register via `registerBuiltinRenderers()`
- tests: `tests/renderers-extra.test.js` (6 tests, passing) covers `jsonEditor`
  validity reporting, `text` / `jsonLines` / `inlineSvg` / `timeSeries` rendering,
  and registration order
- showcase: the renderer set is wired into the showcase result path

Acceptance criteria met for the non-optional tranche (`jsonEditor`, `inlineSvg`,
`jsonLines`, `text`, `timeSeries`). The optional `KeyValueEditor` was scoped out
("optional" in the issue body) and remains a follow-up.
