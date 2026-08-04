const exerciseInput = document.getElementById("exercise");
const weightInput = document.getElementById("weight");
const setsInput = document.getElementById("sets");
const repsInput = document.getElementById("reps");
const notesInput = document.getElementById("notes");
const differentSetsButton = document.getElementById("differentSetsButton");
const variableSetFields = document.getElementById("variableSetFields");
const uniformFields = document.querySelector(".uniform-fields");
const workoutList = document.getElementById("workoutList");
const form = document.querySelector("form");
const exerciseSuggestions = document.getElementById("exerciseSuggestions");
const exerciseSuggestionStatus = document.getElementById("exerciseSuggestionStatus");

let variableSets = false;
let activeTemplateWorkout = null;

const queryParams = new URLSearchParams(window.location.search);
const mode = queryParams.get("mode");
const templateWorkout = queryParams.get("template");

const AUTH_STORAGE_KEY = "workoutTrackerAuth";
const LEGACY_STORAGE_KEY = "workoutTrackerWorkouts";
const EXERCISE_CACHE_KEY = "workoutTrackerExerciseSuggestionsV3";
const EXERCISE_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
const EXERCISE_API_URL = "https://exercise-api.com/v1/exercises?tier=core&sort=preferred_rank&limit=200";

function uniqueExerciseNames(names) {
    const exercisesByName = new Map();
    names.forEach((name) => {
        const cleanedName = String(name || "").replace(/<[^>]*>/g, "").trim();
        const key = cleanedName.toLowerCase();
        if (cleanedName && !exercisesByName.has(key)) {
            exercisesByName.set(key, cleanedName);
        }
    });
    return Array.from(exercisesByName.values());
}

function rankApiExercises(exercises) {
    return exercises
        .filter((exercise) => exercise && exercise.name)
        .sort((first, second) => {
            const goldStandardDifference = Number(second.is_gold_standard) - Number(first.is_gold_standard);
            if (goldStandardDifference) return goldStandardDifference;

            const firstRank = first.preferred_rank !== null && Number.isFinite(Number(first.preferred_rank))
                ? Number(first.preferred_rank)
                : Number.MAX_SAFE_INTEGER;
            const secondRank = second.preferred_rank !== null && Number.isFinite(Number(second.preferred_rank))
                ? Number(second.preferred_rank)
                : Number.MAX_SAFE_INTEGER;
            if (firstRank !== secondRank) return firstRank - secondRank;

            return first.name.localeCompare(second.name);
        })
        .map((exercise) => exercise.name);
}

function renderExerciseSuggestions(apiExercises = []) {
    const suggestions = uniqueExerciseNames(apiExercises);

    exerciseSuggestions.innerHTML = "";
    suggestions.forEach((exerciseName) => {
        const option = document.createElement("option");
        option.value = exerciseName;
        exerciseSuggestions.appendChild(option);
    });

    return suggestions.length;
}

async function loadExerciseSuggestions() {
    let cachedExercises = [];
    let cacheTime = 0;

    try {
        const cached = JSON.parse(localStorage.getItem(EXERCISE_CACHE_KEY) || "null");
        if (cached && Array.isArray(cached.exercises)) {
            cachedExercises = cached.exercises;
            cacheTime = Number(cached.fetchedAt) || 0;
        }
    } catch (error) {
        localStorage.removeItem(EXERCISE_CACHE_KEY);
    }

    const cachedSuggestionCount = renderExerciseSuggestions(cachedExercises);
    if (cachedSuggestionCount && Date.now() - cacheTime < EXERCISE_CACHE_DURATION_MS) {
        exerciseSuggestionStatus.textContent = `${cachedSuggestionCount} suggestions available, or type your own exercise.`;
        return;
    }

    try {
        const response = await fetch(EXERCISE_API_URL, { headers: { Accept: "application/json" } });
        if (!response.ok) {
            throw new Error(`Exercise API returned ${response.status}`);
        }

        const data = await response.json();
        const apiExercises = uniqueExerciseNames(
            Array.isArray(data.data) ? rankApiExercises(data.data) : []
        );
        const suggestionCount = renderExerciseSuggestions(apiExercises);
        localStorage.setItem(EXERCISE_CACHE_KEY, JSON.stringify({
            exercises: apiExercises,
            fetchedAt: Date.now()
        }));
        exerciseSuggestionStatus.textContent = `${suggestionCount} suggestions available, or type your own exercise.`;
    } catch (error) {
        const fallbackCount = renderExerciseSuggestions(cachedExercises);
        exerciseSuggestionStatus.textContent = fallbackCount
            ? `${fallbackCount} saved API suggestions available, or type your own exercise.`
            : "Exercise suggestions are unavailable, but you can still type your own exercise.";
        console.warn("Using saved exercise suggestions because the exercise API is unavailable.", error);
    }
}

if (mode === "previous") {
    const heading = document.querySelector("h2");
    if (heading) {
        heading.textContent = "Add more from this workout";
    }
    const subtext = document.querySelector(".subtext");
    if (subtext) {
        subtext.textContent = "This form is prefilled from the workout you selected. Submit it to save a new comparison entry.";
    }
}

function updateVariableSetToggleButton(isEnabled) {
    differentSetsButton.setAttribute("aria-pressed", isEnabled ? "true" : "false");
    differentSetsButton.innerHTML = isEnabled
        ? '<span class="toggle-box" aria-hidden="true"></span><span>Use same weight/reps for every set</span>'
        : '<span class="toggle-box" aria-hidden="true"></span><span>Different weights/reps for each set?</span>';
}

function setVariableSetMode(enabled, setCount = Number(setsInput.value)) {
    variableSets = Boolean(enabled);
    variableSetFields.classList.toggle("hidden", !variableSets);
    uniformFields.classList.toggle("hidden", variableSets);

    if (variableSets) {
        const currentSets = Number.isFinite(setCount) && setCount > 0 ? setCount : 1;
        setsInput.value = currentSets;
        renderVariableSetFields(currentSets);
    } else {
        variableSetFields.innerHTML = "";
    }

    updateVariableSetToggleButton(variableSets);
}

function toggleVariableSetMode() {
    if (variableSets) {
        setVariableSetMode(false);
    } else {
        setVariableSetMode(true, Number(setsInput.value));
    }
}

window.toggleVariableSetMode = toggleVariableSetMode;
window.updateVariableSetFields = updateVariableSetFields;

function applyTemplateWorkout(workout) {
    if (!workout) {
        return;
    }

    exerciseInput.value = workout.exercise;
    notesInput.value = "";

    if (workout.variableSets && Array.isArray(workout.setDetails)) {
        setVariableSetMode(true, workout.sets);

        workout.setDetails.forEach((set, index) => {
            const repsInputForSet = variableSetFields.querySelector(`#reps${index + 1}`);
            const weightInputForSet = variableSetFields.querySelector(`#weight${index + 1}`);
            if (repsInputForSet) repsInputForSet.value = set.reps;
            if (weightInputForSet) weightInputForSet.value = set.weight;
        });
    } else {
        setVariableSetMode(false);
        setsInput.value = workout.sets;
        repsInput.value = workout.reps;
        weightInput.value = workout.weight;
    }
}

function renderVariableSetFields(setCount) {
    const count = Math.max(1, Math.min(12, setCount));
    variableSetFields.innerHTML = "";

    for (let i = 1; i <= count; i += 1) {
        const wrapper = document.createElement("div");
        wrapper.className = "set-group";
        wrapper.dataset.setIndex = i;

        wrapper.innerHTML = `
            <div>
                <label for="reps${i}">Reps for set ${i}</label>
                <input type="number" id="reps${i}" min="1" class="set-reps">
            </div>
            <div>
                <label for="weight${i}">Weight for set ${i}</label>
                <input type="number" id="weight${i}" min="1" class="set-weight">
            </div>
        `;

        variableSetFields.appendChild(wrapper);
    }
}

function getVariableSetInputs() {
    return Array.from(variableSetFields.querySelectorAll(".set-group")).map(group => ({
        reps: group.querySelector(".set-reps"),
        weight: group.querySelector(".set-weight")
    }));
}

function updateVariableSetFields() {
    if (variableSetFields.classList.contains("hidden")) {
        return;
    }

    const sets = Number(setsInput.value);
    if (sets <= 0) {
        return;
    }

    renderVariableSetFields(sets);
}

function getAuthStorage() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { users: {}, currentUser: null };
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function getCurrentUserEmail() {
    const auth = getAuthStorage();
    return auth.currentUser ? normalizeEmail(auth.currentUser.email) : null;
}

function getUserStorageKey(auth, email) {
    const normalized = normalizeEmail(email);
    if (normalized in auth.users) {
        return normalized;
    }
    return Object.keys(auth.users).find((key) => normalizeEmail(key) === normalized) || normalized;
}

function ensureUserWorkoutRecord(auth, currentUserEmail) {
    const userKey = getUserStorageKey(auth, currentUserEmail);
    const legacyWorkouts = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");

    if (!auth.users[userKey]) {
        auth.users[userKey] = { workouts: legacyWorkouts };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
        return;
    }

    if (!Array.isArray(auth.users[userKey].workouts)) {
        auth.users[userKey].workouts = legacyWorkouts;
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

function saveWorkouts(workouts) {
    const auth = getAuthStorage();
    const currentUserEmail = getCurrentUserEmail();

    if (currentUserEmail) {
        const userKey = getUserStorageKey(auth, currentUserEmail);
        ensureUserWorkoutRecord(auth, userKey);
        auth.users[userKey].workouts = workouts;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
        localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(workouts));
        return;
    }

    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(workouts));
}

function renderWorkoutButton(workout) {
    const button = document.createElement("button");
    button.type = "button";
    button.innerText = `${workout.exercise} — ${workout.total} lbs`;
    button.classList.add("workout-button");

    button.addEventListener("click", () => {
        activeTemplateWorkout = workout;
        exerciseInput.value = workout.exercise;
        notesInput.value = "";

        if (workout.variableSets && Array.isArray(workout.setDetails)) {
            setVariableSetMode(true, workout.sets);

            workout.setDetails.forEach((set, index) => {
                const repsInputForSet = variableSetFields.querySelector(`#reps${index + 1}`);
                const weightInputForSet = variableSetFields.querySelector(`#weight${index + 1}`);
                if (repsInputForSet) repsInputForSet.value = set.reps;
                if (weightInputForSet) weightInputForSet.value = set.weight;
            });
        } else {
            setVariableSetMode(false);
            setsInput.value = workout.sets;
            repsInput.value = workout.reps;
            weightInput.value = workout.weight;
        }

        exerciseInput.focus();
        form.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    workoutList.appendChild(button);
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

function renderWorkouts() {
    workoutList.innerHTML = "";
    const latestWorkouts = getLatestWorkouts();
    latestWorkouts.forEach(renderWorkoutButton);
}

function initializeTracker() {
    renderWorkouts();
    loadExerciseSuggestions();

    if (mode === "previous" && templateWorkout) {
        try {
            const workout = JSON.parse(templateWorkout);
            applyTemplateWorkout(workout);
        } catch (error) {
            console.error("Unable to load workout template", error);
        }
    }

    setsInput.addEventListener("input", () => {
        if (!variableSetFields.classList.contains("hidden")) {
            updateVariableSetFields();
        }
    });

    form.addEventListener("submit", function(event) {
        event.preventDefault();

        const exercise = exerciseInput.value.trim();
        const sets = Number(setsInput.value);
        const notes = notesInput.value.trim();

        if (!exercise || sets <= 0) {
            alert("Please enter a valid exercise and set count.");
            return;
        }

        variableSets = !variableSetFields.classList.contains("hidden");

        let totalWeight;
        let workout;
        let params = new URLSearchParams({ exercise, total: 0, sets });

        if (variableSets) {
            const setInputs = getVariableSetInputs();
            const setDetails = [];
            let sumTotal = 0;

            if (setInputs.length !== sets) {
                alert("Please enter the same number of variable set rows as the number of sets.");
                return;
            }

            setInputs.forEach((inputPair, index) => {
                const setReps = Number(inputPair.reps.value);
                const setWeight = Number(inputPair.weight.value);

                if (setReps <= 0 || setWeight <= 0) {
                    alert("Please enter valid reps and weight for each set.");
                    return;
                }

                setDetails.push({ reps: setReps, weight: setWeight });
                sumTotal += setReps * setWeight;
                params.set(`reps${index + 1}`, setReps);
                params.set(`weight${index + 1}`, setWeight);
            });

            if (setDetails.length !== sets) {
                return;
            }

            totalWeight = sumTotal;
            workout = {
                exercise,
                sets,
                variableSets: true,
                setDetails,
                total: totalWeight,
                notes,
                recordedAt: new Date().toISOString()
            };

            params.set("variableSets", "true");
        } else {
            const reps = Number(repsInput.value);
            const weight = Number(weightInput.value);

            if (reps <= 0 || weight <= 0) {
                alert("Please enter valid reps and weight.");
                return;
            }

            totalWeight = reps * weight * sets;
            workout = {
                exercise,
                reps,
                weight,
                sets,
                total: totalWeight,
                notes,
                recordedAt: new Date().toISOString()
            };

            params.set("reps", reps);
            params.set("weight", weight);
            params.set("variableSets", "false");
        }

        const workouts = getStoredWorkouts();
        workouts.push(workout);
        saveWorkouts(workouts);
        renderWorkouts();

        params.set("total", totalWeight);
        params.set("sets", sets);
        window.location.href = `compare.html?exercise=${encodeURIComponent(exercise)}`;
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeTracker);
} else {
    initializeTracker();
}
