import {
  createDataSourceAdapterRegistry,
  createDefaultTourCommandHandlers,
  createDefaultTourOverlay,
  createExecutionStore,
  createFieldRendererRegistry,
  createPanelRendererRegistry,
  createResultRendererRegistry,
  createRuntimeBus,
  createRuntimeServices,
  createScheduler,
  createSelectionStore,
  createSystemClock,
  createTourCommandHandlerRegistry,
  createTourRuntime,
  registerBuiltinRenderers,
  renderGeoScene,
  validateApp,
} from '../src/index.js';

const FEATURES = [
  {
    id: 'operation-centric',
    title: 'Operation-Centric Core',
    summary: 'Operations are the primary unit. Pages are not.',
    body: 'OpaDeck treats an operation as the semantic center. Layouts, cards, help, data sources, and results all orbit that unit instead of becoming page-specific code.',
    bullets: [
      'Stable operation ids are the backbone of routing, help, and feature flags.',
      'Fields and requests stay close to the operation instead of leaking into pages.',
      'Layouts are presentation trees, not semantic truth.',
    ],
    sample: `{\n  id: "index.rebuild",\n  request: { method: "POST", url: "/api/index/rebuild" },\n  fields: [ ... ],\n  result: { renderer: "jsonFoldable" }\n}`,
  },
  {
    id: 'typed-registries',
    title: 'Typed Registries',
    summary: 'Open edges, closed core.',
    body: 'Field widgets, result renderers, panel renderers, and data-source adapters are allowed to vary. The semantic model is not.',
    bullets: [
      'Registries keep extension points explicit.',
      'The runtime shell supplies services; plugins do not invent their own worlds.',
      'The same pattern can scale from builtins to app-local adapters.',
    ],
    sample: `registerFieldRenderer(renderer)\nregisterResultRenderer(renderer)\nregisterPanelRenderer(renderer)\nregisterDataSourceAdapter(adapter)`,
  },
  {
    id: 'runtime-services',
    title: 'Small Runtime Services',
    summary: 'A bus, clock, scheduler, selection store, and execution store are enough.',
    body: 'The runtime layer is intentionally narrow. It coordinates selection, execution, timing, and eventing without turning into a workflow engine or message platform.',
    bullets: [
      'The event bus is local and typed.',
      'The clock and scheduler exist mainly to improve testability and tours.',
      'Execution and selection are explicit stores instead of scattered mutable state.',
    ],
    sample: `const runtime = createRuntimeServices({\n  bus,\n  clock,\n  scheduler,\n  selection,\n  executions,\n})`,
  },
  {
    id: 'geo-scene',
    title: 'Geo Scene',
    summary: 'Maps are a first-class surface, not a one-off custom result.',
    body: 'Japan map use-cases come up constantly in internal tools. OpaDeck treats geo scenes as structured render targets with layers like choropleth, points, and lines.',
    bullets: [
      'Use as a panel renderer or result renderer.',
      'Keep the renderer generic; ship a Japan preset.',
      'Selection and tours should be able to target map panels too.',
    ],
    sample: `result: {\n  renderer: "geoScene",\n  options: {\n    baseMap: "japan",\n    layers: [{ kind: "choropleth", source: "prefStats", keyField: "pref", valueField: "count" }]\n  }\n}`,
  },
  {
    id: 'help-tour',
    title: 'Help and Tour',
    summary: 'Help is part of the framework, not an app afterthought.',
    body: 'Inline help and guided tours use stable ids and runtime events. This showcase itself uses a lightweight tour controller driven by the runtime bus and scheduler.',
    bullets: [
      'Tour steps target concrete surfaces with stable selectors.',
      'Help content can stay app-specific while presentation stays shared.',
      'A tour runner should coordinate, not own semantics.',
    ],
    sample: `tour "overview" {\n  step "Runtime" {\n    focus panel "runtime-panel"\n    say "The runtime state is visible here."\n  }\n}`,
  },
];

const SAMPLE_APP = {
  id: 'showcase-app',
  version: 1,
  title: 'Showcase App',
  groups: [
    {
      id: 'framework',
      label: 'Framework',
      operations: [
        {
          id: 'describeGeoScene',
          title: 'Describe Geo Scene',
          request: {
            method: 'POST',
            url: '/api/framework/geoScene',
            body: { kind: 'rawField', fieldId: 'payload' },
          },
          fields: [
            { id: 'payload', name: 'payload', type: 'textarea', placement: 'body' },
            { id: 'region', name: 'region', type: 'select', placement: 'query', source: { dataSourceId: 'regions' } },
          ],
          result: {
            renderer: 'geoScene',
            options: {
              baseMap: 'japan',
              layers: [
                { kind: 'choropleth', source: 'prefStats', keyField: 'prefCode', valueField: 'count' },
              ],
            },
          },
        },
      ],
    },
  ],
  dataSources: [
    { id: 'regions', kind: 'options.static', staticOptions: [{ value: 'kanto', label: 'Kanto' }] },
  ],
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
            id: 'featureCards',
            renderer: 'operationTiles',
            binding: { kind: 'group', groupId: 'framework' },
          },
          {
            kind: 'panel',
            id: 'detailPanel',
            renderer: 'operationDetail',
            binding: { kind: 'selection' },
          },
        ],
      },
    },
  ],
  defaultLayoutId: 'default',
  help: {
    entries: [
      {
        id: 'geo-help',
        target: { kind: 'operation', operationId: 'framework.describeGeoScene' },
        kind: 'panel',
        body: 'Geo scenes can be rendered in result or panel surfaces.',
      },
    ],
    tours: [
      {
        id: 'overview',
        title: 'Overview',
        steps: [
          {
            id: 'step-1',
            commands: [{ kind: 'focusPanel', panelId: 'featureCards' }],
          },
        ],
      },
    ],
  },
};

const bus = createRuntimeBus();
const clock = createSystemClock();
const scheduler = createScheduler({ clock });
const selection = createSelectionStore({ bus });
const executions = createExecutionStore({ bus, clock, historyLimit: 8 });
const runtime = createRuntimeServices({ bus, clock, scheduler, selection, executions });

// Use the shared builtin browser renderer set instead of hand-written stubs.
const fieldRenderers = createFieldRendererRegistry();
const resultRenderers = createResultRendererRegistry();
const panelRenderers = createPanelRendererRegistry();
registerBuiltinRenderers({ fieldRenderers, resultRenderers, panelRenderers });

const dataSourceAdapters = createDataSourceAdapterRegistry();
dataSourceAdapters.register({
  id: 'options.static',
  async resolve(ctx) {
    return { kind: 'options', items: ctx.dataSource.staticOptions || [] };
  },
});

const registrySummary = {
  fieldRenderers: fieldRenderers.list().map((item) => item.id),
  resultRenderers: resultRenderers.list().map((item) => item.id),
  panelRenderers: panelRenderers.list().map((item) => item.id),
  dataSourceAdapters: dataSourceAdapters.list().map((item) => item.id),
};

// Tour: registry-driven handlers. The builtin focus/submit/wait handlers come
// from the framework; the showcase adds two local handlers to demonstrate the
// open edge (its UI side effects are not framework semantics).
const tourHandlers = createTourCommandHandlerRegistry().registerAll(createDefaultTourCommandHandlers());
tourHandlers.register({
  id: 'showcase.selectFeature',
  run(command) {
    selectFeature(command.featureId);
  },
});
tourHandlers.register({
  id: 'showcase.runValidation',
  run() {
    runValidation();
  },
});

const tourRuntime = createTourRuntime({
  bus,
  selection,
  scheduler,
  executions,
  handlers: tourHandlers,
  overlay: createDefaultTourOverlay({ document, root: document.getElementById('tour-root') }),
});

const SHOWCASE_TOUR = {
  id: 'overview',
  title: 'Overview',
  steps: [
    {
      id: 'masthead',
      title: 'The Showcase',
      narration: 'This masthead explains the purpose of OpaDeck and exposes the main demo actions.',
      commands: [{ kind: 'focusPanel', panelId: 'masthead' }],
    },
    {
      id: 'features',
      title: 'Feature Cards',
      narration: 'Cards are discovery and launcher surfaces. They are useful, but they are not the semantic core.',
      commands: [
        { kind: 'showcase.selectFeature', featureId: 'operation-centric' },
        { kind: 'focusPanel', panelId: 'featureCards' },
      ],
    },
    {
      id: 'runtime',
      title: 'Runtime Services',
      narration: 'Selection, execution, timing, and eventing stay explicit in the runtime instead of hiding in page code.',
      commands: [
        { kind: 'showcase.selectFeature', featureId: 'runtime-services' },
        { kind: 'focusPanel', panelId: 'runtimeInspector' },
      ],
    },
    {
      id: 'validation',
      title: 'Validation',
      narration: 'The core validator runs against a sample app definition so the demo can show that structure is checked explicitly.',
      commands: [
        { kind: 'showcase.runValidation' },
        { kind: 'focusPanel', panelId: 'validation' },
      ],
    },
  ],
};

const featureGrid = document.getElementById('feature-grid');
const featureDetail = document.getElementById('feature-detail');
const selectionState = document.getElementById('selection-state');
const executionState = document.getElementById('execution-state');
const executionResult = document.getElementById('execution-result');
const eventLog = document.getElementById('event-log');
const validationSummary = document.getElementById('validation-summary');
const validationProblems = document.getElementById('validation-problems');

renderFeatureCards();
selectFeature(FEATURES[0].id);
renderSelectionState();
renderExecutionState();
appendEvent('showcase.ready', 'Showcase booted and runtime services initialized.');

selection.subscribe(() => {
  renderSelectionState();
});
executions.subscribe(() => {
  renderExecutionState();
});

for (const kind of ['selection.changed', 'execution.started', 'execution.success', 'tour.started', 'tour.stepChanged', 'tour.finished']) {
  bus.subscribe(kind, (event) => {
    appendEvent(kind, summarizeEvent(event));
  });
}

document.getElementById('start-tour').addEventListener('click', () => {
  startTour();
});
document.getElementById('simulate-run').addEventListener('click', () => {
  simulateExecution();
});
document.getElementById('validate-app').addEventListener('click', () => {
  runValidation();
});

function renderFeatureCards() {
  featureGrid.innerHTML = '';
  for (const feature of FEATURES) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'feature-card';
    card.dataset.featureId = feature.id;
    card.innerHTML = `<h3>${feature.title}</h3><p>${feature.summary}</p>`;
    card.addEventListener('click', () => {
      selectFeature(feature.id);
    });
    featureGrid.appendChild(card);
  }
}

function selectFeature(featureId) {
  const feature = FEATURES.find((item) => item.id === featureId);
  if (!feature) {
    return;
  }
  selection.set({
    groupId: 'showcase',
    operationId: feature.id,
    fieldId: null,
    resultId: null,
    panelId: 'feature-detail',
  });
  for (const card of featureGrid.querySelectorAll('.feature-card')) {
    card.classList.toggle('active', card.dataset.featureId === feature.id);
  }
  renderFeatureDetail(feature);
}

function renderFeatureDetail(feature) {
  const extra = feature.id === 'typed-registries'
    ? `<ul class="feature-sample">${Object.entries(registrySummary)
        .map(([key, values]) => `<li><strong>${key}</strong>: ${values.join(', ')}</li>`)
        .join('')}</ul>`
    : '';
  featureDetail.innerHTML = `
    <p class="feature-kicker">showcase.${feature.id}</p>
    <h3>${feature.title}</h3>
    <p>${feature.body}</p>
    <ul class="feature-bullets">
      ${feature.bullets.map((bullet) => `<li>${bullet}</li>`).join('')}
    </ul>
    <pre class="feature-code">${escapeHtml(feature.sample)}</pre>
    ${extra}
  `;
  if (feature.id === 'geo-scene') {
    renderGeoSceneDemo();
  }
  if (feature.id === 'operation-centric') {
    renderJsonEditorDemo();
  }
}

function renderJsonEditorDemo() {
  const renderer = fieldRenderers.match({ type: 'json' });
  if (!renderer) {
    return;
  }
  const host = document.createElement('div');
  host.className = 'json-editor-host';
  host.appendChild(renderer.render({
    document,
    operationId: 'index.rebuild',
    field: { id: 'payload', type: 'json', label: 'Operation body (shared JsonEditor)' },
    value: '{\n  "operationId": "index.rebuild",\n  "ok": true\n}',
  }));
  featureDetail.appendChild(host);
}

const GEO_SCENE = {
  baseMap: 'japan',
  layers: [
    { kind: 'choropleth', source: 'prefStats', keyField: 'pref', valueField: 'count' },
    { kind: 'points', source: 'offices', labelField: 'label' },
    { kind: 'lines', source: 'routes', fromField: 'from', toField: 'to' },
  ],
};

const GEO_DATA = {
  prefStats: [
    { pref: 1, name: 'Hokkaido', count: 18 },
    { pref: 13, name: 'Tokyo', count: 92 },
    { pref: 23, name: 'Aichi', count: 47 },
    { pref: 27, name: 'Osaka', count: 71 },
    { pref: 40, name: 'Fukuoka', count: 33 },
    { pref: 47, name: 'Okinawa', count: 9 },
  ],
  offices: [
    { lat: 35.68, lng: 139.69, label: 'Tokyo' },
    { lat: 34.69, lng: 135.5, label: 'Osaka' },
  ],
  routes: [
    { from: 13, to: 27 },
    { from: 13, to: 1 },
  ],
};

function renderGeoSceneDemo() {
  const host = document.createElement('div');
  host.className = 'geo-scene-host';
  const svg = renderGeoScene({
    document,
    scene: GEO_SCENE,
    data: GEO_DATA,
    onSelect: (code, region) => appendEvent('geoScene.select', `Selected prefecture ${code} (${region.name}).`),
  });
  host.appendChild(svg);
  featureDetail.appendChild(host);
}

function renderSelectionState() {
  selectionState.textContent = JSON.stringify(selection.get(), null, 2);
}

function renderExecutionState() {
  executionState.textContent = JSON.stringify({
    current: executions.current(),
    history: executions.history(),
  }, null, 2);
  renderLatestResult();
}

function renderLatestResult() {
  const latest = executions.current() || executions.history()[0];
  executionResult.innerHTML = '';
  if (!latest || !latest.response) {
    executionResult.innerHTML = '<p class="muted">No result yet. Use "Simulate Execution".</p>';
    return;
  }
  const ctx = {
    document,
    bodyJson: latest.response.bodyJson,
    bodyText: latest.response.bodyText,
    contentType: latest.response.contentType,
  };
  // Render the real response through the shared builtin result renderer set,
  // not a hand-written JSON dump.
  const renderer = resultRenderers.match(ctx);
  if (renderer) {
    executionResult.appendChild(renderer.render(ctx));
  } else {
    executionResult.textContent = latest.response.bodyText || '';
  }
}

function appendEvent(kind, message) {
  const item = document.createElement('div');
  item.className = 'event-item';
  item.innerHTML = `<strong>${kind}</strong><span>${escapeHtml(message)}</span>`;
  eventLog.prepend(item);
  while (eventLog.children.length > 14) {
    eventLog.removeChild(eventLog.lastChild);
  }
}

function summarizeEvent(event) {
  switch (event.kind) {
    case 'selection.changed':
      return `Selected ${event.selection.operationId || 'nothing'}.`;
    case 'execution.started':
      return `Execution started for ${event.record.operationFqid}.`;
    case 'execution.success':
      return `Execution completed for ${event.record.operationFqid}.`;
    case 'tour.started':
      return `Guided tour "${event.tour ? event.tour.title : ''}" started.`;
    case 'tour.stepChanged':
      return `Tour moved to "${event.step.title}".`;
    case 'tour.finished':
      return 'Guided tour finished.';
    default:
      return 'Runtime event.';
  }
}

function simulateExecution() {
  const current = selection.get().operationId || FEATURES[0].id;
  executions.begin({
    operationFqid: `showcase.${current}`,
    requestPreview: {
      method: 'POST',
      url: `/api/showcase/${current}`,
      headers: { 'x-opadeck-demo': '1' },
      bodyText: JSON.stringify({ explain: current }, null, 2),
    },
  });
  scheduler.after(640, () => {
    executions.succeed({
      status: 200,
      statusText: 'OK',
      contentType: 'application/json',
      bodyText: JSON.stringify({ ok: true, feature: current }, null, 2),
      bodyJson: { ok: true, feature: current },
    });
  });
}

function runValidation() {
  const problems = validateApp(SAMPLE_APP);
  validationProblems.innerHTML = '';
  if (problems.length === 0) {
    validationSummary.textContent = 'Sample app is valid.';
    validationSummary.className = 'validation-summary';
    return;
  }
  validationSummary.textContent = `${problems.length} problem(s) found in the sample app.`;
  validationSummary.className = 'validation-summary';
  for (const problem of problems) {
    const row = document.createElement('div');
    row.className = `problem ${problem.severity}`;
    row.innerHTML = `<code>${escapeHtml(problem.code)}</code><div>${escapeHtml(problem.message)}</div>`;
    validationProblems.appendChild(row);
  }
}

function startTour() {
  // The showcase no longer owns a bespoke tour player: it loads a TourSpec into
  // the shared runtime, which sequences commands through the handler registry
  // and drives the default overlay.
  tourRuntime.play(SHOWCASE_TOUR);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[char]));
}
