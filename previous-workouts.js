const previousWorkoutList = document.getElementById("previousWorkoutList");

const STORAGE_KEY = "workoutTrackerWorkouts";

function getStoredWorkouts() {
    const raw = localStorage.getItem(STORAGE_KEY);
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
