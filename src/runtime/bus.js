export function createRuntimeBus() {
  const subscribers = new Map();

  return {
    publish(event) {
      assertEvent(event);
      const listeners = subscribers.get(event.kind);
      if (!listeners || listeners.size === 0) {
        return;
      }
      for (const handler of [...listeners]) {
        handler(event);
      }
    },

    subscribe(kind, handler) {
      if (!kind || typeof kind !== 'string') {
        throw new TypeError('Event kind must be a non-empty string.');
      }
      if (typeof handler !== 'function') {
        throw new TypeError('Handler must be a function.');
      }
      let listeners = subscribers.get(kind);
      if (!listeners) {
        listeners = new Set();
        subscribers.set(kind, listeners);
      }
      listeners.add(handler);
      return () => {
        const current = subscribers.get(kind);
        if (!current) {
          return;
        }
        current.delete(handler);
        if (current.size === 0) {
          subscribers.delete(kind);
        }
      };
    },
  };
}

function assertEvent(event) {
  if (!event || typeof event !== 'object' || typeof event.kind !== 'string' || event.kind.length === 0) {
    throw new TypeError('Runtime events must be objects with a non-empty string kind.');
  }
}
