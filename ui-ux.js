/* MULTI STREAM HUB - CENTRAL UI LOADER */

(async function loadMultiStreamSharedUI() {

    const mount = document.getElementById('shared-ui');

    if (!mount) return;

    try {

        const response = await fetch('ui-ux.html', {
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error(
                'Could not load ui-ux.html: ' + response.status
            );
        }

        const markup = await response.text();

        const parsed = new DOMParser().parseFromString(
            markup,
            'text/html'
        );

        const template = parsed.getElementById(
            'multiStreamShell'
        );

        if (!template) {
            throw new Error('Shared UI template not found.');
        }

        mount.replaceChildren(
            template.content.cloneNode(true)
        );

        const current =
            location.pathname.split('/').pop() || 'index.html';

        mount.querySelectorAll('.hub-links a').forEach(link => {

            if (link.dataset.page === current) {
                link.classList.add('active');
            }

        });

        document.documentElement.classList.add(
            'shared-ui-ready'
        );

    } catch (error) {

        console.error('Multi Stream Hub UI:', error);

        mount.innerHTML = `
            <div class="shared-ui-error">
                The shared interface could not load.
                Please refresh the page.
            </div>
        `;

    }

})();
