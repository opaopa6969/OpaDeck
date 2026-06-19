# ISSUE-005: Browser Test Harness And Runtime Verification

## Background

The current environment lacks `node` and browser automation, so verification is mostly static.

## Goal

Add a practical verification path for:

- runtime stores
- registries
- showcase rendering
- real browser interaction

## Scope

- Node runtime setup assumptions
- test scripts that work outside this sandbox
- browser smoke test plan
- optional headless browser harness

## Acceptance criteria

- the repository has a documented executable test path
- runtime unit tests can run on a normal machine
- the showcase can be smoke-tested in a browser automatically or with a short manual checklist

## Notes

This issue is about confidence, not product scope.
