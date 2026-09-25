const routineForm = document.getElementById("routineForm");
const routineNameInput = document.getElementById("routineName");
const routineExerciseList = document.getElementById("routineExerciseList");
const addRoutineExerciseButton = document.getElementById("addRoutineExercise");
const routineMessage = document.getElementById("routineMessage");
const routineExerciseSuggestionStatus = document.getElementById("routineExerciseSuggestionStatus");

const ROUTINE_AUTH_STORAGE_KEY = "workoutTrackerAuth";
const GUEST_ROUTINES_STORAGE_KEY = "workoutTrackerRoutines";
const ROUTINE_EXERCISE_CACHE_KEY = "workoutTrackerExerciseSuggestionsV3";
const ROUTINE_EXERCISE_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
const ROUTINE_EXERCISE_API_URL = "https://exercise-api.com/v1/exercises?tier=core&sort=preferred_rank&limit=200";

let routineExerciseSuggestions = [];

function uniqueRoutineExerciseNames(names) {
    const exercisesByName = new Map();
    names.forEach((name) => {
        const cleanedName = String(name || "").replace(/<[^>]*>/g, "").trim();
        const key = cleanedName.toLowerCase();
        if (cleanedName && !exercisesByName.has(key)) exercisesByName.set(key, cleanedName);
    });
    return Array.from(exercisesByName.values());
}

function rankRoutineApiExercises(exercises) {
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

function setRoutineExerciseSuggestions(exercises) {
    routineExerciseSuggestions = uniqueRoutineExerciseNames(exercises);
    routineExerciseList.querySelectorAll('.routine-exercise-combobox').forEach((combobox) => {
        const dropdown = combobox.querySelector('.exercise-dropdown');
        if (!dropdown.hidden) renderRoutineExerciseDropdown(combobox, combobox.querySelector('input').value, false);
    });
    return routineExerciseSuggestions.length;
}

function closeRoutineExerciseDropdowns(exceptCombobox = null) {
    routineExerciseList.querySelectorAll('.routine-exercise-combobox').forEach((combobox) => {
        if (combobox === exceptCombobox) return;
        const input = combobox.querySelector('input');
        const toggle = combobox.querySelector('.exercise-dropdown-toggle');
        const dropdown = combobox.querySelector('.exercise-dropdown');
        dropdown.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        toggle.setAttribute('aria-expanded', 'false');
        combobox.dataset.activeSuggestionIndex = '-1';
    });
}

function setRoutineExerciseDropdownOpen(combobox, isOpen) {
    if (isOpen) closeRoutineExerciseDropdowns(combobox);
    const input = combobox.querySelector('input');
    const toggle = combobox.querySelector('.exercise-dropdown-toggle');
    const dropdown = combobox.querySelector('.exercise-dropdown');
    dropdown.hidden = !isOpen;
    input.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-expanded', String(isOpen));
    if (!isOpen) {
        input.removeAttribute('aria-activedescendant');
        combobox.dataset.activeSuggestionIndex = '-1';
    }
}

function renderRoutineExerciseDropdown(combobox, searchValue = '', showAll = false) {
    const input = combobox.querySelector('input');
    const dropdown = combobox.querySelector('.exercise-dropdown');
    const query = showAll ? '' : String(searchValue).trim().toLowerCase();
    const visibleSuggestions = query
        ? routineExerciseSuggestions.filter((name) => name.toLowerCase().includes(query))
        : routineExerciseSuggestions.slice();

    dropdown.innerHTML = '';
    combobox.dataset.activeSuggestionIndex = '-1';
    input.removeAttribute('aria-activedescendant');

    if (!visibleSuggestions.length) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'exercise-dropdown-empty';
        emptyMessage.textContent = routineExerciseSuggestions.length
            ? 'No matches. Keep typing to use your own exercise.'
            : 'Exercise suggestions are still loading. You can type your own exercise.';
        dropdown.appendChild(emptyMessage);
    } else {
        visibleSuggestions.forEach((exerciseName, index) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'exercise-dropdown-option';
            option.id = `${dropdown.id}-option-${index}`;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', 'false');
            option.dataset.exerciseName = exerciseName;
            option.textContent = exerciseName;
            dropdown.appendChild(option);
        });
    }

    setRoutineExerciseDropdownOpen(combobox, true);
}

function selectRoutineExerciseSuggestion(combobox, exerciseName) {
    const input = combobox.querySelector('input');
    input.value = exerciseName;
    setRoutineExerciseDropdownOpen(combobox, false);
    input.focus();
}

function highlightRoutineExerciseSuggestion(combobox, index) {
    const input = combobox.querySelector('input');
    const options = Array.from(combobox.querySelectorAll('.exercise-dropdown-option'));
    if (!options.length) return;

    const activeIndex = (index + options.length) % options.length;
    combobox.dataset.activeSuggestionIndex = String(activeIndex);
    options.forEach((option, optionIndex) => {
        const isActive = optionIndex === activeIndex;
        option.classList.toggle('active', isActive);
        option.setAttribute('aria-selected', String(isActive));
    });

    input.setAttribute('aria-activedescendant', options[activeIndex].id);
    options[activeIndex].scrollIntoView({ block: 'nearest' });
}

function connectRoutineExerciseCombobox(combobox) {
    const input = combobox.querySelector('input');
    const toggle = combobox.querySelector('.exercise-dropdown-toggle');
    const dropdown = combobox.querySelector('.exercise-dropdown');

    input.addEventListener('click', () => renderRoutineExerciseDropdown(combobox, '', true));
    input.addEventListener('input', () => renderRoutineExerciseDropdown(combobox, input.value, false));
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setRoutineExerciseDropdownOpen(combobox, false);
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (dropdown.hidden) renderRoutineExerciseDropdown(combobox, input.value, false);
            const options = combobox.querySelectorAll('.exercise-dropdown-option');
            const currentIndex = Number(combobox.dataset.activeSuggestionIndex || -1);
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            const nextIndex = currentIndex === -1
                ? (direction === 1 ? 0 : options.length - 1)
                : currentIndex + direction;
            highlightRoutineExerciseSuggestion(combobox, nextIndex);
            return;
        }

        if (event.key === 'Enter' && !dropdown.hidden) {
            const activeIndex = Number(combobox.dataset.activeSuggestionIndex || -1);
            const options = combobox.querySelectorAll('.exercise-dropdown-option');
            if (activeIndex >= 0 && options[activeIndex]) {
                event.preventDefault();
                selectRoutineExerciseSuggestion(combobox, options[activeIndex].dataset.exerciseName);
            }
        }
    });

    toggle.addEventListener('click', () => {
        if (dropdown.hidden) {
            renderRoutineExerciseDropdown(combobox, '', true);
            input.focus();
        } else {
            setRoutineExerciseDropdownOpen(combobox, false);
        }
    });

    dropdown.addEventListener('mousedown', (event) => event.preventDefault());
    dropdown.addEventListener('click', (event) => {
        const option = event.target.closest('.exercise-dropdown-option');
        if (option) selectRoutineExerciseSuggestion(combobox, option.dataset.exerciseName);
    });
}

async function loadRoutineExerciseSuggestions() {
    let cachedExercises = [];
    let cacheTime = 0;

    try {
        const cached = JSON.parse(localStorage.getItem(ROUTINE_EXERCISE_CACHE_KEY) || 'null');
        if (cached && Array.isArray(cached.exercises)) {
            cachedExercises = cached.exercises;
            cacheTime = Number(cached.fetchedAt) || 0;
        }
    } catch (error) {
        localStorage.removeItem(ROUTINE_EXERCISE_CACHE_KEY);
    }

    const cachedSuggestionCount = setRoutineExerciseSuggestions(cachedExercises);
    if (cachedSuggestionCount && Date.now() - cacheTime < ROUTINE_EXERCISE_CACHE_DURATION_MS) {
        routineExerciseSuggestionStatus.textContent = `${cachedSuggestionCount} suggestions available, or type your own exercise.`;
        return;
    }

    try {
        const response = await fetch(ROUTINE_EXERCISE_API_URL, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Exercise API returned ${response.status}`);

        const data = await response.json();
        const apiExercises = uniqueRoutineExerciseNames(
            Array.isArray(data.data) ? rankRoutineApiExercises(data.data) : []
        );
        const suggestionCount = setRoutineExerciseSuggestions(apiExercises);
        localStorage.setItem(ROUTINE_EXERCISE_CACHE_KEY, JSON.stringify({
            exercises: apiExercises,
            fetchedAt: Date.now()
        }));
        routineExerciseSuggestionStatus.textContent = `${suggestionCount} suggestions available, or type your own exercise.`;
    } catch (error) {
        const fallbackCount = setRoutineExerciseSuggestions(cachedExercises);
        routineExerciseSuggestionStatus.textContent = fallbackCount
            ? `${fallbackCount} saved API suggestions available, or type your own exercise.`
            : 'Exercise suggestions are unavailable, but you can still type your own exercise.';
        console.warn('Using saved exercise suggestions because the exercise API is unavailable.', error);
    }
}

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
        const dropdown = row.querySelector('.exercise-dropdown');
        const toggle = row.querySelector('.exercise-dropdown-toggle');
        dropdown.id = `routineExerciseSuggestions${number}`;
        input.setAttribute('aria-controls', dropdown.id);
        toggle.setAttribute('aria-controls', dropdown.id);
        dropdown.querySelectorAll('.exercise-dropdown-option').forEach((option, optionIndex) => {
            option.id = `${dropdown.id}-option-${optionIndex}`;
        });
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
            <div class="exercise-combobox routine-exercise-combobox" data-active-suggestion-index="-1">
                <input type="text" class="routine-exercise-input" maxlength="80" autocomplete="off" placeholder="Start typing or choose an exercise" role="combobox" aria-autocomplete="list" aria-expanded="false">
                <button type="button" class="exercise-dropdown-toggle" aria-label="Show exercise suggestions" aria-expanded="false">&#9662;</button>
                <div class="exercise-dropdown" role="listbox" hidden></div>
            </div>
        </div>
        <button type="button" class="remove-routine-exercise" aria-label="Remove workout">&times;</button>
    `;

    const combobox = row.querySelector('.routine-exercise-combobox');
    connectRoutineExerciseCombobox(combobox);

    row.querySelector(".remove-routine-exercise").addEventListener("click", () => {
        row.remove();
        updateRoutineExerciseRows();
    });

    routineExerciseList.appendChild(row);
    updateRoutineExerciseRows();
    row.querySelector("input").focus();
}

addRoutineExerciseButton.addEventListener("click", addRoutineExerciseField);

document.addEventListener('click', (event) => {
    if (!event.target.closest('.routine-exercise-combobox')) closeRoutineExerciseDropdowns();
});

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
loadRoutineExerciseSuggestions();
routineNameInput.focus();
