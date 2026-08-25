// Small, framework-free URL state primitive. Feature modules own the state
// shape; this module owns browser history semantics and nothing else.

export function createUrlState(options = {}) {
  const adapter = required(options.adapter, 'adapter');
  const win = options.window || globalThis.window;
  if (!win || !win.location || !win.history || typeof win.addEventListener !== 'function') {
    throw new TypeError('A browser-like window is required.');
  }

  let state = adapter.normalize(adapter.parse(new URL(win.location.href)));
  let started = false;
  let onChange = options.onChange;

  function current() {
    return clone(state);
  }

  function apply(reason) {
    state = adapter.normalize(adapter.parse(new URL(win.location.href)));
    if (typeof onChange === 'function') {
      onChange(clone(state), reason);
    }
    adapter.apply?.(clone(state), reason);
    return clone(state);
  }

  function navigate(next, mode = 'push') {
    if (mode !== 'push' && mode !== 'replace') {
      throw new TypeError(`Unknown history mode: ${mode}`);
    }
    const normalized = adapter.normalize(clone(next));
    const url = adapter.format(normalized, new URL(win.location.href));
    const method = mode === 'push' ? 'pushState' : 'replaceState';
    win.history[method]({ urlState: normalized }, '', url.href);
    return apply('navigate');
  }

  function handlePopState() {
    apply('popstate');
  }

  function start() {
    if (started) return () => {};
    started = true;
    win.addEventListener('popstate', handlePopState);
    // This also canonicalizes an old/non-normalized incoming URL without
    // adding a browser-history entry.
    apply('initial');
    return () => {
      if (!started) return;
      started = false;
      win.removeEventListener?.('popstate', handlePopState);
    };
  }

  return {
    current,
    navigate,
    start,
    setOnChange(listener) {
      onChange = listener;
    },
  };
}

export function createQueryStateAdapter({ defaults = {}, parse, format, normalize }) {
  if (typeof parse !== 'function' || typeof format !== 'function') {
    throw new TypeError('Query state adapter requires parse and format functions.');
  }
  return {
    parse: (url) => ({ ...defaults, ...parse(url) }),
    format,
    normalize: normalize || ((value) => ({ ...defaults, ...value })),
  };
}

function required(value, name) {
  if (!value || typeof value.parse !== 'function'
      || typeof value.format !== 'function'
      || typeof value.normalize !== 'function') {
    throw new TypeError(`URL state ${name} must implement parse, format, and normalize.`);
  }
  return value;
}

function clone(value) {
  if (value === null || typeof value !== 'object') return value;
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}
