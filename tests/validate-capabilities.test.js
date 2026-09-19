import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compileOpsui,
  createDataSourceAdapterRegistry,
  createFieldRendererRegistry,
  createPanelRendererRegistry,
  createResultRendererRegistry,
  registerBuiltinRenderers,
  validateApp,
  validateAppDefinition,
  validateCapabilities,
} from '../src/index.js';

const CAPABILITY_CODES = [
  'result.renderer.unknown',
  'panel.renderer.unknown',
  'dataSource.kind.unknown',
  'field.type.unsupported',
];

function builtinRegistries() {
  const registries = registerBuiltinRenderers({
    fieldRenderers: createFieldRendererRegistry(),
    resultRenderers: createResultRendererRegistry(),
    panelRenderers: createPanelRendererRegistry(),
  });
  registries.dataSourceAdapters = createDataSourceAdapterRegistry();
  registries.dataSourceAdapters.register({ id: 'static', resolve: () => [] });
  return registries;
}

function sampleApp(overrides = {}) {
  return {
    id: 'demo',
    version: 1,
    title: 'Demo',
    groups: [
      {
        id: 'g',
        label: 'G',
        operations: [
          {
            id: 'op',
            groupId: 'g',
            title: 'Op',
            request: { method: 'GET', url: '/x' },
            fields: [
              { id: 'q', name: 'q', type: 'text', placement: 'query' },
              { id: 'company', name: 'company', type: 'select', placement: 'query', source: { dataSourceId: 'companies' } },
            ],
            result: { renderer: 'jsonFoldable' },
          },
        ],
      },
    ],
    dataSources: [{ id: 'companies', kind: 'static', items: [] }],
    layouts: [
      {
        id: 'default',
        root: {
          kind: 'split',
          id: 'root',
          direction: 'row',
          children: [
            { kind: 'panel', id: 'nav', renderer: 'groupNav', binding: { kind: 'group', groupId: 'g' } },
            { kind: 'panel', id: 'detail', renderer: 'operationDetail', binding: { kind: 'results', scope: 'operation', operationId: 'g.op' } },
          ],
        },
      },
    ],
    defaultLayoutId: 'default',
    ...overrides,
  };
}

test('a fully registered app produces no capability problems', () => {
  const problems = validateCapabilities(sampleApp(), builtinRegistries());
  assert.deepEqual(problems, []);
});

test("result.renderer 'auto' is a runtime-selection sentinel, not an unknown id", () => {
  const app = sampleApp();
  app.groups[0].operations[0].result = { renderer: 'auto' };
  assert.deepEqual(validateCapabilities(app, builtinRegistries()), []);
});

test('unknown result.renderer is reported against the operation', () => {
  const app = sampleApp();
  app.groups[0].operations[0].result = { renderer: 'nope' };
  const problems = validateCapabilities(app, builtinRegistries());
  assert.equal(problems.length, 1);
  assert.equal(problems[0].code, 'result.renderer.unknown');
  assert.equal(problems[0].severity, 'error');
  assert.deepEqual(problems[0].target, { kind: 'operation', operationId: 'op' });
  assert.equal(problems[0].detail, 'nope');
});

test('unknown panel renderer id is reported against the panel, including nested tabs', () => {
  const app = sampleApp();
  app.layouts[0].root.children.push({
    kind: 'tabs',
    id: 'side',
    tabs: [{ kind: 'panel', id: 'ghost', renderer: 'noSuchPanel', binding: { kind: 'group', groupId: 'g' } }],
  });
  const problems = validateCapabilities(app, builtinRegistries());
  assert.equal(problems.length, 1);
  assert.equal(problems[0].code, 'panel.renderer.unknown');
  assert.deepEqual(problems[0].target, { kind: 'panel', panelId: 'ghost' });
});

test('unknown data-source adapter kind is reported against the data source', () => {
  const app = sampleApp({ dataSources: [{ id: 'companies', kind: 'graphql', query: '{}' }] });
  const problems = validateCapabilities(app, builtinRegistries());
  assert.equal(problems.length, 1);
  assert.equal(problems[0].code, 'dataSource.kind.unknown');
  assert.deepEqual(problems[0].target, { kind: 'data-source', dataSourceId: 'companies' });
  assert.equal(problems[0].detail, 'graphql');
});

test('a field type with no matching renderer is reported against the field', () => {
  const app = sampleApp();
  app.groups[0].operations[0].fields.push({ id: 'when', name: 'when', type: 'datetime', placement: 'query' });
  const problems = validateCapabilities(app, builtinRegistries());
  assert.equal(problems.length, 1);
  assert.equal(problems[0].code, 'field.type.unsupported');
  assert.deepEqual(problems[0].target, { kind: 'field', operationId: 'op', fieldId: 'when' });
  assert.equal(problems[0].detail, 'datetime');
});

test('each check is skipped when its registry is not supplied', () => {
  const app = sampleApp({ dataSources: [{ id: 'companies', kind: 'graphql' }] });
  app.groups[0].operations[0].result = { renderer: 'nope' };
  app.groups[0].operations[0].fields.push({ id: 'when', name: 'when', type: 'datetime', placement: 'query' });
  app.layouts[0].root.children[0].renderer = 'noSuchPanel';

  assert.deepEqual(validateCapabilities(app, {}), []);
  assert.deepEqual(validateCapabilities(app), []);

  const all = builtinRegistries();
  const codes = (registries) => validateCapabilities(app, registries).map((p) => p.code).sort();
  assert.deepEqual(codes({ resultRenderers: all.resultRenderers }), ['result.renderer.unknown']);
  assert.deepEqual(codes({ panelRenderers: all.panelRenderers }), ['panel.renderer.unknown']);
  assert.deepEqual(codes({ dataSourceAdapters: all.dataSourceAdapters }), ['dataSource.kind.unknown']);
  assert.deepEqual(codes({ fieldRenderers: all.fieldRenderers }), ['field.type.unsupported']);
  assert.deepEqual(codes(all), [...CAPABILITY_CODES].sort());
});

test('validateApp stays purely structural unless registries are passed', () => {
  const app = sampleApp({ dataSources: [{ id: 'companies', kind: 'graphql' }] });
  app.groups[0].operations[0].result = { renderer: 'nope' };

  const without = validateApp(app).map((p) => p.code);
  assert.ok(!without.some((code) => CAPABILITY_CODES.includes(code)));

  const withRegistries = validateApp(app, { registries: builtinRegistries() }).map((p) => p.code);
  assert.ok(withRegistries.includes('result.renderer.unknown'));
  assert.ok(withRegistries.includes('dataSource.kind.unknown'));

  // The bare core validator never learns about registries at all.
  const core = validateAppDefinition(app).map((p) => p.code);
  assert.ok(!core.some((code) => CAPABILITY_CODES.includes(code)));
});

test('capability validation preserves existing structural diagnostics', () => {
  const app = sampleApp();
  app.groups[0].operations[0].fields[1].source.dataSourceId = 'missing';
  app.groups[0].operations[0].result.renderer = 'nope';

  const structural = validateApp(app);
  assert.ok(structural.some((p) => p.code === 'field.source.dataSource.missing'));
  const combined = validateApp(app, { registries: builtinRegistries() });
  assert.deepEqual(combined.filter((p) => !CAPABILITY_CODES.includes(p.code)), structural);
  assert.ok(combined.some((p) => p.code === 'result.renderer.unknown'));
});

test('custom field renderers are matched by supports(field), not by renderer id', () => {
  const app = sampleApp();
  app.groups[0].operations[0].fields.push({
    id: 'when', name: 'when', type: 'datetime', placement: 'query', timezone: 'UTC',
  });
  const registries = builtinRegistries();
  assert.ok(validateApp(app, { registries }).some((p) => p.code === 'field.type.unsupported'));

  registries.fieldRenderers.register({
    id: 'utc-date-picker',
    supports: (field) => field.type === 'datetime' && field.timezone === 'UTC',
    render: () => { throw new Error('Validation must not render a field.'); },
  });
  assert.deepEqual(validateApp(app, { registries }), []);
});

test('compileOpsui forwards registries so DSL diagnostics include capability problems', () => {
  const source = `
app demo v1 {
  title "Demo"
  group g {
    label "G"
    operation op {
      title "Op"
      request {
        method GET
        url "/x"
      }
      result {
        renderer nope
      }
    }
  }
}
`;
  const plain = compileOpsui(source);
  assert.ok(plain.app);
  assert.ok(!plain.problems.some((p) => p.code === 'result.renderer.unknown'));

  const checked = compileOpsui(source, { registries: builtinRegistries() });
  assert.ok(checked.problems.some((p) => p.code === 'result.renderer.unknown'));

  const skipped = compileOpsui(source, { registries: builtinRegistries(), validate: false });
  assert.deepEqual(skipped.problems, []);
});
