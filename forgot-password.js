const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const resetEmailInput = document.getElementById("resetEmail");
const sendResetButton = document.getElementById("sendResetButton");
const forgotPasswordMessage = document.getElementById("forgotPasswordMessage");

function setForgotPasswordMessage(message, type = "error") {
    forgotPasswordMessage.textContent = message;
    forgotPasswordMessage.className = `login-message ${type}`;
}

function isValidResetEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

forgotPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = resetEmailInput.value.trim();

    if (!isValidResetEmail(email)) {
        resetEmailInput.classList.add("invalid");
        setForgotPasswordMessage("Please enter a valid email address.");
        return;
    }

    sendResetButton.disabled = true;
    sendResetButton.textContent = "Sending...";
    try {
        await window.workoutAuth.requestPasswordReset(email);
        window.navigateWithTransition(`password-reset-sent.html?email=${encodeURIComponent(email)}`, "forward");
    } catch (error) {
        console.error("Unable to request a password reset.", error);
        const message = String(error && error.message || "").toLowerCase();
        setForgotPasswordMessage(
            message.includes("rate limit")
                ? "Too many reset emails were requested. Please wait a moment and try again."
                : "We couldn't send the reset email. Please check your connection and try again."
        );
        sendResetButton.disabled = false;
        sendResetButton.textContent = "Send Reset Link";
    }
});

resetEmailInput.addEventListener("input", () => {
    resetEmailInput.classList.remove("invalid");
    forgotPasswordMessage.textContent = "";
    forgotPasswordMessage.className = "login-message";
});

async function initializeForgotPasswordPage() {
    if (!window.workoutAuth || !window.workoutAuth.isConfigured) {
        sendResetButton.disabled = true;
        setForgotPasswordMessage("Online login is not configured yet.", "setup");
        return;
    }
    await window.workoutAuth.ready;
}

initializeForgotPasswordPage();
