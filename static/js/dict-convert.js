/** Client-side Python dict literal ↔ JSON (replaces /api/dict-to-json/convert). */
const DictConvert = (() => {
  function convert(text, direction) {
    try {
      const result = direction === 'to_json'
        ? pythonDictToJson(text)
        : jsonToPythonDict(text);
      return { ok: true, result };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  function pythonDictToJson(text) {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('输入为空');
    const value = parsePythonLiteral(trimmed);
    return JSON.stringify(value, null, 2);
  }

  function jsonToPythonDict(text) {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('输入为空');
    const data = JSON.parse(trimmed);
    return formatPythonValue(data, 0);
  }

  function reprString(value) {
    return `'${value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')}'`;
  }

  function formatPythonValue(value, indent = 0) {
    const space = '  '.repeat(indent);
    const inner = '  '.repeat(indent + 1);

    if (value === null) return 'None';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : JSON.stringify(value);
    if (typeof value === 'string') return reprString(value);

    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      const lines = value.map((item) => `${inner}${formatPythonValue(item, indent + 1)}`);
      return `[\n${lines.join(',\n')}\n${space}]`;
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      const lines = keys.map((key) => {
        const keyRepr = typeof key === 'string' ? reprString(key) : String(key);
        return `${inner}${keyRepr}: ${formatPythonValue(value[key], indent + 1)}`;
      });
      return `{\n${lines.join(',\n')}\n${space}}`;
    }

    return String(value);
  }

  // --- Python literal parser (subset of ast.literal_eval) ---

  function parsePythonLiteral(source) {
    const tokens = tokenize(source);
    const parser = new LiteralParser(tokens);
    const value = parser.parse();
    if (parser.peek().type !== 'EOF') {
      throw new Error('存在无法解析的内容');
    }
    return value;
  }

  function tokenize(source) {
    const tokens = [];
    let i = 0;

    const push = (type, value = null) => tokens.push({ type, value });

    while (i < source.length) {
      const ch = source[i];
      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }

      if ('{}[]():,'.includes(ch)) {
        push(ch);
        i += 1;
        continue;
      }

      if (ch === "'" || ch === '"') {
        const { value, next } = readQuotedString(source, i);
        push('STRING', value);
        i = next;
        continue;
      }

      const rest = source.slice(i);
      let m = rest.match(/^True\b/);
      if (m) { push('TRUE'); i += 4; continue; }
      m = rest.match(/^False\b/);
      if (m) { push('FALSE'); i += 5; continue; }
      m = rest.match(/^None\b/);
      if (m) { push('NONE'); i += 4; continue; }

      m = rest.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (m) {
        push('NUMBER', Number(m[0]));
        i += m[0].length;
        continue;
      }

      throw new Error(`无法识别的字符: ${ch}`);
    }

    push('EOF');
    return tokens;
  }

  function readQuotedString(source, start) {
    const quote = source[start];
    let i = start + 1;
    let value = '';

    while (i < source.length) {
      const ch = source[i];
      if (ch === '\\') {
        i += 1;
        if (i >= source.length) throw new Error('字符串转义不完整');
        const esc = source[i];
        const escapes = { n: '\n', r: '\r', t: '\t', '\\': '\\', "'": "'", '"': '"' };
        value += escapes[esc] ?? esc;
        i += 1;
        continue;
      }
      if (ch === quote) {
        return { value, next: i + 1 };
      }
      value += ch;
      i += 1;
    }

    throw new Error('字符串未闭合');
  }

  class LiteralParser {
    constructor(tokens) {
      this.tokens = tokens;
      this.pos = 0;
    }

    peek() {
      return this.tokens[this.pos];
    }

    consume(type) {
      const tok = this.peek();
      if (tok.type !== type) {
        throw new Error(`语法错误，期望 ${type}，实际 ${tok.type}`);
      }
      this.pos += 1;
      return tok;
    }

    parse() {
      return this.parseValue();
    }

    parseValue() {
      const tok = this.peek();
      switch (tok.type) {
        case '{': return this.parseDict();
        case '[': return this.parseList();
        case '(': return this.parseTuple();
        case 'STRING': this.pos += 1; return tok.value;
        case 'NUMBER': this.pos += 1; return tok.value;
        case 'TRUE': this.pos += 1; return true;
        case 'FALSE': this.pos += 1; return false;
        case 'NONE': this.pos += 1; return null;
        default:
          throw new Error(`无法解析的值: ${tok.type}`);
      }
    }

    parseDict() {
      this.consume('{');
      const obj = {};
      if (this.peek().type === '}') {
        this.consume('}');
        return obj;
      }

      while (true) {
        const key = this.parseValue();
        if (typeof key !== 'string' && typeof key !== 'number') {
          throw new Error('字典键必须是字符串或数字');
        }
        this.consume(':');
        obj[String(key)] = this.parseValue();
        const next = this.peek().type;
        if (next === ',') {
          this.consume(',');
          if (this.peek().type === '}') break;
          continue;
        }
        if (next === '}') break;
        throw new Error('字典格式错误');
      }

      this.consume('}');
      return obj;
    }

    parseList() {
      this.consume('[');
      const arr = [];
      if (this.peek().type === ']') {
        this.consume(']');
        return arr;
      }

      while (true) {
        arr.push(this.parseValue());
        const next = this.peek().type;
        if (next === ',') {
          this.consume(',');
          if (this.peek().type === ']') break;
          continue;
        }
        if (next === ']') break;
        throw new Error('列表格式错误');
      }

      this.consume(']');
      return arr;
    }

    parseTuple() {
      this.consume('(');
      const arr = [];
      if (this.peek().type === ')') {
        this.consume(')');
        return [];
      }

      while (true) {
        arr.push(this.parseValue());
        const next = this.peek().type;
        if (next === ',') {
          this.consume(',');
          if (this.peek().type === ')') break;
          continue;
        }
        if (next === ')') break;
        throw new Error('元组格式错误');
      }

      this.consume(')');
      return arr;
    }
  }

  return { convert, pythonDictToJson, jsonToPythonDict };
})();
