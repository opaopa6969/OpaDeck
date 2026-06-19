# ISSUE-003: Geo Scene Renderer With Japan Preset

## Background

`geoScene` is now a documented first-class renderer, but there is no implementation yet.

## Goal

Implement a browser renderer for `geoScene` with a built-in Japan preset.

## Scope

- SVG-based rendering
- Japan base data
- choropleth layer
- point layer
- line layer
- pan/zoom
- click selection

## Acceptance criteria

- a `geoScene` result renderer exists
- a `geoScene` panel renderer exists or the result renderer is reusable in panel surfaces
- a sample OpaDeck app can render Japan-prefecture data
- the implementation uses data-driven layers instead of hard-coded business logic

## Notes

This should follow the `tetsugo` lesson:
generic renderer, Japan-specific dataset.
