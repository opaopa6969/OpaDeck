// Stable target resolution + the default tour command handlers.
//
// "Stable targets" means the runtime never relies on DOM structure or ad hoc
// selectors. Surfaces advertise themselves with data attributes:
//
//   operation -> [data-op-id="<groupId.operationId>"]
//   field     -> [data-field-id="<operationId>::<fieldId>"]
//   panel     -> [data-panel-id="<panelId>"]
//
// Builtin renderers emit these attributes, so a tour authored against operation
// and field ids keeps working regardless of layout.

export function tourTargetSelector(target) {
  if (!target || typeof target !== 'object') {
    return null;
  }
  switch (target.kind) {
    case 'operation':
      return `[data-op-id="${cssAttrEscape(target.operationId)}"]`;
    case 'field':
      return `[data-field-id="${cssAttrEscape(`${target.operationId}::${target.fieldId}`)}"]`;
    case 'panel':
      return `[data-panel-id="${cssAttrEscape(target.panelId)}"]`;
    case 'selector':
      // 任意の CSS セレクタを直接スポットライト対象にする(operation/field/panel に
      // 紐づかない要素 — 結果カードの view チップ, 地図のレイヤUI 等 — の説明用)。
      return target.selector || null;
    default:
      return null;
  }
}

export function createDefaultTourCommandHandlers() {
  return [
    {
      id: 'focusOperation',
      run(command, context) {
        select(context, { operationId: command.operationId, fieldId: null, panelId: null });
        return spotlight('operation', { kind: 'operation', operationId: command.operationId });
      },
    },
    {
      id: 'focusField',
      run(command, context) {
        select(context, { operationId: command.operationId, fieldId: command.fieldId });
        return spotlight('field', { kind: 'field', operationId: command.operationId, fieldId: command.fieldId });
      },
    },
    {
      id: 'focusPanel',
      run(command, context) {
        select(context, { panelId: command.panelId });
        return spotlight('panel', { kind: 'panel', panelId: command.panelId });
      },
    },
    {
      id: 'focusSelector',
      run(command, context) {
        // 任意 DOM 要素を CSS セレクタでスポットライト。selection は変えない。
        if (command.panelId) select(context, { panelId: command.panelId });
        return spotlight('selector', { kind: 'selector', selector: command.selector });
      },
    },
    {
      id: 'submitOperation',
      run(command, context) {
        // The tour coordinates; it does not own operation semantics. Submission
        // is delegated to whatever the host wired in.
        if (typeof context.submitOperation === 'function') {
          return context.submitOperation(command.operationId, command);
        }
        return undefined;
      },
    },
    {
      id: 'waitResult',
      run(command, context) {
        return waitForResult(command, context);
      },
    },
  ];
}

function select(context, patch) {
  if (context && context.selection && typeof context.selection.set === 'function') {
    context.selection.set(patch);
  }
}

function spotlight(kind, target) {
  return { kind, target, selector: tourTargetSelector(target) };
}

function waitForResult(command, context) {
  const bus = context && context.bus;
  if (!bus || typeof bus.subscribe !== 'function') {
    return undefined;
  }
  const timeoutMs = Number(command.timeoutMs) || Number(context.waitTimeoutMs) || 0;
  return new Promise((resolve) => {
    const unsubscribes = [];
    let settled = false;

    const cleanup = () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
    const settle = (record) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(record);
    };

    for (const kind of ['execution.success', 'execution.error', 'execution.timeout', 'execution.cancelled']) {
      unsubscribes.push(bus.subscribe(kind, (event) => {
        if (matchesOperation(event.record, command.operationId)) {
          settle(event.record);
        }
      }));
    }

    if (timeoutMs > 0 && context.scheduler && typeof context.scheduler.after === 'function') {
      context.scheduler.after(timeoutMs, () => settle(null));
    }
  });
}

function matchesOperation(record, operationId) {
  if (!record || !operationId) {
    return false;
  }
  const fqid = record.operationFqid || '';
  return fqid === operationId || fqid.endsWith(`.${operationId}`);
}

function cssAttrEscape(value) {
  return String(value == null ? '' : value).replace(/["\\]/g, '\\$&');
}
