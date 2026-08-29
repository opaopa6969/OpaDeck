# ISSUE-017: Tour Emits stepChanged And Re-renders The Card After finish()

[glm-hunt]

## Summary

`createTourRuntime`'s player gates `start()` with a `started` flag and `finish()`
with a `finished` flag, but `next()`, `prev()`, and `goTo()` are **not** gated.
After a tour is finished, calling `next()`/`prev()`/`goTo()` still calls
`enter()`, which publishes `tour.stepChanged` **after** `tour.finished` and calls
`overlay.renderStep()` again — re-showing a card the overlay already hid via
`overlay.finish()`.

## Reproduction

```js
import {
  createTourRuntime, createRuntimeBus,
  createDefaultTourCommandHandlers, createTourCommandHandlerRegistry,
} from './src/index.js';

const bus = createRuntimeBus();
const events = [];
for (const kind of ['tour.started', 'tour.stepChanged', 'tour.finished']) {
  bus.subscribe(kind, (e) => events.push([e.kind, e.step ? e.step.index : null]));
}
const overlayCalls = [];
const overlay = {
  start: () => overlayCalls.push('start'),
  renderStep: (info) => overlayCalls.push(['renderStep', info.index]),
  finish: () => overlayCalls.push('finish'),
};
const runtime = createTourRuntime({
  bus, overlay,
  handlers: createTourCommandHandlerRegistry().registerAll(createDefaultTourCommandHandlers()),
  resolveElement: () => null,
});
const player = runtime.play({
  id: 't', title: 'T',
  steps: [
    { id: 's1', title: 'one', commands: [] },
    { id: 's2', title: 'two', commands: [] },
  ],
});
// play() -> start() -> enter(0). index = 0.
await player.finish();      // publishes tour.finished, calls overlay.finish()
await player.next();        // should be a no-op; actually re-enters step 1.
console.log(events);        // [..., ['tour.finished',null], ['tour.stepChanged',1]]
console.log(overlayCalls);  // [..., 'finish', ['renderStep',1]]
```

Observed output:

```
events after finish:   [['tour.started',null],['tour.stepChanged',0],['tour.finished',null]]
overlay after finish:  ['start',['renderStep',0],'finish']
events after next:     [['tour.started',null],['tour.stepChanged',0],['tour.finished',null],['tour.stepChanged',1]]
overlay after next:    ['start',['renderStep',0],'finish',['renderStep',1]]
```

`tour.stepChanged` fires **after** `tour.finished`, and the overlay card is
re-rendered after `overlay.finish()` hid it.

## Affected file

`src/tour/runtime.js:70-92`

```js
next() {
  if (index >= steps.length - 1) {
    return controls.finish();
  }
  return enter(index + 1);        // no `finished` guard
},
prev() {
  return enter(Math.max(0, index - 1));   // no `finished` guard
},
goTo(target) {
  return enter(clamp(target, 0, steps.length - 1));   // no `finished` guard
},
finish() {
  if (finished) return Promise.resolve();
  finished = true;
  ...
  publish('tour.finished', ...);
  return Promise.resolve();
},
```

## Expected vs actual

- **Expected:** once `finish()` has run, `next()`/`prev()`/`goTo()` are no-ops
  (return a resolved promise, publish nothing, do not touch the overlay) —
  matching how `start()` is gated by `started`.
- **Actual:** they call `enter()`, which advances `index`, publishes
  `tour.stepChanged`, and calls `overlay.renderStep()` — re-showing the card.

## Impact

- Hosts that re-layout on `tour.stepChanged` get a spurious event after the tour
  is over.
- The overlay card reappears after the user already dismissed/finished the tour
  (the overlay path calls `overlay.finish()` which hides the card; a subsequent
  `renderStep()` shows it again).
- `player.index` advances past `finish()`, so any host introspection of the
  player state is inconsistent with `finished`.

## Acceptance criteria

- After `finish()`, `next()`, `prev()`, and `goTo()` each return a resolved
  promise without publishing events or calling `overlay.renderStep()`.
- `player.index` does not change after `finish()`.
- A test in `tests/tour.test.js` plays a multi-step tour, calls `finish()`, then
  `next()`, and asserts no `tour.stepChanged` is published after `tour.finished`
  and `overlay.renderStep` is not called post-`finish`.
- `npm test` passes.

## Out of scope

- Adding an explicit `abort()`/`skip()` API for stuck tours (separate concern).
- Changing the overlay's `finish()` semantics.

## Notes

The fix mirrors the existing `started` guard: add
`if (finished) return Promise.resolve();` to `next()`/`prev()`/`goTo()`
(or a single guard at the top of `enter()`). The existing tour test
(`tests/tour.test.js:41-84`) only calls `next()` past the last step to trigger
`finish()`; it never calls `next()` **after** `finish()`, so this slips through.
