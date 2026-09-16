const leaderboardFilters = document.getElementById("leaderboardFilters");
const leaderboardExercise = document.getElementById("leaderboardExercise");
const leaderboardMetric = document.getElementById("leaderboardMetric");
const leaderboardStatus = document.getElementById("leaderboardStatus");
const leaderboardTableWrap = document.getElementById("leaderboardTableWrap");
const leaderboardRows = document.getElementById("leaderboardRows");
const leaderboardScoreHeading = document.getElementById("leaderboardScoreHeading");
const leaderboardEmpty = document.getElementById("leaderboardEmpty");

const LEADERBOARD_AUTH_KEY = "workoutTrackerAuth";
const LEADERBOARD_EXERCISE_CACHE_KEY = "workoutTrackerExerciseSuggestionsV3";
const LEADERBOARD_EXERCISE_CACHE_DURATION = 24 * 60 * 60 * 1000;
const LEADERBOARD_EXERCISE_API_URL = "https://exercise-api.com/v1/exercises?tier=core&sort=preferred_rank&limit=200";

const leaderboardMetricOptions = {
    weight: { label: "Maximum weight", unit: "lbs" },
    volume: { label: "Best workout volume", unit: "lbs" },
    reps: { label: "Total reps", unit: "reps" }
};

let officialLeaderboardExercises = [];

function normalizeLeaderboardValue(value) {
    return String(value || "").trim().toLowerCase();
}

function getLeaderboardAuth() {
    const raw = localStorage.getItem(LEADERBOARD_AUTH_KEY);
    return raw ? JSON.parse(raw) : { users: {}, currentUser: null };
}

function uniqueLeaderboardExerciseNames(names) {
    const exercises = new Map();
    names.forEach((name) => {
        const cleanedName = String(name || "").replace(/<[^>]*>/g, "").trim();
        const key = normalizeLeaderboardValue(cleanedName);
        if (key && !exercises.has(key)) exercises.set(key, cleanedName);
    });
    return Array.from(exercises.values());
}

function rankLeaderboardApiExercises(exercises) {
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

function getCachedLeaderboardExercises() {
    try {
        const cached = JSON.parse(localStorage.getItem(LEADERBOARD_EXERCISE_CACHE_KEY) || "null");
        if (!cached || !Array.isArray(cached.exercises)) return { exercises: [], fetchedAt: 0 };
        return {
            exercises: uniqueLeaderboardExerciseNames(cached.exercises),
            fetchedAt: Number(cached.fetchedAt) || 0
        };
    } catch (error) {
        return { exercises: [], fetchedAt: 0 };
    }
}

function getLeaderboardEligibleExercises(apiExercises) {
    const auth = getLeaderboardAuth();
    const recordedExerciseNames = new Set();

    Object.values(auth.users || {}).forEach((user) => {
        const workouts = Array.isArray(user.workouts) ? user.workouts : [];
        workouts.forEach((workout) => {
            const name = normalizeLeaderboardValue(workout.exercise);
            if (name) recordedExerciseNames.add(name);
        });
    });

    return apiExercises.filter((exerciseName) => recordedExerciseNames.has(normalizeLeaderboardValue(exerciseName)));
}

function getLeaderboardWorkoutScore(workout, metric) {
    const setDetails = Array.isArray(workout.setDetails) ? workout.setDetails : [];

    if (metric === "weight") {
        return workout.variableSets && setDetails.length
            ? Math.max(...setDetails.map((set) => Number(set.weight) || 0))
            : Number(workout.weight) || 0;
    }

    if (metric === "reps") {
        return workout.variableSets && setDetails.length
            ? setDetails.reduce((sum, set) => sum + (Number(set.reps) || 0), 0)
            : (Number(workout.reps) || 0) * (Number(workout.sets) || 0);
    }

    return Number(workout.total) || 0;
}

function getLeaderboardRankings(exerciseName, metric) {
    const auth = getLeaderboardAuth();
    const currentEmail = normalizeLeaderboardValue(auth.currentUser ? auth.currentUser.email : "");

    return Object.entries(auth.users || {})
        .map(([userKey, user], userIndex) => {
            const workouts = (Array.isArray(user.workouts) ? user.workouts : [])
                .filter((workout) => normalizeLeaderboardValue(workout.exercise) === normalizeLeaderboardValue(exerciseName));

            const bestWorkout = workouts.reduce((best, workout) => {
                const score = getLeaderboardWorkoutScore(workout, metric);
                if (score <= 0) return best;
                if (!best || score > best.score) return { workout, score };
                if (score === best.score && new Date(workout.recordedAt) > new Date(best.workout.recordedAt)) {
                    return { workout, score };
                }
                return best;
            }, null);

            if (!bestWorkout) return null;
            const firstName = String(user.firstName || "").trim();
            return {
                name: firstName || `Athlete ${userIndex + 1}`,
                score: bestWorkout.score,
                recordedAt: bestWorkout.workout.recordedAt,
                isCurrentUser: normalizeLeaderboardValue(userKey) === currentEmail
            };
        })
        .filter(Boolean)
        .sort((first, second) => {
            if (second.score !== first.score) return second.score - first.score;
            return first.name.localeCompare(second.name);
        });
}

function formatLeaderboardDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function renderLeaderboard() {
    const exerciseName = leaderboardExercise.value;
    const metric = leaderboardMetric.value;
    const metricOption = leaderboardMetricOptions[metric];
    const rankings = getLeaderboardRankings(exerciseName, metric);

    leaderboardRows.innerHTML = "";
    leaderboardScoreHeading.textContent = metricOption.label;

    if (!rankings.length) {
        leaderboardTableWrap.hidden = true;
        leaderboardEmpty.hidden = false;
        leaderboardEmpty.textContent = `No eligible results have been recorded for ${exerciseName} yet.`;
        leaderboardStatus.textContent = "Only official API exercises are included.";
        return;
    }

    let previousScore = null;
    let previousRank = 0;
    rankings.forEach((ranking, index) => {
        const rank = ranking.score === previousScore ? previousRank : index + 1;
        previousScore = ranking.score;
        previousRank = rank;

        const row = document.createElement("tr");
        if (ranking.isCurrentUser) row.className = "current-user-rank";

        const rankCell = document.createElement("td");
        rankCell.className = "leaderboard-rank";
        rankCell.textContent = String(rank);

        const athleteCell = document.createElement("td");
        athleteCell.textContent = ranking.isCurrentUser ? `${ranking.name} (You)` : ranking.name;

        const scoreCell = document.createElement("td");
        scoreCell.className = "leaderboard-score";
        scoreCell.textContent = `${ranking.score.toLocaleString()} ${metricOption.unit}`;

        const dateCell = document.createElement("td");
        dateCell.textContent = formatLeaderboardDate(ranking.recordedAt);

        row.append(rankCell, athleteCell, scoreCell, dateCell);
        leaderboardRows.appendChild(row);
    });

    leaderboardEmpty.hidden = true;
    leaderboardTableWrap.hidden = false;
    leaderboardStatus.textContent = `${rankings.length} ${rankings.length === 1 ? "athlete" : "athletes"} ranked for ${exerciseName}.`;
}

function displayLeaderboardExercises(apiExercises) {
    officialLeaderboardExercises = getLeaderboardEligibleExercises(uniqueLeaderboardExerciseNames(apiExercises));
    leaderboardExercise.innerHTML = "";

    if (!officialLeaderboardExercises.length) {
        leaderboardFilters.hidden = true;
        leaderboardTableWrap.hidden = true;
        leaderboardEmpty.hidden = false;
        leaderboardEmpty.textContent = "No workouts matching the official exercise catalog have been recorded yet.";
        leaderboardStatus.textContent = "Custom exercise names are not included in leaderboard rankings.";
        return;
    }

    officialLeaderboardExercises.forEach((exerciseName) => {
        const option = document.createElement("option");
        option.value = exerciseName;
        option.textContent = exerciseName;
        leaderboardExercise.appendChild(option);
    });

    leaderboardFilters.hidden = false;
    renderLeaderboard();
}

async function loadLeaderboardExercises() {
    const cached = getCachedLeaderboardExercises();
    if (cached.exercises.length) displayLeaderboardExercises(cached.exercises);

    if (cached.exercises.length && Date.now() - cached.fetchedAt < LEADERBOARD_EXERCISE_CACHE_DURATION) {
        return;
    }

    try {
        const response = await fetch(LEADERBOARD_EXERCISE_API_URL, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`Exercise API returned ${response.status}`);

        const data = await response.json();
        const apiExercises = uniqueLeaderboardExerciseNames(
            Array.isArray(data.data) ? rankLeaderboardApiExercises(data.data) : []
        );
        localStorage.setItem(LEADERBOARD_EXERCISE_CACHE_KEY, JSON.stringify({
            exercises: apiExercises,
            fetchedAt: Date.now()
        }));
        displayLeaderboardExercises(apiExercises);
    } catch (error) {
        if (!cached.exercises.length) {
            leaderboardFilters.hidden = true;
            leaderboardTableWrap.hidden = true;
            leaderboardEmpty.hidden = false;
            leaderboardEmpty.textContent = "The official exercise list is unavailable right now. Please try again later.";
            leaderboardStatus.textContent = "Custom exercises cannot be ranked without the official catalog.";
        }
        console.warn("Unable to refresh official leaderboard exercises.", error);
    }
}

leaderboardExercise.addEventListener("change", renderLeaderboard);
leaderboardMetric.addEventListener("change", renderLeaderboard);
loadLeaderboardExercises();
