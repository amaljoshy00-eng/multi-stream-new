/* Multi Stream Hub admin access — Firebase v8 */
(function () {
  'use strict';

  const ADMIN_UID = 's3fgFVeKwyUDsKYjIJu8NPdGO7f2';

  const CONFIG = {
    apiKey: 'AIzaSyBTPrDoxWQdEWLLHsUuJbv6cQX1vUd6lQY',
    authDomain: 'multi-stream-ddb1d.firebaseapp.com',
    databaseURL: 'https://multi-stream-ddb1d-default-rtdb.firebaseio.com',
    projectId: 'multi-stream-ddb1d',
    appId: '1:305282777189:web:50adf19c4bbb1c8005c68c'
  };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function isAdmin(user) {
    return !!user && user.uid === ADMIN_UID;
  }

  let admin = false;

  function setAdminUI(value) {
    admin = value;

    document.documentElement.classList.toggle(
      'admin-authenticated', value
    );

    document.documentElement.classList.toggle(
      'admin-guest', !value
    );

    document.querySelectorAll('.top-bar').forEach(bar => {
      const input = bar.querySelector('#link');

      if (input) input.hidden = !value;

      bar.querySelectorAll('button').forEach(button => {
        if (/^add$/i.test(button.textContent.trim())) {
          button.hidden = !value;
        }
      });
    });

    document.querySelectorAll(
      '[data-admin-only], .delete-stream, .delete-button'
    ).forEach(el => {
      el.hidden = !value;
    });

    document.querySelectorAll('.controls button').forEach(button => {
      if (/^(x|delete|remove)$/i.test(button.textContent.trim())) {
        button.hidden = !value;
      }
    });
  }

  function addAdminModal() {
    if (document.getElementById('hubAdminModal')) return;

    const modal = document.createElement('div');
    modal.id = 'hubAdminModal';

    modal.innerHTML = `
      <div class="hub-auth-backdrop"></div>

      <section class="hub-auth-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hubAuthTitle">

        <button class="hub-auth-close"
          type="button"
          aria-label="Close">×</button>

        <div class="hub-auth-mark">▶</div>

        <h2 id="hubAuthTitle">Administrator Login</h2>

        <p>Sign in with your authorized admin account.</p>

        <form id="hubAdminForm">

          <label>
            Email
            <input id="hubAdminEmail"
              type="email"
              autocomplete="username"
              required>
          </label>

          <label>
            Password
            <input id="hubAdminPassword"
              type="password"
              autocomplete="current-password"
              required>
          </label>

          <button class="hub-auth-submit" type="submit">
            Sign in
          </button>

          <div id="hubAuthMessage" role="status"></div>

        </form>
      </section>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.hub-auth-close').onclick =
      () => modal.remove();

    modal.querySelector('.hub-auth-backdrop').onclick =
      () => modal.remove();

    modal.querySelector('#hubAdminForm')
      .addEventListener('submit', async e => {

        e.preventDefault();

        const msg = modal.querySelector('#hubAuthMessage');

        const email =
          modal.querySelector('#hubAdminEmail').value.trim();

        const password =
          modal.querySelector('#hubAdminPassword').value;

        msg.textContent = 'Signing in…';

        try {
          const result =
            await firebase.auth().signInWithEmailAndPassword(
              email,
              password
            );

          if (!isAdmin(result.user)) {
            await firebase.auth().signOut();

            throw new Error(
              'This account is not authorized as the site administrator.'
            );
          }

          modal.remove();

          setAdminUI(true);

          alert(
            'Admin login successful. Stream management is now enabled.'
          );

        } catch (err) {
          msg.textContent =
            err.message || 'Login failed. Please try again.';
        }
      });
  }

  window.openAdminLogin = function () {
    if (admin) {
      if (confirm(
        'You are signed in as administrator. Sign out?'
      )) {
        firebase.auth().signOut();
      }

      return;
    }

    addAdminModal();
  };

  function protectActions() {

    if (
      typeof window.addStream === 'function' &&
      !window.addStream.__adminGuarded
    ) {
      const original = window.addStream;

      const guarded = function () {
        if (!admin) {
          alert('Only the administrator can add streams.');
          return;
        }

        return original.apply(this, arguments);
      };

      guarded.__adminGuarded = true;

      window.addStream = guarded;
    }

    if (!document.__hubDeleteGuard) {

      document.addEventListener('click', function (event) {

        const button = event.target.closest('button');

        if (!button) return;

        const label = button.textContent.trim();

        const looksLikeDelete =
          /^(x|✕|×|delete|remove)$/i.test(label) ||
          /delete|remove/i.test(button.title || '') ||
          button.classList.contains('delete-stream') ||
          button.classList.contains('delete-button');

        if (looksLikeDelete && !admin) {

          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          alert('Only the administrator can remove streams.');
        }

      }, true);

      document.__hubDeleteGuard = true;
    }

    setAdminUI(admin);
  }

  async function start() {
    try {

      if (!window.firebase || !firebase.apps || !firebase.apps.length) {
        await loadScript(
          'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js'
        );
      }

      if (!window.firebase || !firebase.auth) {
        await loadScript(
          'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js'
        );
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(CONFIG);
      }

      const auth = firebase.auth();

      await auth.setPersistence(
        firebase.auth.Auth.Persistence.LOCAL
      );

      auth.onAuthStateChanged(user => {
        setAdminUI(isAdmin(user));
        protectActions();
      });

      protectActions();

      new MutationObserver(protectActions).observe(
        document.body,
        {
          childList: true,
          subtree: true
        }
      );

    } catch (error) {

      console.error(
        'Admin authentication could not initialize:',
        error
      );

      setAdminUI(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
