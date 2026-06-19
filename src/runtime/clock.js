export function createSystemClock() {
  return {
    now() {
      if (globalThis.performance && typeof globalThis.performance.now === 'function') {
        return globalThis.performance.now();
      }
      return Date.now();
    },
    schedule(task, delayMs) {
      if (typeof task !== 'function') {
        throw new TypeError('Scheduled task must be a function.');
      }
      const timer = setTimeout(task, Math.max(0, Number(delayMs) || 0));
      return () => clearTimeout(timer);
    },
  };
}

export function createManualClock(options = {}) {
  let nowValue = Number(options.startAt) || 0;
  let sequence = 0;
  const queue = [];

  return {
    now() {
      return nowValue;
    },
    schedule(task, delayMs) {
      if (typeof task !== 'function') {
        throw new TypeError('Scheduled task must be a function.');
      }
      const item = {
        id: ++sequence,
        runAt: nowValue + Math.max(0, Number(delayMs) || 0),
        task,
        cancelled: false,
      };
      queue.push(item);
      queue.sort((left, right) => left.runAt - right.runAt || left.id - right.id);
      return () => {
        item.cancelled = true;
      };
    },
    advanceBy(deltaMs) {
      advanceTo(nowValue + Math.max(0, Number(deltaMs) || 0));
    },
    advanceTo(targetNow) {
      advanceTo(Number(targetNow));
    },
    pendingCount() {
      return queue.filter((item) => !item.cancelled).length;
    },
  };

  function advanceTo(targetNow) {
    if (!Number.isFinite(targetNow) || targetNow < nowValue) {
      throw new RangeError('Manual clock can only advance forward to a finite time.');
    }
    while (true) {
      queue.sort((left, right) => left.runAt - right.runAt || left.id - right.id);
      const next = queue.find((item) => !item.cancelled && item.runAt <= targetNow);
      if (!next) {
        break;
      }
      removeItem(next.id);
      nowValue = next.runAt;
      next.task();
    }
    nowValue = targetNow;
  }

  function removeItem(id) {
    const index = queue.findIndex((item) => item.id === id);
    if (index >= 0) {
      queue.splice(index, 1);
    }
  }
}
