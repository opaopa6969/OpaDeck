# OpaDeck Runtime Orchestration

## 目的

この文書は、**rendering の下** かつ **semantic core の上** にある runtime service を定義する。

中心の問いはこれ。

- OpaDeck に software bus は必要か
- clock/sync infrastructure は必要か
- その関心はどこで止めるべきか

## 判断の要約

短く言うとこう。

- **small typed runtime bus** は必要
- **clock abstraction** は必要
- **scheduler** は必要
- **sync domain** は後からならあり
- ただし **genlock/media-sync framework** を最初の core に入れる必要はない

OpaDeck は internal ops workbench であって、DAW でも game engine でも distributed event platform でもない。

## 1. Runtime bus: 必要。ただし小さく

OpaDeck に bus が必要なのは、次の部品を疎結合にしたいから。

- selection change
- field change
- datasource load
- operation execution lifecycle
- result arrival
- help/tour action
- layout state change

bus が無いと、panel renderer や helper が互いに直接結合しやすい。

それはすぐ brittle になる。

## この bus が意味するもの

- in-process
- 1つの OpaDeck runtime instance に閉じる
- typed
- 既定では synchronous
- UI/runtime coordination に使う

## この bus が意味しないもの

- distributed event bus ではない
- message persistence ではない
- 既定で cross-tab sync はしない
- plugin marketplace protocol ではない
- enterprise middleware ではない

## 候補 shape

```ts
interface RuntimeBus {
  publish<E extends RuntimeEvent>(event: E): void;
  subscribe<E extends RuntimeEventKind>(
    kind: E,
    handler: (event: RuntimeEventByKind<E>) => void
  ): Unsubscribe;
}

type Unsubscribe = () => void;
```

## Event family

event catalog は narrow に保つべき。

候補:

- `selection.changed`
- `field.changed`
- `field.focused`
- `datasource.loading`
- `datasource.resolved`
- `datasource.failed`
- `execution.started`
- `execution.succeeded`
- `execution.failed`
- `execution.cancelled`
- `result.rendered`
- `help.opened`
- `tour.started`
- `tour.stepChanged`
- `layout.changed`

## 利用ルール

bus は coordination に使う。
hidden business logic に使ってはいけない。

良い例:

- result panel が execution 完了を知る
- tour overlay が operation focus に反応する
- history panel が execution を記録する

悪い例:

- field A が opaque handler 経由で field B を勝手に mutate する
- request semantics が subscription の中に埋まる

semantic rule は bus listener ではなく core runtime に置くべき。

## 2. Clock abstraction: 必要

OpaDeck は早い段階で clock abstraction を持つべき。

理由:

- tour に timed step がありうる
- execution history に timestamp が必要
- loading/retry state に elapsed time が必要
- chart や map が将来 animation するかもしれない
- test では deterministic time が欲しい

## 候補 shape

```ts
interface Clock {
  now(): number;
  schedule(task: () => void, delayMs: number): Cancel;
}

type Cancel = () => void;
```

duration には monotonic clock を優先する。

wall time が必要なら、それは別 concern として扱うべき。

## 3. Scheduler: 必要

clock だけでは UI/runtime には少し raw すぎる。

OpaDeck は小さな scheduler service も持つべき。

候補 shape:

```ts
interface Scheduler {
  after(delayMs: number, task: () => void): Cancel;
  every(periodMs: number, task: () => void): Cancel;
  frame?(task: (ts: number) => void): Cancel;
}
```

メモ:

- `after` と `every` があれば help/tour や polling はかなり足りる
- `frame` は optional だが SVG/map/animation 系で有効

## 4. Sync domain: 後からならあり

time-sensitive な surface が増えるなら、app-wide の単一 clock だけでは粗い可能性がある。

そこで `SyncDomain` が効く。

例:

- `ui`
- `tour`
- `map`
- `chart`
- `audio`

候補 shape:

```ts
interface SyncDomain {
  id: string;
  clock: Clock;
  scheduler: Scheduler;
}
```

これでも full media framework よりはかなり小さい。

## 5. Genlock: core v1 には入れない

full genlock 的な同期基盤は OpaDeck v1 には過剰。

理由:

- 多くの operation は request/response 中心
- 多くの result は static か軽い interactive に留まる
- 複数 renderer が frame-perfect に同期すべき evidence はまだない

将来の trigger:

- map と chart の同期 playback
- incident replay の timeline 駆動
- audio/tour/visual cue の同期

そこまでは scheduler + optional `frame()` で十分。

## 6. これらの runtime service はどこに置くか

これらは **semantic core ではなく runtime package** に置くべき。

closed semantic core:

- app definition
- operation definition
- field definition
- layout AST
- request execution contract

runtime orchestration layer:

- bus
- clock
- scheduler
- execution store
- selection store
- layout runtime state

これで憲法を守れる。

## 7. Runtime state contract

これらの model は runtime layer 側で標準化する。

## Request preview

```ts
interface RequestPreviewModel {
  method: string;
  url: string;
  headers: Record<string, string>;
  bodyText?: string;
  curl?: string;
}
```

## Response snapshot

```ts
interface ResponseSnapshot {
  status: number;
  statusText: string;
  contentType: string | null;
  bodyText: string;
  bodyJson?: unknown;
  receivedAt: number;
  durationMs: number;
}
```

## Execution record

```ts
interface ExecutionRecord {
  id: string;
  operationFqid: string;
  startedAt: number;
  finishedAt?: number;
  status: 'idle' | 'running' | 'success' | 'error' | 'cancelled' | 'timeout';
  requestPreview: RequestPreviewModel;
  response?: ResponseSnapshot;
  problems: ProblemEntry[];
}
```

## Store

```ts
interface ExecutionStore {
  current(): ExecutionRecord | null;
  history(): ExecutionRecord[];
  subscribe(listener: () => void): Unsubscribe;
}

interface SelectionStore {
  get(): UiSelection;
  set(next: Partial<UiSelection>): void;
  subscribe(listener: () => void): Unsubscribe;
}
```

これらの store は runtime state であって、semantic core ではない。

## 8. Registry との関係

registry は runtime service を使ってよいが、所有してはいけない。

例:

- `geoScene` panel renderer が `frame()` を使う
- `TourCommandHandler` が runtime event を publish する
- `ResultRenderer` が context 越しに selection state を使う

しかし bus と clock は runtime shell が供給すべきで、plugin 側が再実装するものではない。

## 9. Testing 面での利点

この bus/clock/scheduler 層の価値は、かなりの部分が testability にある。

利点:

- deterministic な tour test
- deterministic な retry/loading test
- deterministic な animation/timed-help test
- execution lifecycle の明確な assertion

実装が小さくても、早めに abstraction を入れる強い理由になる。

## 推奨する v1 runtime surface

```ts
interface RuntimeServices {
  bus: RuntimeBus;
  clock: Clock;
  scheduler: Scheduler;
  selection: SelectionStore;
  executions: ExecutionStore;
}
```

これで次を十分支えられる。

- tour
- execution history
- selection coordination
- map/chart animation hook
- predictable test

## Bottom line

OpaDeck には runtime orchestration layer が必要。
ただし大きくしてはいけない。

作るべきもの:

- typed local runtime bus
- clock abstraction
- small scheduler

作るべきでないもの:

- distributed software bus
- media engine
- genlock framework

後で深い同期が本当に必要になったら、同じ runtime foundation の上に `SyncDomain` を足す。
