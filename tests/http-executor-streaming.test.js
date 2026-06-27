import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createExecutionStore,
  createHttpExecutor,
  createManualClock,
  createRuntimeBus,
} from '../src/index.js';

const NDJSON_OP = {
  id: 'stream',
  groupId: 'core',
  request: { method: 'GET', url: '/api/stream' },
  fields: [],
};

// A Response whose body streams the given chunks through a getReader().
function streamingResponse(contentType, chunks) {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) {
              return { value: undefined, done: true };
            }
            return { value: encoder.encode(chunks[index++]), done: false };
          },
        };
      },
    },
  };
}

test('onProgress fires per completed line and final record holds full body', async () => {
  const clock = createManualClock({ startAt: 0 });
  const bus = createRuntimeBus();
  const executions = createExecutionStore({ bus, clock });

  const progress = [];
  // chunks split a line across two reads to prove partial lines are buffered
  const chunks = ['{"a":1}\n{"a"', ':2}\n', '{"a":3}\n'];
  const fetchImpl = async () => streamingResponse('application/x-ndjson', chunks);
  const executor = createHttpExecutor({
    executions,
    clock,
    fetch: fetchImpl,
    onProgress: (info) => progress.push(info),
  });

  const record = await executor.execute(NDJSON_OP, {});

  // a half-line ('{"a"') must not have produced a progress emit on its own
  for (const p of progress.slice(0, -1)) {
    assert.ok(!p.done, 'only the last emit is done');
  }
  const done = progress[progress.length - 1];
  assert.equal(done.done, true);
  assert.equal(done.operationFqid, 'core.stream');
  assert.equal(done.bodyText, '{"a":1}\n{"a":2}\n{"a":3}\n');

  // intermediate emits are monotonic prefixes of the full body
  assert.ok(progress.length >= 2, 'streamed in more than one emit');
  assert.ok(done.bodyText.startsWith(progress[0].bodyText));

  // the execution store still sees a normal success with the full body
  assert.equal(record.status, 'success');
  assert.equal(record.response.bodyText, '{"a":1}\n{"a":2}\n{"a":3}\n');
});

test('non-streaming responses ignore onProgress', async () => {
  const clock = createManualClock({ startAt: 0 });
  const executions = createExecutionStore({ clock });
  const progress = [];
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
    async text() { return '{"ok":true}'; },
  });
  const executor = createHttpExecutor({ executions, clock, fetch: fetchImpl, onProgress: (i) => progress.push(i) });
  const record = await executor.execute(NDJSON_OP, {});
  assert.equal(progress.length, 0);
  assert.deepEqual(record.response.bodyJson, { ok: true });
});
