import test from 'node:test';
import assert from 'node:assert/strict';

import { validateAppDefinition } from '../src/index.js';

test('validator catches duplicate ids and missing references', () => {
  const problems = validateAppDefinition({
    id: 'demo',
    version: 1,
    title: 'Demo',
    groups: [
      {
        id: 'index',
        label: 'Index',
        operations: [
          {
            id: 'rebuild',
            groupId: 'wrong',
            title: 'Rebuild',
            request: {
              method: 'POST',
              url: '/api/rebuild',
              body: { kind: 'rawField', fieldId: 'missingBody' },
            },
            fields: [
              { id: 'payload', name: 'payload', type: 'textarea', placement: 'body' },
              { id: 'payload', name: 'payload2', type: 'text', placement: 'query' },
              { id: 'company', name: 'company', type: 'select', placement: 'query', source: { dataSourceId: 'companies' } },
            ],
            result: { renderer: 'geoScene', options: {} },
          },
        ],
      },
      {
        id: 'index',
        label: 'Duplicate Group',
        operations: [],
      },
    ],
    dataSources: [],
    layouts: [
      {
        id: 'default',
        root: {
          kind: 'split',
          id: 'root',
          direction: 'row',
          children: [
            {
              kind: 'panel',
              id: 'nav',
              renderer: 'groupNav',
              binding: { kind: 'group', groupId: 'missingGroup' },
            },
            {
              kind: 'panel',
              id: 'nav',
              renderer: 'operationDetail',
              binding: { kind: 'results', scope: 'operation', operationId: 'missing.operation' },
            },
          ],
        },
      },
    ],
    defaultLayoutId: 'default',
    help: {
      entries: [
        {
          id: 'help-1',
          target: { kind: 'field', operationId: 'rebuild', fieldId: 'missingField' },
          body: 'Missing field',
        },
      ],
      tours: [
        {
          id: 'tour-1',
          title: 'Demo Tour',
          steps: [
            {
              id: 'step-1',
              commands: [
                { kind: 'focusOperation', operationId: 'missing.operation' },
                { kind: 'focusPanel', panelId: 'missing-panel' },
              ],
            },
          ],
        },
      ],
    },
  });

  const codes = problems.map((problem) => problem.code);
  assert.ok(codes.includes('group.id.duplicate'));
  assert.ok(codes.includes('operation.groupId.mismatch'));
  assert.ok(codes.includes('field.id.duplicate'));
  assert.ok(codes.includes('request.body.rawField.missing'));
  assert.ok(codes.includes('field.source.dataSource.missing'));
  assert.ok(codes.includes('result.geoScene.layers.missing'));
  assert.ok(codes.includes('panel.binding.group.missing'));
  assert.ok(codes.includes('layout.panel.id.duplicate'));
  assert.ok(codes.includes('help.target.invalid'));
  assert.ok(codes.includes('tour.command.operation.missing'));
  assert.ok(codes.includes('tour.command.panel.missing'));
});
