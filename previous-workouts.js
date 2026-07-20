const previousWorkoutList = document.getElementById("previousWorkoutList");

const AUTH_STORAGE_KEY = "workoutTrackerAuth";
const LEGACY_STORAGE_KEY = "workoutTrackerWorkouts";

function getAuthStorage() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { users: {}, currentUser: null };
}

function getCurrentUserEmail() {
    const auth = getAuthStorage();
    return auth.currentUser ? auth.currentUser.email : null;
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function getUserStorageKey(auth, email) {
    const normalizedEmail = normalizeEmail(email);

    if (normalizedEmail in auth.users) {
        return normalizedEmail;
    }

    return Object.keys(auth.users).find((key) => normalizeEmail(key) === normalizedEmail) || normalizedEmail;
}

function ensureUserWorkoutRecord(auth, currentUserEmail) {
    const legacyWorkouts = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");

    if (!auth.users[currentUserEmail]) {
        auth.users[currentUserEmail] = {
            workouts: legacyWorkouts
        };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
        return;
    }

    if (!Array.isArray(auth.users[currentUserEmail].workouts)) {
        auth.users[currentUserEmail].workouts = legacyWorkouts;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    }
}

function getStoredWorkouts() {
    const auth = getAuthStorage();
    const currentUserEmail = getCurrentUserEmail();

    if (currentUserEmail) {
        const userKey = getUserStorageKey(auth, currentUserEmail);
        ensureUserWorkoutRecord(auth, userKey);
        return auth.users[userKey].workouts || [];
    }

    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
}

function getLatestWorkouts() {
    const workouts = getStoredWorkouts();
    const latestByExercise = workouts.reduce((acc, workout) => {
        const key = workout.exercise.trim().toLowerCase();
        const current = acc[key];

        if (!current || new Date(workout.recordedAt) > new Date(current.recordedAt)) {
            acc[key] = workout;
        }

        return acc;
    }, {});

    return Object.values(latestByExercise);
}

function renderPreviousWorkouts() {
    const workouts = getLatestWorkouts();

    if (!workouts.length) {
        previousWorkoutList.innerHTML = '<p class="empty-state">No workouts saved yet.</p>';
        return;
    }

    previousWorkoutList.innerHTML = "";

    workouts.forEach((workout) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "workout-button";
        button.innerText = `${workout.exercise} — ${workout.total} lbs`;

        button.addEventListener("click", () => {
            const params = new URLSearchParams({
                mode: "previous",
                template: JSON.stringify(workout)
            });
            window.location.href = `tracker.html?${params.toString()}`;
        });

        previousWorkoutList.appendChild(button);
    });
}

renderPreviousWorkouts();
