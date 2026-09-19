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

// A non-object entry (null, string, number, ...) in a groups / operations /
// fields array is a malformed-but-non-throwing input shape: callers use this
// guard to skip it and report a structured problem instead of dereferencing
// it and crashing.
export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasField(operation, fieldId) {
  return Array.isArray(operation.fields) && operation.fields.some((field) => isPlainObject(field) && field.id === fieldId);
}

export function hasById(items, id) {
  return Array.isArray(items) && items.some((item) => isPlainObject(item) && item.id === id);
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
    if (!isPlainObject(group)) {
      continue;
    }
    for (const operation of group.operations) {
      if (!isPlainObject(operation)) {
        continue;
      }
      map.set(fqid(group.id, operation.id), operation);
    }
  }
  return map;
}

export function collectOperationIds(app) {
  const ids = new Set();
  for (const group of app.groups) {
    if (!isPlainObject(group)) {
      continue;
    }
    for (const operation of group.operations) {
      if (!isPlainObject(operation)) {
        continue;
      }
      ids.add(fqid(group.id, operation.id));
      ids.add(operation.id);
    }
  }
  return ids;
}
