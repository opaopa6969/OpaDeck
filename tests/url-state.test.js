import test from 'node:test';
import assert from 'node:assert/strict';

import { createUrlState } from '../src/index.js';

function fakeWindow(href = 'https://example.test/ops') {
  const listeners = new Map();
  const calls = [];
  const win = {
    location: { href },
    history: {
      pushState(state, unused, nextHref) {
        calls.push(['push', state, nextHref]);
        win.location.href = nextHref;
      },
      replaceState(state, unused, nextHref) {
        calls.push(['replace', state, nextHref]);
        win.location.href = nextHref;
      },
    },
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name, listener) {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
    emit(name) { listeners.get(name)?.({}); },
    calls,
  };
  return win;
}

function adapter() {
  return {
    parse(url) {
      return { op: url.searchParams.get('op') || null };
    },
    format(state, base) {
      const url = new URL(base.href);
      url.search = state.op ? `?op=${encodeURIComponent(state.op)}` : '';
      return url;
    },
    normalize(state) {
      return { op: state.op || null };
    },
  };
}

test('URL state applies the initial URL and responds to popstate', () => {
  const win = fakeWindow('https://example.test/ops?op=search');
  const seen = [];
  const state = createUrlState({
    window: win,
    adapter: adapter(),
    onChange: (value, reason) => seen.push([value, reason]),
  });

  const stop = state.start();
  assert.deepEqual(state.current(), { op: 'search' });
  assert.deepEqual(seen.at(-1), [{ op: 'search' }, 'initial']);

  win.location.href = 'https://example.test/ops?op=reload';
  win.emit('popstate');
  assert.deepEqual(state.current(), { op: 'reload' });
  assert.deepEqual(seen.at(-1), [{ op: 'reload' }, 'popstate']);
  stop();
});

test('navigation uses push or replace without a popstate loop', () => {
  const win = fakeWindow();
  const seen = [];
  const state = createUrlState({
    window: win,
    adapter: adapter(),
    onChange: (value, reason) => seen.push([value, reason]),
  });
  state.start();
  state.navigate({ op: 'search' });
  state.navigate({ op: 'reload' }, 'replace');

  assert.deepEqual(win.calls.map(([kind]) => kind), ['push', 'replace']);
  assert.deepEqual(seen.slice(-2), [
    [{ op: 'search' }, 'navigate'],
    [{ op: 'reload' }, 'navigate'],
  ]);
});
