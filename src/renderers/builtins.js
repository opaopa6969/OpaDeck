import { createBuiltinFieldRenderers } from './field-renderers.js';
import { createBuiltinResultRenderers } from './result-renderers.js';
import { createBuiltinPanelRenderers } from './panel-renderers.js';

// Convenience: register the full builtin browser renderer set into the supplied
// registries. Any registry may be omitted.

export function registerBuiltinRenderers(registries = {}) {
  if (registries.fieldRenderers) {
    for (const renderer of createBuiltinFieldRenderers()) {
      registries.fieldRenderers.register(renderer);
    }
  }
  if (registries.resultRenderers) {
    for (const renderer of createBuiltinResultRenderers()) {
      registries.resultRenderers.register(renderer);
    }
  }
  if (registries.panelRenderers) {
    for (const renderer of createBuiltinPanelRenderers()) {
      registries.panelRenderers.register(renderer);
    }
  }
  return registries;
}
