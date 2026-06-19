import { createRuntimeBus } from './bus.js';
import { createSystemClock } from './clock.js';
import { createScheduler } from './scheduler.js';
import { createSelectionStore } from './selection-store.js';
import { createExecutionStore } from './execution-store.js';

export function createRuntimeServices(options = {}) {
  const bus = options.bus || createRuntimeBus();
  const clock = options.clock || createSystemClock();
  const scheduler = options.scheduler || createScheduler({ clock });
  const selection = options.selection || createSelectionStore({ bus });
  const executions = options.executions || createExecutionStore({
    bus,
    clock,
    historyLimit: options.historyLimit,
  });

  return {
    bus,
    clock,
    scheduler,
    selection,
    executions,
  };
}
