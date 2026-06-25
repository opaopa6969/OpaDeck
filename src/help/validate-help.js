import { createProblem } from '../core/problem.js';
import { fqid, fieldKey, pushDuplicateProblems } from '../core/ids.js';
import { traverseRenderNode } from '../layout/validate-layout.js';

// Optional companion layer: help + tour validation. Not part of the closed
// core. Help/tour targets may point at panels (a layout concept), so this
// module depends on the layout companion for reference collection. Composed in
// by validateApp() when an app carries a help block.

export function validateHelp(app) {
  const problems = [];
  const help = app.help;
  if (!help || typeof help !== 'object') {
    return problems;
  }
  const refs = collectReferences(app);
  validateHelpEntries(help, refs, problems);
  validateTours(help, refs, problems);
  return problems;
}

function validateHelpEntries(help, refs, problems) {
  if (!Array.isArray(help.entries)) {
    return;
  }
  pushDuplicateProblems('help-entry', help.entries, problems);
  for (const entry of help.entries) {
    validateHelpTarget(entry.target, refs, problems, entry.id);
  }
}

function validateTours(help, refs, problems) {
  const tours = Array.isArray(help.tours) ? help.tours : [];
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
  for (const layout of Array.isArray(app.layouts) ? app.layouts : []) {
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
