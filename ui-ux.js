/* MULTI STREAM HUB - SHARED UI LOADER */

(async function loadMultiStreamSharedUI() {
    const mount = document.getElementById('shared-ui');
    if (!mount) return;

    const lastPathPart =
        window.location.pathname.split('/').filter(Boolean).pop() || '';

    const isHome =
        lastPathPart === '' ||
        lastPathPart === 'index.html' ||
        !lastPathPart.includes('.');

    const currentPage = isHome ? 'index.html' : lastPathPart;

    try {
        const response = await fetch('ui-ux.html', {
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error('Could not load ui-ux.html');
        }

        const markup = await response.text();
        const parsed = new DOMParser().parseFromString(markup, 'text/html');
        const template = parsed.getElementById('multiStreamShell');

        if (!template) {
            throw new Error('Shared UI template not found.');
        }

        mount.replaceChildren(template.content.cloneNode(true));

        const nav = mount.querySelector('.hub-links');
        const adminActions = mount.querySelector('.hub-nav-actions');
        const hero = mount.querySelector('.hub-hero');
        const adminButton = mount.querySelector('#hubAdminLogin');

        document.body.classList.toggle('home-page', isHome);

        if (isHome) {
            nav?.remove();
            hero?.remove();

            adminActions?.classList.add('home-admin-actions');

            // Create the live viewer counter on the homepage.
            const viewerPill = document.createElement('div');
            viewerPill.className = 'home-live-viewers';
            viewerPill.setAttribute('aria-live', 'polite');
            viewerPill.innerHTML = `
                <span class="home-live-dot"></span>
                <span>LIVE VIEWERS</span>
                <strong id="homeViewerCount">—</strong>
            `;

            const header = mount.querySelector('.hub-nav');
            if (header && adminActions) {
                header.insertBefore(viewerPill, adminActions);
            }

            // Read the existing Firebase viewer count.
            // This does not create or modify user presence records.
            loadHomeViewerCount();

        } else {
            nav?.querySelectorAll('a').forEach(link => {
                if (link.dataset.page === currentPage) {
                    link.classList.add('active');
                }
            });

            adminActions?.remove();
        }

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

        // Preserve existing category-page viewer counter.
        const viewerElement = document.getElementById('viewerCount');
        const heroCount = document.getElementById('heroOnlineCount');

        if (viewerElement && heroCount) {
            const updateCount = () => {
                heroCount.textContent =
                    viewerElement.textContent.trim();
            };

            updateCount();

            new MutationObserver(updateCount).observe(viewerElement, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

    } catch (error) {
        console.error('Multi Stream Hub UI:', error);

        mount.innerHTML =
            '<div class="shared-ui-error">The shared interface could not load. Please refresh the page.</div>';
    }
})();


/* =====================================================
   HOMEPAGE LIVE VIEWER COUNTER
   Reads the existing Firebase users collection.
   Does not write or modify presence data.
   ===================================================== */

async function loadHomeViewerCount() {
    const countElement = document.getElementById('homeViewerCount');

    if (!countElement) return;

    const firebaseConfig = {
        apiKey: "AIzaSyBTPrDoxWQEWLLHsUuJbv6cQX1vUd6lQY",
        authDomain: "multi-stream-ddb1d.firebaseapp.com",
        databaseURL: "https://multi-stream-ddb1d-default-rtdb.firebaseio.com",
        projectId: "multi-stream-ddb1d",
        appId: "1:305282777189:web:50adf19c4bbb1c8005c68c"
    };

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    try {
        if (!window.firebase) {
            await loadScript(
                'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js'
            );
        }

        if (!window.firebase.database) {
            await loadScript(
                'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js'
            );
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        const database = firebase.database();

        database.ref('users').on('value', snapshot => {
            const onlineCount = snapshot.numChildren();

            const currentElement =
                document.getElementById('homeViewerCount');

            if (currentElement) {
                currentElement.textContent = onlineCount;
            }

        }, error => {
            console.error('Viewer counter error:', error);
            countElement.textContent = '—';
        });

    } catch (error) {
        console.error('Could not load Firebase viewer count:', error);
        countElement.textContent = '—';
    }
}
