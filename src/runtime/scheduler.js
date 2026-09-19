import { createSystemClock } from './clock.js';

export function createScheduler(options = {}) {
  const clock = options.clock || createSystemClock();

  return {
    after(delayMs, task) {
      const delay = Number(delayMs);
      if (!Number.isFinite(delay) || delay < 0) {
        throw new RangeError('after() delay must be a finite, non-negative number of milliseconds.');
      }
      return clock.schedule(task, delay);
    },

    every(periodMs, task) {
      if (typeof task !== 'function') {
        throw new TypeError('Recurring task must be a function.');
      }
      const period = Number(periodMs);
      if (!Number.isFinite(period) || period <= 0) {
        throw new RangeError('every() period must be a finite, positive number of milliseconds.');
      }
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
