// A tiny hyperscript helper so the builtin renderers touch only a small, uniform
// slice of the DOM API. That keeps them readable and lets them run against a
// lightweight fake document in tests without a real browser.

const PROP_KEYS = new Set([
  'value', 'checked', 'type', 'name', 'htmlFor', 'hidden',
  'disabled', 'selected', 'placeholder', 'id', 'textContent', 'innerHTML',
]);

const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(doc, tag, props = {}, children = []) {
  return build(doc, doc.createElement(tag), props, children, false);
}

export function svgH(doc, tag, props = {}, children = []) {
  const el = typeof doc.createElementNS === 'function'
    ? doc.createElementNS(SVG_NS, tag)
    : doc.createElement(tag);
  return build(doc, el, props, children, true);
}

function build(doc, el, props, children, isSvg) {
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null) {
      continue;
    }
    if (key === 'class') {
      // SVG elements expose a read-only className; always set the attribute for
      // them, while HTML keeps the fast property path.
      if (isSvg) {
        el.setAttribute('class', value);
      } else {
        el.className = value;
      }
    } else if (key === 'text') {
      el.textContent = String(value);
    } else if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        if (dataValue != null) {
          el.dataset[dataKey] = String(dataValue);
        }
      }
    } else if (key === 'on') {
      for (const [eventName, handler] of Object.entries(value)) {
        el.addEventListener(eventName, handler);
      }
    } else if (PROP_KEYS.has(key)) {
      el[key] = value;
    } else {
      el.setAttribute(key, String(value));
    }
  }
  appendChildren(doc, el, children);
  return el;
}

export function appendChildren(doc, el, children) {
  for (const child of flatten(children)) {
    if (child == null || child === false) {
      continue;
    }
    el.appendChild(typeof child === 'object' ? child : doc.createTextNode(String(child)));
  }
}

export function clear(el) {
  if (!el) {
    return;
  }
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

export function fieldTargetId(operationId, fieldId) {
  return `${operationId}::${fieldId}`;
}

function flatten(children) {
  if (!Array.isArray(children)) {
    return [children];
  }
  const out = [];
  for (const child of children) {
    if (Array.isArray(child)) {
      out.push(...flatten(child));
    } else {
      out.push(child);
    }
  }
  return out;
}
