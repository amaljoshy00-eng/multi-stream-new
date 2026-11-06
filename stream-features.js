/* Multi Stream Hub — Viewer Ordering + Estimated Data Monitor
   Viewer ordering is stored locally. No Firebase data is modified.
*/

(() => {
  'use strict';

  const GRID_ID = 'grid';
  const STORAGE_PREFIX = 'multiStreamViewerOrder:v1:';
  const ESTIMATED_MBPS_PER_STREAM = 2;

  const MB_PER_HOUR_PER_STREAM =
    ESTIMATED_MBPS_PER_STREAM * 3600 / 8;

  const pageKey = (() => {
    const p = location.pathname.toLowerCase();

    if (p.includes('gaming')) return 'gaming';
    if (p.includes('sports')) return 'sports';
    if (p.includes('music')) return 'music';
    if (p.includes('news')) return 'news';

    return p.split('/').pop() || 'streams';
  })();

  const storageKey = STORAGE_PREFIX + pageKey;

  let grid;
  let monitor;
  let startedAt = Date.now();
  let dragged = null;
  let dragPointerId = null;
  let suppressObserver = false;
  let refreshQueued = false;

  let savedOrder = readOrder();

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

    return Array.from(grid.children).filter(
      element => element.classList.contains('card')
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
    ) return;

    suppressObserver = true;

    ordered.forEach(card => {
      grid.appendChild(card);
    });

    requestAnimationFrame(() => {
      suppressObserver = false;
    });
  }

  function makeHandle(card) {
    if (
      card.querySelector(
        ':scope > .viewer-drag-handle'
      )
    ) return;

    const handle = document.createElement('button');

    handle.type = 'button';
    handle.className = 'viewer-drag-handle';
    handle.textContent = '⠿';
    handle.title =
      'Drag to rearrange streams (only on this device)';

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

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const distance = Math.hypot(
        (x - cx) / Math.max(1, rect.width),
        (y - cy) / Math.max(1, rect.height)
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        best = card;

        before =
          y < cy ||
          (
            Math.abs(y - cy) < rect.height * 0.25 &&
            x < cx
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

    handle.setPointerCapture?.(event.pointerId);

    card.classList.add('viewer-dragging');

    document.body.classList.add(
      'viewer-reordering'
    );
  }

  function onPointerMove(event) {
    if (
      !dragged ||
      event.pointerId !== dragPointerId
    ) return;

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
    ) return;

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
    ) return;

    monitor = document.createElement('section');

    monitor.id = 'viewerDataMonitor';

    monitor.innerHTML = `
      <button
        class="vdm-toggle"
        type="button"
        aria-expanded="true"
        title="Collapse data monitor"
      >▾</button>

      <div class="vdm-content">

        <div class="vdm-heading">
          DATA USAGE <span>EST.</span>
        </div>

        <div
          class="vdm-total"
          id="vdmTotal"
        >0 MB</div>

        <div class="vdm-row">
          <span>Hourly estimate</span>
          <strong id="vdmHourly">0 MB/h</strong>
        </div>

        <div class="vdm-row">
          <span>Loaded streams</span>
          <strong id="vdmCount">0</strong>
        </div>

        <div class="vdm-note">
          Approx. 2 Mbps per stream.
          Actual usage varies by quality and platform.
        </div>

        <button
          class="vdm-reset"
          type="button"
        >Reset estimate</button>

      </div>
    `;

    document.body.appendChild(monitor);

    monitor
      .querySelector('.vdm-toggle')
      .addEventListener('click', () => {

        const collapsed =
          monitor.classList.toggle(
            'vdm-collapsed'
          );

        monitor.querySelector(
          '.vdm-toggle'
        ).textContent = collapsed ? '▴' : '▾';

        monitor.querySelector(
          '.vdm-toggle'
        ).setAttribute(
          'aria-expanded',
          String(!collapsed)
        );
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

    monitor.querySelector(
      '#vdmTotal'
    ).textContent = formatBytes(consumedMB);

    monitor.querySelector(
      '#vdmHourly'
    ).textContent =
      formatBytes(hourlyMB) + '/h';

    monitor.querySelector(
      '#vdmCount'
    ).textContent = String(count);
  }

  function installStyles() {
    if (
      document.getElementById(
        'viewerFeaturesStyles'
      )
    ) return;

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

      #viewerDataMonitor {
        position: fixed;
        z-index: 2147483000;
        right: 12px;
        bottom: 12px;
        width: 214px;
        color: #f8fafc;
        background: rgba(13,18,30,.94);
        border: 1px solid rgba(148,163,184,.35);
        border-radius: 13px;
        box-shadow: 0 8px 28px #0008;
        font: 12px/1.4 Arial,sans-serif;
        backdrop-filter: blur(12px);
      }

      #viewerDataMonitor .vdm-toggle {
        position: absolute;
        top: 6px;
        right: 7px;
        border: 0;
        background: transparent;
        color: #fff;
        font-size: 17px;
        cursor: pointer;
        padding: 2px 7px;
      }

      #viewerDataMonitor .vdm-content {
        padding: 12px 13px 11px;
      }

      #viewerDataMonitor .vdm-heading {
        color: #aab8cc;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1.2px;
      }

      #viewerDataMonitor .vdm-heading span {
        color: #7dd3fc;
        margin-left: 5px;
      }

      #viewerDataMonitor .vdm-total {
        font-size: 24px;
        font-weight: 700;
        margin: 3px 0 7px;
      }

      #viewerDataMonitor .vdm-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        color: #cbd5e1;
        margin: 4px 0;
      }

      #viewerDataMonitor .vdm-row strong {
        color: #fff;
      }

      #viewerDataMonitor .vdm-note {
        color: #94a3b8;
        font-size: 10px;
        margin: 8px 0;
      }

      #viewerDataMonitor .vdm-reset {
        width: 100%;
        border: 1px solid #475569;
        border-radius: 7px;
        padding: 6px;
        background: #1e293b;
        color: #e2e8f0;
        cursor: pointer;
      }

      #viewerDataMonitor.vdm-collapsed {
        width: 42px;
        height: 38px;
      }

      #viewerDataMonitor.vdm-collapsed .vdm-content {
        display: none;
      }

      @media(max-width:600px) {
        #viewerDataMonitor {
          right: 8px;
          bottom: 8px;
          width: 190px;
        }

        #viewerDataMonitor .vdm-total {
          font-size: 21px;
        }
      }

    `;

    document.head.appendChild(style);
  }

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
    grid = document.getElementById(GRID_ID);

    if (!grid) return false;

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
