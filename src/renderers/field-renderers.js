import { h, fieldTargetId } from './dom.js';

// Builtin field renderers. Each one follows the FieldRenderer contract
// (supports(field) + render(ctx)) and produces a labeled control wrapped in a
// shell that advertises a stable [data-field-id] target for tours and help.
//
// render(ctx) expects:
//   { document, field, value, operationId, options?, onChange? }
// and returns a DOM element.

export function createBuiltinFieldRenderers() {
  return [
    {
      id: 'text',
      supports: (field) => field.type === 'text' || field.type === 'hidden',
      render: (ctx) => {
        const doc = ctx.document;
        const control = h(doc, 'input', {
          class: 'opa-input',
          type: ctx.field.type === 'hidden' ? 'hidden' : 'text',
          name: serializedName(ctx.field),
          value: ctx.value == null ? '' : String(ctx.value),
          placeholder: ctx.field.placeholder,
          on: changeHandler(ctx, (el) => el.value),
        });
        return fieldShell(ctx, control);
      },
    },
    {
      id: 'textarea',
      supports: (field) => field.type === 'textarea',
      render: (ctx) => {
        const doc = ctx.document;
        const control = h(doc, 'textarea', {
          class: 'opa-textarea',
          name: serializedName(ctx.field),
          placeholder: ctx.field.placeholder,
          value: ctx.value == null ? '' : String(ctx.value),
          on: changeHandler(ctx, (el) => el.value),
        });
        return fieldShell(ctx, control);
      },
    },
    {
      id: 'checkbox',
      supports: (field) => field.type === 'checkbox',
      render: (ctx) => {
        const doc = ctx.document;
        const control = h(doc, 'input', {
          class: 'opa-checkbox',
          type: 'checkbox',
          name: serializedName(ctx.field),
          checked: Boolean(ctx.value),
          on: changeHandler(ctx, (el) => el.checked),
        });
        return fieldShell(ctx, control, { inlineControl: true });
      },
    },
    {
      id: 'select',
      supports: (field) => field.type === 'select',
      render: (ctx) => {
        const doc = ctx.document;
        const options = ctx.options || ctx.field.options || [];
        const optionEls = options.map((option) => h(doc, 'option', {
          value: option.value,
          selected: String(ctx.value) === String(option.value),
          disabled: option.disabled,
          text: option.label == null ? option.value : option.label,
        }));
        const control = h(doc, 'select', {
          class: 'opa-select',
          name: serializedName(ctx.field),
          on: changeHandler(ctx, (el) => el.value),
        }, optionEls);
        return fieldShell(ctx, control);
      },
    },
  ];
}

function fieldShell(ctx, control, options = {}) {
  const doc = ctx.document;
  const label = h(doc, 'label', {
    class: 'opa-field-label',
    text: ctx.field.label || ctx.field.name || ctx.field.id,
  });
  const children = options.inlineControl
    ? [h(doc, 'div', { class: 'opa-field-inline' }, [control, label])]
    : [label, control];
  if (ctx.field.description) {
    children.push(h(doc, 'p', { class: 'opa-field-desc', text: ctx.field.description }));
  }
  return h(doc, 'div', {
    class: `opa-field opa-field-${ctx.field.type}`,
    dataset: { fieldId: fieldTargetId(ctx.operationId || '', ctx.field.id) },
  }, children);
}

function changeHandler(ctx, read) {
  if (typeof ctx.onChange !== 'function') {
    return undefined;
  }
  return {
    input: (event) => ctx.onChange(read(event.target), ctx.field),
    change: (event) => ctx.onChange(read(event.target), ctx.field),
  };
}

function serializedName(field) {
  return field.name || field.id;
}
