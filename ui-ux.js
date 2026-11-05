/* Multi Stream Hub - shared UI */

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

  function syncViewerCount() {
    const target = document.getElementById('heroOnlineCount');
    if (!target) return;

    const existingCount = document.getElementById('viewerCount');

    if (existingCount) {
      const update = () => {
        target.textContent = existingCount.textContent.trim() || '0';
      };

      update();

      new MutationObserver(update).observe(existingCount, {
        childList: true,
        characterData: true,
        subtree: true
      });

      return;
    }

    (async () => {
      try {
        await loadScript(
          'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js'
        );

        await loadScript(
          'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js'
        );

        if (!window.firebase) throw new Error('Firebase unavailable');

        if (!firebase.apps.length) {
          firebase.initializeApp(FIREBASE_CONFIG);
        }

        firebase.database().ref('users').on('value', snapshot => {
          target.textContent = String(snapshot.numChildren());
        }, error => {
          console.error('Viewer count error:', error);
          target.textContent = '—';
        });

      } catch (error) {
        console.error(error);
        target.textContent = '—';
      }
    })();
  }

  try {
    const response = await fetch('ui-ux.html', {
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error('Could not load ui-ux.html');
    }

    const markup = await response.text();

    const parsed = new DOMParser().parseFromString(
      markup,
      'text/html'
    );

    const template = parsed.getElementById('multiStreamShell');

    if (!template) {
      throw new Error('Shared UI template not found');
    }

    mount.replaceChildren(template.content.cloneNode(true));

    const current =
      location.pathname.split('/').pop() || 'index.html';

    const navLinks = mount.querySelector('.hub-links');

    if (current === 'index.html') {
      document.body.classList.add('home-page');

      if (navLinks) {
        // Remove Home navigation button.
        navLinks.querySelector('[data-page="index.html"]')?.remove();

        // Move category navigation below homepage content.
        navLinks.classList.add('home-bottom-nav');

        const homeMain = document.querySelector('.home-wrap');

        if (homeMain) {
          homeMain.insertAdjacentElement('afterend', navLinks);
        }
      }

    } else {
      mount.querySelectorAll('.hub-links a').forEach(link => {
        if (link.dataset.page === current) {
          link.classList.add('active');
        }
      });
    }

    // Admin Login only on homepage.
    const adminButton = document.getElementById('hubAdminLogin');

    if (current !== 'index.html' && adminButton) {
      adminButton.remove();
    }

    if (adminButton) {
      adminButton.addEventListener('click', () => {
        alert('Admin authentication will be connected in the admin update.');
      });
    }

    document.documentElement.classList.add('shared-ui-ready');

    syncViewerCount();

  } catch (error) {
    console.error('Multi Stream Hub UI:', error);

    mount.innerHTML =
      '<div class="shared-ui-error">The shared interface could not load. Please refresh.</div>';
  }
})();
