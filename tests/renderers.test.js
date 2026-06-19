import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBuiltinFieldRenderers,
  createBuiltinPanelRenderers,
  createBuiltinResultRenderers,
  createFieldRendererRegistry,
  createPanelRendererRegistry,
  createResultRendererRegistry,
  registerBuiltinRenderers,
} from '../src/index.js';
import { createFakeDocument } from './helpers/fake-dom.js';

function fieldRenderer(id) {
  return createBuiltinFieldRenderers().find((r) => r.id === id);
}
function resultRenderer(id) {
  return createBuiltinResultRenderers().find((r) => r.id === id);
}
function panelRenderer(id) {
  return createBuiltinPanelRenderers().find((r) => r.id === id);
}

test('text field renderer emits a stable data-field-id and reports changes', () => {
  const document = createFakeDocument();
  const changes = [];
  const el = fieldRenderer('text').render({
    document,
    operationId: 'index.rebuild',
    field: { id: 'q', name: 'query', type: 'text', label: 'Query' },
    value: 'hi',
    onChange: (value) => changes.push(value),
  });
  assert.equal(el.dataset.fieldId, 'index.rebuild::q');
  const input = el.querySelector('input');
  assert.equal(input.value, 'hi');
  assert.equal(input.name, 'query');
  input.value = 'world';
  input.dispatch('input', { target: input });
  assert.deepEqual(changes, ['world']);
});

test('checkbox field renderer reads checked state', () => {
  const document = createFakeDocument();
  const changes = [];
  const el = fieldRenderer('checkbox').render({
    document,
    operationId: 'op',
    field: { id: 'flag', type: 'checkbox' },
    value: true,
    onChange: (value) => changes.push(value),
  });
  const input = el.querySelector('[type="checkbox"]');
  assert.equal(input.checked, true);
  input.checked = false;
  input.dispatch('change', { target: input });
  assert.deepEqual(changes, [false]);
});

test('select field renderer renders options and marks the selected one', () => {
  const document = createFakeDocument();
  const el = fieldRenderer('select').render({
    document,
    operationId: 'op',
    field: { id: 'region', type: 'select' },
    value: 'kanto',
    options: [{ value: 'kansai', label: 'Kansai' }, { value: 'kanto', label: 'Kanto' }],
  });
  const options = el.querySelectorAll('option');
  assert.equal(options.length, 2);
  assert.equal(options[1].selected, true);
  assert.equal(options[0].selected, false);
});

test('jsonFoldable renders a real tree of the response json', () => {
  const document = createFakeDocument();
  const renderer = resultRenderer('jsonFoldable');
  assert.equal(renderer.canRender({ bodyJson: { a: 1 } }), true);
  const el = renderer.render({ document, bodyJson: { ok: true, items: [1, 2] } });
  const summaries = el.querySelectorAll('summary').map((s) => s.textContent);
  assert.ok(summaries.some((t) => /object\(2\)/.test(t)));
  assert.ok(summaries.some((t) => /items: array\(2\)/.test(t)));
  const leaves = el.querySelectorAll('.opa-json-value').map((s) => s.textContent);
  assert.ok(leaves.includes('true'));
});

test('tableResult renders rows and inferred columns', () => {
  const document = createFakeDocument();
  const renderer = resultRenderer('tableResult');
  const rows = [{ id: 1, name: 'a' }, { id: 2, name: 'b', extra: 'x' }];
  assert.equal(renderer.canRender({ bodyJson: rows }), true);
  const el = renderer.render({ document, bodyJson: rows });
  const headers = el.querySelectorAll('th').map((th) => th.textContent);
  assert.deepEqual(headers, ['id', 'name', 'extra']);
  assert.equal(el.querySelectorAll('tbody tr').length, 2);
});

test('groupNav renders operations with stable data-op-id and selects on click', () => {
  const document = createFakeDocument();
  const selected = [];
  const el = panelRenderer('groupNav').render({
    document,
    panel: { id: 'nav' },
    groups: [{ id: 'index', label: 'Index', operations: [{ id: 'rebuild', title: 'Rebuild' }] }],
    onSelect: (fqid) => selected.push(fqid),
  });
  assert.equal(el.dataset.panelId, 'nav');
  const item = el.querySelector('[data-op-id="index.rebuild"]');
  assert.ok(item);
  item.click();
  assert.deepEqual(selected, ['index.rebuild']);
});

test('operationDetail wires field renderers, preview, and submit', () => {
  const document = createFakeDocument();
  const fieldRenderers = createFieldRendererRegistry();
  for (const r of createBuiltinFieldRenderers()) {
    fieldRenderers.register(r);
  }
  const submits = [];
  const el = panelRenderer('operationDetail').render({
    document,
    panel: { id: 'detail' },
    operation: {
      id: 'rebuild', groupId: 'index', title: 'Rebuild',
      fields: [{ id: 'payload', type: 'textarea', label: 'Body' }],
    },
    fieldRenderers,
    fieldState: { payload: '{}' },
    preview: { method: 'POST', url: '/api/rebuild', curl: "curl -X POST '/api/rebuild'" },
    onSubmit: (op) => submits.push(op.id),
  });
  assert.equal(el.dataset.opId, 'index.rebuild');
  assert.ok(el.querySelector('[data-field-id="index.rebuild::payload"]'));
  assert.ok(el.querySelector('.opa-preview-curl'));
  el.querySelector('.opa-submit').click();
  assert.deepEqual(submits, ['rebuild']);
});

test('resultStack renders an execution record through a result renderer', () => {
  const document = createFakeDocument();
  const resultRenderers = createResultRendererRegistry();
  for (const r of createBuiltinResultRenderers()) {
    resultRenderers.register(r);
  }
  const el = panelRenderer('resultStack').render({
    document,
    records: [{
      status: 'success',
      operationFqid: 'index.rebuild',
      response: { status: 200, contentType: 'application/json', bodyText: '{"ok":true}', bodyJson: { ok: true } },
    }],
    resultRenderers,
  });
  assert.ok(el.querySelector('.opa-badge-success'));
  assert.ok(el.querySelector('.opa-json'));
});

test('registerBuiltinRenderers populates every registry', () => {
  const fieldRenderers = createFieldRendererRegistry();
  const resultRenderers = createResultRendererRegistry();
  const panelRenderers = createPanelRendererRegistry();
  registerBuiltinRenderers({ fieldRenderers, resultRenderers, panelRenderers });
  assert.deepEqual(fieldRenderers.list().map((r) => r.id), ['text', 'textarea', 'checkbox', 'select', 'jsonEditor']);
  assert.deepEqual(resultRenderers.list().map((r) => r.id), ['jsonFoldable', 'tableResult', 'jsonLines', 'text', 'inlineSvg', 'timeSeries', 'geoScene']);
  assert.deepEqual(panelRenderers.list().map((r) => r.id), ['groupNav', 'operationTiles', 'operationDetail', 'resultStack', 'geoScene']);
});
