# OpaDeck DSL (`.opsui`)

## 目的

`.opsui` は次を定義する textual DSL。

- operation
- field
- datasource
- help
- tour
- layout

これは generic form DSL ではない。  
operation-centric な internal ops UI DSL である。

## ブロック

core ブロック(closed semantic core):

- `app`
- `datasource`
- `group`
- `operation`
- `field`
- `request`
- `result`

companion ブロック(optional・core ではない。`CORE_MODEL.md` 参照)。parser は解釈するが、
core の意味ではなく companion 層を記述する:

- `help`
- `tour`
- `layout`

## 例

```opsui
app VacantOps v1 {
  title "Vacant Service Ops"
  defaultLayout opsWorkbench

  datasource epCompanies : options.static {
    option "10066" label "関西" description "default"
  }

  group index {
    label "Index"

    operation registerDocuments {
      title "ドキュメント登録"

      request {
        method POST
        url "./api/index/registerDocuments"
        contentType "text/plain"
        body raw field formbody
      }

      field epCompanyId : select in query {
        label "電力会社"
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

## layout primitive

- `split`
- `stack`
- `tabs`
- `panel`

## ガイドライン

`operations` が正本。  
`layout` は見せ方だけを変える。  
`help` は理解だけを補助する。

