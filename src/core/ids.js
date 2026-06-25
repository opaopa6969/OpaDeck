import { createProblem } from './problem.js';

// Shared id/reference helpers used by the closed core validator and by the
// optional companion validators (layout/help/geo). The dependency direction is
// one-way on purpose: companion modules may import from core, but core never
// imports a companion. These helpers only know about core concepts
// (group/operation/field), so they are safe to live here.

export function fqid(groupId, operationId) {
  return `${groupId}.${operationId}`;
}

export function fieldKey(operationId, fieldId) {
  return `${String(operationId)}::${String(fieldId)}`;
}

export function hasField(operation, fieldId) {
  return Array.isArray(operation.fields) && operation.fields.some((field) => field.id === fieldId);
}

export function hasById(items, id) {
  return Array.isArray(items) && items.some((item) => item.id === id);
}

export function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function pushDuplicateProblems(kind, items, problems, scope) {
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

export function collectOperations(app) {
  const map = new Map();
  for (const group of app.groups) {
    for (const operation of group.operations) {
      map.set(fqid(group.id, operation.id), operation);
    }
  }
  return map;
}

export function collectOperationIds(app) {
  const ids = new Set();
  for (const group of app.groups) {
    for (const operation of group.operations) {
      ids.add(fqid(group.id, operation.id));
      ids.add(operation.id);
    }
  }
  return ids;
}
