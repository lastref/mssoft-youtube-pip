// Brings the YouTube tab (and its window) to the front when the PiP window's
// "back to tab" or "full screen" button is used.
const ALLOWED_ORIGINS = new Set(['https://www.youtube.com', 'https://www.youtube-nocookie.com']);

function isTrustedSender(sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab) return false;
  try {
    return ALLOWED_ORIGINS.has(new URL(sender.url || sender.origin || '').origin);
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!isTrustedSender(sender)) return;
  if (message?.type !== 'ytpip:focus-tab') return;
  chrome.tabs.update(sender.tab.id, { active: true }).catch(() => {});
  chrome.windows.update(sender.tab.windowId, { focused: true }).catch(() => {});
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== 'install') return;
  await chrome.storage.sync.set({
    buttonStyle: 'native',
    seekStep: 10,
    hotkey: true,
    autoPip: false,
    pauseWhenHidden: false,
  });
});
