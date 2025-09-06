// Site Reminder Popup - content script
// Reads user configuration from chrome.storage.local and, when the current URL
// matches a configured pattern, displays a blocking overlay with a custom message.

(function () {
  const DEFAULTS = {
    entries: [], // { pattern: string, message: string, enabled: boolean }
    cooldownSeconds: 0, // 0 = show every time
    lastShown: {} // { [key: string]: timestampMs }
  };

  // Load configuration and decide whether to show the popup
  chrome.storage.local.get(Object.keys(DEFAULTS), (res) => {
    const cfg = { ...DEFAULTS, ...res };
    const { entries, cooldownSeconds, lastShown } = cfg;
    if (!Array.isArray(entries) || entries.length === 0) return;

    const url = location.href;
    const hostname = location.hostname;

    const match = findFirstMatch(entries, url, hostname);
    if (!match) return;

    const key = `pattern:${match.pattern}`;
    const now = Date.now();
    const cooldownMs = Math.max(0, Number(cooldownSeconds) || 0) * 1000;
    if (cooldownMs > 0 && lastShown && lastShown[key]) {
      const elapsed = now - lastShown[key];
      const remaining = cooldownMs - elapsed;
      if (remaining > 0) {
        // Within cooldown window; do not show modal, but display countdown badge
        const onExpired = () => {
          // Re-check match before showing again
          try {
            if (!patternMatches(match.pattern, location.href, location.hostname)) return;
          } catch (_) { return; }
          if (document.getElementById('site-reminder-overlay')) return;
          showOverlay(match.message, () => {
            const updated = { ...(lastShown || {}), [key]: Date.now() };
            chrome.storage.local.set({ lastShown: updated });
            if (cooldownMs > 0) showCooldownBadge(cooldownMs, onExpired);
          }, () => {
            const updated = { ...(lastShown || {}), [key]: Date.now() };
            chrome.storage.local.set({ lastShown: updated });
            try { chrome.runtime.sendMessage({ type: 'CLOSE_TAB' }); } catch (_) { window.close(); }
          });
        };
        showCooldownBadge(remaining, onExpired);
        return;
      }
    }

    showOverlay(match.message, () => {
      // Continue: record last shown and dismiss overlay
      const updated = { ...(lastShown || {}), [key]: Date.now() };
      chrome.storage.local.set({ lastShown: updated });
      // If cooldown is set, show a countdown badge after continuing and reshow when it expires
      if (cooldownMs > 0) {
        const onExpired = () => {
          if (document.getElementById('site-reminder-overlay')) return;
          // Ensure still matching
          try {
            if (!patternMatches(match.pattern, location.href, location.hostname)) return;
          } catch (_) { return; }
          showOverlay(match.message, () => {
            const updated2 = { ...(lastShown || {}), [key]: Date.now() };
            chrome.storage.local.set({ lastShown: updated2 });
            if (cooldownMs > 0) showCooldownBadge(cooldownMs, onExpired);
          }, () => {
            const updated2 = { ...(lastShown || {}), [key]: Date.now() };
            chrome.storage.local.set({ lastShown: updated2 });
            try { chrome.runtime.sendMessage({ type: 'CLOSE_TAB' }); } catch (_) { window.close(); }
          });
        };
        showCooldownBadge(cooldownMs, onExpired);
      }
    }, () => {
      // Leave site: record last shown and request background to close tab
      const updated = { ...(lastShown || {}), [key]: Date.now() };
      chrome.storage.local.set({ lastShown: updated });
      try {
        chrome.runtime.sendMessage({ type: 'CLOSE_TAB' });
      } catch (e) {
        // Fallback in case messaging fails
        window.close();
      }
    });
  });

  function findFirstMatch(entries, url, hostname) {
    for (const entry of entries) {
      if (!entry || entry.enabled === false) continue;
      const pattern = String(entry.pattern || '').trim();
      if (!pattern) continue;
      try {
        if (patternMatches(pattern, url, hostname)) return entry;
      } catch (e) {
        // Ignore malformed patterns silently
      }
    }
    return null;
  }

  function patternMatches(pattern, url, hostname) {
    // Support simple formats:
    // - Regex: /.../
    // - Full/partial URL contains
    // - Domain: example.com, *.example.com
    // - Path/fragment contains
    const p = pattern.trim();
    if (!p) return false;

    // Regex between slashes
    if (p.startsWith('/') && p.endsWith('/') && p.length > 2) {
      const body = p.slice(1, -1);
      const re = new RegExp(body);
      return re.test(url);
    }

    // Scheme-present URL prefix or contains
    if (/^https?:\/\//i.test(p)) {
      return url.startsWith(p) || url.includes(p);
    }

    // Wildcard subdomain
    if (p.startsWith('*.')) {
      const dom = p.slice(2).toLowerCase();
      const h = hostname.toLowerCase();
      return h === dom || h.endsWith('.' + dom);
    }

    // If it looks like a bare domain (no spaces, no slashes), match hostname endsWith or equals
    if (!p.includes(' ') && !p.includes('/')) {
      const pd = p.toLowerCase();
      const h = hostname.toLowerCase();
      return h === pd || h.endsWith('.' + pd);
    }

    // Fallback: substring match anywhere in URL
    return url.includes(p);
  }

  function showOverlay(message, onContinue, onLeave) {
    const overlay = document.createElement('div');
    overlay.id = 'site-reminder-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'background:rgba(0,0,0,0.55)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'
    ].join(';');

    const box = document.createElement('div');
    box.style.cssText = [
      'max-width:600px',
      'width:min(90vw,600px)',
      'background:#fff',
      'color:#111',
      'border-radius:12px',
      'box-shadow:0 10px 30px rgba(0,0,0,0.25)',
      'padding:24px',
      'border:1px solid rgba(0,0,0,0.08)'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Heads up';
    title.style.cssText = 'font-weight:700;font-size:20px;margin:0 0 8px;';

    const body = document.createElement('div');
    body.textContent = message || 'Are you sure you want to continue?';
    body.style.cssText = 'font-size:15px;line-height:1.5;margin:0 0 20px;white-space:pre-wrap;';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;';

    const leaveBtn = document.createElement('button');
    leaveBtn.textContent = 'Leave Site';
    leaveBtn.style.cssText = baseBtnCss('#b42318', '#fee4e2');
    leaveBtn.addEventListener('click', () => {
      removeOverlay();
      onLeave && onLeave();
    });

    const okBtn = document.createElement('button');
    okBtn.textContent = 'Continue';
    okBtn.style.cssText = baseBtnCss('#065e3b', '#dcfce7');
    okBtn.addEventListener('click', () => {
      removeOverlay();
      onContinue && onContinue();
    });

    btnRow.append(leaveBtn, okBtn);
    box.append(title, body, btnRow);
    overlay.appendChild(box);

    // Trap focus for accessibility
    overlay.tabIndex = -1;
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        removeOverlay();
        onContinue && onContinue();
      }
    });

    // Insert early, even if DOM not fully ready
    (document.documentElement || document).appendChild(overlay);
    overlay.focus();

    function removeOverlay() {
      overlay.remove();
    }

    function baseBtnCss(color, bg) {
      return [
        'appearance:none',
        'border:1px solid rgba(0,0,0,0.12)',
        'border-radius:8px',
        'padding:10px 14px',
        'font-size:14px',
        'font-weight:600',
        `color:${color}`,
        `background:${bg}`,
        'cursor:pointer',
        'transition:transform .06s ease',
        'outline:none'
      ].join(';');
    }
  }
  
  function showCooldownBadge(remainingMs, onExpired) {
    const id = 'site-reminder-countdown';
    if (document.getElementById(id)) return; // already shown

    const wrap = document.createElement('div');
    wrap.id = id;
    wrap.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483647',
      'background:#0b1324',
      'color:#e6e9f2',
      'border:1px solid rgba(255,255,255,0.12)',
      'border-radius:10px',
      'padding:10px 12px',
      'box-shadow:0 6px 20px rgba(0,0,0,0.35)',
      'font:13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'
    ].join(';');

    const label = document.createElement('span');
    label.textContent = 'Next reminder in ';
    const time = document.createElement('strong');
    time.style.marginLeft = '2px';
    wrap.append(label, time);

    (document.documentElement || document).appendChild(wrap);

    const start = Date.now();
    let remaining = Math.max(0, Math.floor(remainingMs / 1000));
    time.textContent = remaining + 's';

    const iv = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, remaining - elapsed);
      time.textContent = left + 's';
      if (left <= 0) {
        clearInterval(iv);
        wrap.remove();
        try { onExpired && onExpired(); } catch (_) { /* noop */ }
      }
    }, 500);
  }
})();
