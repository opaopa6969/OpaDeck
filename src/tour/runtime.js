import { createTourCommandHandlerRegistry } from './command-handler-registry.js';
import { createDefaultTourCommandHandlers } from './handlers.js';

// The tour runtime sequences a TourSpec loaded from HelpModel.tours. It runs each
// step's commands through the handler registry, resolves the spotlight target,
// and emits tour.started / tour.stepChanged / tour.finished on the runtime bus.
// It is user-paced: entering a step runs its commands, then waits for the host
// (or the overlay) to call next()/prev()/finish().

export function createTourRuntime(options = {}) {
  const bus = options.bus || null;
  const handlers = options.handlers || createTourCommandHandlerRegistry().registerAll(createDefaultTourCommandHandlers());
  const overlay = options.overlay || null;
  const resolveElement = typeof options.resolveElement === 'function'
    ? options.resolveElement
    : defaultResolveElement(options.document);
  const baseContext = {
    bus,
    selection: options.selection || null,
    scheduler: options.scheduler || null,
    executions: options.executions || null,
    submitOperation: options.submitOperation,
    waitTimeoutMs: options.waitTimeoutMs,
  };

  return {
    handlers,

    load(tour, context = {}) {
      if (!tour || !Array.isArray(tour.steps)) {
        throw new TypeError('A tour must have a steps array.');
      }
      return createPlayer(tour, { ...baseContext, ...context });
    },

    play(tour, context = {}) {
      const player = this.load(tour, context);
      player.start();
      return player;
    },
  };

  function createPlayer(tour, context) {
    const steps = tour.steps;
    let index = -1;
    let started = false;
    let finished = false;

    const controls = {
      get index() {
        return index;
      },
      get total() {
        return steps.length;
      },
      get tour() {
        return tour;
      },
      start() {
        if (started) {
          return Promise.resolve();
        }
        started = true;
        publish('tour.started', { tour: tourInfo(tour) });
        if (overlay && typeof overlay.start === 'function') {
          overlay.start(tour, controls);
        }
        return enter(0);
      },
      next() {
        if (index >= steps.length - 1) {
          return controls.finish();
        }
        return enter(index + 1);
      },
      prev() {
        return enter(Math.max(0, index - 1));
      },
      goTo(target) {
        return enter(clamp(target, 0, steps.length - 1));
      },
      finish() {
        if (finished) {
          return Promise.resolve();
        }
        finished = true;
        if (overlay && typeof overlay.finish === 'function') {
          overlay.finish(tour, controls);
        }
        publish('tour.finished', { tour: tourInfo(tour) });
        return Promise.resolve();
      },
    };

    async function enter(target) {
      index = clamp(target, 0, steps.length - 1);
      const step = steps[index];
      let spotlight = null;
      for (const command of step.commands || []) {
        const result = await handlers.runCommand(command, context);
        if (!spotlight && result && result.selector) {
          spotlight = result;
        }
      }
      const selector = spotlight ? spotlight.selector : null;
      const element = selector ? resolveElement(selector) : null;
      publish('tour.stepChanged', {
        tour: tourInfo(tour),
        step: stepInfo(step, index),
        target: spotlight ? spotlight.target : null,
        selector,
      });
      if (overlay && typeof overlay.renderStep === 'function') {
        overlay.renderStep({ tour, step, index, total: steps.length, element, selector, controls });
      }
      return element;
    }

    return controls;
  }

  function publish(kind, payload) {
    if (bus && typeof bus.publish === 'function') {
      bus.publish({ kind, ...payload });
    }
  }
}

function tourInfo(tour) {
  return { id: tour.id, title: tour.title };
}

function stepInfo(step, index) {
  return { id: step.id, title: step.title, narration: step.narration, index };
}

function clamp(value, min, max) {
  const numeric = Number(value) || 0;
  if (numeric < min) return min;
  if (numeric > max) return max;
  return numeric;
}

function defaultResolveElement(documentRef) {
  const doc = documentRef || (typeof globalThis.document !== 'undefined' ? globalThis.document : null);
  if (!doc || typeof doc.querySelector !== 'function') {
    return () => null;
  }
  return (selector) => (selector ? doc.querySelector(selector) : null);
}
