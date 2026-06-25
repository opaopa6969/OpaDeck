import { createProblem } from '../core/problem.js';
import { collectOperationIds, pushDuplicateProblems } from '../core/ids.js';

// Optional companion layer: layout (presentation tree) validation. Not part of
// the closed core. Composed in by validateApp() when an app carries layouts.

export function validateLayouts(app) {
  const problems = [];
  const layouts = Array.isArray(app.layouts) ? app.layouts : [];
  if (layouts.length === 0) {
    return problems;
  }

  pushDuplicateProblems('layout', layouts, problems);

  const groupIds = new Set(app.groups.map((group) => group.id));
  const operationIds = collectOperationIds(app);
  const panelIds = new Set();

  for (const layout of layouts) {
    traverseRenderNode(layout.root, (node) => {
      if (node && typeof node.id === 'string') {
        if (panelIds.has(node.id)) {
          problems.push(createProblem(
            'layout.panel.id.duplicate',
            'error',
            `Panel or layout node id ${node.id} is duplicated.`,
            { target: { kind: 'panel', panelId: node.id } }
          ));
        }
        panelIds.add(node.id);
      }
      if (node && node.kind === 'panel') {
        validatePanelBinding(node, groupIds, operationIds, problems);
      }
    });
  }
  return problems;
}

function validatePanelBinding(panel, groupIds, operationIds, problems) {
  const binding = panel.binding || {};
  switch (binding.kind) {
    case 'group':
      if (!groupIds.has(binding.groupId)) {
        problems.push(createProblem(
          'panel.binding.group.missing',
          'error',
          `Panel ${panel.id} references missing group ${String(binding.groupId)}.`,
          { target: { kind: 'panel', panelId: panel.id } }
        ));
      }
      break;
    case 'results':
    case 'help':
      if (binding.operationId && !operationIds.has(binding.operationId)) {
        problems.push(createProblem(
          `panel.binding.${binding.kind}.operation.missing`,
          'error',
          `Panel ${panel.id} references missing operation ${String(binding.operationId)}.`,
          { target: { kind: 'panel', panelId: panel.id } }
        ));
      }
      break;
    default:
      break;
  }
}

export function traverseRenderNode(node, visitor) {
  if (!node || typeof node !== 'object') {
    return;
  }
  visitor(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      traverseRenderNode(child, visitor);
    }
  }
  if (Array.isArray(node.tabs)) {
    for (const tab of node.tabs) {
      traverseRenderNode(tab, visitor);
    }
  }
}
