import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The outermost promise of OpaDeck: src/** is the distributable. It has to load
// with no package manager, no import map, and no bundler resolution step —
// vendored into someone else's repo, or served straight to a browser.
//
// Concretely that means every module specifier under src/** must be relative.
// A bare specifier ('kazu', 'lodash') needs a resolver the consumer does not
// have; a node: builtin does not exist in a browser; an absolute path or URL
// pins the consumer's hosting layout. All four are rejected here.
//
// This guard is scoped to src/** only. tests/, scripts/ and showcase/ never
// leave this repo, so they may depend on whatever they like.

const SRC_DIR = fileURLToPath(new URL('../src/', import.meta.url));

const RELATIVE = /^\.\.?\//;

// --- scanner ---------------------------------------------------------------

// Walks the source once, tracking comments, strings, template literals and
// regex literals, and reports every string literal that sits in a module
// specifier position. Scanning instead of pattern-matching is what keeps
// `Array.from('x')`, a `//` inside a URL string, and `/["\\]/g` from being
// mistaken for imports.
export function findModuleSpecifiers(source) {
  const found = [];
  // The source with comments dropped and every string collapsed to one
  // placeholder char, so the text preceding a literal is code and only code.
  let code = '';
  let index = 0;

  while (index < source.length) {
    const ch = source[index];
    const next = source[index + 1];

    if (ch === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index += 2;
      continue;
    }
    if (ch === '/' && startsRegex(code)) {
      index = skipRegex(source, index);
      code += '\u0000';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const { value, end, hasInterpolation } = readQuoted(source, index);
      const keyword = specifierKeyword(code);
      // A template literal with `${...}` resolves at runtime and is out of
      // scope for a static guard. A plain `` `./x.js` `` is still static.
      if (keyword && (ch !== '`' || !hasInterpolation)) {
        found.push({ specifier: value, keyword });
      }
      index = end;
      code += '\u0000';
      continue;
    }

    code += ch;
    index += 1;
  }

  return found;
}

// `import 'x'`, `import('x')`, `import ... from 'x'`, `export ... from 'x'`.
// The leading [^.\w$] guard is what keeps `Array.from('x')` out.
function specifierKeyword(code) {
  const tail = code.slice(-64);
  if (/(?:^|[^.\w$])from\s*$/.test(tail)) return 'from';
  if (/(?:^|[^.\w$])import\s*\(\s*$/.test(tail)) return 'import()';
  if (/(?:^|[^.\w$])import\s*$/.test(tail)) return 'import';
  return null;
}

function readQuoted(source, start) {
  const quote = source[start];
  let index = start + 1;
  let value = '';
  let hasInterpolation = false;
  while (index < source.length) {
    const ch = source[index];
    if (ch === '\\') {
      value += source[index + 1] || '';
      index += 2;
      continue;
    }
    if (quote === '`' && ch === '$' && source[index + 1] === '{') {
      hasInterpolation = true;
    }
    if (ch === quote) {
      index += 1;
      break;
    }
    value += ch;
    index += 1;
  }
  return { value, end: index, hasInterpolation };
}

// A '/' opens a regex only where an expression may begin. After a value
// (identifier, literal, ')' or ']') it is division.
function startsRegex(code) {
  const before = code.replace(/\s+$/, '');
  if (before === '') return true;
  const last = before[before.length - 1];
  if (/[)\]}\w$\u0000]/.test(last)) {
    return /(?:^|[^.\w$])(?:return|typeof|instanceof|case|in|of|new|delete|void|throw|do|else|yield|await)$/.test(before);
  }
  return true;
}

function skipRegex(source, start) {
  let index = start + 1;
  let inClass = false;
  while (index < source.length) {
    const ch = source[index];
    if (ch === '\\') {
      index += 2;
      continue;
    }
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) {
      index += 1;
      break;
    } else if (ch === '\n') {
      break;
    }
    index += 1;
  }
  while (index < source.length && /[a-z]/.test(source[index])) index += 1;
  return index;
}

function srcFiles(dir = SRC_DIR, prefix = '') {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...srcFiles(`${dir}${entry.name}/`, `${prefix}${entry.name}/`));
    } else if (entry.name.endsWith('.js')) {
      files.push({ path: `src/${prefix}${entry.name}`, source: readFileSync(dir + entry.name, 'utf8') });
    }
  }
  return files;
}

// --- the invariant ---------------------------------------------------------

test('src/** imports nothing that a bare browser or a vendoring consumer cannot resolve', () => {
  const violations = [];
  for (const file of srcFiles()) {
    for (const { specifier, keyword } of findModuleSpecifiers(file.source)) {
      if (!RELATIVE.test(specifier)) {
        violations.push(`${file.path}: ${keyword} '${specifier}'`);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `src/** must only use relative module specifiers (no bare package, no node: builtin, no absolute path or URL):\n  ${violations.join('\n  ')}`
  );
});

test('the guard actually scans every src file', () => {
  const files = srcFiles();
  assert.ok(files.length >= 30, `expected the whole src tree, walked ${files.length} files`);
  assert.ok(files.some((file) => file.path === 'src/index.js'));
  assert.ok(files.some((file) => file.path === 'src/geo/japan-preset.js'), 'nested directories are walked');
});

// --- scanner: accepted forms ----------------------------------------------

test('relative specifiers in every import form are recognized and allowed', () => {
  const source = [
    `import { a } from './a.js';`,
    `import * as b from '../b/b.js';`,
    `import c from "./c.js";`,
    `import './side-effect.js';`,
    `export { d } from './d.js';`,
    `export * from '../e.js';`,
    `const f = await import('./f.js');`,
    'const g = await import(`./g.js`);',
  ].join('\n');
  const found = findModuleSpecifiers(source);
  assert.deepEqual(found.map((entry) => entry.specifier), [
    './a.js', '../b/b.js', './c.js', './side-effect.js', './d.js', '../e.js', './f.js', './g.js',
  ]);
  assert.ok(found.every((entry) => RELATIVE.test(entry.specifier)));
});

test('non-import code that merely looks like an import is not a specifier', () => {
  const source = [
    `const parts = Array.from('abc');`,
    `const buf = Buffer.from('xyz');`,
    `// import banned from 'kazu';`,
    `/* import { x } from 'lodash'; */`,
    `const url = 'https://example.test/a//b';`,
    `const quoteRe = /["\\\\]/g;`,
    `const ratio = total / count;`,
    `const label = 'imported from somewhere';`,
  ].join('\n');
  assert.deepEqual(findModuleSpecifiers(source), []);
});

test('a template-literal dynamic import is not treated as a static specifier', () => {
  assert.deepEqual(findModuleSpecifiers('const m = await import(`./${name}.js`);'), []);
  assert.deepEqual(findModuleSpecifiers('const m = await import(path);'), []);
});

// --- scanner: rejected forms ----------------------------------------------

test('every unresolvable specifier form is detected', () => {
  const cases = [
    [`import { clamp01 } from 'kazu';`, 'kazu'],
    [`import 'some-side-effect-package';`, 'some-side-effect-package'],
    [`export * from 'lodash';`, 'lodash'],
    [`const c = await import('chalk');`, 'chalk'],
    ['const c = await import(`kazu`);', 'kazu'],
    [`import fs from 'node:fs';`, 'node:fs'],
    [`import x from '/abs/path.js';`, '/abs/path.js'],
    [`import x from 'https://cdn.test/x.js';`, 'https://cdn.test/x.js'],
    ['const x = await import(`https://cdn.test/x.js`);', 'https://cdn.test/x.js'],
  ];
  for (const [source, expected] of cases) {
    const found = findModuleSpecifiers(source);
    assert.equal(found.length, 1, `expected one specifier in: ${source}`);
    assert.equal(found[0].specifier, expected);
    assert.ok(!RELATIVE.test(found[0].specifier), `${expected} must be rejected`);
  }
});

test('re-adding the kazu import to a src file would fail the invariant', () => {
  // Guards the guard: the exact regression this contract exists to catch.
  const regressed = readFileSync(SRC_DIR + 'geo/japan-preset.js', 'utf8')
    .replace('export const JAPAN_TILE_GRID', "import { clamp01 } from 'kazu';\n\nexport const JAPAN_TILE_GRID");
  const external = findModuleSpecifiers(regressed).filter((entry) => !RELATIVE.test(entry.specifier));
  assert.deepEqual(external, [{ specifier: 'kazu', keyword: 'from' }]);
});
