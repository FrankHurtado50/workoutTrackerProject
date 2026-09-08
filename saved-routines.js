const savedRoutinesList = document.getElementById("savedRoutinesList");

const SAVED_ROUTINES_AUTH_KEY = "workoutTrackerAuth";
const SAVED_GUEST_ROUTINES_KEY = "workoutTrackerRoutines";

function normalizeSavedRoutineEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function getSavedRoutineAuthStorage() {
    const raw = localStorage.getItem(SAVED_ROUTINES_AUTH_KEY);
    return raw ? JSON.parse(raw) : { users: {}, currentUser: null };
}

function getSavedRoutineUserKey(auth, email) {
    const normalizedEmail = normalizeSavedRoutineEmail(email);
    if (normalizedEmail in auth.users) return normalizedEmail;
    return Object.keys(auth.users).find((key) => normalizeSavedRoutineEmail(key) === normalizedEmail) || normalizedEmail;
}

function getSavedRoutines() {
    const auth = getSavedRoutineAuthStorage();
    const currentUserEmail = auth.currentUser ? auth.currentUser.email : null;

    if (currentUserEmail) {
        const userKey = getSavedRoutineUserKey(auth, currentUserEmail);
        const user = auth.users[userKey];
        return user && Array.isArray(user.routines) ? user.routines : [];
    }

    return JSON.parse(localStorage.getItem(SAVED_GUEST_ROUTINES_KEY) || "[]");
}

function renderSavedRoutines() {
    const routines = getSavedRoutines()
        .slice()
        .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));

    savedRoutinesList.innerHTML = "";

    if (!routines.length) {
        const emptyState = document.createElement("p");
        emptyState.className = "empty-state saved-routines-empty";
        emptyState.textContent = "You have not saved any routines yet.";
        savedRoutinesList.appendChild(emptyState);
        return;
    }

    routines.forEach((routine) => {
        const card = document.createElement("a");
        card.className = "saved-routine-card";
        card.href = `routine-details.html?id=${encodeURIComponent(routine.id)}`;

        const heading = document.createElement("h2");
        heading.textContent = routine.name;

        const arrow = document.createElement("span");
        arrow.className = "saved-routine-arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "›";

        card.append(heading, arrow);
        savedRoutinesList.appendChild(card);
    });
}

renderSavedRoutines();
