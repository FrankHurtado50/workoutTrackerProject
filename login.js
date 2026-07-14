const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

const AUTH_STORAGE_KEY = "workoutTrackerAuth";
const LEGACY_STORAGE_KEY = "workoutTrackerWorkouts";

function isValidEmail(email) {
    return email.includes("@") && email.toLowerCase().endsWith(".com");
}

function setMessage(text, color) {
    loginMessage.textContent = text;
    loginMessage.style.color = color;
}

function getCurrentUserEmail() {
    const auth = getAuthStorage();
    return auth.currentUser ? auth.currentUser.email : null;
}

function normalizeEmail(email) {
    return email.trim().toLowerCase();
}

function getAuthStorage() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { users: {}, currentUser: null };
}

function getSavedAccount() {
    const auth = getAuthStorage();
    return auth.currentUser ? auth.currentUser : null;
}

function redirectToTracker() {
    window.location.href = "tracker.html";
}

function populateSavedCredentials() {
    const savedAccount = getSavedAccount();
    if (!savedAccount) {
        return;
    }

    usernameInput.value = savedAccount.email || "";
    passwordInput.value = savedAccount.password || "";
    setMessage("Welcome back! Redirecting to your tracker.", "#166534");
    window.setTimeout(redirectToTracker, 800);
}

function saveLogin(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const auth = getAuthStorage();
    const existingUser = auth.users[normalizedEmail];
    const legacyWorkouts = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");

    if (existingUser && existingUser.password !== password) {
        return { success: false, message: "That password does not match this account." };
    }

    if (!existingUser) {
        auth.users[normalizedEmail] = { password, workouts: [] };
    } else {
        auth.users[normalizedEmail].password = password;
    }

    if (!auth.users[normalizedEmail].workouts?.length && legacyWorkouts.length) {
        auth.users[normalizedEmail].workouts = legacyWorkouts;
    }

    auth.currentUser = { email: normalizedEmail, password };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(auth.users[normalizedEmail].workouts || []));
    return { success: true, email: normalizedEmail };
}

usernameInput.addEventListener("input", () => {
    usernameInput.style.borderColor = "#cbd5e1";
    if (loginMessage.textContent) {
        loginMessage.textContent = "";
    }
});

passwordInput.addEventListener("input", () => {
    passwordInput.style.borderColor = "#cbd5e1";
    if (loginMessage.textContent) {
        loginMessage.textContent = "";
    }
});

loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        setMessage("Please enter both your email and password.", "#b91c1c");
        usernameInput.style.borderColor = "#b91c1c";
        passwordInput.style.borderColor = "#b91c1c";
        return;
    }

    if (!isValidEmail(username)) {
        setMessage("Please enter a valid email ending in .com.", "#b91c1c");
        usernameInput.style.borderColor = "#b91c1c";
        passwordInput.style.borderColor = "#cbd5e1";
        return;
    }

    const loginResult = saveLogin(username, password);
    if (!loginResult.success) {
        setMessage(loginResult.message, "#b91c1c");
        passwordInput.style.borderColor = "#b91c1c";
        return;
    }

    usernameInput.style.borderColor = "#16a34a";
    passwordInput.style.borderColor = "#16a34a";
    setMessage(`Welcome ${loginResult.email}!`, "#166534");
    redirectToTracker();
});

populateSavedCredentials();

const savedUserEmail = getCurrentUserEmail();
if (savedUserEmail) {
    const title = document.querySelector(".welcome-card h1");
    if (title) {
        title.textContent = `Welcome ${savedUserEmail}`;
    }
}
