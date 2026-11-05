/* Multi Stream Hub - shared UI loader and live viewer count */

(async function loadMultiStreamSharedUI() {
  const mount = document.getElementById('shared-ui');
  if (!mount) return;

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBTPrDoxWQdEWLLHsUuJbv6cQX1vUd6lQY',
    authDomain: 'multi-stream-ddb1d.firebaseapp.com',
    databaseURL: 'https://multi-stream-ddb1d-default-rtdb.firebaseio.com',
    projectId: 'multi-stream-ddb1d',
    appId: '1:305282777189:web:50adf19c4bbb1c8005c68c'
  };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(s => s.src === src);

      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function startHomepageViewerCount() {
    const target = document.getElementById('homeViewerCount');
    if (!target) return;

    try {
      await loadScript(
        'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js'
      );

      await loadScript(
        'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js'
      );

      if (!window.firebase) {
        throw new Error('Firebase SDK unavailable');
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }

      firebase.database().ref('users').on('value', snapshot => {
        const liveTarget = document.getElementById('homeViewerCount');

        if (liveTarget) {
          liveTarget.textContent = String(snapshot.numChildren());
        }

      }, error => {
        console.error('Homepage viewer count:', error);
        target.textContent = '—';
      });

    } catch (error) {
      console.error('Homepage viewer count:', error);
      target.textContent = '—';
    }
  }

  try {
    const response = await fetch('ui-ux.html', {
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error(
        'Could not load ui-ux.html (' + response.status + ')'
      );
    }

    const markup = await response.text();

    const parsed = new DOMParser().parseFromString(
      markup,
      'text/html'
    );

    const template = parsed.getElementById('multiStreamShell');

    if (!template) {
      throw new Error('Shared UI template was not found.');
    }

    mount.replaceChildren(template.content.cloneNode(true));

    const current =
      location.pathname.split('/').filter(Boolean).pop() || 'index.html';

    const isHome =
      current === 'index.html' || !current.includes('.');

    document.body.classList.toggle('home-page', isHome);

    const nav = mount.querySelector('.hub-links');
    const hero = mount.querySelector('.hub-hero');
    const adminActions = mount.querySelector('.hub-nav-actions');

    if (isHome) {
      nav?.remove();
      hero?.remove();

      // Live viewer counter beside Admin Login.
      const pill = document.createElement('div');

      pill.className = 'home-live-viewers';
      pill.setAttribute('aria-live', 'polite');

      pill.innerHTML =
        '<i class="home-live-dot" aria-hidden="true"></i>' +
        '<span>LIVE VIEWERS</span>' +
        '<strong id="homeViewerCount">—</strong>';

      if (adminActions) {
        mount.querySelector('.hub-nav')?.insertBefore(
          pill,
          adminActions
        );
      }

      startHomepageViewerCount();

    } else {
      nav?.querySelectorAll('a').forEach(link => {
        if (link.dataset.page === current) {
          link.classList.add('active');
        }
      });

      adminActions?.remove();
    }

    const adminButton = mount.querySelector('#hubAdminLogin');

    if (adminButton) {
      adminButton.addEventListener('click', () => {
        if (typeof window.openAdminLogin === 'function') {
          window.openAdminLogin();
        } else {
          alert('Admin login is not configured yet.');
        }
      });
    }

    document.documentElement.classList.add('shared-ui-ready');

    // Category pages: mirror their existing viewer count.
    // Do not create additional presence records.
    const existingCount = document.getElementById('viewerCount');
    const heroCount = document.getElementById('heroOnlineCount');

    if (existingCount && heroCount) {
      const update = () => {
        heroCount.textContent =
          existingCount.textContent.trim() || '0';
      };

      update();

      new MutationObserver(update).observe(existingCount, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }

  } catch (error) {
    console.error('Multi Stream Hub UI:', error);

    mount.innerHTML =
      '<div class="shared-ui-error">' +
      'The shared interface could not load. Please refresh the page.' +
      '</div>';
  }
})();
