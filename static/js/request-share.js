/** Request snapshot share via localStorage (Request Local / Postbuman). */
const RequestShare = (() => {
  const DOC_ID_RE = StaticStorage.DOC_ID_RE;

  function forApi(api) {
    const NS = StaticStorage.namespaceFromApi(api);

    function parseIdFromUrl() {
      const id = new URLSearchParams(window.location.search).get('id');
      return id && DOC_ID_RE.test(id) ? id : null;
    }

    function buildPageUrl(id) {
      const url = new URL(window.location.href);
      url.search = `?id=${encodeURIComponent(id)}`;
      return url.toString();
    }

    function setPageUrl(id) {
      history.replaceState(null, '', buildPageUrl(id));
    }

    function clearPageUrl() {
      const url = new URL(window.location.href);
      url.search = '';
      history.replaceState(null, '', url.toString());
    }

    async function create(content) {
      return StaticStorage.create(NS, content);
    }

    async function load(id) {
      return StaticStorage.load(NS, id);
    }

    async function save(id, content) {
      return StaticStorage.save(NS, id, content);
    }

    return {
      parseIdFromUrl,
      buildPageUrl,
      setPageUrl,
      clearPageUrl,
      create,
      load,
      save,
      DOC_ID_RE,
    };
  }

  const script = document.currentScript;
  const defaultApi = script?.dataset?.api || '/api/request-local/share';

  return Object.assign(forApi(defaultApi), { forApi, DOC_ID_RE });
})();
