/* MULTI STREAM HUB - SHARED UI CONTROLLER */

(async function () {
    const mount = document.getElementById("shared-ui");
    if (!mount) return;

    const currentPage = location.pathname.split("/").pop() || "index.html";
    const isHome = currentPage === "index.html";

    try {
        const response = await fetch("ui-ux.html", { cache: "no-store" });

        if (!response.ok) {
            throw new Error("Unable to load ui-ux.html");
        }

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const template = doc.getElementById("multiStreamShell");

        if (!template) {
            throw new Error("Shared UI template missing");
        }

        mount.replaceChildren(template.content.cloneNode(true));

        const nav = mount.querySelector(".hub-links");
        const hero = mount.querySelector(".hub-hero");
        const admin = mount.querySelector(".hub-admin");
        const homeLink = nav?.querySelector('[data-page="index.html"]');

        document.body.classList.toggle("home-page", isHome);

        // Homepage settings
        if (isHome) {

            // Remove Home button
            homeLink?.remove();

            // Hide duplicate Live Multi-Stream heading
            hero?.remove();

            // Remove duplicate footer title
            document.querySelector(".footer-line")?.remove();

            // Keep Admin Login only on homepage
            if (nav) {
                nav.classList.add("home-bottom-nav");

                // Arrange buttons in requested order
                const order = [
                    "gaming.html",
                    "news.html",
                    "sports.html",
                    "music.html"
                ];

                order.forEach(page => {
                    const link = nav.querySelector(`[data-page="${page}"]`);
                    if (link) nav.appendChild(link);
                });

                // Move category navigation below the category cards
                const homeMain = document.querySelector(".home-wrap");

                if (homeMain) {
                    homeMain.insertAdjacentElement("afterend", nav);
                }
            }

        } else {

            // Hide Admin Login on category pages
            admin?.remove();

            // Active navigation
            nav?.querySelectorAll("a").forEach(link => {
                if (link.dataset.page === currentPage) {
                    link.classList.add("active");
                }
            });
        }

        document.documentElement.classList.add("shared-ui-ready");

        // Viewer count on category pages
        const viewerElement = document.getElementById("viewerCount");
        const heroCount = document.getElementById("heroOnlineCount");

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

        // Homepage viewer count
        if (isHome) {
            loadHomepageViewerCount();
        }

    } catch (error) {
        console.error("Multi Stream Hub UI error:", error);

        mount.innerHTML =
            '<div class="shared-ui-error">Unable to load the shared interface. Please refresh.</div>';
    }

})();


/* Homepage viewer count - reads existing Firebase users */
function loadHomepageViewerCount() {

    const countElement = document.getElementById("heroOnlineCount");

    if (!countElement) return;

    const firebaseConfig = {
        apiKey: "AIzaSyBTPrDoxWQdEWLLHsUuJbv6cQX1vUd6lQY",
        authDomain: "multi-stream-ddb1d.firebaseapp.com",
        databaseURL: "https://multi-stream-ddb1d-default-rtdb.firebaseio.com",
        projectId: "multi-stream-ddb1d",
        appId: "1:305282777189:web:50adf19c4bbb1c8005c68c"
    };

    function startFirebase() {

        if (typeof firebase === "undefined") {
            countElement.textContent = "—";
            return;
        }

        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            firebase.database().ref("users").on("value", snapshot => {
                countElement.textContent = snapshot.numChildren();
            });

        } catch (error) {
            console.error("Viewer count error:", error);
            countElement.textContent = "—";
        }
    }

    if (typeof firebase !== "undefined") {
        startFirebase();
        return;
    }

    const script = document.createElement("script");
    script.src = "https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js";

    script.onload = () => {
        const databaseScript = document.createElement("script");

        databaseScript.src =
            "https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js";

        databaseScript.onload = startFirebase;
        document.head.appendChild(databaseScript);
    };

    document.head.appendChild(script);
}
