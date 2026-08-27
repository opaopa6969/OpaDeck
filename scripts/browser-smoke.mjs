import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED = process.env.OPADECK_BROWSER_SMOKE_REQUIRED === '1';

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch (error) {
    if (error && error.code === 'ERR_MODULE_NOT_FOUND' && /playwright/.test(error.message)) {
      return null;
    }
    throw error;
  }
}

function skipOrFail(message) {
  if (REQUIRED) {
    throw new Error(message);
  }
  console.log(`SKIP browser smoke: ${message}`);
  process.exitCode = 0;
}

async function startShowcaseServer() {
  const child = spawn('python3', ['-u', 'scripts/serve.py', '--host', '127.0.0.1', '--port', '0'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });

  const baseUrl = await new Promise((resolveUrl, reject) => {
    const timeout = setTimeout(() => reject(new Error(`showcase server did not start\n${stderr}`)), 10_000);
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const match = stdout.match(/OpaDeck showcase: (http:\/\/[^\s]+)\/showcase\//);
      if (match) {
        clearTimeout(timeout);
        resolveUrl(match[1]);
      }
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`showcase server exited with code ${code}\n${stderr}`));
    });
  });

  return { baseUrl, child };
}

async function runStep(name, action) {
  await action();
  console.log(`PASS ${name}`);
}

async function main() {
  const chromium = await loadChromium();
  if (!chromium) {
    skipOrFail('Playwright is not installed; run `npm install` first.');
    return;
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    if (/executable doesn't exist|browserType\.launch: Executable/i.test(String(error))) {
      skipOrFail('Chromium is not installed; run `npx playwright install chromium`.');
      return;
    }
    throw error;
  }

  const { baseUrl, child: server } = await startShowcaseServer();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));

  try {
    await runStep('showcase loads without browser errors', async () => {
      const response = await page.goto(`${baseUrl}/showcase/`, { waitUntil: 'load' });
      assert.equal(response?.status(), 200);
      await page.locator('.feature-card').first().waitFor();
      assert.deepEqual(browserErrors, []);
    });

    await runStep('feature selection updates detail, inspector, and Geo Scene', async () => {
      await page.locator('.feature-card[data-feature-id="geo-scene"]').click();
      assert.equal(await page.locator('#feature-detail h3').textContent(), 'Geo Scene');
      const selection = JSON.parse(await page.locator('#selection-state').textContent());
      assert.equal(selection.operationId, 'geo-scene');
      await assertCount(page, '.opa-geo-region', 47);
      assert.ok(await page.locator('.opa-geo-choropleth').count() > 0, 'expected choropleth cells');
      assert.ok(await page.locator('.opa-geo-point').count() > 0, 'expected point markers');
      assert.ok(await page.locator('.opa-geo-line').count() > 0, 'expected connector lines');
    });

    await runStep('simulated execution reaches success and renders its result', async () => {
      await page.locator('#simulate-run').click();
      assert.match(await page.locator('#execution-state').textContent(), /"status": "running"/);
      await page.locator('#execution-state').filter({ hasText: '"status": "success"' }).waitFor();
      assert.match(await page.locator('#execution-result').textContent(), /geo-scene/);
    });

    await runStep('sample validation renders its expected outcome', async () => {
      await page.locator('#validate-app').click();
      const summary = await page.locator('#validation-summary').textContent();
      assert.equal(summary, 'Sample app is valid.');
      await assertCount(page, '#validation-problems .problem', 0);
    });

    await runStep('tour walks every step and emits lifecycle events', async () => {
      await page.locator('#start-tour').click();
      await page.locator('#tour-root:not([hidden]) .tour-card').waitFor();
      while (await page.locator('#tour-root:not([hidden]) [data-tour-action="next"]').count()) {
        await page.locator('#tour-root:not([hidden]) [data-tour-action="next"]').click();
      }
      await page.locator('#tour-root').waitFor({ state: 'hidden' });
      const eventKinds = await page.locator('#event-log .event-item strong').allTextContents();
      for (const kind of ['tour.started', 'tour.stepChanged', 'tour.finished']) {
        assert.ok(eventKinds.includes(kind), `expected ${kind} in the event log`);
      }
    });

    assert.deepEqual(browserErrors, []);
  } finally {
    await page.close();
    await browser.close();
    server.kill('SIGTERM');
  }
}

async function assertCount(page, selector, expected) {
  assert.equal(await page.locator(selector).count(), expected, `expected ${expected} matches for ${selector}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
