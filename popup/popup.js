/**
 * Ikariam Helper – Popup Script
 *
 * Requests game data from the active Ikariam tab (via the content script) and
 * renders it. Falls back to the last cached snapshot stored in chrome.storage.
 */

'use strict';

/* --------------------------------------------------------------------------
 * Utilities
 * -------------------------------------------------------------------------- */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(totalSeconds) {
  if (totalSeconds <= 0) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

function isIkariamUrl(url) {
  if (!url) return false;
  return /ikariam\.(com|hu|de|org|gr|fr|it|pl|ru|cz|sk|ro|net)|gameforge\.com/.test(url);
}

/* --------------------------------------------------------------------------
 * Resource definitions
 * -------------------------------------------------------------------------- */

const RESOURCES = [
  { key: 'gold',    label: 'Arany',    icon: '🪙' },
  { key: 'wood',    label: 'Fa',       icon: '🌲' },
  { key: 'marble',  label: 'Márvány',  icon: '🪨' },
  { key: 'crystal', label: 'Kristály', icon: '💎' },
  { key: 'sulfur',  label: 'Kén',      icon: '🔥' },
  { key: 'wine',    label: 'Bor',      icon: '🍷' },
];

/* --------------------------------------------------------------------------
 * Render helpers
 * -------------------------------------------------------------------------- */

function renderPlayerInfo(playerInfo) {
  const section = document.getElementById('player-info');
  if (!playerInfo || !playerInfo.playerName) {
    section.classList.add('hidden');
    return;
  }
  document.getElementById('player-name').textContent = `👤 ${playerInfo.playerName}`;
  document.getElementById('player-score').textContent = playerInfo.score ? `🏆 ${playerInfo.score.toLocaleString()}` : '';
  document.getElementById('player-town').textContent = playerInfo.currentTown ? `🏛️ ${playerInfo.currentTown}` : '';
  section.classList.remove('hidden');
}

function renderResources(resources, production) {
  const tbody = document.getElementById('resource-rows');
  const rows = RESOURCES.map(({ key, label, icon }) => {
    const amount = resources ? resources[key] || 0 : 0;
    const rate = production ? production[key] : null;
    const rateStr = rate !== null && rate !== undefined ? rate.toLocaleString() : '–';
    return `<tr>
      <td>${icon} ${label}</td>
      <td class="td-amount">${amount.toLocaleString()}</td>
      <td class="td-rate">${rateStr}</td>
    </tr>`;
  });
  tbody.innerHTML = rows.join('');
}

function renderBuildQueue(buildQueue) {
  const list = document.getElementById('build-queue-list');
  if (!buildQueue || buildQueue.length === 0) {
    list.innerHTML = '<li class="empty-state">Nincs aktív építkezés.</li>';
    return;
  }
  list.innerHTML = buildQueue.map(item => {
    const urgentClass = item.timeLeft <= 300 ? 'urgent' : item.timeLeft <= 3600 ? 'soon' : '';
    return `<li class="queue-item ${urgentClass}">
      <span class="queue-name">${escapeHtml(item.name)}${item.level !== null ? ` (Szint ${item.level})` : ''}</span>
      <span class="queue-time">⏱ ${formatTime(item.timeLeft)}</span>
    </li>`;
  }).join('');
}

function renderResearch(research) {
  const container = document.getElementById('research-content');
  if (!research || !research.name) {
    container.innerHTML = '<p class="empty-state">Nincs aktív kutatás.</p>';
    return;
  }
  const urgentClass = research.timeLeft <= 300 ? 'urgent' : research.timeLeft <= 3600 ? 'soon' : '';
  container.innerHTML = `<div class="research-card ${urgentClass}">
    <div class="research-card-name">🔬 ${escapeHtml(research.name)}</div>
    <div class="research-card-time">⏱ ${formatTime(research.timeLeft)}</div>
  </div>`;
}

function renderMilitary(military) {
  const container = document.getElementById('military-content');
  if (!military) {
    container.innerHTML = '<p class="empty-state">Nincs megjeleníthető adat.</p>';
    return;
  }

  const hasArmy = military.army && military.army.length > 0;
  const hasNavy = military.navy && military.navy.length > 0;

  if (!hasArmy && !hasNavy) {
    container.innerHTML = '<p class="empty-state">Nincs megjeleníthető katonai adat.</p>';
    return;
  }

  let html = '';
  if (hasArmy) {
    html += '<p class="mil-section-title">⚔️ Szárazföldi erők</p><ul class="unit-list">';
    military.army.forEach(u => {
      html += `<li><span>${escapeHtml(u.name)}</span><span class="unit-count">${u.count.toLocaleString()}</span></li>`;
    });
    html += '</ul>';
  }
  if (hasNavy) {
    html += '<p class="mil-section-title">⛵ Tengerészet</p><ul class="unit-list">';
    military.navy.forEach(u => {
      html += `<li><span>${escapeHtml(u.name)}</span><span class="unit-count">${u.count.toLocaleString()}</span></li>`;
    });
    html += '</ul>';
  }
  container.innerHTML = html;
}

function setLastUpdated(timestamp) {
  const el = document.getElementById('last-updated');
  if (!timestamp) { el.textContent = '–'; return; }
  const d = new Date(timestamp);
  el.textContent = `Frissítve: ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function showBanner(message, type = 'error') {
  const banner = document.getElementById('status-banner');
  banner.textContent = message;
  banner.className = `status-banner ${type}`;
}

function hideBanner() {
  document.getElementById('status-banner').className = 'status-banner hidden';
}

function renderAll(data) {
  if (!data) return;
  renderPlayerInfo(data.playerInfo);
  renderResources(data.resources, data.production);
  renderBuildQueue(data.buildQueue);
  renderResearch(data.research);
  renderMilitary(data.military);
  setLastUpdated(data.timestamp);
}

/* --------------------------------------------------------------------------
 * Data loading
 * -------------------------------------------------------------------------- */

async function loadData() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !isIkariamUrl(tab.url)) {
      showBanner('Nyisson meg egy Ikariam lapot a játék adatainak megtekintéséhez.', 'info');
      // Try to load cached data
      const cached = await chrome.runtime.sendMessage({ action: 'loadGameData' });
      if (cached && cached.gameData) {
        renderAll(cached.gameData);
        setLastUpdated(cached.lastUpdated);
      }
      return;
    }

    hideBanner();

    // Ask the content script for fresh data
    try {
      const data = await chrome.tabs.sendMessage(tab.id, { action: 'getGameData' });
      if (data) {
        renderAll(data);
        // Persist in storage
        await chrome.runtime.sendMessage({ action: 'saveGameData', data });
        return;
      }
    } catch (_err) {
      // Content script may not have injected yet (e.g. page still loading) –
      // fall through to the storage cache below.
      console.debug('[Ikariam Helper] Could not reach content script:', String(_err));
    }

    // Fall back to storage cache
    const cached = await chrome.runtime.sendMessage({ action: 'loadGameData' });
    if (cached && cached.gameData) {
      renderAll(cached.gameData);
      setLastUpdated(cached.lastUpdated);
      showBanner('Gyorsítótárból betöltve. Frissítsd az Ikariam oldalt az aktuális adatokhoz.', 'info');
    } else {
      showBanner('Nem sikerült adatot betölteni. Nyissa meg az Ikariam játékot.', 'error');
    }
  } catch (err) {
    showBanner(`Hiba: ${err.message}`, 'error');
  }
}

/* --------------------------------------------------------------------------
 * Tab switching
 * -------------------------------------------------------------------------- */

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const target = document.getElementById(tab.dataset.target);
      if (target) target.classList.add('active');
    });
  });
}

/* --------------------------------------------------------------------------
 * Init
 * -------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadData();

  document.getElementById('refresh-btn').addEventListener('click', loadData);
});
