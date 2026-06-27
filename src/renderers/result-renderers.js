import { h } from './dom.js';

// Builtin result renderers. These render real response data, not placeholders.
//
// render(ctx) expects a context shaped like an execution result:
//   { document, resultView?, bodyJson?, bodyText?, contentType?, rows?, columns? }
// and returns a DOM element.

export function createBuiltinResultRenderers() {
  return [
    {
      id: 'jsonFoldable',
      canRender: (ctx) => ctx && (hasJson(ctx) || isJsonContentType(ctx.contentType)),
      render: (ctx) => {
        const doc = ctx.document;
        const data = hasJson(ctx) ? ctx.bodyJson : tryParse(ctx.bodyText);
        return h(doc, 'div', { class: 'opa-json' }, [renderJsonNode(doc, data, 'root')]);
      },
    },
    {
      id: 'tableResult',
      canRender: (ctx) => ctx && Array.isArray(resolveRows(ctx)),
      render: (ctx) => {
        const doc = ctx.document;
        const rows = resolveRows(ctx) || [];
        const columns = ctx.columns || inferColumns(rows);
        if (rows.length === 0) {
          return h(doc, 'div', { class: 'opa-table-empty', text: 'No rows.' });
        }
        const head = h(doc, 'thead', {}, [
          h(doc, 'tr', {}, columns.map((col) => h(doc, 'th', { text: col }))),
        ]);
        const body = h(doc, 'tbody', {}, rows.map((row) => h(doc, 'tr', {},
          columns.map((col) => h(doc, 'td', { text: formatCell(row[col]) })))));
        return h(doc, 'table', { class: 'opa-table' }, [head, body]);
      },
    },
    {
      // Newline-delimited JSON (NDJSON): one record per line. Auto-matches the
      // ndjson content types; otherwise reachable via an explicit renderer id.
      id: 'jsonLines',
      canRender: (ctx) => ctx && isNdjsonContentType(ctx.contentType),
      render: (ctx) => {
        const doc = ctx.document;
        const lines = String(ctx.bodyText || '').split('\n').map((line) => line.trim()).filter(Boolean);
        if (lines.length === 0) {
          return h(doc, 'div', { class: 'opa-jsonl opa-jsonl-empty', text: 'No lines.' });
        }
        return h(doc, 'div', { class: 'opa-jsonl' }, lines.map((line) => h(doc, 'div', {
          class: 'opa-jsonl-line',
          text: line,
        })));
      },
    },
    {
      // Plain text response.
      id: 'text',
      canRender: (ctx) => ctx && isPlainTextContentType(ctx.contentType),
      render: (ctx) => h(ctx.document, 'pre', { class: 'opa-text', text: String(ctx.bodyText || '') }),
    },
    {
      // Inline SVG returned by the operation, injected as markup. Auto-matches
      // image/svg+xml.
      id: 'inlineSvg',
      canRender: (ctx) => ctx && typeof ctx.contentType === 'string' && ctx.contentType.includes('svg'),
      render: (ctx) => {
        const doc = ctx.document;
        const markup = String(ctx.bodyText || '');
        if (!markup.includes('<svg')) {
          return h(doc, 'div', { class: 'opa-inline-svg opa-inline-svg-empty', text: 'No SVG content.' });
        }
        return h(doc, 'div', { class: 'opa-inline-svg', innerHTML: markup });
      },
    },
  ];
}

function isNdjsonContentType(contentType) {
  return typeof contentType === 'string'
    && (contentType.includes('ndjson') || contentType.includes('jsonl'));
}

function isPlainTextContentType(contentType) {
  return typeof contentType === 'string'
    && contentType.startsWith('text/')
    && !contentType.includes('html')
    && !contentType.includes('svg');
}

function renderJsonNode(doc, value, keyLabel) {
  if (Array.isArray(value)) {
    return h(doc, 'details', { class: 'opa-json-node opa-json-array', open: true }, [
      h(doc, 'summary', { text: `${keyLabel}: array(${value.length})` }),
      h(doc, 'div', { class: 'opa-json-children' },
        value.map((item, index) => renderJsonNode(doc, item, String(index)))),
    ]);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    return h(doc, 'details', { class: 'opa-json-node opa-json-object', open: true }, [
      h(doc, 'summary', { text: `${keyLabel}: object(${entries.length})` }),
      h(doc, 'div', { class: 'opa-json-children' },
        entries.map(([key, item]) => renderJsonNode(doc, item, key))),
    ]);
  }
  return h(doc, 'div', { class: 'opa-json-leaf' }, [
    h(doc, 'span', { class: 'opa-json-key', text: `${keyLabel}: ` }),
    h(doc, 'span', { class: `opa-json-value opa-json-${typeofLabel(value)}`, text: formatLeaf(value) }),
  ]);
}

function resolveRows(ctx) {
  if (Array.isArray(ctx.rows)) {
    return ctx.rows;
  }
  if (Array.isArray(ctx.bodyJson)) {
    return ctx.bodyJson;
  }
  return null;
}

function inferColumns(rows) {
  const columns = [];
  const seen = new Set();
  for (const row of rows) {
    if (row && typeof row === 'object') {
      for (const key of Object.keys(row)) {
        if (!seen.has(key)) {
          seen.add(key);
          columns.push(key);
        }
      }
    }
  }
  return columns;
}

function formatCell(value) {
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatLeaf(value) {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  return String(value);
}

function typeofLabel(value) {
  if (value === null) {
    return 'null';
  }
  return typeof value;
}

function hasJson(ctx) {
  return ctx.bodyJson !== undefined && ctx.bodyJson !== null;
}

function isJsonContentType(contentType) {
  // NDJSON / JSON Lines contain the substring "json" but are line-delimited, so
  // they must fall through to the jsonLines renderer instead of being parsed as
  // a single JSON document here.
  return typeof contentType === 'string'
    && contentType.includes('json')
    && !isNdjsonContentType(contentType);
}

function tryParse(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
