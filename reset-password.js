const resetPasswordForm = document.getElementById("resetPasswordForm");
const newPasswordInput = document.getElementById("newPassword");
const confirmNewPasswordInput = document.getElementById("confirmNewPassword");
const saveNewPasswordButton = document.getElementById("saveNewPasswordButton");
const resetPasswordHeading = document.getElementById("resetPasswordHeading");
const resetPasswordIntro = document.getElementById("resetPasswordIntro");
const resetPasswordMessage = document.getElementById("resetPasswordMessage");
const resetPasswordActions = document.getElementById("resetPasswordActions");

function setResetPasswordMessage(message, type = "error") {
    resetPasswordMessage.textContent = message;
    resetPasswordMessage.className = `login-message ${type}`;
}

function getResetLinkError() {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    return hashParams.get("error_description") || queryParams.get("error_description");
}

function showInvalidResetLink(message) {
    resetPasswordForm.hidden = true;
    resetPasswordHeading.textContent = "Reset Link Unavailable";
    resetPasswordIntro.textContent = "This password-reset link is invalid or has expired.";
    setResetPasswordMessage(message || "Request a new link from the login page.");
    resetPasswordActions.hidden = false;
}

resetPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = newPasswordInput.value;
    const confirmation = confirmNewPasswordInput.value;

    if (password.length < 6) {
        newPasswordInput.classList.add("invalid");
        setResetPasswordMessage("Please use a password with at least 6 characters.");
        return;
    }

    if (password !== confirmation) {
        newPasswordInput.classList.add("invalid");
        confirmNewPasswordInput.classList.add("invalid");
        setResetPasswordMessage("The passwords do not match.");
        return;
    }

    saveNewPasswordButton.disabled = true;
    saveNewPasswordButton.textContent = "Saving...";
    try {
        await window.workoutAuth.updatePassword(password);
        await window.workoutAuth.signOut();
        resetPasswordForm.hidden = true;
        resetPasswordHeading.textContent = "Password Updated!";
        resetPasswordIntro.textContent = "Your new password is ready. You can now log in with it.";
        setResetPasswordMessage("Your password was changed successfully.", "success");
        resetPasswordActions.hidden = false;
    } catch (error) {
        console.error("Unable to update the password.", error);
        const message = String(error && error.message || "");
        setResetPasswordMessage(message || "We couldn't update your password. Please request a new reset link.");
        saveNewPasswordButton.disabled = false;
        saveNewPasswordButton.textContent = "Save New Password";
    }
});

[newPasswordInput, confirmNewPasswordInput].forEach((input) => {
    input.addEventListener("input", () => {
        input.classList.remove("invalid");
        resetPasswordMessage.textContent = "";
        resetPasswordMessage.className = "login-message";
    });
});

async function initializeResetPasswordPage() {
    const linkError = getResetLinkError();
    if (linkError) {
        showInvalidResetLink(decodeURIComponent(linkError.replace(/\+/g, " ")));
        return;
    }

    if (!window.workoutAuth || !window.workoutAuth.isConfigured) {
        showInvalidResetLink("Online login is not configured yet.");
        return;
    }

    try {
        await window.workoutAuth.ready;
        const session = await window.workoutAuth.getSession();
        if (!window.workoutAuth.isPasswordRecovery || !session || !session.user) {
            showInvalidResetLink();
            return;
        }

        resetPasswordForm.hidden = false;
        resetPasswordMessage.textContent = "";
        newPasswordInput.focus();
    } catch (error) {
        console.error("Unable to verify the password-reset link.", error);
        showInvalidResetLink();
    }
}

initializeResetPasswordPage();
