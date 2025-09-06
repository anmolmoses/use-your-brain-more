(() => {
  const DEFAULTS = {
    entries: [],
    cooldownSeconds: 0,
    lastShown: {}
  };

  const entriesRoot = document.getElementById('entries');
  const addBtn = document.getElementById('add');
  const saveBtn = document.getElementById('save');
  const cooldownInput = document.getElementById('cooldown');
  const statusEl = document.getElementById('status');

  document.addEventListener('DOMContentLoaded', load);
  addBtn.addEventListener('click', () => appendEntry({ pattern: '', message: '', enabled: true }));
  saveBtn.addEventListener('click', save);

  function load() {
    chrome.storage.local.get(Object.keys(DEFAULTS), (res) => {
      const cfg = { ...DEFAULTS, ...res };
      cooldownInput.value = Number(cfg.cooldownSeconds || 0);
      entriesRoot.innerHTML = '';
      (cfg.entries || []).forEach(e => appendEntry(e));
      if ((cfg.entries || []).length === 0) {
        appendEntry({ pattern: 'twitter.com', message: 'What’s your intention here?', enabled: true });
      }
    });
  }

  function appendEntry({ pattern = '', message = '', enabled = true } = {}) {
    const tpl = document.getElementById('entry-template');
    const node = tpl.content.cloneNode(true);
    const el = node.querySelector('.entry');
    const patternEl = node.querySelector('.pattern');
    const messageEl = node.querySelector('.message');
    const enabledEl = node.querySelector('.enabled');
    const removeBtn = node.querySelector('.remove');

    patternEl.value = pattern;
    messageEl.value = message;
    enabledEl.checked = !!enabled;

    removeBtn.addEventListener('click', () => el.remove());
    entriesRoot.appendChild(node);
  }

  function save() {
    const cooldown = Math.max(0, Number(cooldownInput.value) || 0);
    const entries = Array.from(entriesRoot.querySelectorAll('.entry')).map((el) => ({
      pattern: el.querySelector('.pattern').value.trim(),
      message: el.querySelector('.message').value,
      enabled: el.querySelector('.enabled').checked
    })).filter(e => e.pattern);

    chrome.storage.local.set({ entries, cooldownSeconds: cooldown }, () => {
      flash('Saved');
    });
  }

  function flash(text) {
    statusEl.textContent = text;
    setTimeout(() => statusEl.textContent = '', 1200);
  }
})();

