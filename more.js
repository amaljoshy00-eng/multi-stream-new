/* Multi Stream Hub - shared More menu loader.
   Existing page controls are moved into this shared shell.
   Their original onclick handlers and page-specific functions remain unchanged.
*/

(() => {
  'use strict';

  async function initSharedMoreMenu() {
    const grid = document.getElementById('grid');

    if (!grid || document.getElementById('msMoreRoot')) return;

    const oldButton = document.getElementById('moreButton');
    const oldPanel = document.getElementById('morePanel');

    const controls =
      document.querySelector('.top-controls') ||
      oldPanel?.querySelector('.top-controls');

    const menu =
      document.querySelector('.menu-panel') ||
      oldPanel?.querySelector('.menu-panel');

    try {
      const response = await fetch('more.html', {
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`more.html returned ${response.status}`);
      }

      const markup = await response.text();

      const template = document.createElement('template');
      template.innerHTML = markup.trim();

      const root = template.content.querySelector('#msMoreRoot');

      if (!root) {
        throw new Error('Shared More menu template is missing #msMoreRoot');
      }

      oldButton?.remove();
      oldPanel?.remove();

     const navActions = document.querySelector('.hub-nav-actions');

if (navActions) {
  navActions.appendChild(root);

  const dataMonitor = document.getElementById('viewerDataMonitor');

  if (dataMonitor) {
    navActions.insertBefore(dataMonitor, root);
  }
} else {
  document.body.appendChild(root);
}

      const controlsSlot = root.querySelector('#moreControlsSlot');
      const gridSlot = root.querySelector('#moreGridSlot');

      if (controls) {
        controlsSlot.appendChild(controls);
      }

      if (menu) {
        gridSlot.appendChild(menu);
      }

      const button = root.querySelector('#moreButton');
      const panel = root.querySelector('#morePanel');
      const closeButton = root.querySelector('#moreCloseButton');

      const closeMenu = () => {
        panel.hidden = true;
        button.setAttribute('aria-expanded', 'false');
      };

      const toggleMenu = () => {
        panel.hidden = !panel.hidden;

        button.setAttribute(
          'aria-expanded',
          String(!panel.hidden)
        );
      };

      button.addEventListener('click', event => {
        event.stopPropagation();
        toggleMenu();
      });

      closeButton.addEventListener('click', closeMenu);

      panel.addEventListener('click', event => {
        event.stopPropagation();
      });

      document.addEventListener('click', event => {
        if (!root.contains(event.target)) {
          closeMenu();
        }
      });

      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          closeMenu();
        }
      });

      document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
          closeMenu();
        }
      });

      window.dispatchEvent(
        new CustomEvent('multistream:more-menu-ready')
      );

    } catch (error) {
      console.error(
        'Could not load the shared More menu:',
        error
      );

      // Keep the original page menu available if loading fails.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initSharedMoreMenu,
      { once: true }
    );
  } else {
    initSharedMoreMenu();
  }
})();
