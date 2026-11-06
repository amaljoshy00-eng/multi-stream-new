/* ==========================================================
   MULTI STREAM HUB
   Viewer-controlled stream ordering + data usage estimate
   Local browser changes only. No Firebase writes.
   ========================================================== */

(() => {
  'use strict';

  const GRID_ID = 'grid';
  const STORAGE_PREFIX = 'multiStreamViewerOrder:v1:';

  // Estimate only: 2 Mbps per loaded stream.
  const ESTIMATED_MBPS_PER_STREAM = 2;
  const MB_PER_HOUR_PER_STREAM =
    ESTIMATED_MBPS_PER_STREAM * 3600 / 8;

  const pageKey = (() => {
    const path = location.pathname.toLowerCase();

    if (path.includes('gaming')) return 'gaming';
    if (path.includes('sports')) return 'sports';
    if (path.includes('music')) return 'music';
    if (path.includes('news')) return 'news';

    return path.split('/').pop() || 'streams';
  })();

  const storageKey = STORAGE_PREFIX + pageKey;

  let grid = null;
  let monitor = null;
  let startedAt = Date.now();

  let dragged = null;
  let dragPointerId = null;

  let suppressObserver = false;
  let refreshQueued = false;
  let initialized = false;

  let savedOrder = readOrder();

  /* ==========================================================
     VIEWER ORDER STORAGE
     ========================================================== */

  function readOrder() {
    try {
      const value = JSON.parse(
        localStorage.getItem(storageKey) || '[]'
      );

      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function cardId(card) {
    const player = card.querySelector('.player[id]');

    return player
      ? player.id.replace(/^player-/, '')
      : '';
  }

  function cards() {
    if (!grid) return [];

    return Array.from(grid.children).filter(card =>
      card.classList.contains('card')
    );
  }

  function saveOrder() {
    const ids = cards()
      .map(cardId)
      .filter(Boolean);

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(ids)
      );
    } catch (_) {}

    savedOrder = ids;
  }

  function applyOrder() {
    if (!grid || !savedOrder.length) return;

    const current = cards();

    if (current.length < 2) return;

    const byId = new Map(
      current.map(card => [cardId(card), card])
    );

    const ordered = [];

    savedOrder.forEach(id => {
      if (byId.has(id)) {
        ordered.push(byId.get(id));
        byId.delete(id);
      }
    });

    current.forEach(card => {
      const id = cardId(card);

      if (byId.has(id)) {
        ordered.push(card);
        byId.delete(id);
      }
    });

    if (
      ordered.every(
        (card, index) => current[index] === card
      )
    ) {
      return;
    }

    suppressObserver = true;

    ordered.forEach(card => {
      grid.appendChild(card);
    });

    requestAnimationFrame(() => {
      suppressObserver = false;
    });
  }

  /* ==========================================================
     DRAG HANDLE
     ========================================================== */

  function makeHandle(card) {
    if (
      card.querySelector(
        ':scope > .viewer-drag-handle'
      )
    ) {
      return;
    }

    const handle = document.createElement('button');

    handle.type = 'button';
    handle.className = 'viewer-drag-handle';
    handle.textContent = '⠿';

    handle.title =
      'Drag to rearrange this stream';

    handle.setAttribute(
      'aria-label',
      'Drag to rearrange this stream'
    );

    card.appendChild(handle);
  }

  function nearestCard(x, y) {
    const candidates = cards().filter(
      card => card !== dragged
    );

    let best = null;
    let bestDistance = Infinity;
    let before = false;

    for (const card of candidates) {
      const rect = card.getBoundingClientRect();

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const distance = Math.hypot(
        (x - centerX) / Math.max(1, rect.width),
        (y - centerY) / Math.max(1, rect.height)
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        best = card;

        before =
          y < centerY ||
          (
            Math.abs(y - centerY) < rect.height * 0.25 &&
            x < centerX
          );
      }
    }

    return best ? { card: best, before } : null;
  }

  function onPointerDown(event) {
    const handle = event.target.closest(
      '.viewer-drag-handle'
    );

    if (!handle || !grid) return;

    const card = handle.closest('.card');

    if (!card) return;

    event.preventDefault();

    dragged = card;
    dragPointerId = event.pointerId;

    try {
      handle.setPointerCapture(event.pointerId);
    } catch (_) {}

    card.classList.add('viewer-dragging');

    document.body.classList.add(
      'viewer-reordering'
    );
  }

  function onPointerMove(event) {
    if (
      !dragged ||
      event.pointerId !== dragPointerId
    ) {
      return;
    }

    event.preventDefault();

    const target = nearestCard(
      event.clientX,
      event.clientY
    );

    if (!target) return;

    const targetCard = target.card;

    if (target.before) {
      if (dragged.nextElementSibling !== targetCard) {
        grid.insertBefore(dragged, targetCard);
      }
    } else {
      if (targetCard.nextElementSibling !== dragged) {
        grid.insertBefore(
          dragged,
          targetCard.nextElementSibling
        );
      }
    }
  }

  function endDrag(event) {
    if (!dragged) return;

    if (
      event &&
      event.pointerId !== dragPointerId
    ) {
      return;
    }

    dragged.classList.remove(
      'viewer-dragging'
    );

    dragged = null;
    dragPointerId = null;

    document.body.classList.remove(
      'viewer-reordering'
    );

    saveOrder();
    refreshMonitor();
  }

  /* ==========================================================
     DATA USAGE MONITOR
     ========================================================== */

  function formatBytes(mb) {
    if (mb >= 1024) {
      return (mb / 1024).toFixed(2) + ' GB';
    }

    return mb.toFixed(1) + ' MB';
  }

  function createMonitor() {
    if (
      document.getElementById(
        'viewerDataMonitor'
      )
    ) {
      monitor = document.getElementById(
        'viewerDataMonitor'
      );
      return;
    }

    monitor = document.createElement('section');

    monitor.id = 'viewerDataMonitor';

    monitor.innerHTML = `
      <button
        class="vdm-summary"
        type="button"
        aria-expanded="false"
        title="Show data usage details"
      >
        <span class="vdm-label">DATA</span>

        <strong id="vdmTotal">0 MB</strong>

        <span class="vdm-arrow">▾</span>
      </button>

      <div class="vdm-content">

        <div class="vdm-heading">
          DATA USAGE ESTIMATE
        </div>

        <div class="vdm-row">
          <span>Consumed</span>
          <strong id="vdmDetailTotal">0 MB</strong>
        </div>

        <div class="vdm-row">
          <span>Hourly estimate</span>
          <strong id="vdmHourly">0 MB/h</strong>
        </div>

        <div class="vdm-row">
          <span>Loaded streams</span>
          <strong id="vdmCount">0</strong>
        </div>

        <div class="vdm-note">
          Estimated only. Actual usage varies with
          video quality and streaming platform.
        </div>

        <button
          class="vdm-reset"
          type="button"
        >
          Reset estimate
        </button>

      </div>
    `;

    document.body.appendChild(monitor);

    monitor
      .querySelector('.vdm-summary')
      .addEventListener('click', () => {

        const expanded =
          monitor.classList.toggle(
            'vdm-expanded'
          );

        monitor
          .querySelector('.vdm-summary')
          .setAttribute(
            'aria-expanded',
            String(expanded)
          );

        monitor.querySelector(
          '.vdm-arrow'
        ).textContent = expanded ? '▴' : '▾';
      });

    monitor
      .querySelector('.vdm-reset')
      .addEventListener('click', () => {

        startedAt = Date.now();

        refreshMonitor();
      });

    refreshMonitor();
  }

  function refreshMonitor() {
    if (!monitor || !grid) return;

    const count = cards().length;

    const elapsedHours = Math.max(
      0,
      (Date.now() - startedAt) / 3600000
    );

    const hourlyMB =
      count * MB_PER_HOUR_PER_STREAM;

    const consumedMB =
      hourlyMB * elapsedHours;

    const total = formatBytes(consumedMB);

    const totalElement =
      monitor.querySelector('#vdmTotal');

    const detailElement =
      monitor.querySelector('#vdmDetailTotal');

    const hourlyElement =
      monitor.querySelector('#vdmHourly');

    const countElement =
      monitor.querySelector('#vdmCount');

    if (totalElement) {
      totalElement.textContent = total;
    }

    if (detailElement) {
      detailElement.textContent = total;
    }

    if (hourlyElement) {
      hourlyElement.textContent =
        formatBytes(hourlyMB) + '/h';
    }

    if (countElement) {
      countElement.textContent = String(count);
    }
  }

  /* ==========================================================
     STYLES
     ========================================================== */

  function installStyles() {
    if (
      document.getElementById(
        'viewerFeaturesStyles'
      )
    ) {
      return;
    }

    const style = document.createElement('style');

    style.id = 'viewerFeaturesStyles';

    style.textContent = `

      #grid > .card {
        position: relative;
      }

      .viewer-drag-handle {
        position: absolute;
        z-index: 30;
        top: 8px;
        left: 8px;
        width: 32px;
        height: 32px;
        border: 1px solid rgba(255,255,255,.24);
        border-radius: 9px;
        background: rgba(10,14,24,.82);
        color: #fff;
        font-size: 21px;
        line-height: 1;
        cursor: grab;
        touch-action: none;
        user-select: none;
        box-shadow: 0 2px 10px #0005;
      }

      .viewer-drag-handle:active {
        cursor: grabbing;
      }

      .viewer-dragging {
        opacity: .55 !important;
        outline: 2px dashed #60a5fa !important;
      }

      body.viewer-reordering,
      body.viewer-reordering * {
        user-select: none !important;
      }

      /* DATA MONITOR - TOP BESIDE MORE */

      #viewerDataMonitor {
        position: fixed !important;
        top: 12px !important;
        right: 105px !important;
        z-index: 2147483001 !important;
        width: 145px;
        color: #f8fafc;
        background: rgba(13,18,30,.97);
        border: 1px solid rgba(96,165,250,.45);
        border-radius: 9px;
        box-shadow: 0 4px 16px #0007;
        font: 12px/1.4 Arial,sans-serif;
        backdrop-filter: blur(10px);
      }

      #viewerDataMonitor .vdm-summary {
        width: 100%;
        min-height: 38px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 7px 9px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: white;
        cursor: pointer;
      }

      #viewerDataMonitor .vdm-label {
        color: #7dd3fc;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .5px;
      }

      #viewerDataMonitor .vdm-summary strong {
        font-size: 13px;
        white-space: nowrap;
      }

      #viewerDataMonitor .vdm-arrow {
        color: #94a3b8;
        font-size: 12px;
      }

      #viewerDataMonitor .vdm-content {
        display: none;
        padding: 10px;
        border-top: 1px solid #334155;
      }

      #viewerDataMonitor.vdm-expanded .vdm-content {
        display: block;
      }

      #viewerDataMonitor .vdm-heading {
        color: #7dd3fc;
        font-size: 10px;
        font-weight: 700;
        margin-bottom: 8px;
      }

      #viewerDataMonitor .vdm-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin: 7px 0;
        color: #cbd5e1;
        font-size: 11px;
      }

      #viewerDataMonitor .vdm-row strong {
        color: white;
        white-space: nowrap;
      }

      #viewerDataMonitor .vdm-note {
        color: #94a3b8;
        font-size: 10px;
        line-height: 1.4;
        margin: 9px 0;
      }

      #viewerDataMonitor .vdm-reset {
        width: 100%;
        padding: 7px;
        border: 1px solid #475569;
        border-radius: 6px;
        background: #1e293b;
        color: white;
        font-size: 11px;
        cursor: pointer;
      }

      @media(max-width:600px) {

        #viewerDataMonitor {
          top: 12px !important;
          right: 91px !important;
          width: 130px;
        }

        #viewerDataMonitor .vdm-summary {
          min-height: 36px;
          padding: 6px;
          gap: 4px;
        }

        #viewerDataMonitor .vdm-label {
          font-size: 9px;
        }

        #viewerDataMonitor .vdm-summary strong {
          font-size: 12px;
        }

      }

    `;

    document.head.appendChild(style);
  }

  /* ==========================================================
     INITIALIZATION
     ========================================================== */

  function enhanceCards() {
    cards().forEach(makeHandle);
  }

  function scheduleRefresh() {
    if (refreshQueued) return;

    refreshQueued = true;

    requestAnimationFrame(() => {
      refreshQueued = false;

      if (!grid) return;

      enhanceCards();
      applyOrder();
      refreshMonitor();
    });
  }

  function init() {
    if (initialized) return true;

    grid = document.getElementById(GRID_ID);

    if (!grid) return false;

    initialized = true;

    installStyles();
    createMonitor();
    enhanceCards();
    applyOrder();
    refreshMonitor();

    grid.addEventListener(
      'pointerdown',
      onPointerDown,
      { passive: false }
    );

    document.addEventListener(
      'pointermove',
      onPointerMove,
      { passive: false }
    );

    document.addEventListener(
      'pointerup',
      endDrag
    );

    document.addEventListener(
      'pointercancel',
      endDrag
    );

    const observer = new MutationObserver(() => {
      if (!suppressObserver) {
        scheduleRefresh();
      }
    });

    observer.observe(grid, {
      childList: true
    });

    setInterval(refreshMonitor, 1000);

    return true;
  }

  function boot() {
    if (init()) return;

    const wait = new MutationObserver(() => {
      if (init()) {
        wait.disconnect();
      }
    });

    wait.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true
      }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      { once: true }
    );
  } else {
    boot();
  }

})();
