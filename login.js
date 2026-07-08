const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

function isValidEmail(email) {
    return email.includes("@") && email.toLowerCase().endsWith(".com");
}

function setMessage(text, color) {
    loginMessage.textContent = text;
    loginMessage.style.color = color;
}

usernameInput.addEventListener("input", () => {
    usernameInput.style.borderColor = "#cbd5e1";
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

    usernameInput.style.borderColor = "#16a34a";
    passwordInput.style.borderColor = "#16a34a";
    setMessage("Log in successful", "#166534");
});
