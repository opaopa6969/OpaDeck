import { h } from './dom.js';
import { operationFqid } from '../runtime/request-builder.js';

// Builtin panel renderers. They turn app-model data into navigable, editable
// surfaces and advertise a stable [data-panel-id] target. Operation surfaces
// also advertise [data-op-id] so tours and help can target them.
//
// Each render(ctx) returns a DOM element; the host supplies the ctx fields noted
// per renderer below.

export function createBuiltinPanelRenderers() {
  return [
    {
      // ctx: { document, panel?, groups | app, selection?, onSelect? }
      id: 'groupNav',
      render: (ctx) => {
        const doc = ctx.document;
        const groups = resolveGroups(ctx);
        const activeOp = ctx.selection ? ctx.selection.operationId : null;
        const sections = groups.map((group) => h(doc, 'section', { class: 'opa-nav-group' }, [
          h(doc, 'h3', { class: 'opa-nav-group-label', text: group.label || group.id }),
          h(doc, 'ul', { class: 'opa-nav-list' }, (group.operations || []).map((operation) => {
            const fqid = operationFqid(withGroup(operation, group));
            return h(doc, 'li', {}, [
              h(doc, 'button', {
                type: 'button',
                class: `opa-nav-item${activeOp === operation.id || activeOp === fqid ? ' active' : ''}`,
                dataset: { opId: fqid },
                text: operation.title || operation.id,
                on: onSelect(ctx, operation, group),
              }),
            ]);
          })),
        ]));
        return panelShell(ctx, 'opa-group-nav', sections);
      },
    },
    {
      // ctx: { document, panel?, operations, group?, onSelect? }
      id: 'operationTiles',
      render: (ctx) => {
        const doc = ctx.document;
        const operations = ctx.operations || (ctx.group ? ctx.group.operations : []) || [];
        const tiles = operations.map((operation) => {
          const fqid = operationFqid(withGroup(operation, ctx.group));
          return h(doc, 'button', {
            type: 'button',
            class: 'opa-tile',
            dataset: { opId: fqid },
            on: onSelect(ctx, operation, ctx.group),
          }, [
            h(doc, 'h3', { class: 'opa-tile-title', text: operation.title || operation.id }),
            operation.summary ? h(doc, 'p', { class: 'opa-tile-summary', text: operation.summary }) : null,
          ]);
        });
        return panelShell(ctx, 'opa-operation-tiles', tiles);
      },
    },
    {
      // ctx: { document, panel?, operation, fieldRenderers?, fieldState?, optionsFor?,
      //        onFieldChange?, preview?, onSubmit? }
      id: 'operationDetail',
      render: (ctx) => {
        const doc = ctx.document;
        const operation = ctx.operation;
        if (!operation) {
          return panelShell(ctx, 'opa-operation-detail', [h(doc, 'p', { class: 'opa-empty', text: 'No operation selected.' })]);
        }
        const fqid = operationFqid(operation);
        const fieldState = ctx.fieldState || {};
        const fields = (operation.fields || []).map((field) => renderField(ctx, operation, field, fieldState));
        const body = [
          h(doc, 'header', { class: 'opa-detail-head' }, [
            h(doc, 'h2', { class: 'opa-detail-title', text: operation.title || operation.id }),
            operation.summary ? h(doc, 'p', { class: 'opa-detail-summary', text: operation.summary }) : null,
          ]),
          h(doc, 'div', { class: 'opa-field-stack' }, fields),
          ctx.preview ? renderPreview(doc, ctx.preview) : null,
          renderSubmitBar(ctx, operation),
        ];
        const panel = panelShell(ctx, 'opa-operation-detail', body);
        panel.dataset.opId = fqid;
        return panel;
      },
    },
    {
      // ctx: { document, panel?, records, resultRenderers?, limit?, onDismiss? }
      // Records accumulate newest-first so repeated runs stay on screen for
      // comparison. `limit` caps how many are shown (e.g. 1 for latest-only);
      // `onDismiss(id)` adds a per-result dismiss control.
      id: 'resultStack',
      render: (ctx) => {
        const doc = ctx.document;
        const all = ctx.records || [];
        const records = typeof ctx.limit === 'number' ? all.slice(0, Math.max(0, ctx.limit)) : all;
        if (records.length === 0) {
          return panelShell(ctx, 'opa-result-stack', [h(doc, 'p', { class: 'opa-empty', text: 'No results yet.' })]);
        }
        const items = records.map((record) => h(doc, 'article', { class: `opa-result opa-result-${record.status}` }, [
          h(doc, 'header', { class: 'opa-result-head' }, [
            h(doc, 'span', { class: `opa-badge opa-badge-${record.status}`, text: record.status }),
            h(doc, 'span', { class: 'opa-result-op', text: record.operationFqid || '' }),
            record.response ? h(doc, 'span', { class: 'opa-result-status', text: String(record.response.status) }) : null,
            typeof ctx.onDismiss === 'function'
              ? h(doc, 'button', {
                type: 'button',
                class: 'opa-result-dismiss',
                title: 'Dismiss',
                text: '×',
                on: { click: () => ctx.onDismiss(record.id) },
              })
              : null,
          ]),
          renderResultBody(ctx, record),
        ]));
        return panelShell(ctx, 'opa-result-stack', items);
      },
    },
  ];
}

function renderField(ctx, operation, field, fieldState) {
  const doc = ctx.document;
  const value = fieldState[field.id];
  const fieldCtx = {
    document: doc,
    field,
    value,
    operationId: operationFqid(operation),
    options: typeof ctx.optionsFor === 'function' ? ctx.optionsFor(field) : undefined,
    onChange: ctx.onFieldChange ? (next) => ctx.onFieldChange(field.id, next, field) : undefined,
  };
  const renderer = ctx.fieldRenderers && typeof ctx.fieldRenderers.match === 'function'
    ? ctx.fieldRenderers.match(field)
    : null;
  if (renderer) {
    return renderer.render(fieldCtx);
  }
  return h(doc, 'div', { class: 'opa-field opa-field-fallback', dataset: { fieldId: `${fieldCtx.operationId}::${field.id}` } }, [
    h(doc, 'label', { class: 'opa-field-label', text: field.label || field.name || field.id }),
    h(doc, 'input', { class: 'opa-input', value: value == null ? '' : String(value) }),
  ]);
}

function renderResultBody(ctx, record) {
  const doc = ctx.document;
  const response = record.response;
  if (!response) {
    const problem = (record.problems || [])[0];
    return h(doc, 'p', { class: 'opa-result-note', text: problem ? problem.message : 'No response.' });
  }
  const resultCtx = {
    document: doc,
    bodyJson: response.bodyJson,
    bodyText: response.bodyText,
    contentType: response.contentType,
    resultView: record.resultView,
  };
  const renderer = ctx.resultRenderers && typeof ctx.resultRenderers.match === 'function'
    ? ctx.resultRenderers.match(resultCtx)
    : null;
  if (renderer) {
    return renderer.render(resultCtx);
  }
  return h(doc, 'pre', { class: 'opa-result-raw', text: response.bodyText || '' });
}

function renderPreview(doc, preview) {
  return h(doc, 'div', { class: 'opa-request-preview' }, [
    h(doc, 'div', { class: 'opa-preview-line' }, [
      h(doc, 'span', { class: 'opa-preview-method', text: preview.method }),
      h(doc, 'span', { class: 'opa-preview-url', text: preview.url }),
    ]),
    preview.curl ? h(doc, 'pre', { class: 'opa-preview-curl', text: preview.curl }) : null,
  ]);
}

function renderSubmitBar(ctx, operation) {
  const doc = ctx.document;
  return h(doc, 'div', { class: 'opa-submit-bar' }, [
    h(doc, 'button', {
      type: 'button',
      class: 'opa-submit button primary',
      text: 'Run',
      on: typeof ctx.onSubmit === 'function' ? { click: () => ctx.onSubmit(operation) } : undefined,
    }),
  ]);
}

function panelShell(ctx, className, children) {
  const doc = ctx.document;
  const panelId = (ctx.panel && ctx.panel.id) || ctx.panelId;
  return h(doc, 'div', {
    class: `opa-panel ${className}`,
    dataset: panelId ? { panelId } : undefined,
  }, children);
}

function onSelect(ctx, operation, group) {
  if (typeof ctx.onSelect !== 'function') {
    return undefined;
  }
  return { click: () => ctx.onSelect(operationFqid(withGroup(operation, group)), operation, group) };
}

function resolveGroups(ctx) {
  if (Array.isArray(ctx.groups)) {
    return ctx.groups;
  }
  if (ctx.app && Array.isArray(ctx.app.groups)) {
    return ctx.app.groups;
  }
  return [];
}

function withGroup(operation, group) {
  if (operation.groupId || !group) {
    return operation;
  }
  return { ...operation, groupId: group.id };
}
