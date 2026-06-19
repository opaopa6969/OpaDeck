import { normalizeAppDefinition } from './normalize-app.js';
import { createProblem, problemComparator } from './problem.js';

export function validateAppDefinition(app) {
  const normalized = normalizeAppDefinition(app);
  const problems = [];

  validateTopLevelIds(normalized, problems);
  validateGroups(normalized, problems);
  validateLayouts(normalized, problems);
  validateHelp(normalized, problems);
  validateTours(normalized, problems);

  return problems.sort(problemComparator);
}

function validateTopLevelIds(app, problems) {
  pushDuplicateProblems('group', app.groups, problems);
  pushDuplicateProblems('data-source', app.dataSources, problems);
  pushDuplicateProblems('layout', app.layouts, problems);
}

function validateGroups(app, problems) {
  const operationMap = collectOperations(app);
  for (const group of app.groups) {
    pushDuplicateProblems('operation', group.operations, problems, group.id);
    for (const operation of group.operations) {
      if (operation.groupId !== group.id) {
        problems.push(createProblem(
          'operation.groupId.mismatch',
          'error',
          `Operation ${fqid(group.id, operation.id)} has mismatched groupId ${String(operation.groupId)}.`,
          { target: { kind: 'operation', operationId: operation.id } }
        ));
      }
      pushDuplicateProblems('field', operation.fields, problems, fqid(group.id, operation.id));
      validateRequestBody(operation, group.id, problems);
      validateFieldSources(operation, group.id, app, problems);
      validateResultView(operation, group.id, problems);
    }
  }
  return operationMap;
}

function validateRequestBody(operation, groupId, problems) {
  const body = operation.request && operation.request.body;
  if (!body || body.kind !== 'rawField') {
    return;
  }
  if (!hasField(operation, body.fieldId)) {
    problems.push(createProblem(
      'request.body.rawField.missing',
      'error',
      `Operation ${fqid(groupId, operation.id)} references missing raw body field ${String(body.fieldId)}.`,
      { target: { kind: 'operation', operationId: operation.id } }
    ));
  }
}

function validateFieldSources(operation, groupId, app, problems) {
  for (const field of operation.fields) {
    const source = field.source;
    if (!source || typeof source !== 'object') {
      continue;
    }
    const dataSourceId = source.dataSourceId || source.id;
    if (typeof dataSourceId === 'string' && !hasById(app.dataSources, dataSourceId)) {
      problems.push(createProblem(
        'field.source.dataSource.missing',
        'error',
        `Field ${fqid(groupId, operation.id)}.${field.id} references missing data source ${dataSourceId}.`,
        { target: { kind: 'field', operationId: operation.id, fieldId: field.id } }
      ));
    }
  }
}

function validateResultView(operation, groupId, problems) {
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

function validateLayouts(app, problems) {
  const groupIds = new Set(app.groups.map((group) => group.id));
  const operationIds = collectOperationIds(app);
  const panelIds = new Set();

  for (const layout of app.layouts) {
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

function validateHelp(app, problems) {
  const refs = collectReferences(app);
  const help = app.help;
  if (!help || !Array.isArray(help.entries)) {
    return;
  }
  pushDuplicateProblems('help-entry', help.entries, problems);
  for (const entry of help.entries) {
    validateHelpTarget(entry.target, refs, problems, entry.id);
  }
}

function validateTours(app, problems) {
  const refs = collectReferences(app);
  const tours = app.help && Array.isArray(app.help.tours) ? app.help.tours : [];
  pushDuplicateProblems('tour', tours, problems);
  for (const tour of tours) {
    const steps = Array.isArray(tour.steps) ? tour.steps : [];
    pushDuplicateProblems('tour-step', steps, problems, tour.id);
    for (const step of steps) {
      const commands = Array.isArray(step.commands) ? step.commands : [];
      for (const command of commands) {
        validateTourCommand(command, refs, problems, tour.id, step.id);
      }
    }
  }
}

function validateHelpTarget(target, refs, problems, entryId) {
  if (!target || typeof target !== 'object') {
    problems.push(createProblem('help.target.missing', 'error', `Help entry ${entryId} is missing a target.`));
    return;
  }
  if (!targetExists(target, refs)) {
    problems.push(createProblem(
      'help.target.invalid',
      'error',
      `Help entry ${entryId} references a missing target.`,
      { target: normalizeProblemTarget(target) }
    ));
  }
}

function validateTourCommand(command, refs, problems, tourId, stepId) {
  if (!command || typeof command !== 'object' || typeof command.kind !== 'string') {
    return;
  }
  switch (command.kind) {
    case 'focusOperation':
    case 'submitOperation':
    case 'waitResult':
      if (!refs.operations.has(command.operationId)) {
        problems.push(createProblem(
          'tour.command.operation.missing',
          'error',
          `Tour ${tourId}/${stepId} references missing operation ${String(command.operationId)}.`
        ));
      }
      break;
    case 'focusField':
      if (!refs.fields.has(fieldKey(command.operationId, command.fieldId))) {
        problems.push(createProblem(
          'tour.command.field.missing',
          'error',
          `Tour ${tourId}/${stepId} references missing field ${String(command.operationId)}.${String(command.fieldId)}.`
        ));
      }
      break;
    case 'focusPanel':
      if (!refs.panels.has(command.panelId)) {
        problems.push(createProblem(
          'tour.command.panel.missing',
          'error',
          `Tour ${tourId}/${stepId} references missing panel ${String(command.panelId)}.`
        ));
      }
      break;
    default:
      break;
  }
}

function pushDuplicateProblems(kind, items, problems, scope) {
  const seen = new Set();
  for (const item of items || []) {
    const id = item && item.id;
    if (!id) {
      continue;
    }
    const key = scope ? `${scope}:${id}` : id;
    if (seen.has(key)) {
      problems.push(createProblem(
        `${kind}.id.duplicate`,
        'error',
        `${capitalize(kind)} id ${id} is duplicated${scope ? ` in ${scope}` : ''}.`
      ));
      continue;
    }
    seen.add(key);
  }
}

function collectOperations(app) {
  const map = new Map();
  for (const group of app.groups) {
    for (const operation of group.operations) {
      map.set(fqid(group.id, operation.id), operation);
    }
  }
  return map;
}

function collectOperationIds(app) {
  const ids = new Set();
  for (const group of app.groups) {
    for (const operation of group.operations) {
      ids.add(fqid(group.id, operation.id));
      ids.add(operation.id);
    }
  }
  return ids;
}

function collectReferences(app) {
  const operations = new Set();
  const fields = new Set();
  const groups = new Set(app.groups.map((group) => group.id));
  const panels = new Set();

  for (const group of app.groups) {
    for (const operation of group.operations) {
      operations.add(operation.id);
      operations.add(fqid(group.id, operation.id));
      for (const field of operation.fields) {
        fields.add(fieldKey(operation.id, field.id));
        fields.add(fieldKey(fqid(group.id, operation.id), field.id));
      }
    }
  }
  for (const layout of app.layouts) {
    traverseRenderNode(layout.root, (node) => {
      if (node && typeof node.id === 'string') {
        panels.add(node.id);
      }
    });
  }

  return { groups, operations, fields, panels };
}

function targetExists(target, refs) {
  switch (target.kind) {
    case 'app':
      return true;
    case 'group':
      return refs.groups.has(target.groupId);
    case 'operation':
      return refs.operations.has(target.operationId);
    case 'field':
      return refs.fields.has(fieldKey(target.operationId, target.fieldId));
    case 'panel':
      return refs.panels.has(target.panelId);
    case 'result':
      return !target.operationId || refs.operations.has(target.operationId);
    default:
      return false;
  }
}

function normalizeProblemTarget(target) {
  if (!target || typeof target !== 'object' || !target.kind) {
    return undefined;
  }
  switch (target.kind) {
    case 'group':
      return { kind: 'group', groupId: target.groupId };
    case 'operation':
      return { kind: 'operation', operationId: target.operationId };
    case 'field':
      return { kind: 'field', operationId: target.operationId, fieldId: target.fieldId };
    case 'panel':
      return { kind: 'panel', panelId: target.panelId };
    default:
      return undefined;
  }
}

function traverseRenderNode(node, visitor) {
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

function hasField(operation, fieldId) {
  return Array.isArray(operation.fields) && operation.fields.some((field) => field.id === fieldId);
}

function hasById(items, id) {
  return Array.isArray(items) && items.some((item) => item.id === id);
}

function fqid(groupId, operationId) {
  return `${groupId}.${operationId}`;
}

function fieldKey(operationId, fieldId) {
  return `${String(operationId)}::${String(fieldId)}`;
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
