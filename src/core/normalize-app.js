function shallowCloneArray(items) {
  return Array.isArray(items) ? items.slice() : [];
}

export function normalizeAppDefinition(app) {
  if (!app || typeof app !== 'object') {
    throw new TypeError('App definition must be an object.');
  }
  const groups = shallowCloneArray(app.groups).map((group) => normalizeGroup(group));
  const normalized = {
    ...app,
    groups,
    dataSources: shallowCloneArray(app.dataSources),
    layouts: shallowCloneArray(app.layouts),
  };
  for (const group of normalized.groups) {
    for (const operation of group.operations) {
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
  return {
    ...group,
    operations: shallowCloneArray(group.operations).map((operation) => ({
      ...operation,
      fields: shallowCloneArray(operation.fields),
    })),
  };
}
