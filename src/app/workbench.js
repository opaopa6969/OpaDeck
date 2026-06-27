import { h } from '../renderers/dom.js';
import { createSelectionStore } from '../runtime/selection-store.js';
import { createFieldRendererRegistry } from '../registry/field-renderer-registry.js';
import { registerBuiltinRenderers } from '../renderers/builtins.js';
import { createBuiltinPanelRenderers } from '../renderers/panel-renderers.js';
import { buildRequestPreview, operationFqid } from '../runtime/request-builder.js';

// createWorkbench wires an AppDefinition into a running three-surface ops shell
// (nav -> detail+form -> results) so callers stop hand-assembling the builtin
// panel renderers, the per-operation field state, the live request preview, and
// the execution subscription themselves.
//
// Required options:
//   document          - DOM document
//   app               - normalized AppDefinition ({ groups: [{ operations }] })
//   mounts            - { nav, detail, results } DOM elements to render into
//   executor          - an HTTP executor with execute(op, state, opts) (and the
//                       runtime ExecutionStore it writes to, passed as executions)
//   executions        - the ExecutionStore the executor publishes into
//
// Optional options:
//   selection         - SelectionStore (created if absent)
//   fieldRenderers    - field renderer registry (builtins if absent)
//   panelRenderers    - { groupNav, operationDetail } map (builtins if absent)
//   optionsFor        - (field) => options[] for select fields
//   baseUrl           - base URL for the live request preview
//   initFieldState    - (operation) => state object (field defaults if absent)
//   renderResult      - (record, { document }) => Element (default card if absent)
//   filterMatch       - (operation, queryLower) => boolean (title/summary if absent)
//   onSelect          - (fqid, operation, group) => void
//   onRun             - (record, operation) => void (after execute resolves)
export function createWorkbench(options) {
  const doc = required(options, 'document');
  const app = required(options, 'app');
  const mounts = required(options, 'mounts');
  const executor = required(options, 'executor');
  const executions = required(options, 'executions');

  const selection = options.selection || createSelectionStore({});
  const fieldRenderers = options.fieldRenderers || defaultFieldRenderers();
  const panels = options.panelRenderers || defaultPanelRenderers();
  const optionsFor = options.optionsFor;
  const baseUrl = options.baseUrl;
  const initFieldState = options.initFieldState || defaultInitFieldState;
  const renderResult = options.renderResult || defaultRenderResult;
  const filterMatch = options.filterMatch || defaultFilterMatch;

  const opIndex = new Map();
  for (const group of app.groups || []) {
    for (const operation of group.operations || []) {
      opIndex.set(operationFqid(operation), { operation, group });
    }
  }

  const fieldStates = new Map();
  let currentOperation = null;
  let previewElement = null;
  let filterText = '';

  function stateFor(operation) {
    const fqid = operationFqid(operation);
    if (!fieldStates.has(fqid)) {
      fieldStates.set(fqid, initFieldState(operation));
    }
    return fieldStates.get(fqid);
  }

  function renderNav() {
    const groups = filterGroups(app.groups || [], filterText, filterMatch);
    clear(mounts.nav);
    mounts.nav.appendChild(panels.groupNav.render({
      document: doc,
      panelId: 'nav',
      groups,
      selection: selection.get(),
      onSelect: (fqid) => selectOperation(fqid),
    }));
  }

  function selectOperation(fqid) {
    const entry = opIndex.get(fqid);
    if (!entry) {
      return;
    }
    currentOperation = entry.operation;
    selection.set({ groupId: entry.group.id, operationId: fqid, panelId: 'detail' });
    renderDetail();
    renderNav();
    if (typeof options.onSelect === 'function') {
      options.onSelect(fqid, entry.operation, entry.group);
    }
  }

  function renderDetail() {
    clear(mounts.detail);
    if (!currentOperation) {
      mounts.detail.appendChild(h(doc, 'p', { class: 'opa-empty', text: 'No operation selected.' }));
      previewElement = null;
      return;
    }
    const operation = currentOperation;
    const fieldState = stateFor(operation);

    const detail = panels.operationDetail.render({
      document: doc,
      panelId: 'detail',
      operation,
      fieldRenderers,
      fieldState,
      optionsFor,
      // The form is rendered once per selection; field edits update the live
      // preview only, so inputs never lose focus to a re-render (the reason the
      // preview is kept outside operationDetail's own ctx.preview).
      onFieldChange: (fieldId, value) => {
        fieldState[fieldId] = value;
        updatePreview();
      },
      onSubmit: (op) => runOperation(op),
    });
    mounts.detail.appendChild(detail);

    previewElement = h(doc, 'div', { class: 'opa-live-preview' });
    mounts.detail.appendChild(previewElement);
    updatePreview();
  }

  function updatePreview() {
    if (!previewElement || !currentOperation) {
      return;
    }
    clear(previewElement);
    let preview;
    try {
      preview = buildRequestPreview(currentOperation, stateFor(currentOperation), { baseUrl });
    } catch (error) {
      previewElement.appendChild(h(doc, 'pre', { text: String(error) }));
      return;
    }
    previewElement.appendChild(h(doc, 'div', { class: 'opa-preview-line' }, [
      h(doc, 'span', { class: 'opa-preview-method', text: preview.method }),
      h(doc, 'span', { class: 'opa-preview-url', text: preview.url }),
    ]));
    if (preview.bodyText) {
      previewElement.appendChild(h(doc, 'details', { class: 'opa-preview-body' }, [
        h(doc, 'summary', { text: 'body' }),
        h(doc, 'pre', { text: preview.bodyText }),
      ]));
    }
    previewElement.appendChild(h(doc, 'details', { class: 'opa-preview-curl' }, [
      h(doc, 'summary', { text: 'curl' }),
      h(doc, 'pre', { text: preview.curl }),
    ]));
  }

  async function runOperation(operation) {
    const record = await executor.execute(operation, stateFor(operation), {
      timeoutMs: operation.request && operation.request.timeoutMs,
    });
    if (typeof options.onRun === 'function') {
      options.onRun(record, operation);
    }
    return record;
  }

  function renderResults() {
    const current = executions.current();
    const history = executions.history();
    const records = current ? [current, ...history] : history;
    clear(mounts.results);
    if (records.length === 0) {
      mounts.results.appendChild(h(doc, 'p', { class: 'opa-empty', text: 'No results yet.' }));
      return;
    }
    for (const record of records) {
      mounts.results.appendChild(renderResult(record, { document: doc }));
    }
  }

  function setFilter(text) {
    filterText = String(text || '');
    renderNav();
  }

  const unsubscribe = executions.subscribe(() => renderResults());

  renderNav();
  renderResults();

  return {
    selectOperation,
    setFilter,
    fieldStateFor: (fqid) => {
      const entry = opIndex.get(fqid);
      return entry ? stateFor(entry.operation) : null;
    },
    renderResults,
    operations: () => [...opIndex.keys()],
    destroy: () => { if (typeof unsubscribe === 'function') unsubscribe(); },
  };

  function defaultRenderResult(record) {
    const status = record.response ? record.response.status : '';
    const card = h(doc, 'article', { class: `opa-result-card opa-result-${record.status}` }, [
      h(doc, 'header', { class: 'opa-result-head' }, [
        h(doc, 'span', { class: `opa-badge opa-badge-${record.status}`, text: record.status }),
        h(doc, 'span', { class: 'opa-result-op', text: record.operationFqid }),
        status !== '' ? h(doc, 'span', { class: 'opa-result-status', text: `HTTP ${status}` }) : null,
      ]),
    ]);
    if (record.response) {
      card.appendChild(h(doc, 'pre', { class: 'opa-result-body opa-text', text: record.response.bodyText || '' }));
    } else {
      const problem = (record.problems || [])[0];
      card.appendChild(h(doc, 'p', { class: 'opa-result-note', text: problem ? problem.message : '' }));
    }
    return card;
  }
}

function defaultInitFieldState(operation) {
  const state = {};
  for (const field of operation.fields || []) {
    if (field.defaultValue !== undefined) {
      state[field.id] = field.defaultValue;
    }
  }
  return state;
}

function defaultFilterMatch(operation, queryLower) {
  return (operation.title || '').toLowerCase().includes(queryLower)
    || (operation.summary || '').toLowerCase().includes(queryLower);
}

function filterGroups(groups, filterText, filterMatch) {
  const query = filterText.trim().toLowerCase();
  if (!query) {
    return groups;
  }
  return groups
    .map((group) => ({ ...group, operations: (group.operations || []).filter((op) => filterMatch(op, query)) }))
    .filter((group) => group.operations.length > 0);
}

function defaultFieldRenderers() {
  const registry = createFieldRendererRegistry();
  registerBuiltinRenderers({ fieldRenderers: registry });
  return registry;
}

function defaultPanelRenderers() {
  const map = {};
  for (const renderer of createBuiltinPanelRenderers()) {
    map[renderer.id] = renderer;
  }
  return map;
}

function clear(element) {
  while (element && element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function required(options, key) {
  if (!options || options[key] == null) {
    throw new TypeError(`createWorkbench requires options.${key}.`);
  }
  return options[key];
}
