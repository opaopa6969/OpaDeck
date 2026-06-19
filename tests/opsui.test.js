import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { compileOpsui } from '../src/index.js';

const EXAMPLE = fileURLToPath(new URL('../examples/index-ops.opsui', import.meta.url));

test('compiles the example .opsui into a normalized, valid AppDefinition', () => {
  const source = readFileSync(EXAMPLE, 'utf8');
  const { app, problems } = compileOpsui(source);

  assert.equal(problems.length, 0, JSON.stringify(problems, null, 2));
  assert.equal(app.id, 'IndexOps');
  assert.equal(app.version, 1);
  assert.equal(app.title, 'Index Operations');
  assert.equal(app.defaultLayoutId, 'opsWorkbench');

  const group = app.groups[0];
  assert.equal(group.id, 'index');
  assert.equal(group.operations.length, 2);

  const register = group.operations[0];
  // groupId is injected by compile-time normalization.
  assert.equal(register.groupId, 'index');
  assert.equal(register.request.method, 'POST');
  assert.equal(register.request.contentType, 'text/plain');
  assert.deepEqual(register.request.body, { kind: 'rawField', fieldId: 'formbody' });

  const epField = register.fields[0];
  assert.equal(epField.type, 'select');
  assert.equal(epField.placement, 'query');
  assert.deepEqual(epField.source, { dataSourceId: 'epCompanies' });

  const formbody = register.fields[1];
  assert.equal(formbody.required, true);

  const search = group.operations[1];
  assert.equal(search.fields[0].name, 'query');
  assert.equal(search.result.renderer, 'tableResult');

  const companies = app.dataSources[0];
  assert.equal(companies.kind, 'options.static');
  assert.equal(companies.staticOptions.length, 2);
  assert.deepEqual(companies.staticOptions[0], { value: '10066', label: 'Kansai', description: 'default' });
});

test('surfaces reference problems through validateAppDefinition', () => {
  const source = `
app Demo v1 {
  group g {
    operation op {
      request {
        method POST
        url "/x"
        body raw field missing
      }
    }
  }
}`;
  const { app, problems } = compileOpsui(source);
  assert.ok(app);
  const codes = problems.map((p) => p.code);
  assert.ok(codes.includes('request.body.rawField.missing'), codes.join(','));
});

test('reports an actionable located parse error for malformed DSL', () => {
  const { app, problems } = compileOpsui('app Demo v1 {\n  group g {\n    oops "x"\n  }\n}');
  assert.equal(app, null);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].code, 'dsl.parse.error');
  assert.equal(problems[0].severity, 'error');
  assert.match(problems[0].message, /Unexpected keyword 'oops'/);
  assert.match(problems[0].detail, /line 3/);
});

test('reports unterminated string with a location', () => {
  const { app, problems } = compileOpsui('app Demo v1 {\n  title "unclosed\n}');
  assert.equal(app, null);
  assert.equal(problems[0].code, 'dsl.parse.error');
  assert.match(problems[0].message, /Unterminated string/);
});

test('requires a valid version token', () => {
  const { problems } = compileOpsui('app Demo nope {\n}');
  assert.equal(problems[0].code, 'dsl.parse.error');
  assert.match(problems[0].message, /version like 'v1'/);
});
