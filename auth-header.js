const HEADER_AUTH_STORAGE_KEY = "workoutTrackerAuthV2";

function getAuthStorage() {
    try {
        const parsed = JSON.parse(localStorage.getItem(HEADER_AUTH_STORAGE_KEY) || "null");
        if (parsed && parsed.users && typeof parsed.users === "object") return parsed;
    } catch (error) {
        console.warn("Unable to read the current workout profile.", error);
    }
    return { users: {}, currentUser: null };
}

function getCurrentUserEmail() {
    const auth = getAuthStorage();
    return auth.currentUser ? auth.currentUser.email : null;
}

function getCurrentUserFirstName() {
    const auth = getAuthStorage();
    return auth.currentUser ? auth.currentUser.firstName : null;
}

function isLoggedIn() {
    return Boolean(getCurrentUserEmail());
}

async function handleLogout(authLink) {
    const previousText = authLink.textContent;
    authLink.textContent = "Logging Out...";
    authLink.setAttribute("aria-disabled", "true");

    try {
        if (window.workoutAuth) await window.workoutAuth.signOut();
        window.navigateWithTransition("login.html", "forward");
    } catch (error) {
        console.error("Unable to log out.", error);
        authLink.textContent = previousText;
        authLink.removeAttribute("aria-disabled");
    }
}

function updateAuthHeader() {
    const authLink = document.querySelector(".page-header .login-button");
    if (!authLink) return;

    if (isLoggedIn()) {
        authLink.textContent = "Log Out";
        authLink.removeAttribute("href");
        authLink.onclick = (event) => {
            event.preventDefault();
            if (authLink.getAttribute("aria-disabled") !== "true") handleLogout(authLink);
        };
    } else {
        authLink.textContent = "Log In/Sign Up";
        authLink.setAttribute("href", "login.html");
        authLink.removeAttribute("aria-disabled");
        authLink.onclick = null;
    }
}

function updateWelcomeHeading() {
    const welcomeHeading = document.getElementById("welcomeHeading");
    if (!welcomeHeading) return;
    const firstName = getCurrentUserFirstName();
    welcomeHeading.textContent = firstName ? `Welcome ${firstName}` : "Welcome!";
}

function refreshAuthDisplay() {
    updateAuthHeader();
    updateWelcomeHeading();
}

window.addEventListener("DOMContentLoaded", async () => {
    refreshAuthDisplay();
    if (window.workoutAuth) {
        await window.workoutAuth.ready;
        refreshAuthDisplay();
    }
});

window.addEventListener("workout-auth-changed", refreshAuthDisplay);
