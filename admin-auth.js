```javascript
/* ==========================================================
   MULTI STREAM HUB - ADMIN AUTHENTICATION
   Firebase v8 - Corrected version
   ========================================================== */

(function () {
  'use strict';

  const ADMIN_UID = 's3fgFVeKwyUDsKYjIJu8NPdGO7f2';

  // Matches the Firebase configuration in your HTML pages.
  const CONFIG = {
    apiKey: 'AIzaSyBF8DDDrpXWG6OMu1dvmPHvuWl_UApEE-0',
    authDomain: 'multi-stream-ddb1d.firebaseapp.com',
    databaseURL: 'https://multi-stream-ddb1d-default-rtdb.firebaseio.com',
    projectId: 'multi-stream-ddb1d',
    appId: '1:305282777189:web:50adf19c4bbb1c8005c68c'
  };

  let admin = false;
  let observerScheduled = false;

  /* ==========================================================
     LOAD FIREBASE AUTH
     ========================================================== */

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');

      script.src = src;
      script.onload = resolve;
      script.onerror = reject;

      document.head.appendChild(script);
    });
  }

  async function ensureFirebaseAuth() {
    if (!window.firebase) {
      throw new Error('Firebase SDK is not loaded.');
    }

    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(CONFIG);
    }

    if (!firebase.auth) {
      await loadScript(
        'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js'
      );
    }

    if (!firebase.auth) {
      throw new Error('Firebase Authentication failed to load.');
    }
  }

  function isAdmin(user) {
    return !!user && user.uid === ADMIN_UID;
  }

  /* ==========================================================
     ADMIN UI
     ========================================================== */

  function setAdminUI(value) {
    admin = value;

    document.documentElement.classList.toggle(
      'admin-authenticated',
      value
    );

    document.documentElement.classList.toggle(
      'admin-guest',
      !value
    );

    document.querySelectorAll('.top-bar').forEach(bar => {
      const input = bar.querySelector('#link');

      if (input) {
        input.hidden = !value;
      }

      bar.querySelectorAll('button').forEach(button => {
        if (
          /^add$/i.test(button.textContent.trim())
        ) {
          button.hidden = !value;
        }
      });
    });

    document.querySelectorAll(
      '[data-admin-only], .delete-stream, .delete-button'
    ).forEach(element => {
      element.hidden = !value;
    });

    document.querySelectorAll(
      '.controls button'
    ).forEach(button => {
      if (
        /^(x|delete|remove)$/i.test(
          button.textContent.trim()
        )
      ) {
        button.hidden = !value;
      }
    });

    updateHeader();
  }

  function updateHeader() {
    document.querySelectorAll(
      '#adminLoginButton, .admin-login-button'
    ).forEach(button => {
      button.textContent = admin
        ? '✓ Admin Logged In'
        : 'Admin Login';
    });

    let logoutButton = document.getElementById(
      'adminLogoutButton'
    );

    if (admin && !logoutButton) {
      logoutButton = document.createElement('button');

      logoutButton.id = 'adminLogoutButton';
      logoutButton.type = 'button';
      logoutButton.textContent = 'Logout';

      logoutButton.addEventListener('click', () => {
        if (
          confirm('Are you sure you want to sign out?')
        ) {
          firebase.auth().signOut();
        }
      });

      const loginButton = document.querySelector(
        '#adminLoginButton, .admin-login-button'
      );

      if (loginButton && loginButton.parentElement) {
        loginButton.parentElement.appendChild(
          logoutButton
        );
      } else {
        document.body.appendChild(logoutButton);
      }
    }

    if (logoutButton) {
      logoutButton.hidden = !admin;
    }
  }

  /* ==========================================================
     LOGIN ERROR MESSAGES
     ========================================================== */

  function getLoginErrorMessage(error) {
    const code = error.code || '';

    if (
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-email'
    ) {
      return 'Wrong username. Check your email address.';
    }

    if (code === 'auth/wrong-password') {
      return 'Wrong password. Please try again.';
    }

    if (code === 'auth/user-disabled') {
      return 'This administrator account is disabled.';
    }

    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/invalid-login-credentials'
    ) {
      return 'Wrong username or password.';
    }

    if (code === 'auth/too-many-requests') {
      return 'Too many attempts. Try again later.';
    }

    if (code === 'auth/network-request-failed') {
      return 'Network error. Check your internet connection.';
    }

    console.error('Firebase login error:', error);

    return 'Login failed: ' +
      (error.message || 'Please try again.');
  }

  /* ==========================================================
     LOGIN MODAL
     ========================================================== */

  function closeAdminModal() {
    const modal = document.getElementById(
      'hubAdminModal'
    );

    if (modal) {
      modal.remove();
    }
  }

  function addAdminModal() {
    if (
      document.getElementById('hubAdminModal')
    ) {
      return;
    }

    const modal = document.createElement('div');

    modal.id = 'hubAdminModal';

    modal.innerHTML = `
      <div class="hub-auth-backdrop"></div>

      <section
        class="hub-auth-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hubAuthTitle"
      >

        <button
          class="hub-auth-close"
          type="button"
          aria-label="Close"
        >×</button>

        <div class="hub-auth-mark">▶</div>

        <h2 id="hubAuthTitle">
          Administrator Login
        </h2>

        <p>
          Sign in with your authorized admin account.
        </p>

        <form id="hubAdminForm">

          <label>
            Email

            <input
              id="hubAdminEmail"
              type="email"
              autocomplete="username"
              required
            >
          </label>

          <label>
            Password

            <input
              id="hubAdminPassword"
              type="password"
              autocomplete="current-password"
              required
            >
          </label>

          <button
            class="hub-auth-submit"
            type="submit"
          >
            Sign in
          </button>

          <div
            id="hubAuthMessage"
            role="status"
            aria-live="polite"
          ></div>

        </form>

      </section>
    `;

    document.body.appendChild(modal);

    // Close button works for everyone.
    modal.querySelector(
      '.hub-auth-close'
    ).addEventListener('click', closeAdminModal);

    // Clicking outside the login box closes it too.
    modal.querySelector(
      '.hub-auth-backdrop'
    ).addEventListener('click', closeAdminModal);

    // Escape key closes the modal.
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeAdminModal();
      }
    });

    modal.querySelector(
      '#hubAdminForm'
    ).addEventListener('submit', async event => {

      event.preventDefault();

      const message = modal.querySelector(
        '#hubAuthMessage'
      );

      const submitButton = modal.querySelector(
        '.hub-auth-submit'
      );

      const email = modal.querySelector(
        '#hubAdminEmail'
      ).value.trim();

      const password = modal.querySelector(
        '#hubAdminPassword'
      ).value;

      if (!email || !password) {
        message.textContent =
          'Enter your email and password.';

        return;
      }

      message.textContent = 'Signing in...';

      submitButton.disabled = true;

      try {

        const result = await firebase
          .auth()
          .signInWithEmailAndPassword(
            email,
            password
          );

        if (!isAdmin(result.user)) {

          await firebase.auth().signOut();

          message.textContent =
            'This account is not authorized as the administrator.';

          submitButton.disabled = false;

          return;
        }

        setAdminUI(true);

        closeAdminModal();

        alert(
          'Admin login successful. Stream management is enabled.'
        );

      } catch (error) {

        message.textContent =
          getLoginErrorMessage(error);

        submitButton.disabled = false;
      }
    });
  }

  /* ==========================================================
     OPEN ADMIN LOGIN
     ========================================================== */

  window.openAdminLogin = function () {

    if (admin) {
      if (
        confirm('Are you sure you want to sign out?')
      ) {
        firebase.auth().signOut();
      }

      return;
    }

    addAdminModal();
  };

  /* ==========================================================
     ADD STREAM PROTECTION
     ========================================================== */

  function protectAddAction() {
    if (
      typeof window.addStream === 'function' &&
      !window.addStream.__adminGuarded
    ) {
      const original = window.addStream;

      const guarded = function () {

        if (!admin) {
          alert(
            'Only the administrator can add streams.'
          );

          return;
        }

        return original.apply(this, arguments);
      };

      guarded.__adminGuarded = true;

      window.addStream = guarded;
    }
  }

  /* ==========================================================
     DELETE PROTECTION
     ========================================================== */

  function installDeleteProtection() {

    if (document.__hubDeleteGuard) return;

    document.addEventListener(
      'click',
      function (event) {

        const button = event.target.closest('button');

        if (!button) return;

        // IMPORTANT:
        // Never treat login modal buttons as delete buttons.
        if (button.closest('#hubAdminModal')) {
          return;
        }

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

          alert(
            'Only the administrator can remove streams.'
          );
        }

      },
      true
    );

    document.__hubDeleteGuard = true;
  }

  function protectActions() {
    protectAddAction();
    installDeleteProtection();
    updateHeader();
  }

  /* ==========================================================
     SAFE MUTATION OBSERVER
     ========================================================== */

  function scheduleProtection() {
    if (observerScheduled) return;

    observerScheduled = true;

    requestAnimationFrame(() => {
      observerScheduled = false;

      protectActions();
    });
  }

  /* ==========================================================
     INITIALIZATION
     ========================================================== */

  async function start() {

    try {

      await ensureFirebaseAuth();

      const auth = firebase.auth();

      await auth.setPersistence(
        firebase.auth.Auth.Persistence.LOCAL
      );

      auth.onAuthStateChanged(user => {

        setAdminUI(isAdmin(user));

        scheduleProtection();

      });

      protectActions();

      const observer = new MutationObserver(() => {
        scheduleProtection();
      });

      observer.observe(
        document.body,
        {
          childList: true,
          subtree: true
        }
      );

    } catch (error) {

      console.error(
        'Admin authentication initialization failed:',
        error
      );

      setAdminUI(false);
    }
  }

  if (document.readyState === 'loading') {

    document.addEventListener(
      'DOMContentLoaded',
      start,
      { once: true }
    );

  } else {

    start();

  }

})();
```
