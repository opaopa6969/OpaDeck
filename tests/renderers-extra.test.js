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

test('inlineSvg injects sanitized svg markup and matches image/svg+xml', () => {
  const document = createFakeDocument();
  const renderer = resultRenderer('inlineSvg');
  assert.equal(renderer.canRender({ contentType: 'image/svg+xml' }), true);
  const el = renderer.render({ document, bodyText: '<svg><circle r="2"/></svg>' });
  assert.match(el.className, /opa-inline-svg/);
  const svg = el.querySelector('svg');
  assert.ok(svg, 'an <svg> element is appended');
  assert.equal(svg.querySelectorAll('circle').length, 1);
  const empty = renderer.render({ document, bodyText: 'not svg' });
  assert.match(empty.className, /opa-inline-svg-empty/);
});

test('inlineSvg strips script elements and on* event attributes (XSS hardening)', () => {
  const document = createFakeDocument();
  const renderer = resultRenderer('inlineSvg');
  const payload = '<svg onload="alert(1)"><script>alert(2)</script><circle onclick="alert(3)" r="2"/></svg>';
  const el = renderer.render({ document, bodyText: payload });
  assert.match(el.className, /opa-inline-svg/);
  const svg = el.querySelector('svg');
  assert.ok(svg, 'svg present after sanitization');
  assert.equal(svg.querySelectorAll('script').length, 0, 'script removed');
  assert.equal(svg.hasAttribute('onload'), false, 'svg onload removed');
  const circle = svg.querySelector('circle');
  assert.ok(circle, 'circle preserved');
  assert.equal(circle.hasAttribute('onclick'), false, 'circle onclick removed');
  assert.equal(circle.getAttribute('r'), '2', 'benign attribute preserved');
});

test('inlineSvg strips foreignObject (HTML injection vector)', () => {
  const document = createFakeDocument();
  const renderer = resultRenderer('inlineSvg');
  const payload = '<svg><foreignObject><body><script>alert(1)</script></body></foreignObject><circle r="2"/></svg>';
  const el = renderer.render({ document, bodyText: payload });
  const svg = el.querySelector('svg');
  assert.equal(svg.querySelectorAll('foreignObject').length, 0, 'foreignObject removed');
  assert.equal(svg.querySelectorAll('script').length, 0, 'script inside foreignObject removed');
  assert.equal(svg.querySelectorAll('circle').length, 1, 'circle preserved');
});

test('inlineSvg strips javascript: URLs from href/xlink:href (XSS hardening)', () => {
  const document = createFakeDocument();
  const renderer = resultRenderer('inlineSvg');
  const payload = '<svg>'
    + '<a href="javascript:alert(1)"><circle r="1"/></a>'
    + '<use xlink:href="javascript:alert(2)"/>'
    + '<a href="  Java\tScript:alert(3)"><circle r="1"/></a>'
    + '<a href="https://example.com/safe"><circle r="2"/></a>'
    + '</svg>';
  const el = renderer.render({ document, bodyText: payload });
  const svg = el.querySelector('svg');
  assert.ok(svg, 'svg present after sanitization');
  const anchors = svg.querySelectorAll('a');
  assert.equal(anchors.length, 3);
  assert.equal(anchors[0].hasAttribute('href'), false, 'javascript: href removed');
  assert.equal(anchors[1].hasAttribute('href'), false, 'obfuscated javascript: href removed');
  assert.equal(anchors[2].getAttribute('href'), 'https://example.com/safe', 'safe href preserved');
  const use = svg.querySelector('use');
  assert.equal(use.hasAttribute('xlink:href'), false, 'javascript: xlink:href removed');
});

test('inlineSvg strips SMIL elements that can mutate attributes at runtime', () => {
  const document = createFakeDocument();
  const renderer = resultRenderer('inlineSvg');
  const payload = '<svg>'
    + '<a id="target" href="https://example.com/safe"><circle r="2"/></a>'
    + '<animate href="#target" attributeName="href" values="javascript:alert(1)"/>'
    + '<set href="#target" attributeName="xlink:href" to="javascript:alert(2)"/>'
    + '<animateTransform href="#target" attributeName="transform" type="scale"/>'
    + '<animateMotion href="#target" path="M0 0"/>'
    + '</svg>';
  const el = renderer.render({ document, bodyText: payload });
  const svg = el.querySelector('svg');
  assert.ok(svg, 'svg present after sanitization');
  assert.equal(svg.querySelectorAll('animate').length, 0, 'animate removed');
  assert.equal(svg.querySelectorAll('set').length, 0, 'set removed');
  assert.equal(svg.querySelectorAll('animateTransform').length, 0, 'animateTransform removed');
  assert.equal(svg.querySelectorAll('animateMotion').length, 0, 'animateMotion removed');
  assert.equal(svg.querySelector('a').getAttribute('href'), 'https://example.com/safe', 'static safe href preserved');
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
