const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginMessage = document.getElementById("loginMessage");
const loginEmailInput = document.getElementById("loginEmail");
const loginPasswordInput = document.getElementById("loginPassword");
const signupEmailInput = document.getElementById("signupEmail");
const signupFirstNameInput = document.getElementById("signupFirstName");
const signupPasswordInput = document.getElementById("signupPassword");
const signupConfirmPasswordInput = document.getElementById("signupConfirmPassword");

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

function redirectToWelcome() {
    window.location.href = "welcome.html";
}

function populateSavedCredentials() {
    const savedAccount = getSavedAccount();
    if (!savedAccount) {
        return;
    }

    loginEmailInput.value = savedAccount.email || "";
    signupEmailInput.value = savedAccount.email || "";
    signupFirstNameInput.value = savedAccount.firstName || "";
    loginPasswordInput.value = "";
    signupPasswordInput.value = "";
    signupConfirmPasswordInput.value = "";
    setMessage("Welcome back! Redirecting to your tracker.", "#166534");
    window.setTimeout(redirectToWelcome, 800);
}

function saveLogin(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const auth = getAuthStorage();
    const existingUser = auth.users[normalizedEmail];
    const legacyWorkouts = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");

    if (!existingUser) {
        return { success: false, message: "invalid Credentails" };
    }

    if (existingUser.password !== password) {
        return { success: false, message: "invalid Credentails" };
    }

    if (!existingUser.workouts?.length && legacyWorkouts.length) {
        existingUser.workouts = legacyWorkouts;
    }

    auth.currentUser = {
        email: normalizedEmail,
        password,
        firstName: existingUser.firstName || ""
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(existingUser.workouts || []));
    return { success: true, email: normalizedEmail, firstName: existingUser.firstName || "" };
}

function signUp(email, password, firstName) {
    const normalizedEmail = normalizeEmail(email);
    const auth = getAuthStorage();
    const legacyWorkouts = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");

    if (auth.users[normalizedEmail]) {
        return { success: false, message: "This email is already signed up." };
    }

    auth.users[normalizedEmail] = {
        firstName,
        password,
        workouts: legacyWorkouts.length ? legacyWorkouts : []
    };

    auth.currentUser = {
        email: normalizedEmail,
        password,
        firstName
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(auth.users[normalizedEmail].workouts || []));
    return { success: true, email: normalizedEmail, firstName };
}

function clearMessage() {
    if (loginMessage.textContent) {
        loginMessage.textContent = "";
    }
}

[loginEmailInput, loginPasswordInput, signupEmailInput, signupFirstNameInput, signupPasswordInput, signupConfirmPasswordInput].forEach((input) => {
    input.addEventListener("input", () => {
        input.style.borderColor = "#cbd5e1";
        clearMessage();
    });
});

loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value.trim();

    if (!email || !password) {
        setMessage("Please enter both your email and password.", "#b91c1c");
        loginEmailInput.style.borderColor = "#b91c1c";
        loginPasswordInput.style.borderColor = "#b91c1c";
        return;
    }

    if (!isValidEmail(email)) {
        setMessage("Please enter a valid email ending in .com.", "#b91c1c");
        loginEmailInput.style.borderColor = "#b91c1c";
        loginPasswordInput.style.borderColor = "#cbd5e1";
        return;
    }

    const loginResult = saveLogin(email, password);
    if (!loginResult.success) {
        setMessage(loginResult.message, "#b91c1c");
        loginPasswordInput.style.borderColor = "#b91c1c";
        return;
    }

    loginEmailInput.style.borderColor = "#16a34a";
    loginPasswordInput.style.borderColor = "#16a34a";
    setMessage(`Welcome ${loginResult.firstName || loginResult.email}!`, "#166534");
    redirectToWelcome();
});

signupForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = signupEmailInput.value.trim();
    const firstName = signupFirstNameInput.value.trim();
    const password = signupPasswordInput.value.trim();
    const confirmPassword = signupConfirmPasswordInput.value.trim();

    if (!firstName || !email || !password || !confirmPassword) {
        setMessage("Please fill in your first name, email, and password.", "#b91c1c");
        signupFirstNameInput.style.borderColor = "#b91c1c";
        signupEmailInput.style.borderColor = "#b91c1c";
        signupPasswordInput.style.borderColor = "#b91c1c";
        signupConfirmPasswordInput.style.borderColor = "#b91c1c";
        return;
    }

    if (!isValidEmail(email)) {
        setMessage("Please enter a valid email ending in .com.", "#b91c1c");
        signupEmailInput.style.borderColor = "#b91c1c";
        return;
    }

    if (password !== confirmPassword) {
        signupEmailInput.value = email;
        signupFirstNameInput.value = firstName;
        signupPasswordInput.value = "";
        signupConfirmPasswordInput.value = "";
        setMessage("passwords do not match", "#b91c1c");
        signupPasswordInput.style.borderColor = "#b91c1c";
        signupConfirmPasswordInput.style.borderColor = "#b91c1c";
        return;
    }

    const signupResult = signUp(email, password, firstName);
    if (!signupResult.success) {
        setMessage(signupResult.message, "#b91c1c");
        signupEmailInput.style.borderColor = "#b91c1c";
        return;
    }

    signupEmailInput.style.borderColor = "#16a34a";
    signupPasswordInput.style.borderColor = "#16a34a";
    signupConfirmPasswordInput.style.borderColor = "#16a34a";
    signupFirstNameInput.style.borderColor = "#16a34a";
    setMessage(`Welcome ${signupResult.firstName}!`, "#166534");
    redirectToWelcome();
});

populateSavedCredentials();

const savedUserEmail = getCurrentUserEmail();
if (savedUserEmail) {
    const title = document.querySelector(".welcome-card h1");
    if (title) {
        title.textContent = `Welcome ${savedUserEmail}`;
    }
}
