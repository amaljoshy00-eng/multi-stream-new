/* Multi Stream Hub — viewer stream ordering + estimated data usage
   Estimated usage is a calculation, not a measurement of actual network traffic.
   Viewer ordering and usage totals are stored locally on this device.
*/
(() => {
  'use strict';

  const GRID_ID = 'grid';
  const ORDER_PREFIX = 'multiStreamViewerOrder:v2:';
  const USAGE_KEY = 'multiStreamEstimatedUsage:v1';
  const ESTIMATED_MBPS_PER_STREAM = 2;
  const MB_PER_SECOND_PER_STREAM = ESTIMATED_MBPS_PER_STREAM / 8;

  const pageKey = (() => {
    const name = location.pathname.toLowerCase().split('/').pop() || 'streams';
    return name.replace(/\.html?$/, '') || 'streams';
  })();

  const orderKey = ORDER_PREFIX + pageKey;
  let grid = null;
  let monitor = null;
  let dragged = null;
  let dragPointerId = null;
  let savedOrder = readOrder();
  let lastUsageAt = Date.now();
  let usageMB = readUsage();
  let refreshQueued = false;
  let observer = null;

  function readOrder() {
    try {
      const value = JSON.parse(localStorage.getItem(orderKey) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function readUsage() {
    try {
      const data = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
      return Number.isFinite(data.totalMB) ? data.totalMB : 0;
    } catch (_) { return 0; }
  }

  function writeUsage() {
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify({
        totalMB: usageMB,
        updatedAt: Date.now()
      }));
    } catch (_) {}
  }

  function streamCount() {
    return grid ? Array.from(grid.children).filter(el =>
      el.classList.contains('card') &&
      getComputedStyle(el).display !== 'none'
    ).length : 0;
  }

  function updateUsage() {
    const now = Date.now();
    const elapsedSeconds = Math.max(0, (now - lastUsageAt) / 1000);
    usageMB += elapsedSeconds * streamCount() * MB_PER_SECOND_PER_STREAM;
    lastUsageAt = now;
    writeUsage();
  }

  function formatData(mb) {
    if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
    return mb.toFixed(1) + ' MB';
  }

  function getCardId(card) {
    const player = card.querySelector('.player[id]');
    return player ? player.id.replace(/^player-/, '') : '';
  }

  function cards() {
    return grid ? Array.from(grid.children).filter(el =>
      el.classList.contains('card')
    ) : [];
  }

  function saveOrder() {
    savedOrder = cards().map(getCardId).filter(Boolean);
    try { localStorage.setItem(orderKey, JSON.stringify(savedOrder)); } catch (_) {}
  }

  function applyOrder() {
    if (!grid || !savedOrder.length) return;
    const current = cards();
    const byId = new Map(current.map(card => [getCardId(card), card]));
    const ordered = [];

    savedOrder.forEach(id => {
      if (byId.has(id)) {
        ordered.push(byId.get(id));
        byId.delete(id);
      }
    });

    current.forEach(card => {
      const id = getCardId(card);
      if (byId.has(id)) {
        ordered.push(card);
        byId.delete(id);
      }
    });

    if (ordered.length !== current.length) return;
    ordered.forEach(card => grid.appendChild(card));
  }

  function addDragHandle(card) {
    if (card.querySelector(':scope > .viewer-drag-handle')) return;

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'viewer-drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to rearrange streams on this device';
    handle.setAttribute('aria-label', 'Drag to rearrange stream');
    card.appendChild(handle);
  }

  function nearestCard(x, y) {
    let best = null;
    let bestDistance = Infinity;
    let insertBefore = false;

    cards().filter(card => card !== dragged).forEach(card => {
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
        insertBefore = y < cy || (Math.abs(y - cy) < rect.height * .2 && x < cx);
      }
    });

    return best ? { card: best, insertBefore } : null;
  }

  function pointerDown(event) {
    const handle = event.target.closest('.viewer-drag-handle');
    if (!handle || !grid) return;

    const card = handle.closest('.card');
    if (!card) return;

    event.preventDefault();
    dragged = card;
    dragPointerId = event.pointerId;

    try { handle.setPointerCapture(event.pointerId); } catch (_) {}

    card.classList.add('viewer-dragging');
    document.body.classList.add('viewer-reordering');
  }

  function pointerMove(event) {
    if (!dragged || event.pointerId !== dragPointerId) return;

    event.preventDefault();

    const target = nearestCard(event.clientX, event.clientY);
    if (!target) return;

    if (target.insertBefore) {
      if (dragged.nextElementSibling !== target.card) {
        grid.insertBefore(dragged, target.card);
      }
    } else if (target.card.nextElementSibling !== dragged) {
      grid.insertBefore(dragged, target.card.nextElementSibling);
    }
  }

  function pointerEnd(event) {
    if (!dragged || (event && event.pointerId !== dragPointerId)) return;

    dragged.classList.remove('viewer-dragging');
    dragged = null;
    dragPointerId = null;

    document.body.classList.remove('viewer-reordering');

    saveOrder();
    updateMonitor();
  }

  function installStyles() {
    if (document.getElementById('viewerFeaturesStyles')) return;

    const style = document.createElement('style');
    style.id = 'viewerFeaturesStyles';

    style.textContent = `
      #grid > .card { position:relative; }

      .viewer-drag-handle {
        position:absolute; z-index:30; top:8px; left:8px;
        width:32px; height:32px; border:1px solid #ffffff40;
        border-radius:9px; background:#0a0e18d9; color:#fff;
        font-size:21px; cursor:grab; touch-action:none;
      }

      .viewer-dragging {
        opacity:.55 !important;
        outline:2px dashed #60a5fa !important;
      }

      body.viewer-reordering,
      body.viewer-reordering * {
        user-select:none !important;
      }

      #viewerDataMonitor {
        position:fixed; z-index:2147483002; top:12px; right:112px;
        width:auto; min-width:108px; max-width:185px; box-sizing:border-box;
        color:#f8fafc; background:rgba(13,18,30,.96);
        border:1px solid rgba(148,163,184,.38); border-radius:11px;
        box-shadow:0 6px 22px #0007; font:12px/1.35 Arial,sans-serif;
        backdrop-filter:blur(12px); overflow:hidden;
      }

      #viewerDataMonitor .vdm-head {
        display:flex; align-items:center; gap:7px; padding:8px 9px;
      }

      #viewerDataMonitor .vdm-label {
        color:#aab8cc; font-size:9px; font-weight:700;
        letter-spacing:1px; white-space:nowrap;
      }

      #viewerDataMonitor .vdm-total {
        color:#fff; font-size:15px; font-weight:800;
        white-space:nowrap;
      }

      #viewerDataMonitor .vdm-toggle {
        margin-left:auto; padding:0 2px; border:0;
        background:transparent; color:#fff;
        font-size:15px; cursor:pointer; line-height:1;
      }

      #viewerDataMonitor .vdm-details {
        display:none; padding:0 10px 10px;
        border-top:1px solid #ffffff16;
      }

      #viewerDataMonitor.vdm-expanded .vdm-details {
        display:block;
      }

      #viewerDataMonitor .vdm-row {
        display:flex; justify-content:space-between; gap:12px;
        margin-top:7px; color:#cbd5e1; font-size:11px;
      }

      #viewerDataMonitor .vdm-row strong {
        color:#fff; white-space:nowrap;
      }

      #viewerDataMonitor .vdm-note {
        margin-top:8px; color:#94a3b8;
        font-size:9px; line-height:1.35;
      }

      @media(max-width:700px) {
        #viewerDataMonitor {
          top:7px; right:92px;
          min-width:94px; max-width:150px;
        }

        #viewerDataMonitor .vdm-head {
          padding:7px 8px; gap:6px;
        }

        #viewerDataMonitor .vdm-total {
          font-size:14px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createMonitor() {
    if (document.getElementById('viewerDataMonitor')) {
      monitor = document.getElementById('viewerDataMonitor');
      return;
    }

    monitor = document.createElement('section');
    monitor.id = 'viewerDataMonitor';

    // Start minimized on every page entry.
    monitor.innerHTML = `
      <div class="vdm-head">
        <span class="vdm-label">DATA</span>
        <strong class="vdm-total" id="vdmTotal">0 MB</strong>
        <button class="vdm-toggle" type="button"
          aria-label="Show data usage details" aria-expanded="false">▾</button>
      </div>

      <div class="vdm-details">
        <div class="vdm-row">
          <span>Estimated total</span>
          <strong id="vdmTotalDetail">0 MB</strong>
        </div>

        <div class="vdm-row">
          <span>Hourly estimate</span>
          <strong id="vdmHourly">0 MB/h</strong>
        </div>

        <div class="vdm-row">
          <span>Active streams</span>
          <strong id="vdmCount">0</strong>
        </div>

        <div class="vdm-note">
          Estimate only: assumes about 2 Mbps per visible stream.
          Actual network usage may differ.
        </div>
      </div>
    `;

    document.body.appendChild(monitor);

    monitor.querySelector('.vdm-toggle').addEventListener('click', () => {
      const expanded = monitor.classList.toggle('vdm-expanded');
      const button = monitor.querySelector('.vdm-toggle');

      button.textContent = expanded ? '▴' : '▾';
      button.setAttribute('aria-expanded', String(expanded));

      button.setAttribute(
        'aria-label',
        expanded ? 'Hide data usage details' : 'Show data usage details'
      );
    });
  }

  function updateMonitor() {
    if (!monitor || !grid) return;

    updateUsage();

    const count = streamCount();
    const total = formatData(usageMB);
    const hourly = formatData(
      count * MB_PER_SECOND_PER_STREAM * 3600
    ) + '/h';

    monitor.querySelector('#vdmTotal').textContent = total;
    monitor.querySelector('#vdmTotalDetail').textContent = total;
    monitor.querySelector('#vdmHourly').textContent = hourly;
    monitor.querySelector('#vdmCount').textContent = String(count);
  }

  function scheduleRefresh() {
    if (refreshQueued) return;

    refreshQueued = true;

    requestAnimationFrame(() => {
      refreshQueued = false;
      cards().forEach(addDragHandle);
      updateMonitor();
    });
  }

  function init() {
    grid = document.getElementById(GRID_ID);
    if (!grid) return false;

    installStyles();
    createMonitor();

    cards().forEach(addDragHandle);
    applyOrder();
    updateMonitor();

    grid.addEventListener('pointerdown', pointerDown, { passive:false });
    document.addEventListener('pointermove', pointerMove, { passive:false });
    document.addEventListener('pointerup', pointerEnd);
    document.addEventListener('pointercancel', pointerEnd);

    observer = new MutationObserver(scheduleRefresh);
    observer.observe(grid, { childList:true });

    window.addEventListener('pagehide', () => {
      updateUsage();
      writeUsage();
    });

    setInterval(updateMonitor, 1000);
    return true;
  }

  function boot() {
    if (init()) return;

    const wait = new MutationObserver(() => {
      if (init()) wait.disconnect();
    });

    wait.observe(document.documentElement, {
      childList:true,
      subtree:true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();


/* Multi Stream Hub — shared More menu loader */
(() => {
  'use strict';

  // Prevent duplicate loading if this file is included more than once.
  if (window.multiStreamMoreLoaderStarted) return;
  window.multiStreamMoreLoaderStarted = true;

  // Resolve assets relative to the current page URL.
  const moreCssUrl = new URL('more.css', document.baseURI).href;
  const moreJsUrl = new URL('more.js', document.baseURI).href;

  // Load the shared More menu stylesheet once.
  if (!document.querySelector('link[data-multistream-more-css]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = moreCssUrl;
    css.setAttribute('data-multistream-more-css', 'true');

    css.onload = () => {
      console.log('Multi Stream: more.css loaded.');
    };

    css.onerror = () => {
      console.error('Multi Stream: failed to load more.css:', moreCssUrl);
    };

    document.head.appendChild(css);
  }

  // Load the shared More menu script once.
  if (!document.querySelector('script[data-multistream-more-js]')) {
    const script = document.createElement('script');
    script.src = moreJsUrl;
    script.async = true;
    script.setAttribute('data-multistream-more-js', 'true');

    script.onload = () => {
      console.log('Multi Stream: more.js loaded.');
    };

    script.onerror = () => {
      console.error('Multi Stream: failed to load more.js:', moreJsUrl);
    };

    (document.head || document.body || document.documentElement)
      .appendChild(script);
  }
})();
