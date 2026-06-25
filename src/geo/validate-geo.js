import { createProblem } from '../core/problem.js';
import { fqid } from '../core/ids.js';

// Optional companion check for the geoScene result renderer. The closed core
// treats result.renderer as an opaque registry id; this edge renderer owns the
// validation of its own options. Composed in by validateApp().

export function validateGeoScene(app) {
  const problems = [];
  for (const group of app.groups || []) {
    for (const operation of group.operations || []) {
      validateGeoSceneResult(operation, group.id, problems);
    }
  }
  return problems;
}

function validateGeoSceneResult(operation, groupId, problems) {
  const result = operation.result;
  if (!result || result.renderer !== 'geoScene') {
    return;
  }
  if (!result.options || typeof result.options !== 'object') {
    problems.push(createProblem(
      'result.geoScene.options.missing',
      'error',
      `Operation ${fqid(groupId, operation.id)} declares geoScene without options.`,
      { target: { kind: 'operation', operationId: operation.id } }
    ));
    return;
  }
  const layers = result.options.layers;
  if (!Array.isArray(layers) || layers.length === 0) {
    problems.push(createProblem(
      'result.geoScene.layers.missing',
      'error',
      `Operation ${fqid(groupId, operation.id)} declares geoScene without layers.`,
      { target: { kind: 'operation', operationId: operation.id } }
    ));
  }
}
