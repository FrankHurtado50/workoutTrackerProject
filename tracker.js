const exerciseInput = document.getElementById("exercise");
const weightInput = document.getElementById("weight");
const setsInput = document.getElementById("sets");
const repsInput = document.getElementById("reps");
const differentSetsButton = document.getElementById("differentSetsButton");
const variableSetFields = document.getElementById("variableSetFields");
const uniformFields = document.querySelector(".uniform-fields");
const workoutList = document.getElementById("workoutList");
const form = document.querySelector("form");

let variableSets = false;
let activeTemplateWorkout = null;

const queryParams = new URLSearchParams(window.location.search);
const mode = queryParams.get("mode");
const templateWorkout = queryParams.get("template");

const AUTH_STORAGE_KEY = "workoutTrackerAuth";
const LEGACY_STORAGE_KEY = "workoutTrackerWorkouts";

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

function getCurrentUserEmail() {
    const auth = getAuthStorage();
    return auth.currentUser ? auth.currentUser.email : null;
}

function getStoredWorkouts() {
    const auth = getAuthStorage();
    const currentUserEmail = getCurrentUserEmail();

    if (currentUserEmail && auth.users[currentUserEmail]) {
        return auth.users[currentUserEmail].workouts || [];
    }

    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
}

function saveWorkouts(workouts) {
    const auth = getAuthStorage();
    const currentUserEmail = getCurrentUserEmail();

    if (currentUserEmail) {
        if (!auth.users[currentUserEmail]) {
            auth.users[currentUserEmail] = { workouts: [] };
        }

        auth.users[currentUserEmail].workouts = workouts;
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
