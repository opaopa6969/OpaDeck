import { createIdRegistry } from '../registry/id-registry.js';

// Tour commands are part of the semantic/help model, but their *execution* is an
// open edge. A handler is registered under the command kind it services and is
// invoked with (command, context). This keeps the tour runtime from hard-coding
// command behavior: new command kinds are added by registering a handler, not by
// editing the player.

export function createTourCommandHandlerRegistry() {
  const registry = createIdRegistry('TourCommandHandler', {
    validate(handler) {
      if (typeof handler.run !== 'function') {
        throw new TypeError('TourCommandHandler must implement run().');
      }
    },
  });

  return {
    ...registry,

    registerAll(handlers) {
      for (const handler of handlers || []) {
        registry.register(handler);
      }
      return this;
    },

    runCommand(command, context) {
      if (!command || typeof command.kind !== 'string') {
        throw new TypeError('Tour command must have a string kind.');
      }
      const handler = registry.get(command.kind);
      if (!handler) {
        throw new Error(`No tour command handler is registered for kind ${command.kind}.`);
      }
      return handler.run(command, context);
    },
  };
}
