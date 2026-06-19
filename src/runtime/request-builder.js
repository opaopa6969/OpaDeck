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
  return undefined;
}

function inferContentType(request) {
  const body = request.body;
  if (body && body.kind === 'form') {
    return 'application/x-www-form-urlencoded';
  }
  return undefined;
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
  const direct = fieldState[field.id];
  if (direct !== undefined) {
    return direct;
  }
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }
  return undefined;
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
