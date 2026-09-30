# OpaDeck DSL (`.opsui`)

## Intent

`.opsui` is a textual DSL for defining:

- operations
- fields
- data sources
- help
- tours
- layouts

It is not a generic form DSL. It is an operation-centric internal ops UI DSL.

## Blocks

Core blocks (the closed semantic core):

- `app`
- `datasource`
- `group`
- `operation`
- `field`
- `request`
- `result`

Companion blocks (optional, **not** part of the core — see `CORE_MODEL.md`). The
parser understands them, but they describe companion layers, not core meaning:

- `help`
- `tour`
- `layout`

`fieldset` (and the operation-level `include` it pairs with) is neither: it is
pure compile-time DSL sugar that never reaches the compiled model — see
"Field fragments" below.

## Example

```opsui
app VacantOps v1 {
  title "Vacant Service Ops"
  defaultLayout opsWorkbench

  datasource epCompanies : options.static {
    option "10066" label "Kansai" description "default"
  }

  group index {
    label "Index"

    operation registerDocuments {
      title "Register documents"

      request {
        method POST
        url "./api/index/registerDocuments"
        contentType "text/plain"
        body raw field formbody
      }

      field epCompanyId : select in query {
        label "EP Company"
        source epCompanies
      }

      field formbody : textarea in body {
        label "Document JSON"
        required true
      }

      result {
        renderer auto
      }
    }
  }
}
```

## Field fragments (`fieldset` + `include`)

`fieldset` is compile-time-only sugar for sharing a group of fields across
operations. It is not part of the compiled model: `include` splices deep
copies of the fragment's fields into the including operation's `fields`, so
the core only ever sees plain fields — it never learns a fieldset existed.

`fieldset` blocks are declared at app top level, alongside `datasource` and
`group`, and must appear before any operation that `include`s them:

```opsui
app VacantOps v1 {
  fieldset addressSep {
    field zip : text in query {
      label "Zip"
    }
    field pref : text in query {
      label "Prefecture"
    }
  }

  group index {
    operation search {
      title "Search"
      request {
        method GET
        url "./api/search"
      }
      include addressSep
      result {
        renderer auto
      }
    }
  }
}
```

Rules:

- `include <id>` may only appear inside an `operation` block, alongside
  `field`.
- Referencing an undeclared fieldset is a located `dsl.parse.error`
  ("Unknown fieldset '<id>'. Declare it before the operation that includes
  it.").
- Including the same field id twice (whether from two includes, or an
  include plus a literal `field`) is caught by the existing
  `field.id.duplicate` check — fieldsets do not get a pass on id uniqueness.

## Layout primitives

A `layout` block holds a single root render node built from these primitives:

- `split <id> <row|column> { ... }` — exactly two child nodes; optional
  `sizes <a> <b>` with two finite numeric weights
- `stack <id> { ... }` — N child nodes; optional `gap <none|sm|md|lg>`
- `tabs <id> { ... }` — panel children; optional `defaultTab <panelId>`
- `panel <id> <renderer> { bind <binding> ... }`

Panel bindings:

- `bind allGroups`
- `bind group <groupId>`
- `bind selection`
- `bind results <global|selection|operation> [operation already implied by the scope word]`
- `bind help <app|selection|operation>` (add an operation id when the scope is `operation`)
- `bind markdown "..."`

A panel may also carry chrome: `title "..."`, `collapsible <bool>`,
`defaultCollapsed <bool>`, `closable <bool>`, `resizable <bool>`.

```opsui
layout workbench {
  title "Workbench"
  split root row {
    sizes 1 2
    panel nav groupNav {
      bind group index
      title "Operations"
    }
    tabs main {
      defaultTab detail
      panel detail operationDetail { bind selection }
      panel results resultStack { bind results operation registerDocuments }
    }
  }
}
```

## Help and tour blocks

`help` collects help entries; each `tour` is its own top-level block. Both
compile into `HelpModel` and their targets are reference-checked at compile time.

```opsui
help {
  entry registerHelp {
    target operation registerDocuments
    kind panel
    title "Registering documents"
    body "Paste the document JSON, then run."
  }
  entry bodyHelp {
    target field registerDocuments formbody
    kind tooltip
    body "Raw JSON sent as text/plain."
  }
}

tour overview {
  title "Overview"
  description "How to register documents."
  step pick {
    title "Pick the operation"
    narration "Select it from the nav."
    focus operation registerDocuments
  }
  step run {
    focus panel results
    submit registerDocuments
    wait result registerDocuments
  }
}
```

Help targets: `app <id>`, `group <id>`, `operation <id>`,
`field <opId> <fieldId>`, `panel <id>`, `result [operation <opId>]`.

Tour step commands: `focus operation <id>`, `focus field <opId> <fieldId>`,
`focus panel <id>`, `submit <opId>`, `wait result <opId>`.

## Guiding rule

`operations` are the source of truth.  
`layout` changes presentation only.  
`help` changes comprehension only.
