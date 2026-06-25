import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The north-star invariant of the Lv3 core: src/core/ must stay unaware of the
// optional companion layers. Concretely, core never imports a companion/edge
// module, and never special-cases an edge renderer id.

const CORE_DIR = fileURLToPath(new URL('../src/core/', import.meta.url));

function coreFiles() {
  return readdirSync(CORE_DIR).filter((file) => file.endsWith('.js'));
}

test('core never imports a companion or edge module', () => {
  const importRe = /from\s*['"]([^'"]+)['"]/g;
  const forbidden = /(^|\/)(layout|help|tour|geo|renderers|dsl|runtime|registry)(\/|$)/;
  for (const file of coreFiles()) {
    const src = readFileSync(CORE_DIR + file, 'utf8');
    let match;
    while ((match = importRe.exec(src))) {
      assert.ok(!forbidden.test(match[1]), `src/core/${file} imports a non-core module: ${match[1]}`);
    }
  }
});

test('core does not special-case the geoScene renderer id', () => {
  for (const file of coreFiles()) {
    const src = readFileSync(CORE_DIR + file, 'utf8');
    assert.ok(!src.includes('geoScene'), `src/core/${file} references the geoScene edge renderer`);
  }
});
