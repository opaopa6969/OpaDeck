import { createIdRegistry } from './id-registry.js';

export function createResultRendererRegistry() {
  const registry = createIdRegistry('ResultRenderer', {
    validate(renderer) {
      if (typeof renderer.canRender !== 'function' || typeof renderer.render !== 'function') {
        throw new TypeError('ResultRenderer must implement canRender() and render().');
      }
    },
  });

  return {
    ...registry,
    match(ctx) {
      if (ctx && ctx.resultView && ctx.resultView.renderer && registry.has(ctx.resultView.renderer)) {
        return registry.get(ctx.resultView.renderer);
      }
      return registry.list().find((renderer) => renderer.canRender(ctx)) || null;
    },
  };
}
