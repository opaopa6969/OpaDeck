// A minimal fake DOM, just capable enough to exercise the builtin renderers
// headlessly: element creation, the property/attribute/dataset surface used by
// src/renderers/dom.js, event dispatch, and single-compound-selector queries
// (tag, .class, [attr], [attr="value"], and combinations of those).

class FakeNode {
  constructor() {
    this.childNodes = [];
    this.parentNode = null;
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  appendChild(node) {
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      node.parentNode = null;
    }
    return node;
  }
}

class FakeText extends FakeNode {
  constructor(text) {
    super();
    this.nodeType = 3;
    this.textContent = String(text);
  }
}

function makeClassList(el) {
  const tokens = () => new Set(String(el.className || '').split(/\s+/).filter(Boolean));
  const write = (set) => { el.className = [...set].join(' '); };
  return {
    add(c) { const s = tokens(); s.add(c); write(s); },
    remove(c) { const s = tokens(); s.delete(c); write(s); },
    contains(c) { return tokens().has(c); },
    toggle(c, force) {
      const s = tokens();
      const want = force === undefined ? !s.has(c) : force;
      if (want) s.add(c); else s.delete(c);
      write(s);
      return want;
    },
  };
}

class FakeElement extends FakeNode {
  constructor(tag) {
    super();
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.attributes = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.className = '';
    this._textContent = null;
    this.value = '';
    this.checked = false;
    this.type = '';
    this.name = '';
    this.htmlFor = '';
    this.hidden = false;
    this.disabled = false;
    this.selected = false;
    this.placeholder = '';
    this.id = '';
    this.style = {};
    this.ownerDocument = null;
    this.classList = makeClassList(this);
  }

  removeEventListener(event, handler) {
    const arr = this.listeners.get(event);
    if (arr) {
      const i = arr.indexOf(handler);
      if (i >= 0) arr.splice(i, 1);
    }
  }

  get textContent() {
    if (this._textContent != null) {
      return this._textContent;
    }
    return this.childNodes.map((node) => node.textContent).join('');
  }

  set textContent(value) {
    this.childNodes = [];
    this._textContent = String(value);
  }

  get children() {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }

  appendChild(node) {
    this._textContent = null;
    return super.appendChild(node);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'id') {
      this.id = String(value);
    }
    if (name === 'class') {
      this.className = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  addEventListener(event, handler) {
    const arr = this.listeners.get(event) || [];
    arr.push(handler);
    this.listeners.set(event, arr);
  }

  dispatch(event, payload) {
    for (const handler of this.listeners.get(event) || []) {
      handler(payload || { type: event });
    }
  }

  click() {
    this.dispatch('click', { type: 'click' });
  }

  querySelector(selector) {
    return this.queryAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    return this.queryAll(selector);
  }

  queryAll(selector) {
    const matcher = parseSelector(selector);
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (matcher(child)) {
          out.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return out;
  }
}

function parseSelector(selector) {
  const compounds = splitDescendant(selector).map(parseCompound);
  return (el) => {
    if (compounds.length === 0 || !matchesCompound(el, compounds[compounds.length - 1])) {
      return false;
    }
    // Walk ancestors to satisfy the preceding compounds (descendant combinator).
    let index = compounds.length - 2;
    let node = el.parentNode;
    while (index >= 0 && node) {
      if (node.nodeType === 1 && matchesCompound(node, compounds[index])) {
        index -= 1;
      }
      node = node.parentNode;
    }
    return index < 0;
  };
}

function splitDescendant(selector) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of selector.trim()) {
    if (ch === '[') {
      depth += 1;
    } else if (ch === ']') {
      depth -= 1;
    }
    if (/\s/.test(ch) && depth === 0) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) {
    parts.push(current);
  }
  return parts;
}

function parseCompound(part) {
  // Extract attribute selectors first so a '.' inside an attribute value is not
  // mistaken for a class selector.
  const attrs = [...part.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].map((m) => ({ name: m[1], value: m[2] }));
  const withoutAttrs = part.replace(/\[[^\]]*\]/g, '');
  const tagMatch = /^[a-zA-Z][\w-]*/.exec(withoutAttrs);
  const tag = tagMatch ? tagMatch[0].toUpperCase() : null;
  const classes = [...withoutAttrs.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  return { tag, classes, attrs };
}

function matchesCompound(el, compound) {
  if (compound.tag && el.tagName !== compound.tag) {
    return false;
  }
  for (const cls of compound.classes) {
    if (!String(el.className).split(/\s+/).includes(cls)) {
      return false;
    }
  }
  for (const attr of compound.attrs) {
    const actual = attrValue(el, attr.name);
    if (actual === undefined || actual === null) {
      return false;
    }
    if (attr.value !== undefined && String(actual) !== attr.value) {
      return false;
    }
  }
  return true;
}

function attrValue(el, name) {
  if (name === 'class') {
    return el.className || undefined;
  }
  if (name === 'id') {
    return el.id || el.attributes.get('id');
  }
  if (name.startsWith('data-')) {
    const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return el.dataset[key];
  }
  if (el.attributes.has(name)) {
    return el.attributes.get(name);
  }
  const prop = el[name];
  if (prop != null && typeof prop !== 'object' && typeof prop !== 'function') {
    return prop;
  }
  return undefined;
}

export function createFakeDocument() {
  const byId = new Map();
  const docListeners = new Map();
  const doc = {
    fullscreenElement: null,
    fullscreenEnabled: false, // 既定で未対応 → fullscreen ユーティリティはオーバーレイへ
    createElement(tag) {
      const el = new FakeElement(tag);
      el.ownerDocument = doc;
      return el;
    },
    createElementNS(_ns, tag) {
      const el = new FakeElement(tag);
      el.ownerDocument = doc;
      return el;
    },
    createTextNode(text) {
      return new FakeText(text);
    },
    getElementById(id) {
      return byId.get(id) || null;
    },
    addEventListener(event, handler) {
      const arr = docListeners.get(event) || [];
      arr.push(handler);
      docListeners.set(event, arr);
    },
    removeEventListener(event, handler) {
      const arr = docListeners.get(event);
      if (arr) {
        const i = arr.indexOf(handler);
        if (i >= 0) arr.splice(i, 1);
      }
    },
    dispatch(event, payload) {
      for (const handler of (docListeners.get(event) || []).slice()) handler(payload || { type: event });
    },
    register(element) {
      if (element && element.id) {
        byId.set(element.id, element);
      }
      return element;
    },
  };
  return doc;
}

export { FakeElement, FakeText };
