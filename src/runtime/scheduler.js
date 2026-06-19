import { createSystemClock } from './clock.js';

export function createScheduler(options = {}) {
  const clock = options.clock || createSystemClock();

  return {
    after(delayMs, task) {
      return clock.schedule(task, delayMs);
    },

    every(periodMs, task) {
      if (typeof task !== 'function') {
        throw new TypeError('Recurring task must be a function.');
      }
      const period = Math.max(0, Number(periodMs) || 0);
      let cancelled = false;
      let cancelCurrent = null;

      const run = () => {
        if (cancelled) {
          return;
        }
        task();
        if (!cancelled) {
          cancelCurrent = clock.schedule(run, period);
        }
      };

      cancelCurrent = clock.schedule(run, period);
      return () => {
        cancelled = true;
        if (cancelCurrent) {
          cancelCurrent();
        }
      };
    },

    frame(task) {
      if (typeof task !== 'function') {
        throw new TypeError('Frame task must be a function.');
      }
      if (typeof globalThis.requestAnimationFrame === 'function') {
        const id = globalThis.requestAnimationFrame(task);
        return () => globalThis.cancelAnimationFrame(id);
      }
      return clock.schedule(() => task(clock.now()), 16);
    },
  };
}
