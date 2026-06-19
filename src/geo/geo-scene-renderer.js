import { svgH } from '../renderers/dom.js';
import { createJapanBaseMap } from './japan-preset.js';

// A generic, data-driven geoScene renderer. It knows nothing about prefectures
// or any specific domain: it consumes a GeoSceneDefinition (baseMap + layers)
// and a data map, then paints region cells, choropleth fills, point markers, and
// connector lines. Base maps are pluggable; the Japan preset is just one.
//
// renderGeoScene(ctx):
//   ctx.document   - DOM document (or fake)
//   ctx.scene      - GeoSceneDefinition ({ baseMap, layers, initialView, selectionMode })
//   ctx.data       - { [sourceId]: rows[] } feeding the layers
//   ctx.baseMap    - explicit base map object (overrides scene.baseMap)
//   ctx.onSelect   - (code, region) => void, called on region click
//   ctx.view       - { x, y, zoom } initial pan/zoom
//   ctx.interactive - default true; set false to skip pan/zoom wiring
// returns an <svg> element.

const BASE_MAPS = {
  japan: createJapanBaseMap,
};

export function renderGeoScene(ctx = {}) {
  const doc = ctx.document;
  if (!doc) {
    throw new TypeError('renderGeoScene requires ctx.document.');
  }
  const scene = ctx.scene || (ctx.resultView && ctx.resultView.options) || {};
  const baseMap = ctx.baseMap || resolveBaseMap(scene.baseMap);
  if (!baseMap) {
    return svgH(doc, 'svg', { class: 'opa-geo opa-geo-empty', viewBox: '0 0 1 1' });
  }
  const data = ctx.data || {};
  const layers = Array.isArray(scene.layers) ? scene.layers : [];
  const view = ctx.view || scene.initialView || { x: 0, y: 0, zoom: 1 };

  const regionNodes = baseMap.regions.map((region) => svgH(doc, 'rect', {
    class: 'opa-geo-region',
    x: region.x,
    y: region.y,
    width: region.w,
    height: region.h,
    rx: 2,
    dataset: { regionCode: region.codeText, regionName: region.name },
    on: typeof ctx.onSelect === 'function'
      ? { click: () => ctx.onSelect(region.code, region) }
      : undefined,
  }));

  const layerNodes = [];
  for (const layer of layers) {
    const rows = data[layer.source] || [];
    if (layer.kind === 'choropleth') {
      layerNodes.push(renderChoropleth(doc, baseMap, layer, rows));
    } else if (layer.kind === 'points') {
      layerNodes.push(renderPoints(doc, baseMap, layer, rows));
    } else if (layer.kind === 'lines') {
      layerNodes.push(renderLines(doc, baseMap, layer, rows));
    }
  }

  const scene_g = svgH(doc, 'g', {
    class: 'opa-geo-scene',
    transform: `translate(${view.x || 0} ${view.y || 0}) scale(${view.zoom || 1})`,
  }, [
    svgH(doc, 'g', { class: 'opa-geo-base' }, regionNodes),
    ...layerNodes,
  ]);

  const svg = svgH(doc, 'svg', {
    class: 'opa-geo',
    viewBox: baseMap.viewBox,
    width: '100%',
    dataset: { baseMap: baseMap.id },
  }, [scene_g]);

  if (ctx.interactive !== false) {
    wirePanZoom(svg, scene_g, { ...view });
  }
  return svg;
}

export function listBaseMaps() {
  return Object.keys(BASE_MAPS);
}

function resolveBaseMap(id) {
  const factory = BASE_MAPS[id];
  return factory ? factory() : null;
}

function renderChoropleth(doc, baseMap, layer, rows) {
  const values = new Map();
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    const code = row[layer.keyField];
    const value = Number(row[layer.valueField]);
    if (code == null || !Number.isFinite(value)) {
      continue;
    }
    const region = baseMap.regionByCode(code);
    if (!region) {
      continue;
    }
    values.set(region.codeText, value);
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const palette = PALETTES[layer.palette] || PALETTES.blue;
  const fills = baseMap.regions
    .filter((region) => values.has(region.codeText))
    .map((region) => {
      const value = values.get(region.codeText);
      const t = max > min ? (value - min) / (max - min) : 1;
      return svgH(doc, 'rect', {
        class: 'opa-geo-choropleth',
        x: region.x,
        y: region.y,
        width: region.w,
        height: region.h,
        rx: 2,
        fill: lerpColor(palette[0], palette[1], t),
        dataset: { regionCode: region.codeText, value: String(value) },
      });
    });
  return svgH(doc, 'g', { class: 'opa-geo-layer opa-geo-layer-choropleth' }, fills);
}

function renderPoints(doc, baseMap, layer, rows) {
  const markers = [];
  for (const row of rows) {
    const point = locate(row, layer, baseMap);
    if (!point) {
      continue;
    }
    markers.push(svgH(doc, 'circle', {
      class: 'opa-geo-point',
      cx: point.x,
      cy: point.y,
      r: layer.radius || 4,
    }));
    if (layer.labelField && row[layer.labelField] != null) {
      markers.push(svgH(doc, 'text', {
        class: 'opa-geo-point-label',
        x: point.x + 6,
        y: point.y,
        text: String(row[layer.labelField]),
      }));
    }
  }
  return svgH(doc, 'g', { class: 'opa-geo-layer opa-geo-layer-points' }, markers);
}

function renderLines(doc, baseMap, layer, rows) {
  const lines = [];
  for (const row of rows) {
    const from = locateBy(row[layer.fromField], baseMap);
    const to = locateBy(row[layer.toField], baseMap);
    if (!from || !to) {
      continue;
    }
    lines.push(svgH(doc, 'line', {
      class: 'opa-geo-line',
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
    }));
  }
  return svgH(doc, 'g', { class: 'opa-geo-layer opa-geo-layer-lines' }, lines);
}

// Resolve a row to a point: prefer geographic lat/lng (projected) for true geo
// base maps, otherwise fall back to a region code centroid for schematic maps.
function locate(row, layer, baseMap) {
  const latField = layer.latField || 'lat';
  const lngField = layer.lngField || 'lng';
  if (row[latField] != null && row[lngField] != null && typeof baseMap.project === 'function') {
    return baseMap.project(row[lngField], row[latField]);
  }
  if (layer.xField && layer.yField && row[layer.xField] != null) {
    return { x: Number(row[layer.xField]), y: Number(row[layer.yField]) };
  }
  const keyField = layer.keyField || layer.codeField;
  if (keyField && row[keyField] != null) {
    return locateBy(row[keyField], baseMap);
  }
  return null;
}

function locateBy(code, baseMap) {
  if (code == null) {
    return null;
  }
  const region = baseMap.regionByCode(code);
  return region ? { x: region.cx, y: region.cy } : null;
}

function wirePanZoom(svg, group, view) {
  if (typeof svg.addEventListener !== 'function') {
    return;
  }
  const state = { x: view.x || 0, y: view.y || 0, zoom: view.zoom || 1, dragging: false, lastX: 0, lastY: 0 };
  const apply = () => {
    group.setAttribute('transform', `translate(${state.x} ${state.y}) scale(${state.zoom})`);
  };
  svg.addEventListener('wheel', (event) => {
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    state.zoom = Math.min(8, Math.max(0.4, state.zoom * factor));
    apply();
  });
  svg.addEventListener('pointerdown', (event) => {
    state.dragging = true;
    state.lastX = event.clientX || 0;
    state.lastY = event.clientY || 0;
  });
  svg.addEventListener('pointermove', (event) => {
    if (!state.dragging) {
      return;
    }
    state.x += (event.clientX || 0) - state.lastX;
    state.y += (event.clientY || 0) - state.lastY;
    state.lastX = event.clientX || 0;
    state.lastY = event.clientY || 0;
    apply();
  });
  const stop = () => { state.dragging = false; };
  svg.addEventListener('pointerup', stop);
  svg.addEventListener('pointerleave', stop);
}

const PALETTES = {
  blue: [[219, 234, 254], [30, 64, 175]],
  green: [[220, 252, 231], [22, 101, 52]],
  warm: [[254, 243, 199], [180, 83, 9]],
};

function lerpColor(from, to, t) {
  const clamped = Math.min(1, Math.max(0, t));
  const rgb = from.map((channel, index) => Math.round(channel + (to[index] - channel) * clamped));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}
