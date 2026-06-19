# ISSUE-007: DSL Layout, Help, And Tour Blocks

## Background

The `.opsui` loader from ISSUE-004 compiles a narrow subset: app / datasource /
group / operation / field / request / result. Layouts, help entries, and tours
must still be authored as JS objects, so an app cannot yet be defined end to end
in the DSL.

## Goal

Extend the `.opsui` parser and compiler to cover the remaining first-class
blocks, producing a complete `AppDefinition` from source.

## Scope

- `layout` blocks with the documented primitives: `split`, `stack`, `tabs`,
  `panel` (renderer + binding + optional chrome)
- panel `binding` forms (`group`, `selection`, `results`, `help`, `allGroups`,
  `markdown`)
- `help` blocks: entries with target + kind + body
- `tour` blocks: steps with narration + commands
  (`focus operation/field/panel`, `submit`, `wait result`)
- keep compile-time normalization and `validateAppDefinition` wired in so
  references in the new blocks are validated

## Out of scope

- a full expression language / conditionals in the DSL
- visibility/enable rule syntax beyond simple literals
- importing or splitting `.opsui` across files

## Acceptance criteria

- a complete app (groups, layouts, help, tours) can be defined purely in
  `.opsui` and compiled to a normalized `AppDefinition`
- layout/help/tour references are validated and surface as `ProblemEntry`
  (duplicate ids, missing bindings/targets, missing tour command targets)
- malformed layout/help/tour syntax reports a located `dsl.parse.error`
- an example `.opsui` that exercises every block compiles cleanly, covered by a
  test

## Notes

Stay narrow per ISSUE-004's lesson: encode the documented AST faithfully rather
than inventing new DSL features. The grammar should mirror `docs/en/DSL.md`.
