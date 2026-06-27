import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRequestPreview, MULTIPART_BOUNDARY } from '../src/index.js';

test('checkbox serializes its checkedValue only when checked', () => {
  const operation = {
    id: 'parse',
    groupId: 'core',
    request: { method: 'GET', url: '/api/parsing' },
    fields: [
      { id: 'parser', name: 'parser', type: 'checkbox', placement: 'query', checkedValue: 'indexing' },
    ],
  };

  const checked = buildRequestPreview(operation, { parser: true });
  assert.equal(checked.url, '/api/parsing?parser=indexing');

  const unchecked = buildRequestPreview(operation, { parser: false });
  assert.equal(unchecked.url, '/api/parsing', 'unchecked box must be omitted, not sent as "false"');
});

test('checkbox without checkedValue defaults to "on"', () => {
  const operation = {
    id: 'flag',
    groupId: 'core',
    request: { method: 'GET', url: '/api/x' },
    fields: [{ id: 'agree', name: 'agree', type: 'checkbox', placement: 'query' }],
  };
  assert.equal(buildRequestPreview(operation, { agree: true }).url, '/api/x?agree=on');
});

test('checkbox uncheckedValue is sent when provided', () => {
  const operation = {
    id: 'flag',
    groupId: 'core',
    request: { method: 'GET', url: '/api/x' },
    fields: [{ id: 'on', name: 'on', type: 'checkbox', placement: 'query', checkedValue: '1', uncheckedValue: '0' }],
  };
  assert.equal(buildRequestPreview(operation, { on: false }).url, '/api/x?on=0');
});

test('multipart body builds form-data parts with a stable boundary', () => {
  const operation = {
    id: 'upsert',
    groupId: 'building',
    request: { method: 'POST', url: '/api/building', body: { kind: 'multipart' } },
    fields: [
      { id: 'zip', name: 'zip', type: 'text', placement: 'body' },
      { id: 'name', name: 'buildname', type: 'text', placement: 'body' },
    ],
  };
  const preview = buildRequestPreview(operation, { zip: '1450065', name: 'アーバンレックス' });

  assert.equal(preview.headers['content-type'], `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`);
  assert.match(preview.bodyText, /Content-Disposition: form-data; name="zip"\r\n\r\n1450065\r\n/);
  assert.match(preview.bodyText, /name="buildname"\r\n\r\nアーバンレックス\r\n/);
  assert.ok(preview.bodyText.endsWith(`--${MULTIPART_BOUNDARY}--\r\n`));
});
