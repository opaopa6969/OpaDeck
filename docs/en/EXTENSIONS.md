# OpaDeck Extensions

## Intent

OpaDeck should support extension points, but it should **not** begin as a full plugin platform.

The design choice is:

- closed semantic core
- open typed registries at the edges

That keeps the framework small while still allowing growth.

## What we mean by “extensions”

In OpaDeck v1, “extension” means:

- a typed interface
- registered locally in code
- resolved by id

It does **not** mean:

- dynamic loading from arbitrary packages
- version negotiation
- marketplace/distribution
- sandboxed third-party execution

## Why registry-based architecture

We already know these areas will vary by application:

- field widgets
- result rendering
- panel rendering
- remote data-source fetching/mapping
- help presentation
- tour command execution

But the semantic core should remain fixed.

Registries may depend on runtime services supplied by the host shell.
They should not create their own private bus/clock/scheduler layer.

## Registry set

OpaDeck should start with these registries:

- `FieldRendererRegistry`
- `ResultRendererRegistry`
- `PanelRendererRegistry`
- `DataSourceAdapterRegistry`

Optional later:

- `HelpRendererRegistry`
- `TourCommandHandlerRegistry`

## 1. Field renderer registry

Purpose:

- render a `FieldDefinition`
- handle user input
- report UI-local concerns like focus/open state

```ts
interface FieldRenderer {
  id: string;
  supports(field: FieldDefinition): boolean;
  render(ctx: FieldRenderContext): RenderOutput;
}

interface FieldRenderContext {
  app: AppDefinition;
  operation: OperationDefinition;
  field: FieldDefinition;
  value: unknown;
  options?: OptionItem[];
  problems: ProblemEntry[];
  disabled: boolean;
  runtime: RuntimeServices;
  onChange(value: unknown): void;
}
```

Examples:

- text
- textarea
- checkbox
- select
- autocomplete
- code/json editor

## 2. Result renderer registry

Purpose:

- render an operation result payload
- choose behavior based on content type or explicit result definition

```ts
interface ResultRenderer {
  id: string;
  canRender(ctx: ResultRenderContext): boolean;
  render(ctx: ResultRenderContext): RenderOutput;
}

interface ResultRenderContext {
  operation: OperationDefinition;
  resultView?: ResultViewDefinition;
  execution?: ExecutionRecord;
  status: number;
  statusText: string;
  contentType: string | null;
  bodyText: string;
  bodyJson?: unknown;
  problems?: ProblemEntry[];
  runtime: RuntimeServices;
}
```

Examples:

- `jsonFoldable`
- `jsonLines`
- `htmlFrame`
- `inlineSvg`
- `text`
- custom stats views

## 3. Panel renderer registry

Purpose:

- render layout panels from `PanelNode`
- connect a binding (`selection`, `results`, `allGroups`, etc.) to a concrete view

```ts
interface PanelRenderer {
  id: string;
  render(ctx: PanelRenderContext): RenderOutput;
}

interface PanelRenderContext {
  app: AppDefinition;
  panel: PanelNode;
  selection: UiSelection;
  layoutState: LayoutRuntimeState;
  executions: ExecutionStore;
  runtime: RuntimeServices;
}
```

Examples:

- `groupNav`
- `groupCards`
- `operationTiles`
- `operationDetail`
- `groupSections`
- `resultStack`
- `helpPanel`
- `markdown`

## 4. Data-source adapter registry

Purpose:

- resolve `DataSourceDefinition`
- execute remote fetches
- normalize output into `OptionItem[]`

```ts
interface DataSourceAdapter {
  id: string; // usually matches DataSourceKind
  resolve(ctx: DataSourceResolveContext): Promise<DataSourceResolvedValue>;
}

interface DataSourceResolveContext {
  app: AppDefinition;
  dataSource: DataSourceDefinition;
  operation: OperationDefinition;
  field?: FieldDefinition;
  params: Record<string, unknown>;
}

type DataSourceResolvedValue =
  | { kind: 'options'; items: OptionItem[] };
```

Examples:

- `options.static`
- `options.remote`

Later:

- cached remote variants
- custom mapping adapters

## Optional registries

## Help renderer registry

Use only if multiple help presentation styles become necessary.

```ts
interface HelpRenderer {
  id: string;
  render(ctx: HelpRenderContext): RenderOutput;
}
```

Likely not needed in the first usable version.

## Tour command handler registry

This one is useful if tours need to act on different runtime capabilities.

```ts
interface TourCommandHandler<C = TourCommand> {
  kind: C['kind'];
  run(ctx: TourCommandContext, command: C): Promise<void> | void;
}
```

Use this for:

- `focusOperation`
- `focusField`
- `submitOperation`
- `waitResult`
- panel/tab actions

## What must remain outside registries

These should stay in the closed core:

- `AppDefinition`
- `OperationDefinition`
- `FieldDefinition`
- `DataSourceDefinition`
- dependency graph
- validator
- selection model
- layout AST
- request execution contract

If these become extension-driven too early, the framework loses coherence.

## Registration model

The initial model should be simple and local.

```ts
registerFieldRenderer(renderer)
registerResultRenderer(renderer)
registerPanelRenderer(renderer)
registerDataSourceAdapter(adapter)
```

No runtime marketplace.  
No dynamic remote plugin loading.  
No loose “any object with hooks” shape.

## Validation obligations for extensions

The validator should still own structural validation.

Registries may add capability checks, but they should not replace core checks.

Examples:

- unknown `result.renderer`
- unknown panel renderer id
- unknown data-source adapter kind
- field type with no matching renderer

## Design rule

The right mental model is:

- not “plugin system”
- but “typed extension points”

That wording matters, because it keeps expectations realistic.

## Practical recommendation

Start with:

1. field renderer registry
2. result renderer registry
3. panel renderer registry
4. data-source adapter registry

Add help/tour registries only when the core flow is proven.
