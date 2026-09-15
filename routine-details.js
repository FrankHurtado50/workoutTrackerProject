const routineDetailsContent = document.getElementById("routineDetailsContent");
const routineNotFound = document.getElementById("routineNotFound");
const routineDetailsName = document.getElementById("routineDetailsName");
const routineDetailsDate = document.getElementById("routineDetailsDate");
const routineSavedMessage = document.getElementById("routineSavedMessage");
const routineEditMessage = document.getElementById("routineEditMessage");
const routineProgress = document.getElementById("routineProgress");
const routineChecklist = document.getElementById("routineChecklist");
const submitRoutineSelection = document.getElementById("submitRoutineSelection");
const editRoutineButton = document.getElementById("editRoutineButton");
const routineEditActions = document.getElementById("routineEditActions");
const showAddRoutineWorkout = document.getElementById("showAddRoutineWorkout");
const addRoutineWorkoutForm = document.getElementById("addRoutineWorkoutForm");
const newRoutineWorkout = document.getElementById("newRoutineWorkout");
const cancelAddRoutineWorkout = document.getElementById("cancelAddRoutineWorkout");

const ROUTINE_DETAILS_AUTH_KEY = "workoutTrackerAuth";
const ROUTINE_DETAILS_GUEST_KEY = "workoutTrackerRoutines";
const ROUTINE_PROGRESS_GUEST_KEY = "workoutTrackerRoutineProgress";

let activeRoutine = null;
let activeRoutineStorage = null;
let activeTodayKey = "";
let activeProgressKey = "";
let checkedIndexes = new Set();
let isEditingRoutine = false;

function normalizeRoutineDetailsEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function getRoutineDetailsAuth() {
    const raw = localStorage.getItem(ROUTINE_DETAILS_AUTH_KEY);
    return raw ? JSON.parse(raw) : { users: {}, currentUser: null };
}

function getRoutineDetailsUserKey(auth, email) {
    const normalizedEmail = normalizeRoutineDetailsEmail(email);
    if (normalizedEmail in auth.users) return normalizedEmail;
    return Object.keys(auth.users).find((key) => normalizeRoutineDetailsEmail(key) === normalizedEmail) || normalizedEmail;
}

function getRoutineDetailsStorage() {
    const auth = getRoutineDetailsAuth();
    const email = auth.currentUser ? auth.currentUser.email : null;

    if (email) {
        const userKey = getRoutineDetailsUserKey(auth, email);
        const user = auth.users[userKey];
        return {
            routines: user && Array.isArray(user.routines) ? user.routines : [],
            progress: user && user.routineProgress ? user.routineProgress : {},
            auth,
            userKey
        };
    }

    return {
        routines: JSON.parse(localStorage.getItem(ROUTINE_DETAILS_GUEST_KEY) || "[]"),
        progress: JSON.parse(localStorage.getItem(ROUTINE_PROGRESS_GUEST_KEY) || "{}"),
        auth: null,
        userKey: null
    };
}

function getLocalDateKey() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function saveRoutineProgress(storage, progress) {
    if (storage.auth && storage.userKey) {
        const latestAuth = getRoutineDetailsAuth();
        if (!latestAuth.users) latestAuth.users = {};
        const ownerEmail = storage.auth.currentUser ? storage.auth.currentUser.email : storage.userKey;
        const latestUserKey = getRoutineDetailsUserKey(latestAuth, ownerEmail);
        const previousUser = storage.auth.users[storage.userKey] || {};
        if (!latestAuth.users[latestUserKey]) latestAuth.users[latestUserKey] = { ...previousUser };
        latestAuth.users[latestUserKey].routineProgress = progress;
        localStorage.setItem(ROUTINE_DETAILS_AUTH_KEY, JSON.stringify(latestAuth));
        storage.auth = latestAuth;
        storage.userKey = latestUserKey;
        return;
    }

    localStorage.setItem(ROUTINE_PROGRESS_GUEST_KEY, JSON.stringify(progress));
}

function saveRoutineData(storage) {
    if (storage.auth && storage.userKey) {
        const latestAuth = getRoutineDetailsAuth();
        if (!latestAuth.users) latestAuth.users = {};
        const ownerEmail = storage.auth.currentUser ? storage.auth.currentUser.email : storage.userKey;
        const latestUserKey = getRoutineDetailsUserKey(latestAuth, ownerEmail);
        const previousUser = storage.auth.users[storage.userKey] || {};
        if (!latestAuth.users[latestUserKey]) latestAuth.users[latestUserKey] = { ...previousUser };
        latestAuth.users[latestUserKey].routines = storage.routines;
        latestAuth.users[latestUserKey].routineProgress = storage.progress;
        localStorage.setItem(ROUTINE_DETAILS_AUTH_KEY, JSON.stringify(latestAuth));
        storage.auth = latestAuth;
        storage.userKey = latestUserKey;
        return;
    }

    localStorage.setItem(ROUTINE_DETAILS_GUEST_KEY, JSON.stringify(storage.routines));
    localStorage.setItem(ROUTINE_PROGRESS_GUEST_KEY, JSON.stringify(storage.progress));
}

function updateRoutineProgressText(checkedCount, totalCount) {
    routineProgress.textContent = `${checkedCount} of ${totalCount} selected today`;
    routineProgress.classList.toggle("complete", totalCount > 0 && checkedCount === totalCount);
    submitRoutineSelection.disabled = checkedCount === 0;
    submitRoutineSelection.textContent = checkedCount === 1
        ? "Submit 1 Selected Workout"
        : `Submit ${checkedCount} Selected Workouts`;
}

function showRoutineEditMessage(message, type = "success") {
    routineEditMessage.hidden = false;
    routineEditMessage.textContent = message;
    routineEditMessage.className = `routine-edit-message ${type}`;
}

function clearRoutineEditMessage() {
    routineEditMessage.hidden = true;
    routineEditMessage.textContent = "";
    routineEditMessage.className = "routine-edit-message";
}

function getActiveExercises() {
    return activeRoutine && Array.isArray(activeRoutine.exercises) ? activeRoutine.exercises : [];
}

function updateProgressAfterWorkoutDelete(deletedIndex) {
    const routineProgressPrefix = `${activeRoutine.id}:`;

    Object.keys(activeRoutineStorage.progress).forEach((key) => {
        if (!key.startsWith(routineProgressPrefix) || !Array.isArray(activeRoutineStorage.progress[key])) return;

        activeRoutineStorage.progress[key] = Array.from(new Set(
            activeRoutineStorage.progress[key]
                .filter((index) => Number.isInteger(index) && index !== deletedIndex)
                .map((index) => index > deletedIndex ? index - 1 : index)
        )).sort((first, second) => first - second);
    });

    checkedIndexes = new Set(
        Array.isArray(activeRoutineStorage.progress[activeProgressKey])
            ? activeRoutineStorage.progress[activeProgressKey]
            : []
    );
}

function deleteRoutineWorkout(index) {
    const exercises = getActiveExercises();
    const exercise = exercises[index];
    if (!exercise || !window.confirm(
        `Remove ${exercise} from this routine? Its saved workout history will be kept.`
    )) return;

    exercises.splice(index, 1);
    updateProgressAfterWorkoutDelete(index);
    saveRoutineData(activeRoutineStorage);
    showRoutineEditMessage(
        `${exercise} was removed from ${activeRoutine.name}. Its previous workout history was kept.`
    );
    renderRoutineChecklist();
}

function renderRoutineChecklist() {
    const exercises = getActiveExercises();
    routineChecklist.innerHTML = "";

    if (!exercises.length) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "empty-state routine-checklist-empty";
        emptyMessage.textContent = isEditingRoutine
            ? "This routine has no workouts. Add one below."
            : "This routine has no workouts yet. Select Edit Routine to add one.";
        routineChecklist.appendChild(emptyMessage);
        updateRoutineProgressText(0, 0);
        return;
    }

    exercises.forEach((exercise, index) => {
        if (isEditingRoutine) {
            const row = document.createElement("div");
            row.className = "routine-edit-item";

            const name = document.createElement("span");
            name.textContent = exercise;

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-routine-workout";
            deleteButton.textContent = "Delete";
            deleteButton.setAttribute("aria-label", `Delete ${exercise} from this routine`);
            deleteButton.addEventListener("click", () => deleteRoutineWorkout(index));

            row.append(name, deleteButton);
            routineChecklist.appendChild(row);
            return;
        }

        const label = document.createElement("label");
        label.className = "routine-checklist-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = checkedIndexes.has(index);
        checkbox.setAttribute("aria-label", `Mark ${exercise} as completed`);

        const name = document.createElement("span");
        name.textContent = exercise;

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                checkedIndexes.add(index);
            } else {
                checkedIndexes.delete(index);
            }

            activeRoutineStorage.progress[activeProgressKey] = Array.from(checkedIndexes).sort((first, second) => first - second);
            saveRoutineProgress(activeRoutineStorage, activeRoutineStorage.progress);
            label.classList.toggle("checked", checkbox.checked);
            updateRoutineProgressText(checkedIndexes.size, exercises.length);
        });

        label.classList.toggle("checked", checkbox.checked);
        label.append(checkbox, name);
        routineChecklist.appendChild(label);
    });

    updateRoutineProgressText(checkedIndexes.size, exercises.length);
}

function setRoutineEditing(enabled) {
    isEditingRoutine = Boolean(enabled);
    editRoutineButton.textContent = isEditingRoutine ? "Done Editing" : "Edit Routine";
    editRoutineButton.setAttribute("aria-pressed", String(isEditingRoutine));
    routineDetailsContent.classList.toggle("editing-routine", isEditingRoutine);
    routineProgress.hidden = isEditingRoutine;
    submitRoutineSelection.hidden = isEditingRoutine;
    routineEditActions.hidden = !isEditingRoutine;
    showAddRoutineWorkout.hidden = false;
    addRoutineWorkoutForm.hidden = true;
    addRoutineWorkoutForm.reset();
    clearRoutineEditMessage();
    renderRoutineChecklist();
}

function renderRoutineDetails() {
    const routineId = new URLSearchParams(window.location.search).get("id");
    activeRoutineStorage = getRoutineDetailsStorage();
    activeRoutine = activeRoutineStorage.routines.find((item) => String(item.id) === String(routineId));

    if (!activeRoutine) {
        routineDetailsContent.hidden = true;
        routineNotFound.hidden = false;
        return;
    }

    if (!Array.isArray(activeRoutine.exercises)) activeRoutine.exercises = [];
    activeTodayKey = getLocalDateKey();
    activeProgressKey = `${activeRoutine.id}:${activeTodayKey}`;
    checkedIndexes = new Set(
        Array.isArray(activeRoutineStorage.progress[activeProgressKey])
            ? activeRoutineStorage.progress[activeProgressKey]
            : []
    );
    const savedCount = Number(new URLSearchParams(window.location.search).get("saved"));

    document.title = `${activeRoutine.name} | Routine`;
    routineDetailsName.textContent = activeRoutine.name;
    routineDetailsDate.textContent = `Today's workouts · ${new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric"
    }).format(new Date())}`;
    routineChecklist.innerHTML = "";

    if (savedCount > 0) {
        routineSavedMessage.hidden = false;
        routineSavedMessage.textContent = `${savedCount} ${savedCount === 1 ? "workout was" : "workouts were"} added to your history.`;
    }

    editRoutineButton.addEventListener("click", () => {
        setRoutineEditing(!isEditingRoutine);
    });

    submitRoutineSelection.addEventListener("click", () => {
        if (!checkedIndexes.size) return;
        const destination = new URLSearchParams({ id: activeRoutine.id, date: activeTodayKey });
        window.navigateWithTransition(`routine-workout-entry.html?${destination.toString()}`, "forward");
    });

    showAddRoutineWorkout.addEventListener("click", () => {
        showAddRoutineWorkout.hidden = true;
        addRoutineWorkoutForm.hidden = false;
        newRoutineWorkout.focus();
    });

    cancelAddRoutineWorkout.addEventListener("click", () => {
        addRoutineWorkoutForm.reset();
        addRoutineWorkoutForm.hidden = true;
        showAddRoutineWorkout.hidden = false;
        clearRoutineEditMessage();
    });

    addRoutineWorkoutForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const exercise = newRoutineWorkout.value.trim();
        if (!exercise) return;

        const alreadyExists = getActiveExercises().some(
            (existingExercise) => existingExercise.trim().toLowerCase() === exercise.toLowerCase()
        );
        if (alreadyExists) {
            showRoutineEditMessage(`${exercise} is already in this routine.`, "error");
            newRoutineWorkout.focus();
            return;
        }

        activeRoutine.exercises.push(exercise);
        saveRoutineData(activeRoutineStorage);
        addRoutineWorkoutForm.reset();
        addRoutineWorkoutForm.hidden = true;
        showAddRoutineWorkout.hidden = false;
        showRoutineEditMessage(`${exercise} was added to ${activeRoutine.name}.`);
        renderRoutineChecklist();
    });

    renderRoutineChecklist();
}

renderRoutineDetails();
