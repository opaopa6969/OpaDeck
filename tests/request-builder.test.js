import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRequestPreview, buildCurl, MULTIPART_BOUNDARY } from '../src/index.js';

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

test('rawFieldAny body picks the first non-empty candidate field, in declaration order', () => {
  const operation = {
    id: 'upload',
    groupId: 'verify',
    request: {
      method: 'POST',
      url: '/api/verify',
      contentType: 'text/plain',
      body: { kind: 'rawFieldAny', fieldIds: ['file', 'pasted'] },
    },
    fields: [
      { id: 'file', name: 'file', type: 'file', placement: 'body' },
      { id: 'pasted', name: 'pasted', type: 'textarea', placement: 'body' },
    ],
  };

  const fileWins = buildRequestPreview(operation, { file: 'FILE CONTENT', pasted: 'PASTED CONTENT' });
  assert.equal(fileWins.bodyText, 'FILE CONTENT', 'earlier fieldId wins when both are filled');

  const pastedFallsBack = buildRequestPreview(operation, { file: '', pasted: 'PASTED CONTENT' });
  assert.equal(pastedFallsBack.bodyText, 'PASTED CONTENT', 'later fieldId is used when the earlier one is empty');

  const neitherFilled = buildRequestPreview(operation, { file: '', pasted: '' });
  assert.equal(neitherFilled.bodyText, '', 'empty string when no candidate is filled');
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

test('form body serializes body-placement fields as urlencoded and infers the content type', () => {
  const operation = {
    id: 'login',
    groupId: 'auth',
    request: {
      method: 'POST',
      url: '/api/login',
      body: { kind: 'form' },
    },
    fields: [
      { id: 'user', name: 'user', type: 'text', placement: 'body' },
      { id: 'pass', name: 'pass', type: 'text', placement: 'body' },
      { id: 'remember', name: 'remember', type: 'checkbox', placement: 'body', checkedValue: '1' },
    ],
  };
  const preview = buildRequestPreview(operation, { user: 'alice', pass: 's3cret', remember: true });
  assert.equal(preview.headers['content-type'], 'application/x-www-form-urlencoded');
  const params = new URLSearchParams(preview.bodyText);
  assert.equal(params.get('user'), 'alice');
  assert.equal(params.get('pass'), 's3cret');
  assert.equal(params.get('remember'), '1');

  // No body fields filled => empty form body, still urlencoded.
  const empty = buildRequestPreview(operation, {});
  assert.equal(empty.bodyText, '');
  assert.equal(empty.headers['content-type'], 'application/x-www-form-urlencoded');
});

test('checkbox string "false"/"0" are treated as unchecked, not literal truthy values', () => {
  const operation = {
    id: 'flag',
    groupId: 'core',
    request: { method: 'GET', url: '/api/x' },
    fields: [
      { id: 'a', name: 'a', type: 'checkbox', placement: 'query', checkedValue: 'yes' },
      { id: 'b', name: 'b', type: 'checkbox', placement: 'query', checkedValue: 'yes' },
      { id: 'c', name: 'c', type: 'checkbox', placement: 'query', checkedValue: 'yes' },
    ],
  };
  // string "false" and "0" must NOT serialize as a truthy checkbox value.
  assert.equal(buildRequestPreview(operation, { a: 'false' }).url, '/api/x');
  assert.equal(buildRequestPreview(operation, { b: '0' }).url, '/api/x');
  // any other non-empty string is treated as checked.
  assert.equal(buildRequestPreview(operation, { c: 'maybe' }).url, '/api/x?c=yes');
});

test('defaultValue is used when fieldState does not override the field', () => {
  const operation = {
    id: 'search',
    groupId: 'core',
    request: { method: 'GET', url: '/api/search' },
    fields: [
      { id: 'q', name: 'q', type: 'text', placement: 'query', defaultValue: 'fallback' },
    ],
  };
  assert.equal(buildRequestPreview(operation, {}).url, '/api/search?q=fallback');
  // Explicit fieldState wins over defaultValue.
  assert.equal(buildRequestPreview(operation, { q: 'override' }).url, '/api/search?q=override');
});

test('buildCurl shells-quotes single quotes in url, headers, and body and omits -X for GET', () => {
  const preview = {
    method: 'GET',
    url: "https://example.test/a'b",
    headers: { 'x-note': "it's here" },
    bodyText: "raw 'body' with \\backslash",
  };
  const curl = buildCurl(preview);
  // GET omits -X.
  assert.ok(!/\s-X\s/.test(curl), 'GET must not emit -X');
  // Single quotes are escaped as '\'' so the shell still treats each as one arg.
  assert.ok(curl.includes("'https://example.test/a'\\''b'"), curl);
  assert.ok(curl.includes("'x-note: it'\\''s here'"), curl);
  assert.ok(curl.includes("--data-raw 'raw '\\''body'\\'' with \\backslash'"), curl);

  // Non-GET method emits -X <METHOD>.
  assert.match(buildCurl({ method: 'POST', url: '/x', headers: {}, bodyText: '' }), /^curl -X POST '/);
});
