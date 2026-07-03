/** localStorage backend for hutu-static (replaces server-side share/doc/note APIs). */
const StaticStorage = (() => {
  const PREFIX = 'hutu-static:';
  const DOC_ID_RE = /^[a-z0-9]{10,16}$/;

  function storageKey(namespace, id) {
    return `${PREFIX}${namespace}:${id}`;
  }

  function randomId(length = 12) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    let id = '';
    for (let i = 0; i < length; i += 1) {
      id += chars[bytes[i] % chars.length];
    }
    return id;
  }

  function write(namespace, id, content) {
    localStorage.setItem(storageKey(namespace, id), JSON.stringify({
      content,
      updated_at: Date.now(),
    }));
  }

  function read(namespace, id) {
    const raw = localStorage.getItem(storageKey(namespace, id));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function create(namespace, content) {
    const id = randomId(12);
    write(namespace, id, content);
    return id;
  }

  async function load(namespace, id) {
    const data = read(namespace, id);
    if (!data) {
      throw new Error('内容不存在（静态版数据仅保存在本浏览器）');
    }
    return data.content;
  }

  async function save(namespace, id, content) {
    if (!read(namespace, id)) {
      write(namespace, id, content);
    } else {
      write(namespace, id, content);
    }
    return { ok: true, id };
  }

  async function loadText(namespace, id) {
    const data = read(namespace, id);
    return data ? (data.content ?? '') : '';
  }

  async function saveText(namespace, id, content) {
    write(namespace, id, content);
    return { ok: true };
  }

  function namespaceFromApi(apiPath) {
    return String(apiPath || '')
      .replace(/^\/api\//, '')
      .replace(/\/+$/, '') || 'share';
  }

  return {
    PREFIX,
    DOC_ID_RE,
    create,
    load,
    save,
    loadText,
    saveText,
    namespaceFromApi,
  };
})();
