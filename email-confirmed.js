const confirmationHeading = document.getElementById("confirmationHeading");
const confirmationMessage = document.getElementById("confirmationMessage");
const confirmationAction = document.getElementById("confirmationAction");
const confirmationIcon = document.getElementById("confirmationIcon");

function getConfirmationError() {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    return hashParams.get("error_description") || queryParams.get("error_description");
}

async function initializeConfirmationPage() {
    const confirmationError = getConfirmationError();
    if (confirmationError) {
        confirmationIcon.textContent = "!";
        confirmationIcon.classList.remove("confirmed");
        confirmationHeading.textContent = "We Couldn't Confirm That Email";
        confirmationMessage.textContent = "That confirmation link has expired or was already used. Request a fresh email, then open only the newest confirmation link.";
        confirmationMessage.classList.add("auth-status-error");
        confirmationAction.textContent = "Send a New Confirmation Link";
        confirmationAction.href = "check-email.html?resend=1";
        return;
    }

    if (!window.workoutAuth || !window.workoutAuth.isConfigured) return;

    try {
        await window.workoutAuth.ready;
        const session = await window.workoutAuth.getSession();
        if (session && session.user) {
            confirmationMessage.textContent = "Your email is confirmed and you're signed in. Your workout tracker is ready.";
            confirmationAction.textContent = "Continue to Workout Tracker";
            confirmationAction.href = "welcome.html";
        }
    } catch (error) {
        console.error("Unable to check the confirmed login session.", error);
    }
}

initializeConfirmationPage();
