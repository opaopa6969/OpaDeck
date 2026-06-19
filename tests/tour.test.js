import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultTourCommandHandlers,
  createManualClock,
  createRuntimeBus,
  createScheduler,
  createSelectionStore,
  createTourCommandHandlerRegistry,
  createTourRuntime,
  tourTargetSelector,
} from '../src/index.js';

function defaultRegistry() {
  return createTourCommandHandlerRegistry().registerAll(createDefaultTourCommandHandlers());
}

test('tourTargetSelector builds stable data-attribute selectors', () => {
  assert.equal(tourTargetSelector({ kind: 'operation', operationId: 'index.rebuild' }), '[data-op-id="index.rebuild"]');
  assert.equal(tourTargetSelector({ kind: 'field', operationId: 'index.rebuild', fieldId: 'payload' }), '[data-field-id="index.rebuild::payload"]');
  assert.equal(tourTargetSelector({ kind: 'panel', panelId: 'nav' }), '[data-panel-id="nav"]');
});

test('command handler registry rejects handlers without run() and resolves by kind', () => {
  const registry = createTourCommandHandlerRegistry();
  assert.throws(() => registry.register({ id: 'bad' }), /run/);
  registry.register({ id: 'noop', run: () => 'ok' });
  assert.equal(registry.runCommand({ kind: 'noop' }), 'ok');
  assert.throws(() => registry.runCommand({ kind: 'unknown' }), /No tour command handler/);
});

test('runtime plays steps, updates selection, resolves targets, and emits events', async () => {
  const bus = createRuntimeBus();
  const selection = createSelectionStore({ bus });
  const events = [];
  for (const kind of ['tour.started', 'tour.stepChanged', 'tour.finished']) {
    bus.subscribe(kind, (event) => events.push([event.kind, event.step ? event.step.index : null, event.selector || null]));
  }
  const resolved = [];
  const runtime = createTourRuntime({
    bus,
    selection,
    handlers: defaultRegistry(),
    resolveElement: (selector) => {
      resolved.push(selector);
      return { selector };
    },
  });

  const tour = {
    id: 'overview',
    title: 'Overview',
    steps: [
      { id: 's1', title: 'Operation', commands: [{ kind: 'focusOperation', operationId: 'index.rebuild' }] },
      { id: 's2', title: 'Panel', commands: [{ kind: 'focusPanel', panelId: 'nav' }] },
    ],
  };

  const player = runtime.play(tour);
  await Promise.resolve();
  assert.equal(selection.get().operationId, 'index.rebuild');
  assert.equal(player.index, 0);

  await player.next();
  assert.equal(selection.get().panelId, 'nav');

  await player.next(); // past last -> finish
  assert.deepEqual(events, [
    ['tour.started', null, null],
    ['tour.stepChanged', 0, '[data-op-id="index.rebuild"]'],
    ['tour.stepChanged', 1, '[data-panel-id="nav"]'],
    ['tour.finished', null, null],
  ]);
  assert.deepEqual(resolved, ['[data-op-id="index.rebuild"]', '[data-panel-id="nav"]']);
});

test('submitOperation delegates to the host instead of owning semantics', async () => {
  const submitted = [];
  const runtime = createTourRuntime({
    handlers: defaultRegistry(),
    submitOperation: (operationId) => {
      submitted.push(operationId);
    },
  });
  const player = runtime.load({
    id: 't', title: 'T',
    steps: [{ id: 's', title: 'Submit', commands: [{ kind: 'submitOperation', operationId: 'index.rebuild' }] }],
  });
  await player.start();
  assert.deepEqual(submitted, ['index.rebuild']);
});

test('waitResult resolves when a matching execution event is published', async () => {
  const bus = createRuntimeBus();
  const clock = createManualClock();
  const scheduler = createScheduler({ clock });
  const runtime = createTourRuntime({ bus, scheduler, handlers: defaultRegistry() });

  let entered = false;
  const player = runtime.load({
    id: 't', title: 'T',
    steps: [{ id: 's', title: 'Wait', commands: [{ kind: 'waitResult', operationId: 'index.rebuild' }] }],
  });
  const startPromise = player.start().then(() => { entered = true; });

  await Promise.resolve();
  assert.equal(entered, false, 'step should still be waiting for the result');

  bus.publish({ kind: 'execution.success', record: { operationFqid: 'index.rebuild' } });
  await startPromise;
  assert.equal(entered, true);
});

test('waitResult gives up after its scheduler timeout', async () => {
  const bus = createRuntimeBus();
  const clock = createManualClock();
  const scheduler = createScheduler({ clock });
  const runtime = createTourRuntime({ bus, scheduler, handlers: defaultRegistry(), waitTimeoutMs: 100 });
  const player = runtime.load({
    id: 't', title: 'T',
    steps: [{ id: 's', title: 'Wait', commands: [{ kind: 'waitResult', operationId: 'never' }] }],
  });
  let done = false;
  const startPromise = player.start().then(() => { done = true; });
  await Promise.resolve();
  assert.equal(done, false);
  clock.advanceBy(100);
  await startPromise;
  assert.equal(done, true);
});
