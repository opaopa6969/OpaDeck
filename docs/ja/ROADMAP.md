# OpaDeck ロードマップ

## Phase 0: Incubation

- naming と constitution を固める
- semantic model を書く
- DSL の形を固める
- 実ユースケースから sample app を書く

## Phase 1: Core object model

- `AppDefinition`
- `GroupDefinition`
- `OperationDefinition`
- `FieldDefinition`
- `DataSourceDefinition`
- `ResultViewDefinition`

## Phase 2: Validator

- id 重複チェック
- field/source binding チェック
- dependency graph チェック
- layout binding チェック
- help/tour target チェック

## Phase 3: Rendering runtime

- simple panel runtime
- left-nav / operation-detail / result-stack
- classic two-pane preset
- three-pane workbench preset

## Phase 4: Help and tour

- help registry
- help panel
- inline help target
- tour runner / player

## Phase 5: DSL parser

- `.opsui` を parse
- object model に compile
- compile 後の validator を実行

## Phase 6: Extraction decision

独立 repo に切り出す条件:

1. 実 migration が 1 本動いている
2. validator が実際に効いている
3. help/tour と layout の抽象が壊れていない
4. 単一アプリを超えた reuse pressure がある

