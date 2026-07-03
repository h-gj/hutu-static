(() => {
  const NOTE_NS = 'notes';
  const NOTE_ID = 'default';
  const SAVE_DEBOUNCE_MS = 600;

  const textarea = document.getElementById('note-content');
  const saveStatus = document.getElementById('save-status');

  let isLoading = false;
  let lastSavedContent = '';
  let saveTimer = null;
  let saving = false;
  let saveQueued = false;

  function setStatus(text) {
    saveStatus.textContent = text;
  }

  function isDirty() {
    return textarea.value !== lastSavedContent;
  }

  async function loadNote() {
    isLoading = true;
    setStatus('加载中…');
    try {
      textarea.value = await StaticStorage.loadText(NOTE_NS, NOTE_ID);
      lastSavedContent = textarea.value;
      setStatus('');
    } catch (err) {
      setStatus(`加载失败: ${err.message}`);
    } finally {
      isLoading = false;
    }
  }

  async function persistNote() {
    if (isLoading) return;

    const content = textarea.value;
    if (content === lastSavedContent) {
      if (!saving) setStatus('已保存');
      return;
    }

    if (saving) {
      saveQueued = true;
      return;
    }

    saving = true;
    setStatus('保存中…');

    try {
      await StaticStorage.saveText(NOTE_NS, NOTE_ID, content);
      lastSavedContent = content;
      setStatus('已保存');
    } catch (err) {
      setStatus(`保存失败: ${err.message}`);
      console.error('note save error:', err);
    } finally {
      saving = false;
      if (saveQueued || isDirty()) {
        saveQueued = false;
        persistNote();
      }
    }
  }

  function schedulePersist() {
    if (isLoading) return;
    clearTimeout(saveTimer);
    setStatus('编辑中…');
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persistNote();
    }, SAVE_DEBOUNCE_MS);
  }

  textarea.addEventListener('input', schedulePersist);

  textarea.addEventListener('blur', () => {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (isDirty()) persistNote();
  });

  document.getElementById('copy-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setStatus('链接已复制');
      setTimeout(() => {
        if (saveStatus.textContent === '链接已复制') {
          setStatus(isDirty() ? '编辑中…' : '已保存');
        }
      }, 1500);
    } catch {
      setStatus('复制失败');
    }
  });

  document.getElementById('clear-note').addEventListener('click', () => {
    if (textarea.value && !window.confirm('确定清空记事本内容？')) return;
    textarea.value = '';
    clearTimeout(saveTimer);
    saveTimer = null;
    persistNote();
    textarea.focus();
  });

  window.addEventListener('beforeunload', (e) => {
    if (isDirty() || saving || saveTimer) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  loadNote();
})();
