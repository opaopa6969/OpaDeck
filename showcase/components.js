// showcase/components.js — 新コンポーネント(createWorkbench / geoMap+fullscreen)の
// 動くデモ。ライブラリ利用者が「見た目」と「最小の組み立て」を掴むためのもの。
import {
  createRuntimeBus,
  createSystemClock,
  createScheduler,
  createSelectionStore,
  createExecutionStore,
  createHttpExecutor,
  createWorkbench,
  createGeoMapPanelRenderer,
} from '../src/index.js';

// ---- createWorkbench デモ ----------------------------------------------------
const APP = {
  id: 'demo', version: 1, title: 'Demo',
  groups: [{
    id: 'index', label: 'Index',
    operations: [
      {
        id: 'search', groupId: 'index', title: 'Search documents', summary: 'GET /api/index/search',
        request: { method: 'GET', url: '/api/index/search' },
        fields: [
          { id: 'q', name: 'query', type: 'text', placement: 'query', label: 'Query', defaultValue: '東京都大田区' },
          { id: 'limit', name: 'limit', type: 'text', placement: 'query', label: 'Limit', defaultValue: '20' },
        ],
      },
      {
        id: 'register', groupId: 'index', title: 'Register document', summary: 'POST /api/index/register',
        request: { method: 'POST', url: '/api/index/register', contentType: 'application/json', body: { kind: 'rawField', fieldId: 'doc' } },
        fields: [{ id: 'doc', name: 'doc', type: 'json', placement: 'body', label: 'Document JSON', defaultValue: '{\n  "zip": "1450065"\n}' }],
      },
    ],
  }],
};

const bus = createRuntimeBus();
const clock = createSystemClock();
const scheduler = createScheduler({ clock });
const selection = createSelectionStore({ bus });
const executions = createExecutionStore({ bus, clock, historyLimit: 20 });

// 実バックエンド不要: canned JSON を返す fake fetch を executor に注入。
const fakeFetch = async (url) => ({
  ok: true, status: 200, statusText: 'OK',
  headers: { get: (n) => (n.toLowerCase() === 'content-type' ? 'application/json' : null) },
  async text() { return JSON.stringify({ ok: true, url, hits: [{ id: 'doc_1', zip: '1450065' }] }, null, 2); },
});
const executor = createHttpExecutor({ executions, clock, fetch: fakeFetch, baseUrl: '/' });

const workbench = createWorkbench({
  document, app: APP,
  mounts: { nav: document.getElementById('wb-nav'), detail: document.getElementById('wb-detail'), results: document.getElementById('wb-results') },
  executor, executions, selection, baseUrl: '/',
});
workbench.selectOperation('index.search'); // 先頭操作を選んでフォームを表示

// ---- geoMap + fullscreen デモ ------------------------------------------------
// host が供給する地図エンジン(最小): canvas に点を打つだけ。実プロダクトでは
// tetsugo mapcore などを注入する。返すハンドルは {resize, destroy} 等(任意)。
function tinyMapFactory(canvas, { data }) {
  const ctx = canvas.getContext('2d');
  const points = (data && data.points) || [];
  function draw() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    ctx.fillStyle = '#10202c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // lon/lat を矩形へ素朴に正規化(日本周辺 123-146E, 24-46N)
    for (const p of points) {
      const x = ((p.lon - 123) / (146 - 123)) * canvas.width;
      const y = (1 - (p.lat - 24) / (46 - 24)) * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 4 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = p.color || '#4e79a7';
      ctx.fill();
    }
  }
  draw();
  return { resize: draw, refresh: draw };
}

const geoMap = createGeoMapPanelRenderer({ mapFactory: tinyMapFactory });
const geoData = {
  points: [
    { lat: 35.68, lon: 139.69, color: '#e15759' }, { lat: 34.69, lon: 135.5, color: '#edc948' },
    { lat: 43.06, lon: 141.35, color: '#4e79a7' }, { lat: 26.21, lon: 127.68, color: '#59a14f' },
    { lat: 33.59, lon: 130.4, color: '#b07aa1' }, { lat: 38.27, lon: 140.87, color: '#e15759' },
  ],
};
document.getElementById('geo-box').appendChild(geoMap.render({ document, data: geoData, panelId: 'demoMap' }));
