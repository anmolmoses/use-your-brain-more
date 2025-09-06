// MV3 service worker: respond to messages from content scripts
// and perform privileged actions like closing the current tab.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'CLOSE_TAB') {
    const tabId = sender && sender.tab && sender.tab.id;
    if (typeof tabId === 'number') {
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          // Best-effort; ignore errors (e.g., tab already closed)
        }
      });
      sendResponse({ ok: true });
      return true; // keep channel open for async (not strictly needed here)
    }
  }
});

