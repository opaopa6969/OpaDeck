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

`fieldset`(と operation 内で対になる `include`)はどちらでもない。コンパイル後の
model には一切現れない、純粋な compile-time の DSL sugar。詳細は下記
「field fragment(`fieldset` + `include`)」参照。

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

## field fragment(`fieldset` + `include`)

`fieldset` は複数の operation でフィールド群を共有するための compile-time 専用の
sugar。compiled model の一部ではない: `include` は fragment のフィールドを
deep-copy して、include した operation の `fields` へ splice する。core は
plain field の羅列しか見ず、fieldset の存在を一切知らない。

`fieldset` ブロックは `datasource` / `group` と同じく app top level で宣言し、
それを `include` する operation より前に置く必要がある:

```opsui
app VacantOps v1 {
  fieldset addressSep {
    field zip : text in query {
      label "郵便番号"
    }
    field pref : text in query {
      label "都道府県"
    }
  }

  group index {
    operation search {
      title "検索"
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

ルール:

- `include <id>` は `operation` ブロック内でのみ有効(`field` と同じ場所)。
- 未宣言の fieldset を参照すると located な `dsl.parse.error`
  (`Unknown fieldset '<id>'. Declare it before the operation that includes it.`)。
- 同じ field id が二重に(2つの include、または include とリテラル `field` の
  組み合わせで)出現した場合は既存の `field.id.duplicate` チェックが捕捉する。
  fieldset だからといって id 一意性の対象外にはならない。

## layout primitive

- `split <id> <row|column> { ... }` — 子ノードは厳密に2個。省略可能な
  `sizes <a> <b>` には有限の数値ウェイトを2個指定する
- `stack`
- `tabs`
- `panel`

## ガイドライン

`operations` が正本。  
`layout` は見せ方だけを変える。  
`help` は理解だけを補助する。
