import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWorkbench,
  createExecutionStore,
  createHttpExecutor,
  createManualClock,
  createRuntimeBus,
} from '../src/index.js';
import { createFakeDocument } from './helpers/fake-dom.js';

const APP = {
  id: 'demo',
  version: 1,
  groups: [
    {
      id: 'core',
      label: 'Core',
      operations: [
        {
          id: 'search',
          groupId: 'core',
          title: 'Search',
          summary: 'GET /api/search',
          request: { method: 'GET', url: '/api/search' },
          fields: [{ id: 'q', name: 'q', type: 'text', placement: 'query', defaultValue: 'hello' }],
        },
        {
          id: 'reload',
          groupId: 'core',
          title: 'Reload cache',
          summary: 'GET /api/reload',
          request: { method: 'GET', url: '/api/reload' },
          fields: [],
        },
      ],
    },
  ],
};

function setup() {
  const doc = createFakeDocument();
  const nav = doc.createElement('div');
  const detail = doc.createElement('div');
  const results = doc.createElement('div');

  const clock = createManualClock();
  const bus = createRuntimeBus();
  const executions = createExecutionStore({ bus, clock });
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
      async text() { return JSON.stringify({ ok: true }); },
    };
  };
  const executor = createHttpExecutor({ executions, clock, fetch: fetchImpl });
  const workbench = createWorkbench({ document: doc, app: APP, mounts: { nav, detail, results }, executor, executions });
  return { doc, nav, detail, results, workbench, calls, clock };
}

test('workbench renders nav for every operation', () => {
  const { nav } = setup();
  const items = nav.querySelectorAll('.opa-nav-item');
  assert.equal(items.length, 2);
});

test('selecting an operation renders its form and a live preview', () => {
  const { detail, workbench } = setup();
  workbench.selectOperation('core.search');
  assert.equal(detail.querySelectorAll('.opa-field').length, 1);
  const previewUrl = detail.querySelector('.opa-preview-url');
  assert.ok(previewUrl);
  assert.equal(previewUrl.textContent, '/api/search?q=hello');
});

test('field edits update the preview without re-rendering the form', () => {
  const { detail, workbench } = setup();
  workbench.selectOperation('core.search');
  const formBefore = detail.querySelector('.opa-field');
  const input = detail.querySelector('.opa-input');
  input.value = 'world';
  input.dispatch('input', { target: input });
  const formAfter = detail.querySelector('.opa-field');
  assert.equal(formBefore, formAfter, 'the form element must be the same instance (no re-render)');
  assert.equal(detail.querySelector('.opa-preview-url').textContent, '/api/search?q=world');
});

test('running an operation executes it and renders a result card', async () => {
  const { detail, results, workbench, calls } = setup();
  workbench.selectOperation('core.search');

  const submit = detail.querySelector('.opa-submit');
  assert.ok(submit, 'submit button is rendered');
  submit.click();

  // let the async executor + execution subscription settle
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(calls, ['/api/search?q=hello']);
  const card = results.querySelector('.opa-result-card');
  assert.ok(card, 'a result card is rendered');
  assert.ok(results.querySelector('.opa-badge-success'));
});

test('filter narrows the nav', () => {
  const { nav, workbench } = setup();
  workbench.setFilter('reload');
  const items = nav.querySelectorAll('.opa-nav-item');
  assert.equal(items.length, 1);
  assert.equal(items[0].textContent, 'Reload cache');
});
