import { svgH } from './dom.js';

// A generic, data-driven time-series (line chart) renderer, the chart sibling of
// geoScene. It carries no domain logic: it reads x/y fields from rows, scales
// them into a fixed viewport, and draws a polyline with point markers and a
// baseline. Reachable as an explicit result renderer (renderer: 'timeSeries').
//
// renderTimeSeries(ctx):
//   ctx.document - DOM document (or fake)
//   ctx.scene    - { xField, yField, source? } (or taken from resultView.options)
//   ctx.data     - { [source]: rows[] }, or ctx.rows, or an array bodyJson
// returns an <svg> element.

const WIDTH = 240;
const HEIGHT = 100;
const PAD = 8;

export function renderTimeSeries(ctx = {}) {
  const doc = ctx.document;
  if (!doc) {
    throw new TypeError('renderTimeSeries requires ctx.document.');
  }
  const scene = ctx.scene || (ctx.resultView && ctx.resultView.options) || {};
  const xField = scene.xField || 'x';
  const yField = scene.yField || 'y';
  const rows = resolveRows(ctx, scene);

  const points = rows
    .map((row) => ({ x: Number(row[xField]), y: Number(row[yField]) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  if (points.length === 0) {
    return svgH(doc, 'svg', { class: 'opa-timeseries opa-timeseries-empty', viewBox: `0 0 ${WIDTH} ${HEIGHT}` });
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const sx = (x) => PAD + spanRatio(x, minX, maxX) * (WIDTH - 2 * PAD);
  const sy = (y) => HEIGHT - PAD - spanRatio(y, minY, maxY) * (HEIGHT - 2 * PAD);

  const scaled = points.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
  const polyline = svgH(doc, 'polyline', {
    class: 'opa-timeseries-line',
    fill: 'none',
    points: scaled.map((p) => `${round(p.x)},${round(p.y)}`).join(' '),
  });
  const markers = scaled.map((p) => svgH(doc, 'circle', {
    class: 'opa-timeseries-point',
    cx: round(p.x),
    cy: round(p.y),
    r: 2,
  }));
  const baseline = svgH(doc, 'line', {
    class: 'opa-timeseries-axis',
    x1: PAD,
    y1: HEIGHT - PAD,
    x2: WIDTH - PAD,
    y2: HEIGHT - PAD,
  });

  return svgH(doc, 'svg', {
    class: 'opa-timeseries',
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    width: '100%',
    dataset: { points: String(points.length) },
  }, [baseline, polyline, ...markers]);
}

export function createTimeSeriesRenderer() {
  return {
    id: 'timeSeries',
    canRender: () => false,
    render: (ctx) => renderTimeSeries(ctx),
  };
}

function resolveRows(ctx, scene) {
  if (scene.source && ctx.data && Array.isArray(ctx.data[scene.source])) {
    return ctx.data[scene.source];
  }
  if (Array.isArray(ctx.rows)) {
    return ctx.rows;
  }
  if (Array.isArray(ctx.bodyJson)) {
    return ctx.bodyJson;
  }
  return [];
}

function spanRatio(value, min, max) {
  return max > min ? (value - min) / (max - min) : 0.5;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
