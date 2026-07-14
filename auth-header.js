const AUTH_STORAGE_KEY = "workoutTrackerAuth";

function getAuthStorage() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { users: {}, currentUser: null };
}

function getCurrentUserEmail() {
    const auth = getAuthStorage();
    return auth.currentUser ? auth.currentUser.email : null;
}

function isLoggedIn() {
    return Boolean(getCurrentUserEmail());
}

function handleLogout() {
    const auth = getAuthStorage();
    auth.currentUser = null;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    window.location.href = "login.html";
}

function updateAuthHeader() {
    const authLink = document.querySelector(".page-header .login-button");
    if (!authLink) {
        return;
    }

    if (isLoggedIn()) {
        authLink.textContent = "Log Out";
        authLink.removeAttribute("href");
        authLink.addEventListener("click", function (event) {
            event.preventDefault();
            handleLogout();
        }, { once: true });
    } else {
        authLink.textContent = "Log In";
        authLink.setAttribute("href", "login.html");
        authLink.onclick = null;
    }
}

window.addEventListener("DOMContentLoaded", updateAuthHeader);