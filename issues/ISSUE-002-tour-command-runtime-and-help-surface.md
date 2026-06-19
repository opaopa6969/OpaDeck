# ISSUE-002: Tour Command Runtime And Help Surface

## Background

The showcase contains a local tour implementation, but it is not yet connected to the documented help/tour model or registries.

## Goal

Implement a reusable runtime for:

- help entries
- guided tours
- command execution against stable targets

## Scope

- `TourCommandHandlerRegistry`
- stable target resolution for operation/field/panel
- `focusOperation`
- `focusField`
- `focusPanel`
- `submitOperation`
- `waitResult`
- default overlay renderer

## Acceptance criteria

- a tour can be loaded from `HelpModel.tours`
- command handlers are registry-driven
- runtime events are emitted for tour start/step/finish
- the showcase tour migrates from ad hoc code to the shared runtime

## Notes

The design rule is important:
the tour runtime coordinates actions, but must not own operation semantics.
