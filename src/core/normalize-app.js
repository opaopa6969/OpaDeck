import { isPlainObject } from './ids.js';

function shallowCloneArray(items) {
  return Array.isArray(items) ? items.slice() : [];
}

export function normalizeAppDefinition(app) {
  if (!app || typeof app !== 'object') {
    throw new TypeError('App definition must be an object.');
  }
  const groups = shallowCloneArray(app.groups).map((group) => normalizeGroup(group));
  // Core normalizes only the semantic spine (groups + dataSources). Optional
  // companion sections ride through untouched via the spread.
  const normalized = {
    ...app,
    groups,
    dataSources: shallowCloneArray(app.dataSources),
  };
  for (const group of normalized.groups) {
    // A non-object group is a malformed-but-non-throwing shape: leave it as
    // is for validateAppDefinition to report as `group.invalid`.
    if (!isPlainObject(group)) {
      continue;
    }
    for (const operation of group.operations) {
      if (!isPlainObject(operation)) {
        continue;
      }
      // Inject the normalized groupId only when the author did not declare one.
      // A declared-but-mismatched groupId is preserved on purpose so that
      // validateAppDefinition can report `operation.groupId.mismatch` instead of
      // silently rewriting an authoring mistake.
      if (operation.groupId == null) {
        operation.groupId = group.id;
      }
    }
  }
  return normalized;
}

function normalizeGroup(group) {
  if (!isPlainObject(group)) {
    return group;
  }
  return {
    ...group,
    operations: shallowCloneArray(group.operations).map((operation) => normalizeOperation(operation)),
  };
}

function normalizeOperation(operation) {
  if (!isPlainObject(operation)) {
    return operation;
  }
  return {
    ...operation,
    fields: shallowCloneArray(operation.fields),
  };
}
