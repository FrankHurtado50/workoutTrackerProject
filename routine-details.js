const routineDetailsContent = document.getElementById("routineDetailsContent");
const routineNotFound = document.getElementById("routineNotFound");
const routineDetailsName = document.getElementById("routineDetailsName");
const routineDetailsDate = document.getElementById("routineDetailsDate");
const routineProgress = document.getElementById("routineProgress");
const routineChecklist = document.getElementById("routineChecklist");

const ROUTINE_DETAILS_AUTH_KEY = "workoutTrackerAuth";
const ROUTINE_DETAILS_GUEST_KEY = "workoutTrackerRoutines";
const ROUTINE_PROGRESS_GUEST_KEY = "workoutTrackerRoutineProgress";

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
        if (!storage.auth.users[storage.userKey]) storage.auth.users[storage.userKey] = {};
        storage.auth.users[storage.userKey].routineProgress = progress;
        localStorage.setItem(ROUTINE_DETAILS_AUTH_KEY, JSON.stringify(storage.auth));
        return;
    }

    localStorage.setItem(ROUTINE_PROGRESS_GUEST_KEY, JSON.stringify(progress));
}

function updateRoutineProgressText(checkedCount, totalCount) {
    routineProgress.textContent = `${checkedCount} of ${totalCount} completed today`;
    routineProgress.classList.toggle("complete", totalCount > 0 && checkedCount === totalCount);
}

function renderRoutineDetails() {
    const routineId = new URLSearchParams(window.location.search).get("id");
    const storage = getRoutineDetailsStorage();
    const routine = storage.routines.find((item) => String(item.id) === String(routineId));

    if (!routine) {
        routineDetailsContent.hidden = true;
        routineNotFound.hidden = false;
        return;
    }

    const exercises = Array.isArray(routine.exercises) ? routine.exercises : [];
    const todayKey = getLocalDateKey();
    const progressKey = `${routine.id}:${todayKey}`;
    const checkedIndexes = new Set(Array.isArray(storage.progress[progressKey]) ? storage.progress[progressKey] : []);

    document.title = `${routine.name} | Routine`;
    routineDetailsName.textContent = routine.name;
    routineDetailsDate.textContent = `Today's workouts · ${new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric"
    }).format(new Date())}`;
    routineChecklist.innerHTML = "";

    exercises.forEach((exercise, index) => {
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

            storage.progress[progressKey] = Array.from(checkedIndexes).sort((first, second) => first - second);
            saveRoutineProgress(storage, storage.progress);
            label.classList.toggle("checked", checkbox.checked);
            updateRoutineProgressText(checkedIndexes.size, exercises.length);
        });

        label.classList.toggle("checked", checkbox.checked);
        label.append(checkbox, name);
        routineChecklist.appendChild(label);
    });

    updateRoutineProgressText(checkedIndexes.size, exercises.length);
}

renderRoutineDetails();
