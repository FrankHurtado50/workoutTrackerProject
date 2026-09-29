const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginMessage = document.getElementById("loginMessage");
const loginEmailInput = document.getElementById("loginEmail");
const loginPasswordInput = document.getElementById("loginPassword");
const signupEmailInput = document.getElementById("signupEmail");
const signupFirstNameInput = document.getElementById("signupFirstName");
const signupPasswordInput = document.getElementById("signupPassword");
const signupConfirmPasswordInput = document.getElementById("signupConfirmPassword");
const loginSubmitButton = loginForm.querySelector('button[type="submit"]');
const signupSubmitButton = signupForm.querySelector('button[type="submit"]');

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function setMessage(text, type = "error") {
    loginMessage.textContent = text;
    loginMessage.className = `login-message ${type}`;
}

function clearMessage() {
    loginMessage.textContent = "";
    loginMessage.className = "login-message";
}

function setFormBusy(form, isBusy, busyText) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton.dataset.defaultText) submitButton.dataset.defaultText = submitButton.textContent;
    submitButton.disabled = isBusy;
    submitButton.textContent = isBusy ? busyText : submitButton.dataset.defaultText;
}

function redirectToWelcome() {
    window.navigateWithTransition("welcome.html", "back");
}

function getFriendlyAuthError(error) {
    const message = String(error && error.message || "").toLowerCase();
    if (message.includes("invalid login credentials")) return "The email or password is incorrect.";
    if (message.includes("email not confirmed")) return "Please confirm your email before logging in.";
    if (message.includes("user already registered")) return "This email is already signed up.";
    if (message.includes("password") && message.includes("characters")) return "Please use a password with at least 6 characters.";
    if (message.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
    if (message.includes("fetch") || message.includes("network")) return "Unable to reach the login service. Check your internet connection.";
    return error && error.message ? error.message : "Something went wrong. Please try again.";
}

[loginEmailInput, loginPasswordInput, signupEmailInput, signupFirstNameInput, signupPasswordInput, signupConfirmPasswordInput].forEach((input) => {
    input.addEventListener("input", () => {
        input.classList.remove("invalid");
        clearMessage();
    });
});

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;

    if (!email || !password) {
        setMessage("Please enter both your email and password.");
        loginEmailInput.classList.toggle("invalid", !email);
        loginPasswordInput.classList.toggle("invalid", !password);
        return;
    }

    if (!isValidEmail(email)) {
        setMessage("Please enter a valid email address.");
        loginEmailInput.classList.add("invalid");
        return;
    }

    setFormBusy(loginForm, true, "Logging In...");
    try {
        const data = await window.workoutAuth.signIn(email, password);
        const firstName = String(data.user && data.user.user_metadata && data.user.user_metadata.first_name || "").trim();
        setMessage(`Welcome ${firstName || data.user.email}!`, "success");
        redirectToWelcome();
    } catch (error) {
        loginPasswordInput.classList.add("invalid");
        setMessage(getFriendlyAuthError(error));
    } finally {
        setFormBusy(loginForm, false, "Logging In...");
    }
});

signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = signupEmailInput.value.trim();
    const firstName = signupFirstNameInput.value.trim();
    const password = signupPasswordInput.value;
    const confirmPassword = signupConfirmPasswordInput.value;

    if (!firstName || !email || !password || !confirmPassword) {
        setMessage("Please fill in your first name, email, and password.");
        signupFirstNameInput.classList.toggle("invalid", !firstName);
        signupEmailInput.classList.toggle("invalid", !email);
        signupPasswordInput.classList.toggle("invalid", !password);
        signupConfirmPasswordInput.classList.toggle("invalid", !confirmPassword);
        return;
    }

    if (!isValidEmail(email)) {
        setMessage("Please enter a valid email address.");
        signupEmailInput.classList.add("invalid");
        return;
    }

    if (password.length < 6) {
        setMessage("Please use a password with at least 6 characters.");
        signupPasswordInput.classList.add("invalid");
        return;
    }

    if (password !== confirmPassword) {
        signupPasswordInput.value = "";
        signupConfirmPasswordInput.value = "";
        signupPasswordInput.classList.add("invalid");
        signupConfirmPasswordInput.classList.add("invalid");
        setMessage("The passwords do not match.");
        return;
    }

    setFormBusy(signupForm, true, "Creating Account...");
    try {
        const data = await window.workoutAuth.signUp(email, password, firstName);
        if (data.session) {
            setMessage(`Welcome ${firstName}!`, "success");
            redirectToWelcome();
        } else {
            signupPasswordInput.value = "";
            signupConfirmPasswordInput.value = "";
            window.navigateWithTransition(`check-email.html?email=${encodeURIComponent(email)}`, "forward");
        }
    } catch (error) {
        setMessage(getFriendlyAuthError(error));
    } finally {
        setFormBusy(signupForm, false, "Creating Account...");
    }
});

async function initializeLoginPage() {
    if (!window.workoutAuth || !window.workoutAuth.isConfigured) {
        loginSubmitButton.disabled = true;
        signupSubmitButton.disabled = true;
        setMessage("Online login needs your Supabase project URL and publishable key in supabase-config.js.", "setup");
        return;
    }

    try {
        await window.workoutAuth.ready;
        const session = await window.workoutAuth.getSession();
        if (session && session.user) {
            const firstName = String(session.user.user_metadata && session.user.user_metadata.first_name || "").trim();
            setMessage(`You are already logged in${firstName ? ` as ${firstName}` : ""}. Redirecting...`, "success");
            window.setTimeout(redirectToWelcome, 500);
        }
    } catch (error) {
        setMessage(getFriendlyAuthError(error));
    }
}

initializeLoginPage();
