// showcase/capture-screenshots.mjs — ライブラリ利用者向けドキュメント用スクリーンショット。
//
// repo root を Node http で配信し(showcase が ../src/index.js を import するため)、
// Playwright(chromium) で showcase 本体と components デモを撮影する。外部依存なし。
//
//   node showcase/capture-screenshots.mjs
//
// 出力: docs/en/img/*.png

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = normalize(join(HERE, '..')); // repo root
const OUT = join(ROOT, 'docs/en/img');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

async function loadChromium() {
  try { return (await import('playwright')).chromium; } catch (_) { /* fall through */ }
  for (const path of [
    '/home/opa/work/vacant-workspace/building-hierarchy/node_modules/playwright/index.js',
    '/home/opa/work/AskOS-workspace/syslenz/node_modules/playwright/index.js',
  ]) {
    try { const mod = await import(path); return mod.chromium || mod.default?.chromium; } catch (_) { /* next */ }
  }
  throw new Error('playwright(chromium) が見つかりません。npm i -D playwright を。');
}

async function main() {
  const chromium = await loadChromium();
  const server = http.createServer(async (req, res) => {
    let path = new URL(req.url, 'http://x').pathname;
    if (path === '/') path = '/showcase/index.html';
    else if (path.endsWith('/')) path += 'index.html'; // ディレクトリは index.html へ
    let filePath = normalize(ROOT + path);
    if (!filePath.startsWith(ROOT)) { res.statusCode = 403; return res.end('no'); }
    try { const buf = await readFile(filePath); res.setHeader('content-type', TYPES[extname(filePath)] || 'application/octet-stream'); res.end(buf); }
    catch { res.statusCode = 404; res.end('not found'); }
  });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const shot = (name, opts) => page.screenshot({ path: join(OUT, name), ...opts });

  // ---- showcase 本体 ----
  await page.goto(`${base}/showcase/`, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await shot('01-showcase-overview.png'); // feature cards + detail + runtime inspector

  await page.locator('.feature-card[data-feature-id="geo-scene"]').click().catch(() => {});
  await page.waitForTimeout(500);
  await shot('02-geoscene.png'); // Japan geoScene SVG

  await page.locator('#simulate-run').click().catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('#start-tour').click().catch(() => {});
  await page.waitForTimeout(500);
  await shot('03-tour.png'); // tour overlay

  // ---- components デモ(新コンポーネント) ----
  await page.goto(`${base}/showcase/components.html`, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  // workbench で先頭操作を実行して結果を出す
  await page.locator('#wb-detail .opa-submit').click().catch(() => {});
  await page.waitForTimeout(400);
  await shot('04-components.png', { fullPage: true }); // workbench + geoMap

  console.log('screenshots written to', OUT);
  await browser.close();
  server.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
