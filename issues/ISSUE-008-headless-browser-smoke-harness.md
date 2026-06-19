# ISSUE-008: Headless Browser Smoke-Test Harness

## Background

ISSUE-005 established a runnable unit-test path (`npm test`, 43 tests on Node
>= 18) and a *manual* browser smoke-test checklist in
`docs/en/IMPLEMENTATION.md`. The builtin renderers and the geoScene renderer are
exercised headlessly against a fake DOM, but no test actually loads the showcase
in a browser. Real DOM/SVG/event behavior is therefore still only manually
verified.

## Goal

Automate the showcase smoke checklist so the in-browser path is verified by a
command, not by hand.

## Scope

- a headless harness (e.g. Playwright or Puppeteer) that serves the showcase via
  `scripts/serve.py` and drives it
- assertions covering the existing manual checklist:
  - the page loads with no console errors
  - selecting a feature card updates the detail panel + selection inspector
  - selecting Geo Scene draws the Japan map (47 regions, choropleth, points,
    lines)
  - Simulate Execution moves the inspector running -> success and renders the
    response under "Latest Result"
  - Validate Sample App shows the expected problems
  - Start Tour walks the steps and emits tour.started / stepChanged / finished
- a documented `npm run` script, kept separate from `npm test` so the default
  test path stays dependency-free

## Out of scope

- visual regression / screenshot diffing
- cross-browser matrix
- replacing the fake-DOM unit tests (they stay as the fast inner loop)

## Acceptance criteria

- a single command runs the showcase in a headless browser and passes the smoke
  assertions
- it is documented in the README next to `npm test`
- CI-friendly: it can run on a normal machine with the browser dependency
  installed, and is skipped/clearly gated when that dependency is absent

## Notes

This issue is about confidence, not product scope. Keep the browser dependency
out of the default `npm test` so contributors without it can still run the unit
suite.
