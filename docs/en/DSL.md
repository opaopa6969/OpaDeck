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

## Core blocks

- `app`
- `datasource`
- `group`
- `operation`
- `field`
- `request`
- `result`
- `help`
- `tour`
- `layout`

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

## Layout primitives

A `layout` block holds a single root render node built from these primitives:

- `split <id> <row|column> { ... }` — exactly two child nodes; optional `sizes <a> <b>`
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

