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

- `split`
- `stack`
- `tabs`
- `panel`

## Guiding rule

`operations` are the source of truth.  
`layout` changes presentation only.  
`help` changes comprehension only.

