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
      operation.groupId = group.id;
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
