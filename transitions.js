(function () {
    const TRANSITION_STORAGE_KEY = "workoutTrackerTransitionDirection";
    const validDirections = new Set(["forward", "back"]);

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
