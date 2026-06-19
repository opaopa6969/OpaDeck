import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDataSourceAdapterRegistry,
  createFieldRendererRegistry,
  createPanelRendererRegistry,
  createResultRendererRegistry,
} from '../src/index.js';

test('field renderer registry matches by supports()', () => {
  const registry = createFieldRendererRegistry();
  registry.register({
    id: 'text',
    supports(field) {
      return field.type === 'text';
    },
    render() {
      return 'text';
    },
  });
  const renderer = registry.match({ type: 'text' });
  assert.equal(renderer.id, 'text');
});

test('result renderer registry prefers explicit renderer id', () => {
  const registry = createResultRendererRegistry();
  registry.register({
    id: 'jsonFoldable',
    canRender() {
      return false;
    },
    render() {
      return 'json';
    },
  });
  const renderer = registry.match({
    resultView: { renderer: 'jsonFoldable' },
    contentType: 'application/json',
  });
  assert.equal(renderer.id, 'jsonFoldable');
});

test('panel renderer registry rejects missing render()', () => {
  const registry = createPanelRendererRegistry();
  assert.throws(() => {
    registry.register({ id: 'bad' });
  }, /render/);
});

test('data source adapter registry resolves by dataSource.kind', async () => {
  const registry = createDataSourceAdapterRegistry();
  registry.register({
    id: 'options.static',
    async resolve() {
      return { kind: 'options', items: [{ value: 'a', label: 'A' }] };
    },
  });
  const result = await registry.resolve({
    dataSource: { kind: 'options.static' },
    params: {},
  });
  assert.deepEqual(result, { kind: 'options', items: [{ value: 'a', label: 'A' }] });
});
