# ISSUE-015: Document Or Sanitize inlineSvg Renderer Markup Injection

## Background

The `inlineSvg` result renderer injects response markup directly into the DOM
via `innerHTML`. `src/renderers/result-renderers.js:72` does:

```
h(doc, 'div', { class: 'opa-inline-svg', innerHTML: markup })
```

where `markup = String(ctx.bodyText || '')` comes from the operation response
when the content type includes `svg` (auto-matched on `image/svg+xml`, see
`:65`). There is no sanitization, and no documented contract that the caller
must only pass trusted responses. If an operation's response is not actually
trusted SVG (e.g. an upstream returns `image/svg+xml` with an `<svg>` wrapping
a `<script>` or `onload=` handler), the markup executes in the host page.

Severity is low in the current showcase (responses are fixtures), but the
renderer is a public extension point, so the contract should be explicit.

## Evidence (observed, read-only)

- `src/renderers/result-renderers.js:64-73` `inlineSvg` renderer:
  - `canRender`: `contentType` includes `svg`
  - `render`: checks `markup.includes('<svg')`, then sets `innerHTML: markup`
- The `h` helper (`src/renderers/dom.js`) passes `innerHTML` through to the DOM
  node.
- No sanitization layer exists in `src/renderers/`.
- `docs/en/COMPONENTS.md` and `docs/en/EXTENSIONS.md` do not state a "trusted
  response only" contract for `inlineSvg` (spot-checked).

## Goal

Close the gap between the renderer's behavior and its documented contract. Two
valid resolutions; the maintainer picks one (or both):

- **Option A (document)**: add a clear "trusted response only" contract to
  `docs/en/COMPONENTS.md` (inlineSvg entry) and `docs/en/EXTENSIONS.md` (result
  renderer contract), and the ja mirrors. State that `inlineSvg` injects
  response markup unsanitized and must only be used for responses the host
  trusts.
- **Option B (sanitize)**: sanitize the SVG markup before injection (strip
  `<script>`, event handler attributes, `xlink:href` to javascript: URIs,
  etc.), either with a small allowlist or by re-parsing the SVG and re-emitting
  safe nodes. Add a test that a malicious SVG payload does not execute.

## Scope

- at least Option A; Option B if the maintainer wants defense-in-depth
- if Option A: docs in `docs/en/COMPONENTS.md`, `docs/en/EXTENSIONS.md`, and
  the ja counterparts
- if Option B: `src/renderers/result-renderers.js`, a test in
  `tests/renderers-extra.test.js`
- keep the happy-path (real SVG renders) working

## Out of scope

- a general HTML sanitizer usable by other renderers (scoped to inlineSvg)
- changing the content-type auto-match behavior
- CSP changes (separate concern)

## Acceptance criteria

- Either the docs clearly state the trusted-only contract for `inlineSvg`, or
  the renderer sanitizes SVG markup and a test proves a `<script>`-bearing SVG
  payload is neutralized.
- The existing inlineSvg test (empty / no-svg / real-svg cases) still passes.
- `npm test` passes.

## Human gate

- Option A is a doc-only change and low-risk; Option B changes renderer
  behavior and needs a decision on how strict the SVG allowlist is (e.g. do we
  keep `<foreignObject>`? animations?).
- If the maintainer considers all OpaDeck operations trusted-by-construction
  (internal ops tool, no untrusted upstream), Option A may suffice. If
  operations can proxy untrusted upstreams, Option B is safer.
- This is a security-adjacent decision; maintainer approval required.

## Notes

Low severity in current usage, but the renderer is a public extension point, so
the contract should not be implicit.
