const resetEmailDestination = document.getElementById("resetEmailDestination");
const resetEmail = new URLSearchParams(window.location.search).get("email");

if (resetEmail) {
    resetEmailDestination.textContent = ` for ${resetEmail}`;
    resetEmailDestination.classList.add("auth-status-email");
}
