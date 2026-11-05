/* MULTI STREAM HUB - SHARED UI LOADER */

(async function loadMultiStreamSharedUI() {
    const mount = document.getElementById('shared-ui');
    if (!mount) return;

    // Handles both /multi-stream-new/ and /multi-stream-new/index.html.
    const lastPathPart = window.location.pathname.split('/').filter(Boolean).pop() || '';
    const isHome = lastPathPart === '' || lastPathPart === 'index.html' || !lastPathPart.includes('.');
    const currentPage = isHome ? 'index.html' : lastPathPart;

    try {
        const response = await fetch('ui-ux.html', { cache: 'no-store' });

        if (!response.ok) {
            throw new Error('Could not load ui-ux.html (' + response.status + ')');
        }

        const markup = await response.text();
        const parsed = new DOMParser().parseFromString(markup, 'text/html');
        const template = parsed.getElementById('multiStreamShell');

        if (!template) {
            throw new Error('Shared UI template was not found.');
        }

        mount.replaceChildren(template.content.cloneNode(true));

        const nav = mount.querySelector('.hub-links');
        const adminActions = mount.querySelector('.hub-nav-actions');
        const hero = mount.querySelector('.hub-hero');
        const adminButton = mount.querySelector('#hubAdminLogin');

        document.body.classList.toggle('home-page', isHome);

        if (isHome) {
            // Homepage: remove duplicate category navigation and hero.
            nav?.remove();
            hero?.remove();

            // Keep Admin Login at the top-right.
            adminActions?.classList.add('home-admin-actions');

        } else {
            // Category pages: retain navigation.
            nav?.querySelectorAll('a').forEach(link => {
                if (link.dataset.page === currentPage) {
                    link.classList.add('active');
                }
            });

            // Admin Login is homepage-only.
            adminActions?.remove();
        }

        // Preserve the existing Admin Login hook if available.
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

        // Mirror the existing viewer count on category pages.
        // This does not create or change Firebase presence records.
        const viewerElement = document.getElementById('viewerCount');
        const heroCount = document.getElementById('heroOnlineCount');

        if (viewerElement && heroCount) {
            const updateCount = () => {
                heroCount.textContent = viewerElement.textContent.trim();
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
