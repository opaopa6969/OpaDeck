// Serializes an operation definition plus field state into an HTTP request and a
// RequestPreviewModel. This is pure: it never performs I/O, so it can be tested
// and shown to the operator before anything is executed.

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

export function operationFqid(operation) {
  if (!operation || typeof operation !== 'object') {
    return '';
  }
  if (operation.groupId) {
    return `${operation.groupId}.${operation.id}`;
  }
  return String(operation.id || '');
}

export function buildRequestPreview(operation, fieldState = {}, options = {}) {
  if (!operation || typeof operation !== 'object') {
    throw new TypeError('buildRequestPreview requires an operation object.');
  }
  const request = operation.request || {};
  const method = String(request.method || 'GET').toUpperCase();
  const fields = Array.isArray(operation.fields) ? operation.fields : [];

  const url = buildUrl(request, fields, fieldState, options);
  const { headers, bodyText } = buildHeadersAndBody(request, method, fields, fieldState);

  const preview = {
    method,
    url,
    headers,
    bodyText,
  };
  preview.curl = buildCurl(preview);
  return preview;
}

function buildUrl(request, fields, fieldState, options) {
  let url = joinUrl(options.baseUrl, request.url);
  url = substitutePathParams(url, fields, fieldState);

  const query = new URLSearchParams();
  for (const field of fields) {
    if (field.placement !== 'query') {
      continue;
    }
    appendValue(query, serializedKey(field), readValue(fieldState, field));
  }
  const queryString = query.toString();
  if (queryString) {
    url += (url.includes('?') ? '&' : '?') + queryString;
  }
  return url;
}

function substitutePathParams(url, fields, fieldState) {
  let next = url;
  for (const field of fields) {
    if (field.placement !== 'path') {
      continue;
    }
    const value = readValue(fieldState, field);
    if (value == null) {
      continue;
    }
    const key = serializedKey(field);
    const encoded = encodeURIComponent(String(value));
    next = next
      .replace(new RegExp(`:${escapeRegExp(key)}\\b`, 'g'), encoded)
      .replace(new RegExp(`\\{${escapeRegExp(key)}\\}`, 'g'), encoded);
  }
  return next;
}

function buildHeadersAndBody(request, method, fields, fieldState) {
  const headers = {};

  for (const field of fields) {
    if (field.placement !== 'header') {
      continue;
    }
    const value = readValue(fieldState, field);
    if (value != null && value !== '') {
      headers[serializedKey(field)] = String(value);
    }
  }

  if (Array.isArray(request.accept) && request.accept.length > 0) {
    headers.accept = request.accept.join(', ');
  }

  let bodyText;
  if (!BODYLESS_METHODS.has(method)) {
    bodyText = buildBody(request, fields, fieldState);
    if (bodyText != null && request.contentType) {
      headers['content-type'] = request.contentType;
    } else if (bodyText != null && !hasHeader(headers, 'content-type')) {
      const inferred = inferContentType(request);
      if (inferred) {
        headers['content-type'] = inferred;
      }
    }
  }

  return { headers, bodyText };
}

function buildBody(request, fields, fieldState) {
  const body = request.body;
  if (!body || body.kind === 'none') {
    return undefined;
  }
  if (body.kind === 'rawField') {
    const value = fieldState[body.fieldId];
    return value == null ? '' : String(value);
  }
  if (body.kind === 'form') {
    const form = new URLSearchParams();
    for (const field of fields) {
      if (field.placement !== 'body') {
        continue;
      }
      appendValue(form, serializedKey(field), readValue(fieldState, field));
    }
    return form.toString();
  }
  if (body.kind === 'multipart') {
    return buildMultipart(fields, fieldState);
  }
  return undefined;
}

function inferContentType(request) {
  const body = request.body;
  if (body && body.kind === 'form') {
    return 'application/x-www-form-urlencoded';
  }
  if (body && body.kind === 'multipart') {
    return `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`;
  }
  return undefined;
}

// A fixed boundary keeps buildRequestPreview pure (no Date/Math.random) and lets
// the preview, curl, and the executed request stay byte-for-byte identical.
export const MULTIPART_BOUNDARY = '----OpaDeckFormBoundary7MA4YWxkTrZu0gW';

function buildMultipart(fields, fieldState) {
  const parts = [];
  for (const field of fields) {
    if (field.placement !== 'body') {
      continue;
    }
    const value = readValue(fieldState, field);
    if (value == null) {
      continue;
    }
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item == null) {
        continue;
      }
      parts.push(
        `--${MULTIPART_BOUNDARY}\r\n`
        + `Content-Disposition: form-data; name="${serializedKey(field)}"\r\n\r\n`
        + `${String(item)}\r\n`,
      );
    }
  }
  parts.push(`--${MULTIPART_BOUNDARY}--\r\n`);
  return parts.join('');
}

export function buildCurl(preview) {
  const parts = ['curl'];
  if (preview.method && preview.method !== 'GET') {
    parts.push('-X', preview.method);
  }
  parts.push(shellQuote(preview.url));
  for (const [key, value] of Object.entries(preview.headers || {})) {
    parts.push('-H', shellQuote(`${key}: ${value}`));
  }
  if (preview.bodyText != null && preview.bodyText !== '') {
    parts.push('--data-raw', shellQuote(preview.bodyText));
  }
  return parts.join(' ');
}

// --- helpers ---------------------------------------------------------------

function readValue(fieldState, field) {
  let value;
  const direct = fieldState[field.id];
  if (direct !== undefined) {
    value = direct;
  } else if (field.defaultValue !== undefined) {
    value = field.defaultValue;
  } else {
    value = undefined;
  }
  return resolveCheckbox(field, value);
}

// Checkbox fields carry a boolean state, but HTML checkbox semantics are
// "submit a specific value only when checked". A checked box serializes to
// `field.checkedValue` (default 'on'); an unchecked box serializes to
// `field.uncheckedValue` (default undefined => the parameter is omitted), so
// the boolean never leaks out as the literal string "true"/"false".
function resolveCheckbox(field, value) {
  if (!field || field.type !== 'checkbox') {
    return value;
  }
  const checked = value === true
    || (typeof value === 'string' && value !== '' && value !== 'false' && value !== '0');
  if (checked) {
    return field.checkedValue !== undefined ? field.checkedValue : 'on';
  }
  return field.uncheckedValue;
}

function appendValue(params, key, value) {
  if (value == null) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item != null && item !== '') {
        params.append(key, String(item));
      }
    }
    return;
  }
  if (value === '') {
    return;
  }
  params.append(key, String(value));
}

function serializedKey(field) {
  return field.name || field.id;
}

function joinUrl(baseUrl, url) {
  const left = baseUrl == null ? '' : String(baseUrl);
  const right = url == null ? '' : String(url);
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(right)) {
    return right;
  }
  return left.replace(/\/+$/, '') + '/' + right.replace(/^\/+/, '');
}

function hasHeader(headers, name) {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
}

function shellQuote(text) {
  return `'${String(text).replace(/'/g, `'\\''`)}'`;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
