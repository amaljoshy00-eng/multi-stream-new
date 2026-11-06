/* ==========================================================
   MULTI STREAM HUB - ADMIN AUTHENTICATION
   Firebase v8
   ========================================================== */

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

  let admin = false;
  let observerScheduled = false;

  /* ==========================================================
     LOAD FIREBASE
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
          /^add$/i.test(
            button.textContent.trim()
          )
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
    const loginButtons = document.querySelectorAll(
      '#adminLoginButton, .admin-login-button'
    );

    loginButtons.forEach(button => {
      const text = admin
        ? '✓ Admin Logged In'
        : 'Admin Login';

      if (button.textContent.trim() !== text) {
        button.textContent = text;
      }
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
      return 'Wrong username. Please check your email address.';
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
      return 'Too many attempts. Please try again later.';
    }

    if (code === 'auth/network-request-failed') {
      return 'Network error. Check your internet connection.';
    }

    return 'Login failed. Please try again.';
  }

  /* ==========================================================
     LOGIN MODAL
     ========================================================== */

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

    const closeModal = () => modal.remove();

    modal.querySelector(
      '.hub-auth-close'
    ).addEventListener('click', closeModal);

    modal.querySelector(
      '.hub-auth-backdrop'
    ).addEventListener('click', closeModal);

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
          'Please enter your email and password.';
        return;
      }

      message.textContent = 'Signing in…';

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
            'Wrong username. This account is not the authorized administrator.';

          submitButton.disabled = false;

          return;
        }

        setAdminUI(true);

        modal.remove();

        alert(
          'Admin login successful. Stream management is now enabled.'
        );

      } catch (error) {

        message.textContent =
          getLoginErrorMessage(error);

        submitButton.disabled = false;

        console.error(
          'Admin login failed:',
          error.code || error.message
        );
      }
    });
  }

  /* ==========================================================
     LOGIN BUTTON
     ========================================================== */

  window.openAdminLogin = function () {

    if (admin) {
      if (
        confirm(
          'You are signed in as administrator. Sign out?'
        )
      ) {
        firebase.auth().signOut();
      }

      return;
    }

    addAdminModal();
  };

  /* ==========================================================
     PROTECT ADD / DELETE ACTIONS
     ========================================================== */

  function protectActions() {

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

    if (!document.__hubDeleteGuard) {

      document.addEventListener(
        'click',
        function (event) {

          const button = event.target.closest(
            'button'
          );

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

            alert(
              'Only the administrator can remove streams.'
            );
          }

        },
        true
      );

      document.__hubDeleteGuard = true;
    }

    setAdminUI(admin);
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
     START FIREBASE AUTHENTICATION
     ========================================================== */

  async function start() {

    try {

      if (
        !window.firebase ||
        !firebase.apps ||
        !firebase.apps.length
      ) {
        await loadScript(
          'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js'
        );
      }

      if (
        !window.firebase ||
        !firebase.auth
      ) {
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
        'Admin authentication could not initialize:',
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
