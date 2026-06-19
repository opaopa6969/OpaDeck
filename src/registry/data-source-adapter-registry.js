import { createIdRegistry } from './id-registry.js';

export function createDataSourceAdapterRegistry() {
  const registry = createIdRegistry('DataSourceAdapter', {
    validate(adapter) {
      if (typeof adapter.resolve !== 'function') {
        throw new TypeError('DataSourceAdapter must implement resolve().');
      }
    },
  });

  return {
    ...registry,
    resolve(ctx) {
      if (!ctx || !ctx.dataSource || typeof ctx.dataSource.kind !== 'string') {
        throw new TypeError('Data-source resolution requires ctx.dataSource.kind.');
      }
      const adapter = registry.get(ctx.dataSource.kind);
      if (!adapter) {
        throw new Error(`No DataSourceAdapter is registered for kind ${ctx.dataSource.kind}.`);
      }
      return adapter.resolve(ctx);
    },
  };
}
