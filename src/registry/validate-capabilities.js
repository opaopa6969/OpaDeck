import { createProblem } from '../core/problem.js';
import { isPlainObject } from '../core/ids.js';
import { traverseRenderNode } from '../layout/validate-layout.js';

// Optional companion layer: capability validation against the typed registries.
// Not part of the closed core — the core validator never learns which renderer
// ids / adapter kinds / field types exist. Composed by validateApp() only when
// the caller supplies registries, so an app can be validated structurally
// without any registry, and validated for capabilities once the runtime's
// registries are assembled (e.g. after registerBuiltinRenderers).
//
// registries (each optional; a check is skipped when its registry is absent):
//   resultRenderers     - result renderer registry (has(id))
//   panelRenderers      - panel renderer registry (has(id))
//   dataSourceAdapters  - data-source adapter registry (has(kind))
//   fieldRenderers      - field renderer registry (match(field))

export function validateCapabilities(app, registries = {}) {
  const problems = [];
  if (!app || typeof app !== 'object') {
    throw new TypeError('App definition must be an object.');
  }
  if (!registries || typeof registries !== 'object') {
    return problems;
  }

  const groups = Array.isArray(app.groups) ? app.groups : [];
  for (const group of groups) {
    if (!isPlainObject(group)) {
      continue;
    }
    const operations = Array.isArray(group.operations) ? group.operations : [];
    for (const operation of operations) {
      validateResultRenderer(operation, registries.resultRenderers, problems);
      validateFieldTypes(operation, registries.fieldRenderers, problems);
    }
  }
  validateDataSourceKinds(app, registries.dataSourceAdapters, problems);
  validatePanelRenderers(app, registries.panelRenderers, problems);

  return problems;
}

// `renderer: 'auto'` is not a registry id: it is the documented way (DSL
// `result { renderer auto }`) to let the result registry pick a renderer via
// canRender() at runtime, so it is never reported as unknown.
const AUTO_RESULT_RENDERER = 'auto';

function validateResultRenderer(operation, registry, problems) {
  if (!isRegistry(registry)) {
    return;
  }
  const renderer = operation.result && operation.result.renderer;
  if (typeof renderer === 'string' && renderer !== AUTO_RESULT_RENDERER && !registry.has(renderer)) {
    problems.push(createProblem(
      'result.renderer.unknown',
      'error',
      `Operation ${String(operation.id)} references unknown result renderer ${renderer}.`,
      { target: { kind: 'operation', operationId: operation.id }, detail: renderer }
    ));
  }
}

function validateFieldTypes(operation, registry, problems) {
  if (!registry || typeof registry.match !== 'function') {
    return;
  }
  const fields = Array.isArray(operation.fields) ? operation.fields : [];
  for (const field of fields) {
    if (!field || typeof field !== 'object') {
      continue;
    }
    if (!registry.match(field)) {
      problems.push(createProblem(
        'field.type.unsupported',
        'error',
        `Field ${String(operation.id)}.${String(field.id)} has type ${String(field.type)} with no matching field renderer.`,
        { target: { kind: 'field', operationId: operation.id, fieldId: field.id }, detail: String(field.type) }
      ));
    }
  }
}

function validateDataSourceKinds(app, registry, problems) {
  if (!isRegistry(registry)) {
    return;
  }
  const dataSources = Array.isArray(app.dataSources) ? app.dataSources : [];
  for (const dataSource of dataSources) {
    if (!dataSource || typeof dataSource !== 'object') {
      continue;
    }
    const kind = dataSource.kind;
    if (typeof kind === 'string' && !registry.has(kind)) {
      problems.push(createProblem(
        'dataSource.kind.unknown',
        'error',
        `Data source ${String(dataSource.id)} references unknown adapter kind ${kind}.`,
        { target: { kind: 'data-source', dataSourceId: dataSource.id }, detail: kind }
      ));
    }
  }
}

function validatePanelRenderers(app, registry, problems) {
  if (!isRegistry(registry)) {
    return;
  }
  const layouts = Array.isArray(app.layouts) ? app.layouts : [];
  for (const layout of layouts) {
    traverseRenderNode(layout && layout.root, (node) => {
      if (!node || node.kind !== 'panel') {
        return;
      }
      const renderer = node.renderer;
      if (typeof renderer === 'string' && !registry.has(renderer)) {
        problems.push(createProblem(
          'panel.renderer.unknown',
          'error',
          `Panel ${String(node.id)} references unknown panel renderer ${renderer}.`,
          { target: { kind: 'panel', panelId: node.id }, detail: renderer }
        ));
      }
    });
  }
}

function isRegistry(registry) {
  return Boolean(registry) && typeof registry.has === 'function';
}
