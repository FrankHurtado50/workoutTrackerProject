(function () {
    const TRANSITION_STORAGE_KEY = "workoutTrackerTransitionDirection";
    const THEME_STORAGE_KEY = "workoutTrackerTheme";
    const validDirections = new Set(["forward", "back"]);
    const validThemes = new Set(["light", "dark"]);

    function getPreferredTheme() {
        try {
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            if (validThemes.has(savedTheme)) return savedTheme;
        } catch (error) {
            // The browser preference still provides a safe default.
        }
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    }

    function applyTheme(theme, savePreference = false) {
        const safeTheme = validThemes.has(theme) ? theme : "light";
        document.documentElement.dataset.theme = safeTheme;
        document.documentElement.style.colorScheme = safeTheme;
        if (savePreference) {
            try {
                localStorage.setItem(THEME_STORAGE_KEY, safeTheme);
            } catch (error) {
                // The theme still applies for this page when storage is unavailable.
            }
        }
        window.dispatchEvent(new CustomEvent("workout-theme-changed", { detail: { theme: safeTheme } }));
        return safeTheme;
    }

    let activeTheme = applyTheme(getPreferredTheme());

    function updateThemeToggle(button) {
        const switchingTo = activeTheme === "dark" ? "light" : "dark";
        button.innerHTML = `<span aria-hidden="true">${activeTheme === "dark" ? "&#9728;" : "&#9790;"}</span>`;
        button.setAttribute("aria-label", `Switch to ${switchingTo} mode`);
        button.title = `Switch to ${switchingTo} mode`;
        button.setAttribute("aria-pressed", String(activeTheme === "dark"));
    }

    document.addEventListener("DOMContentLoaded", function () {
        const header = document.querySelector(".page-header");
        if (!header || header.querySelector(".theme-toggle")) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "theme-toggle";
        updateThemeToggle(button);
        button.addEventListener("click", function () {
            activeTheme = applyTheme(activeTheme === "dark" ? "light" : "dark", true);
            updateThemeToggle(button);
        });
        header.appendChild(button);
    });

    window.addEventListener("storage", function (event) {
        if (event.key !== THEME_STORAGE_KEY || !validThemes.has(event.newValue)) return;
        activeTheme = applyTheme(event.newValue);
        const button = document.querySelector(".theme-toggle");
        if (button) updateThemeToggle(button);
    });

    function applyTransitionDirection(direction) {
        const safeDirection = validDirections.has(direction) ? direction : "forward";
        document.documentElement.dataset.transitionDirection = safeDirection;
        try {
            sessionStorage.setItem(TRANSITION_STORAGE_KEY, safeDirection);
        } catch (error) {
            // Navigation still works when browser storage is unavailable.
        }
    }

    let incomingDirection = null;
    try {
        incomingDirection = sessionStorage.getItem(TRANSITION_STORAGE_KEY);
    } catch (error) {
        incomingDirection = null;
    }
    if (validDirections.has(incomingDirection)) {
        document.documentElement.dataset.transitionDirection = incomingDirection;
        try {
            sessionStorage.removeItem(TRANSITION_STORAGE_KEY);
        } catch (error) {
            // The direction was still applied for this page load.
        }
    }

    window.navigateWithTransition = function (url, direction = "forward") {
        applyTransitionDirection(direction);
        window.location.href = url;
    };

    document.addEventListener("click", function (event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        const link = event.target.closest("a[href]");
        if (!link || link.target === "_blank" || link.hasAttribute("download")) {
            return;
        }

        const destination = new URL(link.href, window.location.href);
        const isCurrentPage = destination.pathname === window.location.pathname && destination.search === window.location.search;
        if (destination.origin !== window.location.origin || isCurrentPage) {
            return;
        }

        const explicitDirection = link.dataset.transitionDirection;
        const isBackNavigation =
            explicitDirection === "back" ||
            link.classList.contains("home-button") ||
            link.classList.contains("back-link") ||
            destination.pathname.endsWith("/welcome.html");

        applyTransitionDirection(isBackNavigation ? "back" : "forward");
    }, true);
})();
