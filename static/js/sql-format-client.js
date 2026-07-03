/** Client-side SQL format + basic validation (replaces /api/sql-tool/process). */
const SqlFormatClient = (() => {
  const DIALECT_MAP = {
    mysql: 'mysql',
    postgres: 'postgresql',
    sqlite: 'sqlite',
    oracle: 'sql',
    tsql: 'tsql',
  };

  function checkQuotes(sql) {
    let inSingle = false;
    let inDouble = false;
    let escape = false;
    let line = 1;
    let col = 0;

    for (const ch of sql) {
      if (ch === '\n') {
        line += 1;
        col = 0;
        continue;
      }
      col += 1;
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (!inDouble && ch === "'") {
        inSingle = !inSingle;
        continue;
      }
      if (!inSingle && ch === '"') {
        inDouble = !inDouble;
        continue;
      }
    }

    if (inSingle) return { message: '单引号未闭合', line, column: col };
    if (inDouble) return { message: '双引号未闭合', line, column: col };
    return null;
  }

  function checkBalanced(sql, openCh, closeCh, label) {
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let escape = false;
    let line = 1;
    let col = 0;
    let errLine = null;
    let errCol = null;

    for (const ch of sql) {
      if (ch === '\n') {
        line += 1;
        col = 0;
        continue;
      }
      col += 1;
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (!inDouble && ch === "'") {
        inSingle = !inSingle;
        continue;
      }
      if (!inSingle && ch === '"') {
        inDouble = !inDouble;
        continue;
      }
      if (inSingle || inDouble) continue;

      if (ch === openCh) depth += 1;
      else if (ch === closeCh) {
        depth -= 1;
        if (depth < 0) {
          errLine = line;
          errCol = col;
          break;
        }
      }
    }

    if (depth > 0 && errLine === null) {
      errLine = line;
      errCol = col;
    }

    if (depth !== 0) {
      return {
        message: depth > 0 ? `${label}不匹配` : `${label}多余闭合`,
        line: errLine,
        column: errCol,
      };
    }
    return null;
  }

  function validateSql(sql, dialect) {
    const errors = [];
    const quoteErr = checkQuotes(sql);
    if (quoteErr) errors.push(quoteErr);
    const parenErr = checkBalanced(sql, '(', ')', '圆括号');
    if (parenErr) errors.push(parenErr);

    return {
      valid: errors.length === 0,
      errors,
      warnings: errors.length === 0
        ? [{ message: '静态版仅做基础结构检测，完整方言解析请使用本地 HuTu' }]
        : [],
      dialect: dialect || 'mysql',
    };
  }

  function process(sql, options = {}) {
    const {
      dialect = 'mysql',
      keyword_case: keywordCase = 'upper',
      indent = 2,
      format: doFormat = true,
      validate: doValidate = true,
    } = options;

    const result = { ok: true };

    if (doValidate) {
      result.validation = validateSql(sql, dialect);
    }

    if (doFormat) {
      try {
        if (!sql.trim()) throw new Error('请输入 SQL');
        if (typeof sqlFormatter === 'undefined') {
          throw new Error('SQL 格式化库未加载，请刷新页面重试');
        }
        result.formatted = sqlFormatter.format(sql, {
          language: DIALECT_MAP[dialect] || 'mysql',
          keywordCase: keywordCase === 'preserve' ? 'preserve' : keywordCase,
          tabWidth: Math.max(1, Math.min(Number(indent) || 2, 8)),
        });
      } catch (err) {
        result.ok = false;
        result.error = err.message || String(err);
        return result;
      }
    }

    return result;
  }

  return { process, validateSql };
})();
