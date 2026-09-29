const confirmationEmail = document.getElementById("confirmationEmail");
const email = new URLSearchParams(window.location.search).get("email");

if (email) {
    confirmationEmail.textContent = ` to ${email}`;
    confirmationEmail.classList.add("auth-status-email");
}
