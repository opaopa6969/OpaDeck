import { createIdRegistry } from './id-registry.js';

export function createFieldRendererRegistry() {
  const registry = createIdRegistry('FieldRenderer', {
    validate(renderer) {
      if (typeof renderer.supports !== 'function' || typeof renderer.render !== 'function') {
        throw new TypeError('FieldRenderer must implement supports() and render().');
      }
    },
  });

  return {
    ...registry,
    match(field) {
      return registry.list().find((renderer) => renderer.supports(field)) || null;
    },
  };
}
