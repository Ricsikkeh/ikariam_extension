/**
 * Ikariam Helper - Background Service Worker
 * Handles alarms, data storage and messaging between popup and content scripts.
 */

const ALARM_INTERVAL_MINUTES = 1;

/** Install / startup: create a periodic alarm for badge updates. */
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('updateBadge', { periodInMinutes: ALARM_INTERVAL_MINUTES });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('updateBadge', { periodInMinutes: ALARM_INTERVAL_MINUTES });
});

/** Alarm handler: refresh data from the active Ikariam tab. */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateBadge') {
    refreshActiveTab();
  }
});

/**
 * Send a message to the content script on the active Ikariam tab and
 * update the extension badge with the number of finishing builds.
 */
async function refreshActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !isIkariamTab(tab.url)) return;

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getGameData' });
    if (response && response.buildQueue) {
      const count = response.buildQueue.filter(item => item.timeLeft <= 60).length;
      if (count > 0) {
        chrome.action.setBadgeText({ text: String(count) });
        chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    }
  } catch (_err) {
    // Tab may not have a content script loaded yet (e.g. page is still loading
    // or the tab navigated away). This is expected and can be ignored.
    console.debug('[Ikariam Helper SW] Badge refresh skipped:', String(_err));
  }
}

/** Check whether a URL belongs to Ikariam / Gameforge. */
function isIkariamTab(url) {
  if (!url) return false;
  return /ikariam\.(com|hu|de|org|gr|fr|it|pl|ru|cz|sk|ro|net)|gameforge\.com/.test(url);
}

/**
 * Relay messages from the content script to the popup (or vice versa)
 * and persist game snapshots to chrome.storage.local.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'saveGameData') {
    chrome.storage.local.set({ gameData: message.data, lastUpdated: Date.now() }, () => {
      sendResponse({ ok: true });
    });
    return true; // keep message channel open for async sendResponse
  }

  if (message.action === 'loadGameData') {
    chrome.storage.local.get(['gameData', 'lastUpdated'], (result) => {
      sendResponse(result);
    });
    return true;
  }

  if (message.action === 'saveSettings') {
    chrome.storage.local.set({ settings: message.settings }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.action === 'loadSettings') {
    chrome.storage.local.get('settings', (result) => {
      sendResponse(result.settings || {});
    });
    return true;
  }
});
