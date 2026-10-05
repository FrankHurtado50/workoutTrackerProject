const confirmationEmail = document.getElementById("confirmationEmail");
const resendConfirmationForm = document.getElementById("resendConfirmationForm");
const resendConfirmationEmail = document.getElementById("resendConfirmationEmail");
const resendConfirmationButton = document.getElementById("resendConfirmationButton");
const resendConfirmationMessage = document.getElementById("resendConfirmationMessage");
const email = new URLSearchParams(window.location.search).get("email");

if (email) {
    confirmationEmail.textContent = ` to ${email}`;
    confirmationEmail.classList.add("auth-status-email");
    resendConfirmationEmail.value = email;
}

function setResendMessage(text, type = "error") {
    resendConfirmationMessage.textContent = text;
    resendConfirmationMessage.className = `login-message ${type}`;
}

function getFriendlyResendError(error) {
    const message = String(error && error.message || "").toLowerCase();
    if (message.includes("rate limit") || message.includes("too many")) {
        return "Please wait a little while before requesting another email, then try again.";
    }
    if (message.includes("already confirmed")) {
        return "This email is already confirmed. You can return to Log In.";
    }
    if (message.includes("fetch") || message.includes("network")) {
        return "We couldn't reach the email service. Check your connection and try again.";
    }
    return "We couldn't send a new confirmation email. Please wait a moment and try again.";
}

resendConfirmationEmail.addEventListener("input", () => {
    resendConfirmationEmail.classList.remove("invalid");
    resendConfirmationMessage.textContent = "";
    resendConfirmationMessage.className = "login-message";
});

resendConfirmationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const requestedEmail = resendConfirmationEmail.value.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail)) {
        resendConfirmationEmail.classList.add("invalid");
        setResendMessage("Please enter a valid email address.");
        return;
    }

    if (!window.workoutAuth || !window.workoutAuth.isConfigured) {
        setResendMessage("The confirmation service is unavailable right now. Please try again later.");
        return;
    }

    resendConfirmationButton.disabled = true;
    resendConfirmationButton.textContent = "Sending...";
    try {
        await window.workoutAuth.resendConfirmation(requestedEmail);
        confirmationEmail.textContent = ` to ${requestedEmail}`;
        confirmationEmail.classList.add("auth-status-email");
        setResendMessage(
            "A new confirmation email was requested. Check your inbox and spam folder, and open only the newest email.",
            "success"
        );
    } catch (error) {
        console.error("Unable to resend the confirmation email.", error);
        setResendMessage(getFriendlyResendError(error));
    } finally {
        resendConfirmationButton.disabled = false;
        resendConfirmationButton.textContent = "Resend Confirmation Email";
    }
});
