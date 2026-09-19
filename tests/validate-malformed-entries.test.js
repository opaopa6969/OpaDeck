import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeAppDefinition, validateApp, validateAppDefinition } from '../src/index.js';

// ISSUE-041: a non-object entry in groups / operations / fields must surface
// as a structured problem, not escape as a bare TypeError.

test('normalizeAppDefinition never throws for a non-object group, operation, or field', () => {
  assert.doesNotThrow(() => normalizeAppDefinition({ id: 'a', groups: [null] }));
  assert.doesNotThrow(() => normalizeAppDefinition({ id: 'a', groups: [{ id: 'g', operations: [null] }] }));
  assert.doesNotThrow(() => normalizeAppDefinition({
    id: 'a',
    groups: [{ id: 'g', operations: [{ id: 'op', groupId: 'g', fields: [null] }] }],
  }));
});

test('validateAppDefinition reports group.invalid for a non-object group and keeps validating the rest', () => {
  const problems = validateAppDefinition({
    id: 'a',
    groups: [null, { id: 'g', operations: [] }],
  });
  const codes = problems.map((problem) => problem.code);
  assert.ok(codes.includes('group.invalid'));
  assert.equal(problems.find((problem) => problem.code === 'group.invalid').target.groupIndex, 0);
});

test('validateAppDefinition reports operation.invalid for a non-object operation and keeps validating siblings', () => {
  const problems = validateAppDefinition({
    id: 'a',
    groups: [{
      id: 'g',
      operations: [
        null,
        { id: 'op', groupId: 'wrong' },
      ],
    }],
  });
  const codes = problems.map((problem) => problem.code);
  assert.ok(codes.includes('operation.invalid'));
  assert.ok(codes.includes('operation.groupId.mismatch'));
});

test('validateAppDefinition reports field.invalid for a non-object field and keeps validating siblings', () => {
  const problems = validateAppDefinition({
    id: 'a',
    groups: [{
      id: 'g',
      operations: [{
        id: 'op',
        groupId: 'g',
        request: { method: 'POST', url: '/x', body: { kind: 'rawField', fieldId: 'missing' } },
        fields: [null, { id: 'present', name: 'present', type: 'text', placement: 'query' }],
      }],
    }],
  });
  const codes = problems.map((problem) => problem.code);
  assert.ok(codes.includes('field.invalid'));
  assert.ok(codes.includes('request.body.rawField.missing'));
});

test('a wrong argument type at the entry point still throws a TypeError', () => {
  assert.throws(() => normalizeAppDefinition(null), TypeError);
  assert.throws(() => normalizeAppDefinition('not an app'), TypeError);
});

test('the composed validateApp (layout/help/geo/capabilities companions) never throws for non-object groups', () => {
  const app = {
    id: 'a',
    groups: [null],
    layouts: [{ id: 'l', root: { kind: 'panel', id: 'p', renderer: 'groupNav', binding: { kind: 'group', groupId: 'missing' } } }],
    help: { entries: [{ id: 'h', target: { kind: 'group', groupId: 'missing' }, body: 'x' }], tours: [] },
  };
  assert.doesNotThrow(() => validateApp(app));
  const codes = validateApp(app).map((problem) => problem.code);
  assert.ok(codes.includes('group.invalid'));
});

test('validateApp with registries never throws for a non-object operation (capabilities companion)', () => {
  const app = { id: 'a', groups: [{ id: 'g', operations: [null] }] };
  const registries = {
    resultRenderers: { has: () => true },
    fieldRenderers: { match: () => true },
  };
  assert.doesNotThrow(() => validateApp(app, { registries }));
});

test('validateApp reports layout.invalid for a non-object layout and keeps validating the rest', () => {
  const app = {
    id: 'a',
    groups: [{ id: 'g', operations: [] }],
    layouts: [
      null,
      { id: 'l', root: { kind: 'panel', id: 'p', renderer: 'groupNav', binding: { kind: 'group', groupId: 'g' } } },
    ],
  };
  assert.doesNotThrow(() => validateApp(app));
  const problems = validateApp(app);
  const codes = problems.map((problem) => problem.code);
  assert.ok(codes.includes('layout.invalid'));
  assert.equal(problems.find((problem) => problem.code === 'layout.invalid').target.layoutIndex, 0);
});

// ISSUE-049: the same bug class as ISSUE-041/#48, but in the help/tour
// companion validator (src/help/validate-help.js).

test('validateApp reports help-entry.invalid for a non-object help entry and keeps validating siblings', () => {
  const app = {
    id: 'a',
    groups: [{ id: 'g', operations: [] }],
    help: {
      entries: [null, { id: 'h', target: { kind: 'group', groupId: 'missing' } }],
      tours: [],
    },
  };
  assert.doesNotThrow(() => validateApp(app));
  const problems = validateApp(app);
  const codes = problems.map((problem) => problem.code);
  assert.ok(codes.includes('help-entry.invalid'));
  assert.equal(problems.find((problem) => problem.code === 'help-entry.invalid').target.entryIndex, 0);
  assert.ok(codes.includes('help.target.invalid'));
});

test('validateApp reports tour.invalid for a non-object tour and keeps validating siblings', () => {
  const app = {
    id: 'a',
    groups: [{ id: 'g', operations: [] }],
    help: {
      entries: [],
      tours: [null, { id: 't', steps: [] }],
    },
  };
  assert.doesNotThrow(() => validateApp(app));
  const problems = validateApp(app);
  const codes = problems.map((problem) => problem.code);
  assert.ok(codes.includes('tour.invalid'));
  assert.equal(problems.find((problem) => problem.code === 'tour.invalid').target.tourIndex, 0);
});

test('validateApp reports tour-step.invalid for a non-object tour step and keeps validating siblings', () => {
  const app = {
    id: 'a',
    groups: [{ id: 'g', operations: [] }],
    help: {
      entries: [],
      tours: [{
        id: 't',
        steps: [
          null,
          { id: 's', commands: [{ kind: 'focusOperation', operationId: 'missing' }] },
        ],
      }],
    },
  };
  assert.doesNotThrow(() => validateApp(app));
  const problems = validateApp(app);
  const codes = problems.map((problem) => problem.code);
  assert.ok(codes.includes('tour-step.invalid'));
  const invalid = problems.find((problem) => problem.code === 'tour-step.invalid');
  assert.equal(invalid.target.tourId, 't');
  assert.equal(invalid.target.stepIndex, 0);
  assert.ok(codes.includes('tour.command.operation.missing'));
});

test('validateApp never throws when a null layout is combined with a help block referencing panels', () => {
  const app = {
    id: 'a',
    groups: [{ id: 'g', operations: [] }],
    layouts: [null, { id: 'l', root: { kind: 'panel', id: 'p', renderer: 'groupNav', binding: { kind: 'group', groupId: 'g' } } }],
    help: { entries: [{ id: 'h', target: { kind: 'panel', panelId: 'p' } }], tours: [] },
  };
  assert.doesNotThrow(() => validateApp(app));
  const problems = validateApp(app);
  const codes = problems.map((problem) => problem.code);
  assert.ok(codes.includes('layout.invalid'));
  assert.ok(!codes.includes('help.target.invalid'));
});
