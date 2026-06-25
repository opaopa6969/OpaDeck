import { normalizeAppDefinition } from '../core/normalize-app.js';
import { validateApp } from '../validate.js';
import { createProblem } from '../core/problem.js';

// A loader for the `.opsui` DSL. It parses the core blocks (app / datasource /
// fieldset / group / operation / field / request / result) and the optional
// companion blocks (layout / help / tour). `fieldset` + `include` are pure
// compile-time sugar: an include splices copies of the fragment's fields into
// the operation, so the compiled model only ever contains plain fields.
//
// compileOpsui returns { app, problems }:
//   - parse errors are reported as a single located `dsl.parse.error` problem
//     and `app` is null;
//   - on a successful parse, `app` is the normalized AppDefinition and
//     `problems` are the structured reference diagnostics from
//     validateAppDefinition (so DSL diagnostics align with ProblemEntry).

const FIELD_TYPES = new Set(['text', 'textarea', 'checkbox', 'select', 'hidden']);
const FIELD_PLACEMENTS = new Set(['query', 'body', 'header', 'path', 'state']);

export function compileOpsui(source, options = {}) {
  const problems = [];
  let app;
  try {
    const tokens = tokenize(String(source == null ? '' : source));
    app = new Parser(tokens).parseApp();
  } catch (error) {
    if (error && error.opsui) {
      problems.push(createProblem('dsl.parse.error', 'error', error.opsui.message, {
        detail: `line ${error.opsui.line}, column ${error.opsui.column}`,
      }));
      return { app: null, problems };
    }
    throw error;
  }

  const normalized = normalizeAppDefinition(app);
  if (options.validate === false) {
    return { app: normalized, problems };
  }
  problems.push(...validateApp(normalized));
  return { app: normalized, problems };
}

// --- tokenizer -------------------------------------------------------------

function tokenize(source) {
  const tokens = [];
  let line = 1;
  let column = 1;
  let i = 0;
  const n = source.length;

  const advance = (count) => {
    for (let k = 0; k < count; k += 1) {
      if (source[i] === '\n') {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
      i += 1;
    }
  };

  while (i < n) {
    const ch = source[i];
    if (ch === '\n' || ch === ' ' || ch === '\t' || ch === '\r') {
      advance(1);
      continue;
    }
    if (ch === '#') {
      while (i < n && source[i] !== '\n') {
        advance(1);
      }
      continue;
    }
    if (ch === '{' || ch === '}' || ch === ':') {
      const type = ch === '{' ? 'lbrace' : ch === '}' ? 'rbrace' : 'colon';
      tokens.push({ type, value: ch, line, column });
      advance(1);
      continue;
    }
    if (ch === '"') {
      const startLine = line;
      const startColumn = column;
      advance(1);
      let value = '';
      while (i < n && source[i] !== '"') {
        if (source[i] === '\n') {
          throw parseError('Unterminated string literal.', startLine, startColumn);
        }
        if (source[i] === '\\' && i + 1 < n) {
          const escaped = source[i + 1];
          value += escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped;
          advance(2);
          continue;
        }
        value += source[i];
        advance(1);
      }
      if (i >= n) {
        throw parseError('Unterminated string literal.', startLine, startColumn);
      }
      advance(1); // closing quote
      tokens.push({ type: 'string', value, line: startLine, column: startColumn });
      continue;
    }
    const startColumn = column;
    let word = '';
    while (i < n && !/[\s{}:"#]/.test(source[i])) {
      word += source[i];
      advance(1);
    }
    tokens.push({ type: 'word', value: word, line, column: startColumn });
  }

  tokens.push({ type: 'eof', value: '', line, column });
  return tokens;
}

// --- parser ----------------------------------------------------------------

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    // Compile-time field fragments. `fieldset` blocks are pure DSL sugar: an
    // `include` splices copies of the fragment's fields into an operation, so
    // the compiled model only ever sees plain fields. The core never learns
    // that a fieldset existed.
    this.fieldSets = new Map();
  }

  peek() {
    return this.tokens[this.pos];
  }

  next() {
    const token = this.tokens[this.pos];
    this.pos += 1;
    return token;
  }

  expect(type, label) {
    const token = this.peek();
    if (token.type !== type) {
      throw parseError(`Expected ${label || type} but found ${describe(token)}.`, token.line, token.column);
    }
    return this.next();
  }

  expectWord(value) {
    const token = this.expect('word', value ? `'${value}'` : 'identifier');
    if (value != null && token.value !== value) {
      throw parseError(`Expected '${value}' but found '${token.value}'.`, token.line, token.column);
    }
    return token;
  }

  parseApp() {
    this.expectWord('app');
    const id = this.expectWord().value;
    const versionToken = this.expectWord();
    const versionMatch = /^v(\d+)$/.exec(versionToken.value);
    if (!versionMatch) {
      throw parseError(`Expected a version like 'v1' but found '${versionToken.value}'.`, versionToken.line, versionToken.column);
    }
    const app = {
      id,
      version: Number(versionMatch[1]),
      title: id,
      groups: [],
      dataSources: [],
      layouts: [],
      defaultLayoutId: undefined,
    };
    const help = { entries: [], tours: [] };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      const keyword = this.expectAtTopLevel(['title', 'defaultLayout', 'datasource', 'fieldset', 'group', 'layout', 'help', 'tour']);
      switch (keyword.value) {
        case 'title':
          app.title = this.expect('string', 'a title string').value;
          break;
        case 'defaultLayout':
          app.defaultLayoutId = this.expectWord().value;
          break;
        case 'datasource':
          app.dataSources.push(this.parseDatasource());
          break;
        case 'fieldset':
          this.parseFieldSet();
          break;
        case 'group':
          app.groups.push(this.parseGroup());
          break;
        case 'layout':
          app.layouts.push(this.parseLayout());
          break;
        case 'help':
          help.entries.push(...this.parseHelpBlock());
          break;
        case 'tour':
          help.tours.push(this.parseTour());
          break;
        default:
          break;
      }
    }
    this.expect('rbrace', "'}'");
    this.expect('eof', 'end of file');
    if (help.entries.length > 0 || help.tours.length > 0) {
      app.help = help;
    }
    return app;
  }

  expectAtTopLevel(allowed) {
    const token = this.expect('word', allowed.map((a) => `'${a}'`).join(', '));
    if (!allowed.includes(token.value)) {
      throw parseError(`Unexpected keyword '${token.value}'. Expected one of: ${allowed.join(', ')}.`, token.line, token.column);
    }
    return token;
  }

  parseFieldSet() {
    const id = this.expectWord().value;
    const fields = [];
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      this.expectAtTopLevel(['field']);
      fields.push(this.parseField());
    }
    this.expect('rbrace', "'}'");
    this.fieldSets.set(id, fields);
  }

  parseDatasource() {
    const id = this.expectWord().value;
    this.expect('colon', "':'");
    const kind = this.expectWord().value;
    const dataSource = { id, kind, staticOptions: [] };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      const keyword = this.expectAtTopLevel(['option']);
      if (keyword.value === 'option') {
        dataSource.staticOptions.push(this.parseOption());
      }
    }
    this.expect('rbrace', "'}'");
    if (dataSource.staticOptions.length === 0) {
      delete dataSource.staticOptions;
    }
    return dataSource;
  }

  parseOption() {
    const value = this.expect('string', 'an option value string').value;
    const option = { value, label: value };
    while (this.peek().type === 'word' && ['label', 'description', 'group'].includes(this.peek().value)) {
      const key = this.next().value;
      option[key] = this.expect('string', `a ${key} string`).value;
    }
    return option;
  }

  parseGroup() {
    const id = this.expectWord().value;
    const group = { id, label: id, operations: [] };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      const keyword = this.expectAtTopLevel(['label', 'summary', 'operation']);
      switch (keyword.value) {
        case 'label':
          group.label = this.expect('string', 'a label string').value;
          break;
        case 'summary':
          group.summary = this.expect('string', 'a summary string').value;
          break;
        case 'operation':
          group.operations.push(this.parseOperation());
          break;
        default:
          break;
      }
    }
    this.expect('rbrace', "'}'");
    return group;
  }

  parseOperation() {
    const id = this.expectWord().value;
    const operation = { id, title: id, request: { method: 'GET', url: '' }, fields: [] };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      const keyword = this.expectAtTopLevel(['title', 'summary', 'request', 'field', 'include', 'result']);
      switch (keyword.value) {
        case 'title':
          operation.title = this.expect('string', 'a title string').value;
          break;
        case 'summary':
          operation.summary = this.expect('string', 'a summary string').value;
          break;
        case 'request':
          operation.request = this.parseRequest();
          break;
        case 'field':
          operation.fields.push(this.parseField());
          break;
        case 'include': {
          const ref = this.expectWord();
          const fields = this.fieldSets.get(ref.value);
          if (!fields) {
            throw parseError(
              `Unknown fieldset '${ref.value}'. Declare it before the operation that includes it.`,
              ref.line,
              ref.column
            );
          }
          for (const field of fields) {
            operation.fields.push(cloneField(field));
          }
          break;
        }
        case 'result':
          operation.result = this.parseResult();
          break;
        default:
          break;
      }
    }
    this.expect('rbrace', "'}'");
    return operation;
  }

  parseRequest() {
    const request = { method: 'GET', url: '' };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      const keyword = this.expectAtTopLevel(['method', 'url', 'contentType', 'timeoutMs', 'accept', 'body']);
      switch (keyword.value) {
        case 'method':
          request.method = this.expectWord().value.toUpperCase();
          break;
        case 'url':
          request.url = this.expect('string', 'a url string').value;
          break;
        case 'contentType':
          request.contentType = this.expect('string', 'a content-type string').value;
          break;
        case 'timeoutMs':
          request.timeoutMs = Number(this.expectWord().value);
          break;
        case 'accept':
          request.accept = request.accept || [];
          request.accept.push(this.expect('string', 'an accept string').value);
          break;
        case 'body':
          request.body = this.parseRequestBody();
          break;
        default:
          break;
      }
    }
    this.expect('rbrace', "'}'");
    return request;
  }

  parseRequestBody() {
    const kindToken = this.expectWord();
    switch (kindToken.value) {
      case 'none':
        return { kind: 'none' };
      case 'form':
        return { kind: 'form' };
      case 'raw': {
        this.expectWord('field');
        const fieldId = this.expectWord().value;
        return { kind: 'rawField', fieldId };
      }
      default:
        throw parseError(`Unknown body kind '${kindToken.value}'. Expected none, form, or raw.`, kindToken.line, kindToken.column);
    }
  }

  parseField() {
    const idToken = this.expectWord();
    this.expect('colon', "':'");
    const typeToken = this.expectWord();
    if (!FIELD_TYPES.has(typeToken.value)) {
      throw parseError(`Unknown field type '${typeToken.value}'.`, typeToken.line, typeToken.column);
    }
    this.expectWord('in');
    const placementToken = this.expectWord();
    if (!FIELD_PLACEMENTS.has(placementToken.value)) {
      throw parseError(`Unknown field placement '${placementToken.value}'.`, placementToken.line, placementToken.column);
    }
    const field = {
      id: idToken.value,
      name: idToken.value,
      type: typeToken.value,
      placement: placementToken.value,
    };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      const keyword = this.expectAtTopLevel(['name', 'label', 'description', 'required', 'placeholder', 'source', 'default']);
      switch (keyword.value) {
        case 'name':
          field.name = this.expect('string', 'a name string').value;
          break;
        case 'label':
          field.label = this.expect('string', 'a label string').value;
          break;
        case 'description':
          field.description = this.expect('string', 'a description string').value;
          break;
        case 'required':
          field.required = this.expectBoolean();
          break;
        case 'placeholder':
          field.placeholder = this.expect('string', 'a placeholder string').value;
          break;
        case 'source':
          field.source = { dataSourceId: this.expectWord().value };
          break;
        case 'default':
          field.defaultValue = this.parseScalar();
          break;
        default:
          break;
      }
    }
    this.expect('rbrace', "'}'");
    return field;
  }

  parseResult() {
    const result = { renderer: 'auto' };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      const keyword = this.expectAtTopLevel(['renderer']);
      if (keyword.value === 'renderer') {
        result.renderer = this.expectWord().value;
      }
    }
    this.expect('rbrace', "'}'");
    return result;
  }

  // --- layout blocks -------------------------------------------------------

  parseLayout() {
    const id = this.expectWord().value;
    const layout = { id, root: null };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      const keyword = this.expectAtTopLevel(['title', 'split', 'stack', 'tabs', 'panel']);
      if (keyword.value === 'title') {
        layout.title = this.expect('string', 'a title string').value;
      } else {
        if (layout.root) {
          throw parseError(`Layout ${id} can only have one root node.`, keyword.line, keyword.column);
        }
        layout.root = this.parseNodeFrom(keyword);
      }
    }
    this.expect('rbrace', "'}'");
    if (!layout.root) {
      const here = this.peek();
      throw parseError(`Layout ${id} has no root node.`, here.line, here.column);
    }
    return layout;
  }

  parseNode() {
    const keyword = this.expect('word', 'a layout node (split, stack, tabs, panel)');
    return this.parseNodeFrom(keyword);
  }

  parseNodeFrom(keyword) {
    switch (keyword.value) {
      case 'split':
        return this.parseSplit();
      case 'stack':
        return this.parseStack();
      case 'tabs':
        return this.parseTabs();
      case 'panel':
        return this.parsePanel();
      default:
        throw parseError(`Unexpected layout node '${keyword.value}'. Expected split, stack, tabs, or panel.`, keyword.line, keyword.column);
    }
  }

  parseSplit() {
    const id = this.expectWord().value;
    const direction = this.expectWord();
    if (direction.value !== 'row' && direction.value !== 'column') {
      throw parseError(`Split direction must be row or column, found '${direction.value}'.`, direction.line, direction.column);
    }
    const node = { kind: 'split', id, direction: direction.value, children: [] };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      if (this.peek().type === 'word' && this.peek().value === 'sizes') {
        this.next();
        node.sizes = [Number(this.expectWord().value), Number(this.expectWord().value)];
      } else {
        node.children.push(this.parseNode());
      }
    }
    this.expect('rbrace', "'}'");
    if (node.children.length !== 2) {
      const here = this.peek();
      throw parseError(`Split ${id} must have exactly 2 children, found ${node.children.length}.`, here.line, here.column);
    }
    return node;
  }

  parseStack() {
    const id = this.expectWord().value;
    const node = { kind: 'stack', id, children: [] };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      if (this.peek().type === 'word' && this.peek().value === 'gap') {
        this.next();
        node.gap = this.expectWord().value;
      } else {
        node.children.push(this.parseNode());
      }
    }
    this.expect('rbrace', "'}'");
    return node;
  }

  parseTabs() {
    const id = this.expectWord().value;
    const node = { kind: 'tabs', id, tabs: [] };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      if (this.peek().type === 'word' && this.peek().value === 'defaultTab') {
        this.next();
        node.defaultTabId = this.expectWord().value;
      } else {
        const keyword = this.expectWord();
        if (keyword.value !== 'panel') {
          throw parseError(`Tabs children must be panels, found '${keyword.value}'.`, keyword.line, keyword.column);
        }
        node.tabs.push(this.parsePanel());
      }
    }
    this.expect('rbrace', "'}'");
    return node;
  }

  parsePanel() {
    const id = this.expectWord().value;
    const renderer = this.expectWord().value;
    const node = { kind: 'panel', id, renderer, binding: { kind: 'selection' } };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      const keyword = this.expectAtTopLevel(['bind', 'title', 'collapsible', 'defaultCollapsed', 'closable', 'resizable']);
      if (keyword.value === 'bind') {
        node.binding = this.parsePanelBinding();
      } else {
        node.chrome = node.chrome || {};
        if (keyword.value === 'title') {
          node.chrome.title = this.expect('string', 'a title string').value;
        } else {
          node.chrome[keyword.value] = this.expectBoolean();
        }
      }
    }
    this.expect('rbrace', "'}'");
    return node;
  }

  parsePanelBinding() {
    const kindToken = this.expectWord();
    switch (kindToken.value) {
      case 'allGroups':
        return { kind: 'allGroups' };
      case 'selection':
        return { kind: 'selection' };
      case 'group':
        return { kind: 'group', groupId: this.expectWord().value };
      case 'markdown':
        return { kind: 'markdown', content: this.expect('string', 'markdown content string').value };
      case 'results':
      case 'help': {
        const scope = this.expectWord();
        const binding = { kind: kindToken.value, scope: scope.value };
        if (scope.value === 'operation') {
          binding.operationId = this.expectWord().value;
        }
        return binding;
      }
      default:
        throw parseError(`Unknown panel binding '${kindToken.value}'.`, kindToken.line, kindToken.column);
    }
  }

  // --- help blocks ---------------------------------------------------------

  parseHelpBlock() {
    const entries = [];
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      this.expectAtTopLevel(['entry']);
      entries.push(this.parseHelpEntry());
    }
    this.expect('rbrace', "'}'");
    return entries;
  }

  parseHelpEntry() {
    const id = this.expectWord().value;
    const entry = { id, kind: 'inline', body: '' };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      const keyword = this.expectAtTopLevel(['target', 'kind', 'title', 'body']);
      switch (keyword.value) {
        case 'target':
          entry.target = this.parseHelpTarget();
          break;
        case 'kind':
          entry.kind = this.expectWord().value;
          break;
        case 'title':
          entry.title = this.expect('string', 'a title string').value;
          break;
        case 'body':
          entry.body = this.expect('string', 'a body string').value;
          break;
        default:
          break;
      }
    }
    this.expect('rbrace', "'}'");
    return entry;
  }

  parseHelpTarget() {
    const kindToken = this.expectWord();
    switch (kindToken.value) {
      case 'app':
        return { kind: 'app', appId: this.expectWord().value };
      case 'group':
        return { kind: 'group', groupId: this.expectWord().value };
      case 'operation':
        return { kind: 'operation', operationId: this.expectWord().value };
      case 'field':
        return { kind: 'field', operationId: this.expectWord().value, fieldId: this.expectWord().value };
      case 'panel':
        return { kind: 'panel', panelId: this.expectWord().value };
      case 'result': {
        const target = { kind: 'result' };
        if (this.peek().type === 'word' && this.peek().value === 'operation') {
          this.next();
          target.operationId = this.expectWord().value;
        }
        return target;
      }
      default:
        throw parseError(`Unknown help target '${kindToken.value}'.`, kindToken.line, kindToken.column);
    }
  }

  // --- tour blocks ---------------------------------------------------------

  parseTour() {
    const id = this.expectWord().value;
    const tour = { id, title: id, steps: [] };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      const keyword = this.expectAtTopLevel(['title', 'description', 'startFrom', 'step']);
      switch (keyword.value) {
        case 'title':
          tour.title = this.expect('string', 'a title string').value;
          break;
        case 'description':
          tour.description = this.expect('string', 'a description string').value;
          break;
        case 'startFrom':
          tour.startFrom = this.expectWord().value;
          break;
        case 'step':
          tour.steps.push(this.parseTourStep());
          break;
        default:
          break;
      }
    }
    this.expect('rbrace', "'}'");
    return tour;
  }

  parseTourStep() {
    const id = this.expectWord().value;
    const step = { id, title: id, commands: [] };
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      const keyword = this.expectAtTopLevel(['title', 'narration', 'focus', 'submit', 'wait']);
      switch (keyword.value) {
        case 'title':
          step.title = this.expect('string', 'a title string').value;
          break;
        case 'narration':
          step.narration = this.expect('string', 'a narration string').value;
          break;
        case 'focus':
          step.commands.push(this.parseFocusCommand());
          break;
        case 'submit':
          step.commands.push({ kind: 'submitOperation', operationId: this.expectWord().value });
          break;
        case 'wait':
          this.expectAtTopLevel(['result']);
          step.commands.push({ kind: 'waitResult', operationId: this.expectWord().value });
          break;
        default:
          break;
      }
    }
    this.expect('rbrace', "'}'");
    return step;
  }

  parseFocusCommand() {
    const target = this.expectWord();
    switch (target.value) {
      case 'operation':
        return { kind: 'focusOperation', operationId: this.expectWord().value };
      case 'field':
        return { kind: 'focusField', operationId: this.expectWord().value, fieldId: this.expectWord().value };
      case 'panel':
        return { kind: 'focusPanel', panelId: this.expectWord().value };
      default:
        throw parseError(`focus must target operation, field, or panel; found '${target.value}'.`, target.line, target.column);
    }
  }

  expectBoolean() {
    const token = this.expectWord();
    if (token.value === 'true') {
      return true;
    }
    if (token.value === 'false') {
      return false;
    }
    throw parseError(`Expected true or false but found '${token.value}'.`, token.line, token.column);
  }

  parseScalar() {
    const token = this.peek();
    if (token.type === 'string') {
      return this.next().value;
    }
    const word = this.expectWord().value;
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(word)) return Number(word);
    return word;
  }
}

function cloneField(field) {
  // Fields are plain data (primitives, small arrays/objects), so a structural
  // round-trip is enough and keeps each operation's copy independent.
  return JSON.parse(JSON.stringify(field));
}

function describe(token) {
  if (token.type === 'eof') {
    return 'end of file';
  }
  if (token.type === 'string') {
    return `string "${token.value}"`;
  }
  return `'${token.value}'`;
}

function parseError(message, line, column) {
  const error = new Error(`${message} (line ${line}, column ${column})`);
  error.opsui = { message, line, column };
  return error;
}
