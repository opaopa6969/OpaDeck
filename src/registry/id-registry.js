export function createIdRegistry(name, options = {}) {
  const items = new Map();
  const validate = typeof options.validate === 'function' ? options.validate : null;

  return {
    register(item) {
      if (!item || typeof item.id !== 'string' || item.id.length === 0) {
        throw new TypeError(`${name} items must have a non-empty string id.`);
      }
      if (items.has(item.id)) {
        throw new Error(`${name} id ${item.id} is already registered.`);
      }
      if (validate) {
        validate(item);
      }
      items.set(item.id, item);
      return item;
    },

    unregister(id) {
      items.delete(id);
    },

    get(id) {
      return items.get(id) || null;
    },

    has(id) {
      return items.has(id);
    },

    list() {
      return [...items.values()];
    },
  };
}
