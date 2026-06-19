# OpaDeck Constitution

## Core statement

> OpaDeck is an operation-centric internal ops workbench.  
> Data sources are first-class primitives that support fields, but they are not the center of the model.

## Principles

### 1. Operation first

The primary unit is the `Operation`.

- fields provide input
- data sources provide options/defaults/help data
- result views present outcomes
- help and tours explain operations
- layout arranges how operations are shown

### 2. Meaning before rendering

Separate:

- semantic layer
- help layer
- rendering layer

Rendering may change without changing business meaning.

### 3. Stable ids everywhere

Labels are not internal keys.

Use stable ids for:

- groups
- operations
- fields
- panels
- help targets
- tour targets

### 4. Validation over convention

The framework must validate:

- duplicate ids
- broken references
- dependency cycles
- invalid layout bindings
- invalid help/tour targets

### 5. Help is a feature

Every OpaDeck application should be able to provide:

- inline help
- contextual help
- troubleshooting help
- interactive tours

### 6. Layout is flexible but shallow

Start with a small set of layout primitives:

- split
- stack
- tabs
- panel

Do not begin with a full docking IDE framework.

### 7. Narrow scope wins

OpaDeck should not become:

- a workflow engine
- a public-site builder
- a full low-code platform

