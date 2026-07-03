/** Browser-side HTTP send for static HuTu (replaces /api/request-local/send). */
const RequestClient = (() => {
  const FORBIDDEN = new Set([
    'host', 'connection', 'content-length', 'transfer-encoding',
    'upgrade', 'keep-alive', 'te', 'trailer', 'accept-encoding',
  ]);

  const BINARY_KEYWORDS = [
    'pdf', 'octet-stream', 'zip', 'excel', 'spreadsheet', 'msword',
    'wordprocessing', 'powerpoint', 'ms-powerpoint', '/vnd.', 'image/', 'audio/', 'video/',
  ];

  function filterHeaders(headers) {
    const out = {};
    Object.entries(headers || {}).forEach(([name, value]) => {
      if (!FORBIDDEN.has(name.toLowerCase())) out[name] = value;
    });
    return out;
  }

  function buildBody(request) {
    const { body, body_encoding: enc } = request;
    if (body == null || body === '') return undefined;
    if (enc === 'base64') {
      const bin = atob(body);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }
    return body;
  }

  function formatTextBody(text) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  function filenameFromHeaders(headers) {
    const disposition = headers['content-disposition'] || headers['Content-Disposition'] || '';
    let m = disposition.match(/filename\*=(?:UTF-8''|utf-8'')([^;\s]+)/i);
    if (m) return decodeURIComponent(m[1].trim().replace(/^["']|["']$/g, ''));
    m = disposition.match(/filename="([^"]+)"/i);
    if (m) return m[1];
    m = disposition.match(/filename=([^;\s]+)/i);
    return m ? m[1].replace(/^["']|["']$/g, '') : null;
  }

  function isBinaryResponse(raw, contentType, headers) {
    const ct = (contentType || '').toLowerCase();
    const disposition = (headers['content-disposition'] || headers['Content-Disposition'] || '').toLowerCase();
    if (disposition.includes('attachment')) return true;
    if (filenameFromHeaders(headers) && BINARY_KEYWORDS.some((kw) => ct.includes(kw))) return true;
    if (BINARY_KEYWORDS.some((kw) => ct.includes(kw))) return true;
    if (ct.startsWith('text/') || ct.includes('json')) {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(raw);
      return text.includes('\ufffd') && text.split('\ufffd').length > Math.max(3, text.length / 500);
    }
    if (!ct) {
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(raw);
        return false;
      } catch {
        return true;
      }
    }
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(raw);
      return false;
    } catch {
      return true;
    }
  }

  function headersToObject(resHeaders) {
    const out = {};
    resHeaders.forEach((value, key) => { out[key] = value; });
    return out;
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function send(request, options = {}) {
    if (!request?.url) {
      return { ok: false, error: '缺少请求 URL' };
    }

    const { signal, preferBinary = false } = options;
    const start = Date.now();

    try {
      const res = await fetch(request.url, {
        method: (request.method || 'GET').toUpperCase(),
        headers: filterHeaders(request.headers),
        body: buildBody(request),
        signal,
        redirect: 'follow',
      });

      const elapsed_ms = Date.now() - start;
      const respHeaders = headersToObject(res.headers);
      const contentType = res.headers.get('content-type') || '';
      const raw = new Uint8Array(await res.arrayBuffer());
      const ctMain = contentType.split(';')[0].trim().toLowerCase() || null;

      if (preferBinary && isBinaryResponse(raw, contentType, respHeaders)) {
        return {
          ok: true,
          status: res.status,
          headers: respHeaders,
          elapsed_ms,
          body: bytesToBase64(raw),
          body_encoding: 'base64',
          content_type: ctMain || 'application/octet-stream',
          filename: filenameFromHeaders(respHeaders),
        };
      }

      const text = new TextDecoder('utf-8', { fatal: false }).decode(raw);
      return {
        ok: true,
        status: res.status,
        headers: respHeaders,
        elapsed_ms,
        body: formatTextBody(text),
        body_encoding: 'utf-8',
        content_type: ctMain,
        filename: null,
      };
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      const elapsed_ms = Date.now() - start;
      let error = err?.message || String(err);
      if (error === 'Failed to fetch') {
        error = '请求失败: 无法连接目标地址（请确认本地服务已启动；跨域请求可能被浏览器拦截）';
      }
      return { ok: false, error, elapsed_ms };
    }
  }

  return { send };
})();
