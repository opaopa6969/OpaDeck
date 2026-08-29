import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProblem,
  problemComparator,
  normalizeAppDefinition,
  pushDuplicateProblems,
} from '../src/index.js';

test('createProblem rejects bad arguments and problemComparator orders by severity then code', () => {
  assert.throws(() => createProblem('', 'error', 'x'), /non-empty string/);
  assert.throws(() => createProblem('c', '', 'x'), /non-empty string/);
  assert.throws(() => createProblem('c', 'error', ''), /non-empty string/);

  const problem = createProblem('code', 'warning', 'msg', { target: 't', detail: 'd' });
  assert.deepEqual(problem, { code: 'code', severity: 'warning', message: 'msg', target: 't', detail: 'd' });

  const pool = [
    createProblem('b', 'error', 'b'),
    createProblem('a', 'error', 'a'),
    createProblem('z', 'warning', 'z'),
    createProblem('m', 'info', 'm'),
    createProblem('q', 'debug', 'q'),
  ].sort(problemComparator);
  // severity rank: error(3) > warning(2) > info(1) > unknown(0)
  assert.deepEqual(pool.map((p) => p.severity), ['error', 'error', 'warning', 'info', 'debug']);
  // within the same severity, code ascends via localeCompare
  assert.deepEqual(pool.filter((p) => p.severity === 'error').map((p) => p.code), ['a', 'b']);
});

test('normalizeAppDefinition rejects non-objects and preserves a mismatched groupId', () => {
  assert.throws(() => normalizeAppDefinition(null), /must be an object/);
  assert.throws(() => normalizeAppDefinition('x'), /must be an object/);

  const app = normalizeAppDefinition({
    id: 'd',
    version: 1,
    title: 'D',
    groups: [{
      id: 'g',
      label: 'G',
      operations: [
        { id: 'injected', title: 'I', request: { method: 'GET', url: '/i' }, fields: [] },
        { id: 'mismatched', groupId: 'wrong', title: 'M', request: { method: 'GET', url: '/m' }, fields: [] },
      ],
    }],
  });
  // Missing groupId is injected from the enclosing group.
  assert.equal(app.groups[0].operations[0].groupId, 'g');
  // A declared-but-mismatched groupId is preserved on purpose so that
  // validateAppDefinition can report `operation.groupId.mismatch` instead of
  // silently rewriting an authoring mistake.
  assert.equal(app.groups[0].operations[1].groupId, 'wrong');

  // Null/missing arrays are tolerated via shallowCloneArray.
  const empty = normalizeAppDefinition({ id: 'e', version: 1 });
  assert.deepEqual(empty.groups, []);
  assert.deepEqual(empty.dataSources, []);
});

test('pushDuplicateProblems skips idless items, accepts null list, and scopes duplicate keys', () => {
  const problems = [];
  pushDuplicateProblems('field', null, problems);
  pushDuplicateProblems('field', [
    { id: 'a' },
    { id: '' },
    null,
    { id: 'a' },
    { id: 'b' },
  ], problems);

  assert.equal(problems.length, 1);
  assert.equal(problems[0].code, 'field.id.duplicate');
  assert.equal(problems[0].severity, 'error');
  assert.match(problems[0].message, /Field id a is duplicated\./);

  // Scope keying: the same id in different scopes is NOT a duplicate.
  const scoped = [];
  pushDuplicateProblems('op', [{ id: 'x' }, { id: 'x' }], scoped, 'g1');
  pushDuplicateProblems('op', [{ id: 'x' }, { id: 'x' }], scoped, 'g2');
  assert.equal(scoped.length, 2);
  assert.match(scoped[0].message, /in g1/);
  assert.match(scoped[1].message, /in g2/);

  // The first occurrence never produces a problem.
  const first = [];
  pushDuplicateProblems('g', [{ id: 'only' }], first);
  assert.equal(first.length, 0);
});
