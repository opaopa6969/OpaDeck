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

test('scheduler.every rejects a zero or non-finite period instead of hanging the clock', () => {
  const clock = createManualClock({ startAt: 0 });
  const scheduler = createScheduler({ clock });
  assert.throws(() => scheduler.every(0, () => {}), RangeError);
  assert.throws(() => scheduler.every(-5, () => {}), RangeError);
  assert.throws(() => scheduler.every(NaN, () => {}), RangeError);
  assert.throws(() => scheduler.every(Infinity, () => {}), RangeError);
  assert.equal(clock.pendingCount(), 0);
});

test('scheduler.after rejects a negative or non-finite delay', () => {
  const clock = createManualClock({ startAt: 0 });
  const scheduler = createScheduler({ clock });
  assert.throws(() => scheduler.after(-1, () => {}), RangeError);
  assert.throws(() => scheduler.after(NaN, () => {}), RangeError);
  const seen = [];
  scheduler.after(0, () => seen.push('immediate'));
  clock.advanceBy(0);
  assert.deepEqual(seen, ['immediate']);
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
  const done = store.succeed(current.id, {
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

test('execution store accumulates runs and removes one by id', () => {
  const clock = createManualClock({ startAt: 0 });
  const bus = createRuntimeBus();
  const store = createExecutionStore({ clock, bus });
  const removed = [];
  bus.subscribe('execution.removed', (event) => removed.push(event.id));

  const ids = [];
  for (const op of ['a', 'b', 'c']) {
    const started = store.begin({ operationFqid: `g.${op}`, requestPreview: { method: 'GET', url: `/${op}` } });
    ids.push(store.succeed(started.id, { status: 200, bodyText: '{}' }).id);
  }
  assert.equal(store.history().length, 3); // runs accumulate for comparison

  const target = ids[1];
  assert.equal(store.remove(target), true);
  assert.equal(store.remove(target), false); // already gone
  assert.equal(store.history().length, 2);
  assert.ok(!store.history().some((record) => record.id === target));
  assert.deepEqual(removed, [target]);
});

test('execution store tracks two overlapping executions independently', () => {
  const clock = createManualClock({ startAt: 0 });
  const bus = createRuntimeBus();
  const store = createExecutionStore({ clock, bus });
  const kinds = [];
  bus.subscribe('execution.started', (event) => kinds.push([event.kind, event.record.id]));
  bus.subscribe('execution.success', (event) => kinds.push([event.kind, event.record.id]));

  const a = store.begin({ operationFqid: 'g.a', requestPreview: { method: 'GET', url: '/a' } });
  const b = store.begin({ operationFqid: 'g.b', requestPreview: { method: 'GET', url: '/b' } });
  assert.notEqual(a.id, b.id);

  // Completion order is reversed from start order: A finishes before B.
  const doneA = store.succeed(a.id, { status: 200, bodyText: 'response-A' });
  assert.equal(doneA.id, a.id);
  assert.equal(doneA.operationFqid, 'g.a');
  assert.equal(doneA.response.bodyText, 'response-A');

  const doneB = store.succeed(b.id, { status: 200, bodyText: 'response-B' });
  assert.equal(doneB.id, b.id);
  assert.equal(doneB.operationFqid, 'g.b');
  assert.equal(doneB.response.bodyText, 'response-B');

  const history = store.history();
  assert.equal(history.length, 2);
  assert.deepEqual(history.map((record) => record.operationFqid).sort(), ['g.a', 'g.b']);
  assert.deepEqual(kinds, [
    ['execution.started', a.id],
    ['execution.started', b.id],
    ['execution.success', a.id],
    ['execution.success', b.id],
  ]);
});

test('finalizing an unknown or already-terminated execution id is a no-op', () => {
  const clock = createManualClock({ startAt: 0 });
  const store = createExecutionStore({ clock });
  assert.equal(store.succeed('exec_missing', { status: 200 }), null);

  const started = store.begin({ operationFqid: 'g.a', requestPreview: { method: 'GET', url: '/a' } });
  const first = store.succeed(started.id, { status: 200 });
  assert.equal(first.status, 'success');
  assert.equal(store.succeed(started.id, { status: 200 }), null, 'already-terminated id does not overwrite history');
  assert.equal(store.history().length, 1);
});
