const input = document.getElementById('input');
const dictEditor = LineEditor.init(input, { dark: false });
const jsonPanel = JsonPanel.init({
  textEl: document.getElementById('json-text'),
  helperSelector: '#json-viewer-helper .response-viewer-wrap',
  expandTitle: 'JSON',
  copyBtn: document.getElementById('copy-output'),
  expandBtn: document.getElementById('expand-json'),
  onChange: () => scheduleSyncFromJson(),
});
const errorEl = document.getElementById('error');

const DEBOUNCE_MS = 250;
let syncing = false;
let dictTimer = null;
let jsonTimer = null;
let jsonUserEdited = false;

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
}

function convertLocal(text, direction) {
  return DictConvert.convert(text, direction);
}

async function syncFromDict() {
  if (syncing) return;
  const text = input.value;

  syncing = true;
  try {
    if (!text.trim()) {
      jsonPanel.clear();
      hideError();
      return;
    }

    const data = convertLocal(text, 'to_json');
    if (data.ok) {
      jsonPanel.setValue(data.result);
      hideError();
    } else {
      showError(data.error);
    }
  } catch {
    showError('转换失败');
  } finally {
    syncing = false;
  }
}

async function syncFromJson() {
  if (syncing) return;
  const text = jsonPanel.getValue();

  syncing = true;
  try {
    if (!text.trim()) {
      if (jsonUserEdited) {
        input.value = '';
        dictEditor?.updateLines();
        jsonUserEdited = false;
      }
      hideError();
      return;
    }

    jsonUserEdited = false;

    const data = convertLocal(text, 'to_dict');
    if (data.ok) {
      input.value = data.result;
      dictEditor?.updateLines();
      hideError();
    } else {
      showError(data.error);
    }
  } catch {
    showError('转换失败');
  } finally {
    syncing = false;
  }
}

function scheduleSyncFromDict() {
  clearTimeout(dictTimer);
  dictTimer = setTimeout(syncFromDict, DEBOUNCE_MS);
}

function scheduleSyncFromJson() {
  clearTimeout(jsonTimer);
  jsonTimer = setTimeout(syncFromJson, DEBOUNCE_MS);
}

function clearAll() {
  syncing = true;
  jsonUserEdited = false;
  input.value = '';
  jsonPanel.clear();
  dictEditor?.updateLines();
  syncing = false;
  hideError();
}

function bindDictAutoSync() {
  const run = () => scheduleSyncFromDict();
  input.addEventListener('input', run);
  input.addEventListener('paste', () => {
    run();
    clearTimeout(dictTimer);
    dictTimer = setTimeout(syncFromDict, 0);
  });
}

function bindJsonAutoSync() {
  const run = () => {
    jsonUserEdited = true;
    scheduleSyncFromJson();
  };
  jsonPanel.textEl.addEventListener('input', run);
  jsonPanel.textEl.addEventListener('paste', () => {
    jsonUserEdited = true;
    run();
    clearTimeout(jsonTimer);
    jsonTimer = setTimeout(syncFromJson, 0);
  });
}

bindDictAutoSync();
bindJsonAutoSync();

document.getElementById('clear-input').addEventListener('click', () => {
  clearAll();
  input.focus();
});

document.getElementById('clear-json').addEventListener('click', () => {
  clearAll();
  jsonPanel.textEl.focus();
});

document.getElementById('copy-input').addEventListener('click', () => {
  JsonPanel.copyWithFeedback(document.getElementById('copy-input'), input.value);
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    if (document.activeElement === jsonPanel.textEl) return;
    e.preventDefault();
    if (jsonPanel.getValue().trim()) {
      jsonPanel.jsonPreview?.setText(jsonPanel.getValue());
      jsonPanel.jsonPreview?.openSearch();
    }
  }
});

const backToTopBtn = document.getElementById('back-to-top');

function updateBackToTop() {
  if (!backToTopBtn) return;
  backToTopBtn.hidden = window.scrollY < 200;
}

backToTopBtn?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

window.addEventListener('scroll', updateBackToTop, { passive: true });
updateBackToTop();
