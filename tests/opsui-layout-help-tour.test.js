import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { compileOpsui } from '../src/index.js';

const FULL = fileURLToPath(new URL('../examples/full-app.opsui', import.meta.url));

test('compiles a full .opsui with layout, help, and tour blocks', () => {
  const { app, problems } = compileOpsui(readFileSync(FULL, 'utf8'));
  assert.equal(problems.length, 0, JSON.stringify(problems, null, 2));

  // Layout tree.
  const layout = app.layouts[0];
  assert.equal(layout.id, 'workbench');
  assert.equal(layout.title, 'Workbench');
  assert.equal(layout.root.kind, 'split');
  assert.equal(layout.root.direction, 'row');
  assert.deepEqual(layout.root.sizes, [1, 2]);
  const [nav, main] = layout.root.children;
  assert.equal(nav.kind, 'panel');
  assert.equal(nav.renderer, 'groupNav');
  assert.deepEqual(nav.binding, { kind: 'group', groupId: 'index' });
  assert.equal(nav.chrome.title, 'Operations');
  assert.equal(main.kind, 'tabs');
  assert.equal(main.defaultTabId, 'detail');
  assert.equal(main.tabs.length, 2);
  assert.deepEqual(main.tabs[0].binding, { kind: 'selection' });
  assert.deepEqual(main.tabs[1].binding, { kind: 'results', scope: 'operation', operationId: 'registerDocuments' });

  // Help.
  assert.equal(app.help.entries.length, 2);
  assert.deepEqual(app.help.entries[0].target, { kind: 'operation', operationId: 'registerDocuments' });
  assert.equal(app.help.entries[0].kind, 'panel');
  assert.deepEqual(app.help.entries[1].target, { kind: 'field', operationId: 'registerDocuments', fieldId: 'formbody' });

  // Tour.
  const tour = app.help.tours[0];
  assert.equal(tour.id, 'overview');
  assert.equal(tour.steps.length, 3);
  assert.deepEqual(tour.steps[0].commands, [{ kind: 'focusOperation', operationId: 'registerDocuments' }]);
  assert.deepEqual(tour.steps[1].commands, [{ kind: 'focusField', operationId: 'registerDocuments', fieldId: 'formbody' }]);
  assert.deepEqual(tour.steps[2].commands, [
    { kind: 'focusPanel', panelId: 'results' },
    { kind: 'submitOperation', operationId: 'registerDocuments' },
    { kind: 'waitResult', operationId: 'registerDocuments' },
  ]);
});

test('validates references inside layout, help, and tour blocks', () => {
  const source = `
app Demo v1 {
  group g {
    operation op {
      request { method GET url "/x" }
      field f : text in query {}
    }
  }
  layout l {
    panel p groupNav { bind group missingGroup }
  }
  help {
    entry e { target field op missingField body "x" }
  }
  tour t {
    step s {
      focus operation missingOp
      focus panel missingPanel
    }
  }
}`;
  const { app, problems } = compileOpsui(source);
  assert.ok(app);
  const codes = problems.map((p) => p.code);
  assert.ok(codes.includes('panel.binding.group.missing'), codes.join(','));
  assert.ok(codes.includes('help.target.invalid'), codes.join(','));
  assert.ok(codes.includes('tour.command.operation.missing'), codes.join(','));
  assert.ok(codes.includes('tour.command.panel.missing'), codes.join(','));
});

test('reports a located parse error for a malformed layout node', () => {
  const { app, problems } = compileOpsui('app Demo v1 {\n  layout l {\n    split root sideways {\n      panel a x {}\n      panel b y {}\n    }\n  }\n}');
  assert.equal(app, null);
  assert.equal(problems[0].code, 'dsl.parse.error');
  assert.match(problems[0].message, /direction must be row or column/);
  assert.match(problems[0].detail, /line 3/);
});

test('a split must have exactly two children', () => {
  const { app, problems } = compileOpsui('app Demo v1 {\n  layout l {\n    split root row {\n      panel a x {}\n    }\n  }\n}');
  assert.equal(app, null);
  assert.match(problems[0].message, /exactly 2 children/);
});
