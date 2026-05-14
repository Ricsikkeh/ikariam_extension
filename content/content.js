/**
 * Ikariam Helper – Content Script
 *
 * Runs on all Ikariam game pages. Extracts game data (resources, build queue,
 * research, military) and injects a floating helper panel into the page.
 */

(function () {
  'use strict';

  /* -------------------------------------------------------------------------
   * Utility helpers
   * ---------------------------------------------------------------------- */

  /** Parse a localised number string like "1.234" or "1,234" into an integer. */
  function parseGameNumber(str) {
    if (!str) return 0;
    return parseInt(str.replace(/[.,\s]/g, '').replace(/[^\d]/g, ''), 10) || 0;
  }

  /** Convert a time string like "01:23:45" or "45:12" into total seconds. */
  function parseTimeString(str) {
    if (!str) return 0;
    const parts = str.trim().split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }

  /** Format seconds into a human-readable countdown string. */
  function formatTime(totalSeconds) {
    if (totalSeconds <= 0) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  }

  /** Safely query a selector and return the trimmed text content (or ''). */
  function getText(selector, context) {
    const el = (context || document).querySelector(selector);
    return el ? el.textContent.trim() : '';
  }

  /* -------------------------------------------------------------------------
   * Data extraction
   * ---------------------------------------------------------------------- */

  function extractResources() {
    return {
      gold:    parseGameNumber(getText('#js_GlobalMenu_gold') || getText('.resources .gold .value') || getText('[id*="gold"] .value') || getText('#headerGold')),
      wood:    parseGameNumber(getText('#js_GlobalMenu_wood') || getText('.resources .wood .value') || getText('[id*="wood"] .value')),
      marble:  parseGameNumber(getText('#js_GlobalMenu_stone') || getText('.resources .marble .value') || getText('[id*="stone"] .value') || getText('[id*="marble"] .value')),
      crystal: parseGameNumber(getText('#js_GlobalMenu_crystal') || getText('.resources .crystal .value') || getText('[id*="crystal"] .value')),
      sulfur:  parseGameNumber(getText('#js_GlobalMenu_sulfur') || getText('.resources .sulfur .value') || getText('[id*="sulfur"] .value')),
      wine:    parseGameNumber(getText('#js_GlobalMenu_wine') || getText('.resources .wine .value') || getText('[id*="wine"] .value')),
    };
  }

  function extractProductionRates() {
    const rates = {};
    const resourceKeys = ['gold', 'wood', 'marble', 'crystal', 'sulfur', 'wine'];
    resourceKeys.forEach(key => {
      const altKey = key === 'marble' ? 'stone' : key;
      const el = document.querySelector(
        `#js_GlobalMenu_${altKey} ~ .production,` +
        `#js_${altKey}Production,` +
        `[id*="${altKey}"] .production,` +
        `[id*="${altKey}"] .hourlyProduction`
      );
      rates[key] = el ? parseGameNumber(el.textContent) : null;
    });
    return rates;
  }

  function extractBuildQueue() {
    const queue = [];
    // Ikariam stores build queue items in a list with countdown timers
    const selectors = [
      '.buildingQueueEntry',
      '.buildingListEntry',
      '#buildingQueueList li',
      '.js_buildingQueueItem',
      '[id*="buildingUpgrade"] li',
    ];

    let items = [];
    for (const sel of selectors) {
      items = document.querySelectorAll(sel);
      if (items.length > 0) break;
    }

    items.forEach(item => {
      const nameEl = item.querySelector('.name, .buildingName, h4, h3, .title');
      const timerEl = item.querySelector('.timer, .countdown, .time, [class*="timer"]');
      const levelEl = item.querySelector('.level, .buildingLevel, [class*="level"]');

      const name = nameEl ? nameEl.textContent.trim() : '?';
      const timeStr = timerEl ? timerEl.textContent.trim() : '';
      const level = levelEl ? parseGameNumber(levelEl.textContent) : null;

      queue.push({
        name,
        level,
        timeLeft: parseTimeString(timeStr),
        timeStr,
      });
    });

    return queue;
  }

  function extractResearch() {
    const researchEl = document.querySelector(
      '#researchCurrentName, .currentResearch .name, .researchQueueEntry .name, [id*="research"] .name'
    );
    const timerEl = document.querySelector(
      '#researchCountdown, .researchTimer, .researchCountdown, [id*="research"] .timer, [id*="research"] .countdown'
    );

    if (!researchEl) return null;

    return {
      name: researchEl.textContent.trim(),
      timeLeft: timerEl ? parseTimeString(timerEl.textContent) : 0,
      timeStr: timerEl ? timerEl.textContent.trim() : '',
    };
  }

  function extractMilitary() {
    const military = {
      army: [],
      navy: [],
    };

    document.querySelectorAll('.armyEntry, .troopEntry, [class*="militaryUnit"]').forEach(el => {
      const nameEl = el.querySelector('.name, .unitName, h4');
      const countEl = el.querySelector('.count, .amount, .quantity');
      if (nameEl && countEl) {
        military.army.push({
          name: nameEl.textContent.trim(),
          count: parseGameNumber(countEl.textContent),
        });
      }
    });

    document.querySelectorAll('.navyEntry, .shipEntry, [class*="navyUnit"]').forEach(el => {
      const nameEl = el.querySelector('.name, .unitName, h4');
      const countEl = el.querySelector('.count, .amount, .quantity');
      if (nameEl && countEl) {
        military.navy.push({
          name: nameEl.textContent.trim(),
          count: parseGameNumber(countEl.textContent),
        });
      }
    });

    return military;
  }

  function extractPlayerInfo() {
    const nameEl = document.querySelector(
      '#js_playerName, .playerName, #headerPlayerName, [id*="playerName"]'
    );
    const scoreEl = document.querySelector(
      '#js_score, .playerScore, #headerScore, [id*="score"]'
    );
    const townEl = document.querySelector(
      '#js_cityName, .cityName, #headerCityName, .townName, [class*="cityName"]'
    );

    return {
      playerName: nameEl ? nameEl.textContent.trim() : '',
      score: scoreEl ? parseGameNumber(scoreEl.textContent) : 0,
      currentTown: townEl ? townEl.textContent.trim() : '',
    };
  }

  /** Gather all available data from the current page. */
  function collectGameData() {
    return {
      resources: extractResources(),
      production: extractProductionRates(),
      buildQueue: extractBuildQueue(),
      research: extractResearch(),
      military: extractMilitary(),
      playerInfo: extractPlayerInfo(),
      url: window.location.href,
      timestamp: Date.now(),
    };
  }

  /* -------------------------------------------------------------------------
   * Floating helper panel
   * ---------------------------------------------------------------------- */

  const PANEL_ID = 'ikariam-helper-panel';
  const TOGGLE_ID = 'ikariam-helper-toggle';

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    // Toggle button
    const toggle = document.createElement('button');
    toggle.id = TOGGLE_ID;
    toggle.title = 'Ikariam Helper';
    toggle.innerHTML = '⚓';
    toggle.setAttribute('aria-label', 'Ikariam Helper megnyitása / bezárása');
    document.body.appendChild(toggle);

    // Panel container
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'complementary');
    panel.setAttribute('aria-label', 'Ikariam Helper panel');
    panel.innerHTML = buildPanelHTML();
    document.body.appendChild(panel);

    toggle.addEventListener('click', () => {
      panel.classList.toggle('open');
      toggle.classList.toggle('active');
    });

    document.getElementById('ih-close-btn').addEventListener('click', () => {
      panel.classList.remove('open');
      toggle.classList.remove('active');
    });

    document.getElementById('ih-refresh-btn').addEventListener('click', () => {
      updatePanel();
    });

    // Tab switching
    panel.querySelectorAll('.ih-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        panel.querySelectorAll('.ih-tab').forEach(t => t.classList.remove('active'));
        panel.querySelectorAll('.ih-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const target = panel.querySelector(`#${tab.dataset.target}`);
        if (target) target.classList.add('active');
      });
    });

    updatePanel();
  }

  function buildPanelHTML() {
    return `
      <div class="ih-header">
        <span class="ih-title">⚓ Ikariam Helper</span>
        <button id="ih-refresh-btn" class="ih-icon-btn" title="Frissítés" aria-label="Adatok frissítése">↻</button>
        <button id="ih-close-btn" class="ih-icon-btn" title="Bezárás" aria-label="Panel bezárása">✕</button>
      </div>
      <div class="ih-tabs" role="tablist">
        <button class="ih-tab active" data-target="ih-tab-resources" role="tab" aria-selected="true">Erőforrások</button>
        <button class="ih-tab" data-target="ih-tab-build" role="tab" aria-selected="false">Építés</button>
        <button class="ih-tab" data-target="ih-tab-research" role="tab" aria-selected="false">Kutatás</button>
        <button class="ih-tab" data-target="ih-tab-military" role="tab" aria-selected="false">Katonaság</button>
      </div>
      <div class="ih-body">
        <div id="ih-tab-resources" class="ih-tab-content active" role="tabpanel">
          <div id="ih-resources">Adatok betöltése...</div>
        </div>
        <div id="ih-tab-build" class="ih-tab-content" role="tabpanel">
          <div id="ih-build-queue">Adatok betöltése...</div>
        </div>
        <div id="ih-tab-research" class="ih-tab-content" role="tabpanel">
          <div id="ih-research">Adatok betöltése...</div>
        </div>
        <div id="ih-tab-military" class="ih-tab-content" role="tabpanel">
          <div id="ih-military">Adatok betöltése...</div>
        </div>
      </div>
      <div class="ih-footer" id="ih-footer">Utolsó frissítés: –</div>
    `;
  }

  const RESOURCE_LABELS = {
    gold:    { label: 'Arany',    icon: '🪙' },
    wood:    { label: 'Fa',       icon: '🌲' },
    marble:  { label: 'Márvány',  icon: '🪨' },
    crystal: { label: 'Kristály', icon: '💎' },
    sulfur:  { label: 'Kén',      icon: '🔥' },
    wine:    { label: 'Bor',      icon: '🍷' },
  };

  function renderResources(data) {
    const el = document.getElementById('ih-resources');
    if (!el) return;

    const { resources, production, playerInfo } = data;

    let html = '';
    if (playerInfo && playerInfo.playerName) {
      html += `<div class="ih-player-info">
        <span class="ih-player-name">👤 ${escapeHtml(playerInfo.playerName)}</span>
        ${playerInfo.score ? `<span class="ih-score">🏆 ${playerInfo.score.toLocaleString()}</span>` : ''}
        ${playerInfo.currentTown ? `<span class="ih-town">🏛️ ${escapeHtml(playerInfo.currentTown)}</span>` : ''}
      </div>`;
    }

    html += '<table class="ih-resource-table"><thead><tr><th>Erőforrás</th><th>Mennyiség</th><th>/óra</th></tr></thead><tbody>';

    for (const [key, info] of Object.entries(RESOURCE_LABELS)) {
      const amount = resources[key] || 0;
      const rate = production[key];
      const rateStr = rate !== null && rate !== undefined ? rate.toLocaleString() : '–';
      html += `<tr>
        <td>${info.icon} ${info.label}</td>
        <td class="ih-amount">${amount.toLocaleString()}</td>
        <td class="ih-rate">${rateStr}</td>
      </tr>`;
    }

    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function renderBuildQueue(data) {
    const el = document.getElementById('ih-build-queue');
    if (!el) return;

    const { buildQueue } = data;

    if (!buildQueue || buildQueue.length === 0) {
      el.innerHTML = '<p class="ih-empty">Nincs aktív építkezés.</p>';
      return;
    }

    let html = '<ul class="ih-queue-list">';
    buildQueue.forEach(item => {
      const urgentClass = item.timeLeft <= 300 ? ' ih-urgent' : item.timeLeft <= 3600 ? ' ih-soon' : '';
      html += `<li class="ih-queue-item${urgentClass}">
        <span class="ih-queue-name">${escapeHtml(item.name)}${item.level !== null ? ` (Szint ${item.level})` : ''}</span>
        <span class="ih-queue-time">⏱ ${formatTime(item.timeLeft)}</span>
      </li>`;
    });
    html += '</ul>';
    el.innerHTML = html;
  }

  function renderResearch(data) {
    const el = document.getElementById('ih-research');
    if (!el) return;

    const { research } = data;

    if (!research || !research.name) {
      el.innerHTML = '<p class="ih-empty">Nincs aktív kutatás.</p>';
      return;
    }

    const urgentClass = research.timeLeft <= 300 ? ' ih-urgent' : research.timeLeft <= 3600 ? ' ih-soon' : '';
    el.innerHTML = `<div class="ih-research-item${urgentClass}">
      <div class="ih-research-name">🔬 ${escapeHtml(research.name)}</div>
      <div class="ih-research-time">⏱ ${formatTime(research.timeLeft)}</div>
    </div>`;
  }

  function renderMilitary(data) {
    const el = document.getElementById('ih-military');
    if (!el) return;

    const { military } = data;
    const hasArmy = military.army && military.army.length > 0;
    const hasNavy = military.navy && military.navy.length > 0;

    if (!hasArmy && !hasNavy) {
      el.innerHTML = '<p class="ih-empty">Nincs megjeleníthető katonai adat.</p>';
      return;
    }

    let html = '';

    if (hasArmy) {
      html += '<h4 class="ih-section-title">⚔️ Szárazföldi erők</h4><ul class="ih-unit-list">';
      military.army.forEach(unit => {
        html += `<li><span>${escapeHtml(unit.name)}</span><span class="ih-unit-count">${unit.count.toLocaleString()}</span></li>`;
      });
      html += '</ul>';
    }

    if (hasNavy) {
      html += '<h4 class="ih-section-title">⛵ Tengerészet</h4><ul class="ih-unit-list">';
      military.navy.forEach(unit => {
        html += `<li><span>${escapeHtml(unit.name)}</span><span class="ih-unit-count">${unit.count.toLocaleString()}</span></li>`;
      });
      html += '</ul>';
    }

    el.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function updatePanel() {
    const data = collectGameData();

    renderResources(data);
    renderBuildQueue(data);
    renderResearch(data);
    renderMilitary(data);

    const footer = document.getElementById('ih-footer');
    if (footer) {
      const now = new Date();
      footer.textContent = `Frissítve: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    }

    // Persist to storage for popup access
    chrome.runtime.sendMessage({ action: 'saveGameData', data });
  }

  /* -------------------------------------------------------------------------
   * Live countdown timer
   * ---------------------------------------------------------------------- */

  let countdownInterval = null;

  function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      // Decrement all displayed times by 1 second
      document.querySelectorAll('.ih-queue-time, .ih-research-time').forEach(el => {
        const text = el.textContent.replace('⏱ ', '').trim();
        const secs = parseTimeString(text);
        if (secs > 0) {
          el.textContent = '⏱ ' + formatTime(secs - 1);

          // Update urgency classes
          const parent = el.closest('.ih-queue-item, .ih-research-item');
          if (parent) {
            parent.classList.remove('ih-urgent', 'ih-soon');
            if (secs - 1 <= 300) parent.classList.add('ih-urgent');
            else if (secs - 1 <= 3600) parent.classList.add('ih-soon');
          }
        }
      });
    }, 1000);
  }

  /* -------------------------------------------------------------------------
   * Message handler (from popup / service worker)
   * ---------------------------------------------------------------------- */

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'getGameData') {
      sendResponse(collectGameData());
      return true;
    }
    if (message.action === 'refreshPanel') {
      updatePanel();
      sendResponse({ ok: true });
      return true;
    }
  });

  /* -------------------------------------------------------------------------
   * Initialisation
   * ---------------------------------------------------------------------- */

  function init() {
    createPanel();
    startCountdown();

    // Re-fetch data whenever Ikariam updates the DOM (AJAX navigation)
    const observer = new MutationObserver(() => {
      updatePanel();
    });

    // Observe only high-level containers to avoid performance issues
    const targets = [
      document.getElementById('js_GlobalMenu'),
      document.getElementById('buildingQueueList'),
      document.getElementById('researchCurrentName'),
      document.body,
    ].filter(Boolean);

    const target = targets[0] || document.body;
    observer.observe(target, { childList: true, subtree: true, characterData: true });

    // Throttle observer-triggered updates to at most once every 5 seconds
    let updateThrottle = null;
    const throttledUpdate = () => {
      if (updateThrottle) return;
      updateThrottle = setTimeout(() => {
        updatePanel();
        updateThrottle = null;
      }, 5000);
    };

    observer.disconnect();
    observer.observe(document.body, {
      childList: true,
      subtree: false,
      characterData: false,
    });

    document.body.addEventListener('DOMSubtreeModified', throttledUpdate, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
