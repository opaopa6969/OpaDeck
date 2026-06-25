import { createProblem } from '../core/problem.js';

export function createRequestPreviewModel(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('Request preview input must be an object.');
  }
  return {
    method: String(input.method || 'GET').toUpperCase(),
    url: String(input.url || ''),
    headers: { ...(input.headers || {}) },
    bodyText: input.bodyText == null ? undefined : String(input.bodyText),
    curl: input.curl == null ? undefined : String(input.curl),
  };
}

export function createResponseSnapshot(input, clock) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('Response snapshot input must be an object.');
  }
  return {
    status: Number(input.status) || 0,
    statusText: String(input.statusText || ''),
    contentType: input.contentType == null ? null : String(input.contentType),
    bodyText: String(input.bodyText || ''),
    bodyJson: input.bodyJson,
    receivedAt: typeof input.receivedAt === 'number' ? input.receivedAt : clock.now(),
    durationMs: Math.max(0, Number(input.durationMs) || 0),
  };
}

export function createExecutionStore(options = {}) {
  const listeners = new Set();
  const bus = options.bus || null;
  const clock = options.clock;
  if (!clock || typeof clock.now !== 'function') {
    throw new TypeError('Execution store requires a clock with now().');
  }
  const historyLimit = Math.max(1, Number(options.historyLimit) || 50);
  let currentRecord = null;
  let history = [];
  let sequence = 0;

  return {
    current() {
      return cloneRecord(currentRecord);
    },

    history() {
      return history.map(cloneRecord);
    },

    begin(input) {
      const startedAt = clock.now();
      const record = {
        id: `exec_${++sequence}`,
        operationFqid: String(input.operationFqid || ''),
        startedAt,
        finishedAt: undefined,
        status: 'running',
        requestPreview: createRequestPreviewModel(input.requestPreview || {}),
        response: undefined,
        problems: normalizeProblems(input.problems),
      };
      currentRecord = record;
      emit('execution.started', { record: cloneRecord(record) });
      return cloneRecord(record);
    },

    succeed(response, options2 = {}) {
      return finalize('success', response, options2.problems);
    },

    fail(response, options2 = {}) {
      return finalize('error', response, options2.problems);
    },

    cancel(problems) {
      return finalize('cancelled', null, problems);
    },

    timeout(problems) {
      return finalize('timeout', null, problems);
    },

    remove(id) {
      const next = history.filter((record) => record.id !== id);
      if (next.length === history.length) {
        return false;
      }
      history = next;
      emit('execution.removed', { id });
      return true;
    },

    clearHistory() {
      history = [];
      emit('execution.historyCleared', { history: [] });
    },

    subscribe(listener) {
      if (typeof listener !== 'function') {
        throw new TypeError('Execution listener must be a function.');
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  function finalize(status, response, problems) {
    if (!currentRecord) {
      return null;
    }
    const finishedAt = clock.now();
    const snapshot = response ? createResponseSnapshot({
      ...response,
      durationMs: response.durationMs != null ? response.durationMs : finishedAt - currentRecord.startedAt,
      receivedAt: response.receivedAt != null ? response.receivedAt : finishedAt,
    }, clock) : undefined;
    const finalized = {
      ...currentRecord,
      finishedAt,
      status,
      response: snapshot,
      problems: currentRecord.problems.concat(normalizeProblems(problems)),
    };
    currentRecord = null;
    history = [finalized, ...history].slice(0, historyLimit);
    emit(`execution.${status}`, { record: cloneRecord(finalized) });
    return cloneRecord(finalized);
  }

  function emit(kind, event) {
    for (const listener of [...listeners]) {
      listener({
        current: cloneRecord(currentRecord),
        history: history.map(cloneRecord),
      }, { kind, ...event });
    }
    if (bus && typeof bus.publish === 'function') {
      bus.publish({ kind, ...event });
    }
  }
}

function normalizeProblems(problems) {
  if (!problems) {
    return [];
  }
  if (!Array.isArray(problems)) {
    return [normalizeProblem(problems)];
  }
  return problems.map(normalizeProblem);
}

function normalizeProblem(problem) {
  if (problem && typeof problem.code === 'string') {
    return { ...problem };
  }
  if (typeof problem === 'string') {
    return createProblem('execution.message', 'info', problem);
  }
  return createProblem('execution.unknown', 'warning', 'Unknown execution problem.');
}

function cloneRecord(record) {
  if (!record) {
    return null;
  }
  return {
    ...record,
    requestPreview: {
      ...record.requestPreview,
      headers: { ...(record.requestPreview && record.requestPreview.headers ? record.requestPreview.headers : {}) },
    },
    response: record.response ? { ...record.response } : undefined,
    problems: Array.isArray(record.problems) ? record.problems.map((problem) => ({ ...problem })) : [],
  };
}
