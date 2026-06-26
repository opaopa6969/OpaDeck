import test from 'node:test';
import assert from 'node:assert/strict';

import { makeFullscreenable, createGeoMapPanelRenderer } from '../src/index.js';
import { createFakeDocument } from './helpers/fake-dom.js';

test('makeFullscreenable toggles overlay and fires onChange (no native API)', () => {
  const doc = createFakeDocument();
  const panel = doc.createElement('div');
  const changes = [];
  const fs = makeFullscreenable(panel, { document: doc, onChange: (on) => changes.push(on) });

  assert.equal(fs.isFullscreen(), false);
  assert.ok(panel.children.includes(fs.button), 'button mounted into element');

  fs.toggle();
  assert.equal(fs.isFullscreen(), true);
  assert.equal(panel.style.position, 'fixed');
  assert.equal(panel.style.inset, '0');
  assert.ok(panel.classList.contains('opa-fs-overlay'));
  assert.equal(fs.button.textContent, '⤡');

  fs.toggle();
  assert.equal(fs.isFullscreen(), false);
  assert.equal(panel.style.position, '', 'style restored on exit');
  assert.ok(!panel.classList.contains('opa-fs-overlay'));
  assert.deepEqual(changes, [true, false]);
});

test('Escape exits overlay fullscreen', () => {
  const doc = createFakeDocument();
  const panel = doc.createElement('div');
  const fs = makeFullscreenable(panel, { document: doc });
  fs.enter();
  assert.equal(fs.isFullscreen(), true);
  doc.dispatch('keydown', { key: 'Escape' });
  assert.equal(fs.isFullscreen(), false);
});

test('geoMap renderer mounts a canvas and calls the injected mapFactory', () => {
  const doc = createFakeDocument();
  const calls = [];
  const renderer = createGeoMapPanelRenderer({
    mapFactory: (canvas, opts) => {
      calls.push({ canvas, data: opts.data });
      return { resize() { calls.push('resize'); }, refresh() {} };
    },
  });
  assert.equal(renderer.id, 'geoMap');

  const data = { categories: [{ key: 'a', color: '#f00' }], points: [{ lat: 35, lon: 139, category: 'a' }] };
  const el = renderer.render({ document: doc, data, panelId: 'map' });

  const canvas = el.querySelector('canvas');
  assert.ok(canvas, 'canvas mounted');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].data, data, 'data forwarded to mapFactory');
  assert.equal(el.dataset.panelId, 'map');

  // fullscreen button present, and toggling triggers handle.resize()
  const fsBtn = el.children.find((c) => c.className && c.className.includes('opa-fs-btn'));
  assert.ok(fsBtn, 'fullscreen button present by default');
  fsBtn.click();
  assert.ok(calls.includes('resize'), 'fullscreen change calls handle.resize()');
});

test('geoMap renders a placeholder when no mapFactory is provided', () => {
  const doc = createFakeDocument();
  const renderer = createGeoMapPanelRenderer();
  const el = renderer.render({ document: doc, data: { points: [] } });
  assert.ok(el.querySelector('.opa-geomap-empty'), 'placeholder shown');
});
