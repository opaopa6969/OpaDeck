import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createExecutionStore,
  createManualClock,
  createRuntimeBus,
  createScheduler,
  createSelectionStore,
} from '../src/index.js';

test('runtime bus publishes synchronously and unsubscribe works', () => {
  const bus = createRuntimeBus();
  const seen = [];
  const unsubscribe = bus.subscribe('selection.changed', (event) => {
    seen.push(event.selection.operationId);
  });
  bus.publish({ kind: 'selection.changed', selection: { operationId: 'index.rebuild' } });
  unsubscribe();
  bus.publish({ kind: 'selection.changed', selection: { operationId: 'index.delete' } });
  assert.deepEqual(seen, ['index.rebuild']);
});

test('manual clock and scheduler drive delayed work deterministically', () => {
  const clock = createManualClock({ startAt: 10 });
  const scheduler = createScheduler({ clock });
  const seen = [];
  scheduler.after(15, () => seen.push(['after', clock.now()]));
  scheduler.every(20, () => seen.push(['every', clock.now()]));
  clock.advanceBy(19);
  assert.deepEqual(seen, [['after', 25]]);
  clock.advanceBy(1);
  assert.deepEqual(seen, [['after', 25], ['every', 30]]);
  clock.advanceBy(20);
  assert.deepEqual(seen, [['after', 25], ['every', 30], ['every', 50]]);
});

test('selection store emits only on actual changes', () => {
  const bus = createRuntimeBus();
  const store = createSelectionStore({ bus });
  let busEvents = 0;
  bus.subscribe('selection.changed', () => {
    busEvents++;
  });
  store.set({ operationId: 'index.rebuild' });
  store.set({ operationId: 'index.rebuild' });
  store.set({ fieldId: 'payload' });
  assert.equal(busEvents, 2);
  assert.deepEqual(store.get(), {
    groupId: null,
    operationId: 'index.rebuild',
    fieldId: 'payload',
    resultId: null,
    panelId: null,
  });
});

test('execution store records lifecycle and history', () => {
  const clock = createManualClock({ startAt: 100 });
  const bus = createRuntimeBus();
  const store = createExecutionStore({ clock, bus, historyLimit: 2 });
  const kinds = [];
  bus.subscribe('execution.started', (event) => kinds.push(event.kind));
  bus.subscribe('execution.success', (event) => kinds.push(event.kind));

  const current = store.begin({
    operationFqid: 'index.rebuild',
    requestPreview: { method: 'post', url: '/api/rebuild', headers: { 'x-test': '1' } },
  });
  assert.equal(current.status, 'running');
  clock.advanceBy(25);
  const done = store.succeed({
    status: 200,
    statusText: 'OK',
    contentType: 'application/json',
    bodyText: '{"ok":true}',
    bodyJson: { ok: true },
  });
  assert.equal(done.status, 'success');
  assert.equal(done.response.durationMs, 25);
  assert.equal(store.current(), null);
  assert.equal(store.history().length, 1);
  assert.deepEqual(kinds, ['execution.started', 'execution.success']);
});
