import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBuiltinFieldRenderers,
  createBuiltinResultRenderers,
  createFieldRendererRegistry,
  createResultRendererRegistry,
  registerBuiltinRenderers,
  renderTimeSeries,
} from '../src/index.js';
import { createFakeDocument } from './helpers/fake-dom.js';

function fieldRenderer(id) {
  return createBuiltinFieldRenderers().find((r) => r.id === id);
}
function resultRenderer(id) {
  return createBuiltinResultRenderers().find((r) => r.id === id);
}

test('jsonEditor matches type json and reports validity live', () => {
  const document = createFakeDocument();
  const renderer = fieldRenderer('jsonEditor');
  assert.equal(renderer.supports({ type: 'json' }), true);
  assert.equal(renderer.supports({ type: 'textarea' }), false);

  const changes = [];
  const el = renderer.render({
    document,
    operationId: 'index.rebuild',
    field: { id: 'body', type: 'json', label: 'Body' },
    value: '{"ok":true}',
    onChange: (value) => changes.push(value),
  });
  assert.equal(el.dataset.fieldId, 'index.rebuild::body');
  const status = el.querySelector('.opa-json-status');
  assert.equal(status.textContent, 'valid JSON');

  const textarea = el.querySelector('textarea');
  textarea.value = '{bad';
  textarea.dispatch('input', { target: textarea });
  assert.match(el.querySelector('.opa-json-status').textContent, /invalid JSON/);
  assert.deepEqual(changes, ['{bad']);
});

test('text result renderer matches text/plain and renders a pre', () => {
  const document = createFakeDocument();
  const renderer = resultRenderer('text');
  assert.equal(renderer.canRender({ contentType: 'text/plain' }), true);
  assert.equal(renderer.canRender({ contentType: 'application/json' }), false);
  assert.equal(renderer.canRender({ contentType: 'image/svg+xml' }), false);
  const el = renderer.render({ document, bodyText: 'hello' });
  assert.equal(el.tagName, 'PRE');
  assert.equal(el.textContent, 'hello');
});

test('jsonLines renders one row per NDJSON line', () => {
  const document = createFakeDocument();
  const renderer = resultRenderer('jsonLines');
  assert.equal(renderer.canRender({ contentType: 'application/x-ndjson' }), true);
  assert.equal(renderer.canRender({ contentType: 'application/json' }), false);
  const el = renderer.render({ document, bodyText: '{"a":1}\n{"a":2}\n\n{"a":3}\n' });
  assert.equal(el.querySelectorAll('.opa-jsonl-line').length, 3);
});

test('inlineSvg injects svg markup and matches image/svg+xml', () => {
  const document = createFakeDocument();
  const renderer = resultRenderer('inlineSvg');
  assert.equal(renderer.canRender({ contentType: 'image/svg+xml' }), true);
  const el = renderer.render({ document, bodyText: '<svg><circle r="2"/></svg>' });
  assert.match(el.className, /opa-inline-svg/);
  assert.match(el.innerHTML, /<svg/);
  const empty = renderer.render({ document, bodyText: 'not svg' });
  assert.match(empty.className, /opa-inline-svg-empty/);
});

test('timeSeries draws a polyline and point markers from rows', () => {
  const document = createFakeDocument();
  const el = renderTimeSeries({
    document,
    scene: { xField: 't', yField: 'v' },
    rows: [{ t: 0, v: 5 }, { t: 1, v: 9 }, { t: 2, v: 3 }],
  });
  assert.equal(el.tagName, 'SVG');
  assert.equal(el.dataset.points, '3');
  const polyline = el.querySelector('polyline');
  assert.ok(polyline);
  assert.equal(polyline.getAttribute('points').split(' ').length, 3);
  assert.equal(el.querySelectorAll('.opa-timeseries-point').length, 3);
});

test('the extended sets register in order', () => {
  const fieldRenderers = createFieldRendererRegistry();
  const resultRenderers = createResultRendererRegistry();
  registerBuiltinRenderers({ fieldRenderers, resultRenderers });
  assert.ok(fieldRenderers.has('jsonEditor'));
  assert.ok(resultRenderers.has('timeSeries'));
  assert.ok(resultRenderers.has('inlineSvg'));
});
