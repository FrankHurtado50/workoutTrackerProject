const routineWorkoutForm = document.getElementById("routineWorkoutForm");
const routineWorkoutColumns = document.getElementById("routineWorkoutColumns");
const routineEntryTitle = document.getElementById("routineEntryTitle");
const routineEntryEmpty = document.getElementById("routineEntryEmpty");
const routineEntryMessage = document.getElementById("routineEntryMessage");
const saveRoutineWorkoutsButton = document.getElementById("saveRoutineWorkouts");
const backToRoutine = document.getElementById("backToRoutine");

const ROUTINE_ENTRY_AUTH_KEY = "workoutTrackerAuth";
const ROUTINE_ENTRY_GUEST_ROUTINES_KEY = "workoutTrackerRoutines";
const ROUTINE_ENTRY_GUEST_PROGRESS_KEY = "workoutTrackerRoutineProgress";
const ROUTINE_ENTRY_WORKOUTS_KEY = "workoutTrackerWorkouts";

function normalizeRoutineEntryEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function getRoutineEntryAuth() {
    const raw = localStorage.getItem(ROUTINE_ENTRY_AUTH_KEY);
    return raw ? JSON.parse(raw) : { users: {}, currentUser: null };
}

function getRoutineEntryUserKey(auth, email) {
    const normalizedEmail = normalizeRoutineEntryEmail(email);
    if (normalizedEmail in auth.users) return normalizedEmail;
    return Object.keys(auth.users).find((key) => normalizeRoutineEntryEmail(key) === normalizedEmail) || normalizedEmail;
}

function getRoutineEntryContext() {
    const auth = getRoutineEntryAuth();
    const email = auth.currentUser ? auth.currentUser.email : null;

    if (email) {
        const userKey = getRoutineEntryUserKey(auth, email);
        const user = auth.users[userKey];
        return {
            routines: user && Array.isArray(user.routines) ? user.routines : [],
            progress: user && user.routineProgress ? user.routineProgress : {}
        };
    }

    return {
        routines: JSON.parse(localStorage.getItem(ROUTINE_ENTRY_GUEST_ROUTINES_KEY) || "[]"),
        progress: JSON.parse(localStorage.getItem(ROUTINE_ENTRY_GUEST_PROGRESS_KEY) || "{}")
    };
}

function createRoutineWorkoutId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    return `workout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getTodayKey() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function saveRoutineWorkouts(newWorkouts) {
    const auth = getRoutineEntryAuth();
    const email = auth.currentUser ? auth.currentUser.email : null;
    const guestWorkouts = JSON.parse(localStorage.getItem(ROUTINE_ENTRY_WORKOUTS_KEY) || "[]");

    if (email) {
        const userKey = getRoutineEntryUserKey(auth, email);
        if (!auth.users[userKey]) auth.users[userKey] = {};
        const existingWorkouts = Array.isArray(auth.users[userKey].workouts)
            ? auth.users[userKey].workouts
            : [];
        const workouts = existingWorkouts.concat(newWorkouts);
        auth.users[userKey].workouts = workouts;
        localStorage.setItem(ROUTINE_ENTRY_AUTH_KEY, JSON.stringify(auth));
        return;
    }

    localStorage.setItem(ROUTINE_ENTRY_WORKOUTS_KEY, JSON.stringify(guestWorkouts.concat(newWorkouts)));
}

function renderVariableSetRows(card, setCount) {
    const variableFields = card.querySelector(".routine-variable-fields");
    const cardIndex = card.dataset.cardIndex;
    const count = Math.max(1, Math.min(12, Number(setCount) || 1));
    variableFields.innerHTML = "";

    for (let index = 1; index <= count; index += 1) {
        const row = document.createElement("div");
        row.className = "set-group";
        row.innerHTML = `
            <div>
                <label for="routine-${cardIndex}-reps-${index}">Reps for set ${index}</label>
                <input type="number" id="routine-${cardIndex}-reps-${index}" min="1" class="set-reps" required>
            </div>
            <div>
                <label for="routine-${cardIndex}-weight-${index}">Weight for set ${index}</label>
                <input type="number" id="routine-${cardIndex}-weight-${index}" min="1" class="set-weight" required>
            </div>
        `;
        variableFields.appendChild(row);
    }
}

function setRoutineVariableMode(card, enabled) {
    const toggle = card.querySelector(".routine-different-sets");
    const uniformFields = card.querySelector(".routine-uniform-fields");
    const variableFields = card.querySelector(".routine-variable-fields");
    const uniformInputs = Array.from(uniformFields.querySelectorAll("input"));
    const setsInput = card.querySelector(".routine-entry-sets");
    const isEnabled = Boolean(enabled);

    toggle.setAttribute("aria-pressed", String(isEnabled));
    toggle.innerHTML = isEnabled
        ? '<span class="toggle-box" aria-hidden="true"></span><span>Use same weight/reps for every set</span>'
        : '<span class="toggle-box" aria-hidden="true"></span><span>Different weights/reps for each set?</span>';
    uniformFields.classList.toggle("hidden", isEnabled);
    variableFields.classList.toggle("hidden", !isEnabled);
    uniformInputs.forEach((input) => {
        input.disabled = isEnabled;
    });

    if (isEnabled) {
        renderVariableSetRows(card, setsInput.value);
    } else {
        variableFields.innerHTML = "";
    }
}

function createRoutineWorkoutColumn(exercise, index) {
    const card = document.createElement("section");
    card.className = "routine-workout-column";
    card.dataset.cardIndex = index;
    card.dataset.exercise = exercise;

    const heading = document.createElement("h2");
    heading.textContent = exercise;

    const fields = document.createElement("div");
    fields.className = "routine-workout-column-fields";
    fields.innerHTML = `
        <label for="routine-${index}-sets">How Many Sets?</label>
        <input type="number" id="routine-${index}-sets" min="1" max="12" class="routine-entry-sets" required>

        <button type="button" class="secondary-button routine-different-sets" aria-pressed="false">
            <span class="toggle-box" aria-hidden="true"></span>
            <span>Different weights/reps for each set?</span>
        </button>

        <div class="uniform-fields routine-uniform-fields">
            <label for="routine-${index}-reps">How Many Reps?</label>
            <input type="number" id="routine-${index}-reps" min="1" class="routine-entry-reps" required>

            <label for="routine-${index}-weight">How Much Weight?</label>
            <input type="number" id="routine-${index}-weight" min="1" class="routine-entry-weight" required>
        </div>

        <div class="routine-variable-fields hidden"></div>

        <label for="routine-${index}-notes">Additional Notes <span class="optional-label">(optional)</span></label>
        <textarea id="routine-${index}-notes" rows="4" maxlength="500" class="routine-entry-notes" placeholder="How did it feel? Anything to remember for next time?"></textarea>
    `;

    card.append(heading, fields);

    const toggle = card.querySelector(".routine-different-sets");
    const setsInput = card.querySelector(".routine-entry-sets");
    toggle.addEventListener("click", () => {
        setRoutineVariableMode(card, toggle.getAttribute("aria-pressed") !== "true");
    });
    setsInput.addEventListener("input", () => {
        if (toggle.getAttribute("aria-pressed") === "true" && Number(setsInput.value) > 0) {
            renderVariableSetRows(card, setsInput.value);
        }
    });

    return card;
}

function buildWorkoutFromColumn(card) {
    const exercise = card.dataset.exercise;
    const sets = Number(card.querySelector(".routine-entry-sets").value);
    const notes = card.querySelector(".routine-entry-notes").value.trim();
    const variableSets = card.querySelector(".routine-different-sets").getAttribute("aria-pressed") === "true";
    const baseWorkout = {
        id: createRoutineWorkoutId(),
        exercise,
        sets,
        notes,
        recordedAt: new Date().toISOString()
    };

    if (variableSets) {
        const setDetails = Array.from(card.querySelectorAll(".set-group")).map((row) => ({
            reps: Number(row.querySelector(".set-reps").value),
            weight: Number(row.querySelector(".set-weight").value)
        }));
        const total = setDetails.reduce((sum, set) => sum + (set.reps * set.weight), 0);
        return { ...baseWorkout, variableSets: true, setDetails, total };
    }

    const reps = Number(card.querySelector(".routine-entry-reps").value);
    const weight = Number(card.querySelector(".routine-entry-weight").value);
    return { ...baseWorkout, reps, weight, total: reps * weight * sets };
}

function initializeRoutineWorkoutEntry() {
    const params = new URLSearchParams(window.location.search);
    const routineId = params.get("id");
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "") ? params.get("date") : getTodayKey();
    const context = getRoutineEntryContext();
    const routine = context.routines.find((item) => String(item.id) === String(routineId));

    backToRoutine.href = routineId
        ? `routine-details.html?id=${encodeURIComponent(routineId)}`
        : "saved-routines.html";

    if (!routine) {
        routineWorkoutColumns.hidden = true;
        routineEntryEmpty.hidden = false;
        saveRoutineWorkoutsButton.hidden = true;
        return;
    }

    const selectedIndexes = Array.isArray(context.progress[`${routine.id}:${dateKey}`])
        ? context.progress[`${routine.id}:${dateKey}`]
        : [];
    const exercises = Array.isArray(routine.exercises) ? routine.exercises : [];
    const selectedExercises = selectedIndexes
        .filter((index) => Number.isInteger(index) && index >= 0 && index < exercises.length)
        .map((index) => exercises[index]);

    routineEntryTitle.textContent = `${routine.name} Workout Details`;
    document.title = `${routine.name} | Enter Workouts`;
    routineWorkoutColumns.innerHTML = "";

    if (!selectedExercises.length) {
        routineWorkoutColumns.hidden = true;
        routineEntryEmpty.hidden = false;
        saveRoutineWorkoutsButton.hidden = true;
        return;
    }

    selectedExercises.forEach((exercise, index) => {
        routineWorkoutColumns.appendChild(createRoutineWorkoutColumn(exercise, index));
    });
    saveRoutineWorkoutsButton.textContent = selectedExercises.length === 1
        ? "Save 1 Workout"
        : `Save All ${selectedExercises.length} Workouts`;

    routineWorkoutForm.addEventListener("submit", (event) => {
        event.preventDefault();
        routineEntryMessage.textContent = "";

        if (!routineWorkoutForm.reportValidity()) {
            routineEntryMessage.textContent = "Please complete all required workout fields.";
            routineEntryMessage.className = "routine-message error";
            return;
        }

        const columns = Array.from(routineWorkoutColumns.querySelectorAll(".routine-workout-column"));
        const workouts = columns.map(buildWorkoutFromColumn);
        saveRoutineWorkoutsButton.disabled = true;
        saveRoutineWorkouts(workouts);

        const destination = new URLSearchParams({ id: routine.id, saved: String(workouts.length) });
        window.navigateWithTransition(`routine-details.html?${destination.toString()}`, "back");
    });
}

initializeRoutineWorkoutEntry();
