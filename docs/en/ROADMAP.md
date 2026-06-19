# OpaDeck Roadmap

## Phase 0: Incubation

- finalize naming and constitution
- write the semantic model
- write the DSL shape
- write sample apps from real use cases

## Phase 1: Core object model

- `AppDefinition`
- `GroupDefinition`
- `OperationDefinition`
- `FieldDefinition`
- `DataSourceDefinition`
- `ResultViewDefinition`

## Phase 2: Validator

- duplicate-id checks
- field/source binding checks
- dependency graph checks
- layout binding checks
- help/tour target checks

## Phase 3: Rendering runtime

- simple panel runtime
- left-nav / operation-detail / result-stack
- classic two-pane preset
- three-pane workbench preset

## Phase 4: Help and tour

- help registry
- help panel
- inline help targets
- tour runner and player

## Phase 5: DSL parser

- parse `.opsui`
- compile to object model
- validate compiled output

## Phase 6: Extraction decision

Extract to its own repository only if:

1. one real migration is working
2. the validator proves useful
3. help/tour and layout abstractions remain clean
4. reuse pressure exists outside a single app

