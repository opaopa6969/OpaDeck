const DEFAULT_SELECTION = Object.freeze({
  groupId: null,
  operationId: null,
  fieldId: null,
  resultId: null,
  panelId: null,
});

export function createSelectionStore(options = {}) {
  const listeners = new Set();
  const bus = options.bus || null;
  let state = {
    ...DEFAULT_SELECTION,
    ...(options.initial || {}),
  };

  return {
    get() {
      return { ...state };
    },

    set(next) {
      const candidate = { ...state, ...(next || {}) };
      if (isSameSelection(state, candidate)) {
        return { ...state };
      }
      const previous = state;
      state = candidate;
      emit({ kind: 'selection.changed', selection: { ...state }, previous: { ...previous } });
      return { ...state };
    },

    reset() {
      return this.set(DEFAULT_SELECTION);
    },

    subscribe(listener) {
      if (typeof listener !== 'function') {
        throw new TypeError('Selection listener must be a function.');
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  function emit(event) {
    for (const listener of [...listeners]) {
      listener({ ...state }, event);
    }
    if (bus && typeof bus.publish === 'function') {
      bus.publish(event);
    }
  }
}

function isSameSelection(left, right) {
  return left.groupId === right.groupId
    && left.operationId === right.operationId
    && left.fieldId === right.fieldId
    && left.resultId === right.resultId
    && left.panelId === right.panelId;
}
