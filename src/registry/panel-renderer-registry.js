import { createIdRegistry } from './id-registry.js';

export function createPanelRendererRegistry() {
  return createIdRegistry('PanelRenderer', {
    validate(renderer) {
      if (typeof renderer.render !== 'function') {
        throw new TypeError('PanelRenderer must implement render().');
      }
    },
  });
}
