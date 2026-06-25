import { normalizeAppDefinition } from './normalize-app.js';
import { createProblem, problemComparator } from './problem.js';
import { fqid, hasField, hasById, pushDuplicateProblems } from './ids.js';

// Closed-core validation. This only knows about the semantic spine:
// app / group / operation / request / field / datasource. Validation of the
// optional companion layers (layout, help, tour, geo result options) lives in
// their own modules and is composed by validateApp() in ../validate.js.

export function validateAppDefinition(app) {
  const normalized = normalizeAppDefinition(app);
  const problems = [];

  validateTopLevelIds(normalized, problems);
  validateGroups(normalized, problems);

  return problems.sort(problemComparator);
}

function validateTopLevelIds(app, problems) {
  pushDuplicateProblems('group', app.groups, problems);
  pushDuplicateProblems('data-source', app.dataSources, problems);
}

function validateGroups(app, problems) {
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
    }
  }
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
