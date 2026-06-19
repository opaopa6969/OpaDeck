import { normalizeAppDefinition } from '../core/normalize-app.js';
import { validateAppDefinition } from '../core/validate-app.js';
import { createProblem } from '../core/problem.js';

// A deliberately narrow loader for the `.opsui` DSL. It supports the subset
// proven by docs/en/DSL.md: app / datasource / group / operation / field /
// request / result. Layout, help, and tour blocks are intentionally not parsed
// yet; the runtime still accepts those via JS objects. The goal here is to
// prove the compile path, not to ship a full language.
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
  problems.push(...validateAppDefinition(normalized));
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
    this.expect('lbrace', "'{'");
    while (this.peek().type !== 'rbrace') {
      const keyword = this.expectAtTopLevel(['title', 'defaultLayout', 'datasource', 'group']);
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
        case 'group':
          app.groups.push(this.parseGroup());
          break;
        default:
          break;
      }
    }
    this.expect('rbrace', "'}'");
    this.expect('eof', 'end of file');
    return app;
  }

  expectAtTopLevel(allowed) {
    const token = this.expect('word', allowed.map((a) => `'${a}'`).join(', '));
    if (!allowed.includes(token.value)) {
      throw parseError(`Unexpected keyword '${token.value}'. Expected one of: ${allowed.join(', ')}.`, token.line, token.column);
    }
    return token;
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
      const keyword = this.expectAtTopLevel(['title', 'summary', 'request', 'field', 'result']);
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
