# OpaDeck Constitution

## Core statement

> OpaDeck is an operation-centric internal ops workbench.  
> Data sources are first-class primitives that support fields, but they are not the center of the model.

## Principles

### 1. Operation first

The primary unit is the `Operation`. The closed core holds only the meaning
needed to run that operation.

- fields provide input
- data sources provide options/defaults/help data
- result views present outcomes (renderer is an open registry id)

help / tour / layout / card are **optional companion layers that sit on top of**
the operation core; they are not part of the closed core (see principles 5 & 6,
and "Companion layers" in `CORE_MODEL.md`).

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

The **core** must validate at least:

- duplicate ids
- broken references (body field / data source)
- groupId mismatch

Companion-layer checks live outside the core (composed by `validateApp`):

- invalid layout bindings → layout companion
- invalid help/tour targets → help companion
- invalid geoScene options → geo companion

### 5. Help is a companion layer (not an afterthought)

OpaDeck **can** provide the following — but these are optional companion layers on
top of the operation core, not part of the closed core:

- inline help
- contextual help
- troubleshooting help
- interactive tours

Being able to offer them is part of OpaDeck's value, yet the core does not know
about them. Help/tour types and their validation live in the companion layer.

### 6. Layout is a companion layer too (flexible but shallow)

Layout is also a companion layer, not core. Keep the primitives to just:

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

