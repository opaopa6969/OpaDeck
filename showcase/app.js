import {
  createDataSourceAdapterRegistry,
  createExecutionStore,
  createFieldRendererRegistry,
  createPanelRendererRegistry,
  createResultRendererRegistry,
  createRuntimeBus,
  createRuntimeServices,
  createScheduler,
  createSelectionStore,
  createSystemClock,
  validateAppDefinition,
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

const fieldRenderers = createFieldRendererRegistry();
fieldRenderers.register({
  id: 'text',
  supports(field) {
    return field.type === 'text';
  },
  render() {
    return null;
  },
});
fieldRenderers.register({
  id: 'select',
  supports(field) {
    return field.type === 'select';
  },
  render() {
    return null;
  },
});

const resultRenderers = createResultRendererRegistry();
resultRenderers.register({
  id: 'jsonFoldable',
  canRender(ctx) {
    return ctx.contentType === 'application/json';
  },
  render() {
    return null;
  },
});
resultRenderers.register({
  id: 'geoScene',
  canRender(ctx) {
    return ctx.resultView && ctx.resultView.renderer === 'geoScene';
  },
  render() {
    return null;
  },
});

const panelRenderers = createPanelRendererRegistry();
panelRenderers.register({ id: 'operationTiles', render() { return null; } });
panelRenderers.register({ id: 'operationDetail', render() { return null; } });

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

const featureGrid = document.getElementById('feature-grid');
const featureDetail = document.getElementById('feature-detail');
const selectionState = document.getElementById('selection-state');
const executionState = document.getElementById('execution-state');
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
}

function renderSelectionState() {
  selectionState.textContent = JSON.stringify(selection.get(), null, 2);
}

function renderExecutionState() {
  executionState.textContent = JSON.stringify({
    current: executions.current(),
    history: executions.history(),
  }, null, 2);
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
      return 'Guided tour started.';
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
  const problems = validateAppDefinition(SAMPLE_APP);
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

const TOUR_STEPS = [
  {
    target: '[data-tour="masthead"]',
    title: 'The Showcase',
    body: 'This masthead explains the purpose of OpaDeck and exposes the main demo actions.',
  },
  {
    target: '[data-tour="feature-list"]',
    title: 'Feature Cards',
    body: 'Cards are discovery and launcher surfaces. They are useful, but they are not the semantic core.',
    onEnter() {
      selectFeature('operation-centric');
    },
  },
  {
    target: '[data-feature-id="runtime-services"]',
    title: 'Runtime Services',
    body: 'Selection, execution, timing, and eventing stay explicit in the runtime instead of hiding in page code.',
    onEnter() {
      selectFeature('runtime-services');
    },
  },
  {
    target: '[data-tour="runtime-panel"]',
    title: 'Runtime Inspector',
    body: 'This panel shows the current selection, execution history, and event stream. It is the visible proof that the runtime stays small but real.',
  },
  {
    target: '[data-tour="validation-panel"]',
    title: 'Validation',
    body: 'The core validator runs against a sample app definition so the demo can show that structure is checked explicitly.',
    onEnter() {
      runValidation();
    },
  },
];

function startTour() {
  createTourPlayer(TOUR_STEPS, runtime).start();
}

function createTourPlayer(steps, runtimeServices) {
  const root = document.getElementById('tour-root');
  let index = 0;

  return {
    start() {
      runtimeServices.bus.publish({ kind: 'tour.started' });
      root.hidden = false;
      renderStep();
    },
  };

  function renderStep() {
    const step = steps[index];
    step.onEnter && step.onEnter();
    runtimeServices.bus.publish({ kind: 'tour.stepChanged', step: { title: step.title, index } });

    const target = document.querySelector(step.target);
    if (!target) {
      finish();
      return;
    }
    const rect = target.getBoundingClientRect();
    const padding = 10;
    const cardTop = Math.min(window.innerHeight - 220, rect.bottom + 18);
    const cardLeft = Math.min(window.innerWidth - 390, Math.max(18, rect.left));

    root.innerHTML = `
      <div class="tour-scrim"></div>
      <div class="tour-spotlight"
        style="top:${rect.top - padding}px;left:${rect.left - padding}px;width:${rect.width + padding * 2}px;height:${rect.height + padding * 2}px"></div>
      <div class="tour-card" style="top:${cardTop}px;left:${cardLeft}px">
        <p class="tour-meta">Step ${index + 1} / ${steps.length}</p>
        <h3>${step.title}</h3>
        <p>${step.body}</p>
        <div class="tour-actions">
          <button class="button ghost" data-tour-action="close">Close</button>
          <div>
            ${index > 0 ? '<button class="button ghost" data-tour-action="prev">Back</button>' : ''}
            <button class="button primary" data-tour-action="next">${index === steps.length - 1 ? 'Finish' : 'Next'}</button>
          </div>
        </div>
      </div>
    `;

    const close = root.querySelector('[data-tour-action="close"]');
    const next = root.querySelector('[data-tour-action="next"]');
    const prev = root.querySelector('[data-tour-action="prev"]');
    close.addEventListener('click', finish);
    next.addEventListener('click', () => {
      if (index === steps.length - 1) {
        finish();
        return;
      }
      index++;
      renderStep();
    });
    if (prev) {
      prev.addEventListener('click', () => {
        index = Math.max(0, index - 1);
        renderStep();
      });
    }
  }

  function finish() {
    root.hidden = true;
    root.innerHTML = '';
    runtimeServices.bus.publish({ kind: 'tour.finished' });
  }
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[char]));
}
