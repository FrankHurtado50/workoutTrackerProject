const routineForm = document.getElementById("routineForm");
const routineNameInput = document.getElementById("routineName");
const routineExerciseList = document.getElementById("routineExerciseList");
const addRoutineExerciseButton = document.getElementById("addRoutineExercise");
const routineMessage = document.getElementById("routineMessage");

const ROUTINE_AUTH_STORAGE_KEY = "workoutTrackerAuth";
const GUEST_ROUTINES_STORAGE_KEY = "workoutTrackerRoutines";

function normalizeRoutineEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function getRoutineAuthStorage() {
    const raw = localStorage.getItem(ROUTINE_AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { users: {}, currentUser: null };
}

function getRoutineUserKey(auth, email) {
    const normalizedEmail = normalizeRoutineEmail(email);
    if (normalizedEmail in auth.users) return normalizedEmail;
    return Object.keys(auth.users).find((key) => normalizeRoutineEmail(key) === normalizedEmail) || normalizedEmail;
}

function getStoredRoutines() {
    const auth = getRoutineAuthStorage();
    const currentUserEmail = auth.currentUser ? auth.currentUser.email : null;

    if (currentUserEmail) {
        const userKey = getRoutineUserKey(auth, currentUserEmail);
        const user = auth.users[userKey];
        return user && Array.isArray(user.routines) ? user.routines : [];
    }

    return JSON.parse(localStorage.getItem(GUEST_ROUTINES_STORAGE_KEY) || "[]");
}

function saveStoredRoutines(routines) {
    const auth = getRoutineAuthStorage();
    const currentUserEmail = auth.currentUser ? auth.currentUser.email : null;

    if (currentUserEmail) {
        const userKey = getRoutineUserKey(auth, currentUserEmail);
        if (!auth.users[userKey]) auth.users[userKey] = {};
        auth.users[userKey].routines = routines;
        localStorage.setItem(ROUTINE_AUTH_STORAGE_KEY, JSON.stringify(auth));
        return;
    }

    localStorage.setItem(GUEST_ROUTINES_STORAGE_KEY, JSON.stringify(routines));
}

function createRoutineId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    return `routine-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function updateRoutineExerciseRows() {
    const rows = Array.from(routineExerciseList.querySelectorAll(".routine-exercise-row"));
    rows.forEach((row, index) => {
        const input = row.querySelector("input");
        const label = row.querySelector("label");
        const removeButton = row.querySelector(".remove-routine-exercise");
        const number = index + 1;

        input.id = `routineExercise${number}`;
        label.htmlFor = input.id;
        label.textContent = `Workout ${number}`;
        removeButton.hidden = rows.length === 1;
        removeButton.setAttribute("aria-label", `Remove workout ${number}`);
    });
}

function addRoutineExerciseField() {
    const row = document.createElement("div");
    row.className = "routine-exercise-row";
    row.innerHTML = `
        <div class="routine-exercise-field">
            <label>Workout</label>
            <input type="text" class="routine-exercise-input" maxlength="80" placeholder="Example: Lat Pulldown">
        </div>
        <button type="button" class="remove-routine-exercise" aria-label="Remove workout">&times;</button>
    `;

    row.querySelector(".remove-routine-exercise").addEventListener("click", () => {
        row.remove();
        updateRoutineExerciseRows();
    });

    routineExerciseList.appendChild(row);
    updateRoutineExerciseRows();
    row.querySelector("input").focus();
}

addRoutineExerciseButton.addEventListener("click", addRoutineExerciseField);

routineForm.addEventListener("input", () => {
    routineMessage.textContent = "";
});

routineForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const routineName = routineNameInput.value.trim();
    const exercises = Array.from(routineExerciseList.querySelectorAll(".routine-exercise-input"))
        .map((input) => input.value.trim())
        .filter(Boolean);

    if (!routineName) {
        routineMessage.textContent = "Please name your routine.";
        routineMessage.className = "routine-message error";
        routineNameInput.focus();
        return;
    }

    if (!exercises.length) {
        routineMessage.textContent = "Please add at least one workout to your routine.";
        routineMessage.className = "routine-message error";
        routineExerciseList.querySelector("input").focus();
        return;
    }

    const routines = getStoredRoutines();
    routines.push({
        id: createRoutineId(),
        name: routineName,
        exercises,
        createdAt: new Date().toISOString()
    });
    saveStoredRoutines(routines);

    routineMessage.textContent = `“${routineName}” was saved with ${exercises.length} ${exercises.length === 1 ? "workout" : "workouts"}.`;
    routineMessage.className = "routine-message success";
    routineForm.reset();
    routineExerciseList.innerHTML = "";
    addRoutineExerciseField();
    routineNameInput.focus();
});

addRoutineExerciseField();
routineNameInput.focus();
