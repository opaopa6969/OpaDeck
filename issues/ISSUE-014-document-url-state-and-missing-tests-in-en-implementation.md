# ISSUE-014: Document URL State And Missing Test Files In English IMPLEMENTATION.md

## Background

The English and Japanese `IMPLEMENTATION.md` have drifted in two ways:

1. **URL state is documented in ja but not en.** `docs/ja/IMPLEMENTATION.md`
   §8 "App shell と URL state" (lines 142-151) lists `createUrlState` and its
   History API integration (initial URL, push/replace, popstate). The English
   `docs/en/IMPLEMENTATION.md` §8 has no URL-state content; it covers workbench,
   fullscreen, geomap instead. There is an implementation (`tests/url-state.test.js`
   passes) that the English doc does not mention.
2. **The English "Verified by automated tests" list is missing two test files.**
   `docs/en/IMPLEMENTATION.md:186-201` enumerates 13 bullet entries covering
   test files, but `tests/` has 15 files. Missing from the bullets:
   `tests/opsui-layout-help-tour.test.js` and `tests/url-state.test.js`.
   The header text "71 tests across" is correct; only the bullet list is
   incomplete.

The Japanese doc does not have a per-file test bullet list (it only states
"71 tests"), so this is not a symmetric "sync both docs" task — it is "fix the
English doc".

## Evidence (observed, read-only)

- `docs/ja/IMPLEMENTATION.md:142-151` §8 contains `createUrlState` + History API.
- `docs/en/IMPLEMENTATION.md` has no `url-state` / `createUrlState` / "URL state"
  match (grep returns 0).
- `docs/en/IMPLEMENTATION.md:188` says "71 tests across" — correct.
- `docs/en/IMPLEMENTATION.md:190-201` bullet list omits
  `tests/opsui-layout-help-tour.test.js` and `tests/url-state.test.js`
  (verified by grep against the file).
- `tests/` has 15 files; `npm test` runs 71 tests, all pass.

## Goal

Make the English `IMPLEMENTATION.md` reflect the current implementation:

1. Add URL-state coverage to the English §8 (or equivalent section) so
   `createUrlState` / History API integration is documented in English too.
2. Add the two missing test files to the "Verified by automated tests" bullet
   list so the list matches `tests/`.

## Scope

- `docs/en/IMPLEMENTATION.md` only
- decide whether to also align the Japanese §8 structure with the English one
  (the two §8 sections currently describe different cuts of the shell). This is
  optional and a maintainer call; minimum is to add URL state to the English doc.

## Out of scope

- changing the implementation
- renumbering or restructuring the whole IMPLEMENTATION.md
- translating the entire English doc to Japanese or vice versa

## Acceptance criteria

- `docs/en/IMPLEMENTATION.md` mentions `createUrlState` / URL state.
- The English "Verified by automated tests" bullet list includes all 15 test
  files (or, if the list is intentionally grouped, it no longer undercounts).
- `npm test` still passes (docs-only change).

## Human gate

The §8 section headings differ between en and ja (en §8 = workbench/fullscreen/
geomap; ja §8 = "App shell と URL state"). The maintainer decides whether to:
- keep the two §8 sections as different cuts and just add URL state to the
  English doc, or
- align the section structure across languages.
This affects doc organization, so it needs a maintainer call.

## Notes

Docs-only. No code changes.
