import { createBuiltinFieldRenderers } from './field-renderers.js';
import { createBuiltinResultRenderers } from './result-renderers.js';
import { createBuiltinPanelRenderers } from './panel-renderers.js';
import { createTimeSeriesRenderer } from './time-series.js';
import { createGeoSceneResultRenderer, createGeoScenePanelRenderer } from '../geo/geo-scene-registry.js';

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
    registries.resultRenderers.register(createTimeSeriesRenderer());
    registries.resultRenderers.register(createGeoSceneResultRenderer());
  }
  if (registries.panelRenderers) {
    for (const renderer of createBuiltinPanelRenderers()) {
      registries.panelRenderers.register(renderer);
    }
    registries.panelRenderers.register(createGeoScenePanelRenderer());
  }
  return registries;
}
