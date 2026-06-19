import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  JAPAN_TILE_GRID,
  createGeoSceneResultRenderer,
  createJapanBaseMap,
  renderGeoScene,
} from '../src/index.js';
import { createFakeDocument } from './helpers/fake-dom.js';

const DATA = JSON.parse(readFileSync(fileURLToPath(new URL('../examples/japan-prefectures.json', import.meta.url)), 'utf8'));

const SCENE = {
  baseMap: 'japan',
  layers: [
    { kind: 'choropleth', source: 'prefStats', keyField: 'pref', valueField: 'count' },
    { kind: 'points', source: 'offices', labelField: 'label' },
    { kind: 'lines', source: 'routes', fromField: 'from', toField: 'to' },
  ],
};

test('Japan preset has all 47 prefectures on unique grid cells', () => {
  assert.equal(JAPAN_TILE_GRID.length, 47);
  const codes = new Set(JAPAN_TILE_GRID.map((p) => p.code));
  assert.equal(codes.size, 47);
  const cells = new Set(JAPAN_TILE_GRID.map((p) => `${p.col},${p.row}`));
  assert.equal(cells.size, 47, 'tile cells must not overlap');
});

test('Japan base map projects geographic coordinates inside the viewport', () => {
  const baseMap = createJapanBaseMap();
  assert.equal(baseMap.regions.length, 47);
  const tokyo = baseMap.project(139.69, 35.68);
  assert.ok(tokyo.x >= 0 && tokyo.x <= baseMap.width);
  assert.ok(tokyo.y >= 0 && tokyo.y <= baseMap.height);
  assert.equal(baseMap.regionByCode(13).name, 'Tokyo');
  assert.equal(baseMap.regionByCode('01').name, 'Hokkaido');
});

test('renderGeoScene paints base regions, choropleth, points, and lines from data', () => {
  const document = createFakeDocument();
  const svg = renderGeoScene({ document, scene: SCENE, data: DATA, interactive: false });

  assert.equal(svg.tagName, 'SVG');
  assert.equal(svg.dataset.baseMap, 'japan');
  assert.equal(svg.querySelectorAll('.opa-geo-region').length, 47);

  const fills = svg.querySelectorAll('.opa-geo-choropleth');
  assert.equal(fills.length, DATA.prefStats.length);
  // Tokyo (count 92) should be darker than Okinawa (count 9): higher value -> a
  // larger interpolation toward the dark end, i.e. a smaller leading channel.
  const tokyo = svg.querySelector('.opa-geo-choropleth[data-region-code="13"]');
  const okinawa = svg.querySelector('.opa-geo-choropleth[data-region-code="47"]');
  assert.ok(tokyo && okinawa);
  assert.ok(leadChannel(tokyo.getAttribute('fill')) < leadChannel(okinawa.getAttribute('fill')));

  assert.equal(svg.querySelectorAll('.opa-geo-point').length, DATA.offices.length);
  assert.equal(svg.querySelectorAll('.opa-geo-point-label').length, DATA.offices.length);
  assert.equal(svg.querySelectorAll('.opa-geo-line').length, DATA.routes.length);
});

test('region click selection reports the prefecture code', () => {
  const document = createFakeDocument();
  const selected = [];
  const svg = renderGeoScene({
    document,
    scene: { baseMap: 'japan', layers: [] },
    data: {},
    interactive: false,
    onSelect: (code, region) => selected.push([code, region.name]),
  });
  svg.querySelector('.opa-geo-region[data-region-code="13"]').click();
  assert.deepEqual(selected, [[13, 'Tokyo']]);
});

test('geoScene result renderer renders when the result view requests it', () => {
  const document = createFakeDocument();
  const renderer = createGeoSceneResultRenderer();
  assert.equal(renderer.canRender({ resultView: { renderer: 'geoScene' } }), true);
  assert.equal(renderer.canRender({ resultView: { renderer: 'jsonFoldable' } }), false);
  const el = renderer.render({
    document,
    resultView: { renderer: 'geoScene', options: SCENE },
    data: DATA,
    interactive: false,
  });
  assert.equal(el.tagName, 'SVG');
  assert.equal(el.querySelectorAll('.opa-geo-choropleth').length, DATA.prefStats.length);
});

function leadChannel(rgb) {
  const match = /rgb\((\d+)/.exec(rgb || '');
  return match ? Number(match[1]) : NaN;
}
