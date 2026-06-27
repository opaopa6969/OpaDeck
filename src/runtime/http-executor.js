import { createProblem } from '../core/problem.js';
import { buildRequestPreview, operationFqid } from './request-builder.js';

// Bridges an operation definition to a real HTTP request and routes the
// lifecycle into an ExecutionStore. The store is what publishes the
// execution.* events on the runtime bus, so the executor only decides which
// terminal state (success / error / timeout / cancelled) was reached.

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

export function createHttpExecutor(options = {}) {
  const executions = options.executions;
  if (!executions || typeof executions.begin !== 'function') {
    throw new TypeError('createHttpExecutor requires an execution store.');
  }
  const clock = options.clock;
  if (!clock || typeof clock.now !== 'function' || typeof clock.schedule !== 'function') {
    throw new TypeError('createHttpExecutor requires a clock with now() and schedule().');
  }
  const fetchImpl = options.fetch || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('createHttpExecutor requires a fetch implementation.');
  }
  const defaultBaseUrl = options.baseUrl;
  const defaultTimeoutMs = Number(options.defaultTimeoutMs) || 0;
  const AbortControllerImpl = options.AbortController
    || (typeof globalThis.AbortController === 'function' ? globalThis.AbortController : null);
  // Optional live hook for line-delimited (NDJSON/JSON Lines) responses. The
  // ExecutionStore still only sees begin -> succeed; onProgress is an out-of-band
  // callback invoked on newline boundaries while the body streams, so a host can
  // render partial results without the store needing a "partial" state.
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

  return {
    preview(operation, fieldState, callOptions = {}) {
      return buildRequestPreview(operation, fieldState, {
        baseUrl: callOptions.baseUrl !== undefined ? callOptions.baseUrl : defaultBaseUrl,
      });
    },

    execute(operation, fieldState = {}, callOptions = {}) {
      const preview = buildRequestPreview(operation, fieldState, {
        baseUrl: callOptions.baseUrl !== undefined ? callOptions.baseUrl : defaultBaseUrl,
      });
      executions.begin({
        operationFqid: operationFqid(operation),
        requestPreview: preview,
      });
      return runRequest(preview, operation, callOptions);
    },
  };

  async function runRequest(preview, operation, callOptions) {
    const controller = AbortControllerImpl ? new AbortControllerImpl() : null;
    const state = { timedOut: false, cancelled: false };

    const detachSignal = wireExternalCancel(controller, state, callOptions.signal);
    const timeoutMs = resolveTimeout(operation, callOptions, defaultTimeoutMs);
    const cancelTimer = timeoutMs > 0 && controller
      ? clock.schedule(() => {
          state.timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;

    const startedAt = clock.now();
    try {
      const response = await fetchImpl(preview.url, {
        method: preview.method,
        headers: { ...preview.headers },
        body: BODYLESS_METHODS.has(preview.method) ? undefined : preview.bodyText,
        signal: controller ? controller.signal : undefined,
      });
      cleanup(cancelTimer, detachSignal);
      const snapshot = await readResponse(response, startedAt, operation);
      if (response.ok) {
        return executions.succeed(snapshot);
      }
      return executions.fail(snapshot, {
        problems: createProblem(
          'execution.http.status',
          'error',
          `Request failed with HTTP ${snapshot.status} ${snapshot.statusText}.`.trim()
        ),
      });
    } catch (error) {
      cleanup(cancelTimer, detachSignal);
      if (state.timedOut) {
        return executions.timeout(createProblem(
          'execution.timeout',
          'error',
          `Request timed out after ${timeoutMs}ms.`
        ));
      }
      if (state.cancelled) {
        return executions.cancel(createProblem(
          'execution.cancelled',
          'info',
          'Request was cancelled.'
        ));
      }
      return executions.fail(null, {
        problems: createProblem(
          'execution.network',
          'error',
          error && error.message ? error.message : 'Network request failed.'
        ),
      });
    }
  }

  async function readResponse(response, startedAt, operation) {
    const contentType = typeof response.headers?.get === 'function'
      ? response.headers.get('content-type')
      : (response.contentType || null);

    const canStream = onProgress
      && isLineStreamable(contentType)
      && response.body
      && typeof response.body.getReader === 'function';

    let bodyText = '';
    if (canStream) {
      bodyText = await readLineStream(response, contentType, operation, startedAt);
    } else if (typeof response.text === 'function') {
      bodyText = await response.text();
    } else if (typeof response.bodyText === 'string') {
      bodyText = response.bodyText;
    }
    let bodyJson;
    if (contentType && contentType.includes('json') && bodyText) {
      try {
        bodyJson = JSON.parse(bodyText);
      } catch {
        bodyJson = undefined;
      }
    }
    return {
      status: response.status,
      statusText: response.statusText || '',
      contentType,
      bodyText,
      bodyJson,
      durationMs: Math.max(0, clock.now() - startedAt),
    };
  }

  async function readLineStream(response, contentType, operation, startedAt) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const fqid = operationFqid(operation);
    let pendingTail = '';
    let fullText = '';

    const emit = (done) => {
      onProgress({
        operationFqid: fqid,
        contentType,
        bodyText: fullText,
        done,
        durationMs: Math.max(0, clock.now() - startedAt),
      });
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        pendingTail += chunk;
        // Only notify on completed lines so subscribers never see a half-line.
        const lastNewline = pendingTail.lastIndexOf('\n');
        if (lastNewline >= 0) {
          pendingTail = pendingTail.slice(lastNewline + 1);
          emit(false);
        }
      }
      if (done) {
        fullText += decoder.decode();
        emit(true);
        break;
      }
    }
    return fullText;
  }

  function wireExternalCancel(controller, state, signal) {
    if (!controller || !signal) {
      return null;
    }
    if (signal.aborted) {
      state.cancelled = true;
      controller.abort();
      return null;
    }
    const onAbort = () => {
      state.cancelled = true;
      controller.abort();
    };
    signal.addEventListener('abort', onAbort, { once: true });
    return () => signal.removeEventListener('abort', onAbort);
  }
}

function resolveTimeout(operation, callOptions, defaultTimeoutMs) {
  if (callOptions && callOptions.timeoutMs != null) {
    return Math.max(0, Number(callOptions.timeoutMs) || 0);
  }
  const fromOperation = operation && operation.request && operation.request.timeoutMs;
  if (fromOperation != null) {
    return Math.max(0, Number(fromOperation) || 0);
  }
  return Math.max(0, Number(defaultTimeoutMs) || 0);
}

function cleanup(cancelTimer, detachSignal) {
  if (typeof cancelTimer === 'function') {
    cancelTimer();
  }
  if (typeof detachSignal === 'function') {
    detachSignal();
  }
}

function isLineStreamable(contentType) {
  return typeof contentType === 'string'
    && (contentType.includes('ndjson') || contentType.includes('jsonl'));
}
