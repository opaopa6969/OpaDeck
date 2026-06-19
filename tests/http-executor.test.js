import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRequestPreview,
  createExecutionStore,
  createHttpExecutor,
  createManualClock,
  createRuntimeBus,
  operationFqid,
} from '../src/index.js';

const GET_OP = {
  id: 'search',
  groupId: 'index',
  request: { method: 'GET', url: '/api/index/search' },
  fields: [
    { id: 'q', name: 'query', type: 'text', placement: 'query' },
    { id: 'limit', name: 'limit', type: 'text', placement: 'query' },
    { id: 'token', name: 'x-token', type: 'text', placement: 'header' },
  ],
};

const POST_OP = {
  id: 'rebuild',
  groupId: 'index',
  request: {
    method: 'POST',
    url: '/api/index/rebuild',
    contentType: 'text/plain',
    body: { kind: 'rawField', fieldId: 'payload' },
    timeoutMs: 50,
  },
  fields: [
    { id: 'payload', name: 'payload', type: 'textarea', placement: 'body' },
  ],
};

function fakeResponse(input) {
  return {
    ok: input.status >= 200 && input.status < 400,
    status: input.status,
    statusText: input.statusText || '',
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? input.contentType || null : null) },
    async text() {
      return input.bodyText || '';
    },
  };
}

test('buildRequestPreview serializes GET query, headers and curl', () => {
  const preview = buildRequestPreview(GET_OP, { q: 'hello world', limit: '10', token: 'abc' }, { baseUrl: 'https://api.example.com' });
  assert.equal(preview.method, 'GET');
  assert.equal(preview.url, 'https://api.example.com/api/index/search?query=hello+world&limit=10');
  assert.equal(preview.headers['x-token'], 'abc');
  assert.equal(preview.bodyText, undefined);
  assert.match(preview.curl, /^curl 'https:\/\/api\.example\.com/);
  assert.match(preview.curl, /-H 'x-token: abc'/);
});

test('buildRequestPreview serializes raw body and content-type for POST', () => {
  const preview = buildRequestPreview(POST_OP, { payload: '{"ok":true}' });
  assert.equal(preview.method, 'POST');
  assert.equal(preview.bodyText, '{"ok":true}');
  assert.equal(preview.headers['content-type'], 'text/plain');
  assert.match(preview.curl, /-X POST/);
  assert.match(preview.curl, /--data-raw '\{"ok":true\}'/);
});

test('path params and array query values are serialized', () => {
  const op = {
    id: 'get', groupId: 'doc',
    request: { method: 'GET', url: '/api/doc/:id' },
    fields: [
      { id: 'id', name: 'id', placement: 'path' },
      { id: 'tag', name: 'tag', placement: 'query' },
    ],
  };
  const preview = buildRequestPreview(op, { id: 'a/b', tag: ['x', 'y'] });
  assert.equal(preview.url, '/api/doc/a%2Fb?tag=x&tag=y');
});

test('operationFqid uses groupId when present', () => {
  assert.equal(operationFqid(GET_OP), 'index.search');
  assert.equal(operationFqid({ id: 'bare' }), 'bare');
});

test('execute records success and publishes execution events', async () => {
  const clock = createManualClock({ startAt: 0 });
  const bus = createRuntimeBus();
  const executions = createExecutionStore({ clock, bus });
  const kinds = [];
  for (const k of ['execution.started', 'execution.success', 'execution.error', 'execution.timeout', 'execution.cancelled']) {
    bus.subscribe(k, (event) => kinds.push(event.kind));
  }
  const calls = [];
  const executor = createHttpExecutor({
    executions,
    clock,
    AbortController: globalThis.AbortController,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return fakeResponse({ status: 200, statusText: 'OK', contentType: 'application/json', bodyText: '{"ok":true}' });
    },
  });

  const record = await executor.execute(POST_OP, { payload: '{"ok":true}' });
  assert.equal(record.status, 'success');
  assert.equal(record.response.status, 200);
  assert.deepEqual(record.response.bodyJson, { ok: true });
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, '{"ok":true}');
  assert.deepEqual(kinds, ['execution.started', 'execution.success']);
});

test('execute maps a non-2xx response to an error record with a snapshot', async () => {
  const clock = createManualClock({ startAt: 0 });
  const executions = createExecutionStore({ clock });
  const executor = createHttpExecutor({
    executions,
    clock,
    AbortController: globalThis.AbortController,
    fetch: async () => fakeResponse({ status: 500, statusText: 'Server Error', contentType: 'text/plain', bodyText: 'boom' }),
  });
  const record = await executor.execute(GET_OP, { q: 'x' });
  assert.equal(record.status, 'error');
  assert.equal(record.response.status, 500);
  assert.ok(record.problems.some((p) => p.code === 'execution.http.status'));
});

test('execute maps a thrown fetch to a network error record', async () => {
  const clock = createManualClock({ startAt: 0 });
  const executions = createExecutionStore({ clock });
  const executor = createHttpExecutor({
    executions,
    clock,
    AbortController: globalThis.AbortController,
    fetch: async () => {
      throw new Error('connection refused');
    },
  });
  const record = await executor.execute(GET_OP, { q: 'x' });
  assert.equal(record.status, 'error');
  assert.equal(record.response, undefined);
  assert.ok(record.problems.some((p) => p.code === 'execution.network' && /connection refused/.test(p.message)));
});

test('execute maps a timeout via the clock to a timeout record', async () => {
  const clock = createManualClock({ startAt: 0 });
  const executions = createExecutionStore({ clock });
  const executor = createHttpExecutor({
    executions,
    clock,
    AbortController: globalThis.AbortController,
    // fetch only settles when the request is aborted.
    fetch: (url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }),
  });
  const promise = executor.execute(POST_OP, { payload: 'x' }); // timeoutMs: 50
  clock.advanceBy(50);
  const record = await promise;
  assert.equal(record.status, 'timeout');
  assert.ok(record.problems.some((p) => p.code === 'execution.timeout'));
});

test('execute maps an external cancel signal to a cancelled record', async () => {
  const clock = createManualClock({ startAt: 0 });
  const executions = createExecutionStore({ clock });
  const controller = new globalThis.AbortController();
  const executor = createHttpExecutor({
    executions,
    clock,
    AbortController: globalThis.AbortController,
    fetch: (url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }),
  });
  const promise = executor.execute(GET_OP, { q: 'x' }, { signal: controller.signal });
  controller.abort();
  const record = await promise;
  assert.equal(record.status, 'cancelled');
  assert.ok(record.problems.some((p) => p.code === 'execution.cancelled'));
});
