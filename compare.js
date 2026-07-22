const AUTH_STORAGE_KEY = "workoutTrackerAuth";
const LEGACY_STORAGE_KEY = "workoutTrackerWorkouts";
const params = new URLSearchParams(window.location.search);
const exercise = params.get("exercise");
const compareTitle = document.getElementById("compareTitle");
const chartDetails = document.getElementById("chartDetails");
const canvas = document.getElementById("historyChart");
const backButton = document.getElementById("backButton");
const chartControls = document.getElementById("chartControls");
const metricSelect = document.getElementById("metricSelect");
const groupSelect = document.getElementById("groupSelect");

const metricOptions = {
    volume: { label: "Total volume", unit: "lbs", aggregate: "sum" },
    weight: { label: "Maximum weight", unit: "lbs", aggregate: "max" },
    reps: { label: "Total reps", unit: "reps", aggregate: "sum" }
};

function getAuthStorage() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { users: {}, currentUser: null };
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function getUserStorageKey(auth, email) {
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail in auth.users) return normalizedEmail;
    return Object.keys(auth.users).find((key) => normalizeEmail(key) === normalizedEmail) || normalizedEmail;
}

function ensureUserWorkoutRecord(auth, email) {
    const userKey = getUserStorageKey(auth, email);
    const legacyWorkouts = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");

    if (!auth.users[userKey]) {
        auth.users[userKey] = { workouts: legacyWorkouts };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    } else if (!Array.isArray(auth.users[userKey].workouts)) {
        auth.users[userKey].workouts = legacyWorkouts;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    }

    return userKey;
}

function getStoredWorkouts() {
    const auth = getAuthStorage();
    const currentUserEmail = auth.currentUser ? auth.currentUser.email : null;

    if (currentUserEmail) {
        const userKey = ensureUserWorkoutRecord(auth, currentUserEmail);
        return auth.users[userKey].workouts || [];
    }

    return JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");
}

function getExerciseNames(workouts) {
    const names = new Map();
    workouts.forEach((workout) => {
        const name = String(workout.exercise || "").trim();
        if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
    });
    return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
}

function renderExercisePicker(workouts) {
    const exerciseNames = getExerciseNames(workouts);
    compareTitle.innerText = "View previous workout history";
    canvas.hidden = true;
    backButton.innerText = "Back to welcome";

    if (!exerciseNames.length) {
        chartDetails.innerHTML = '<p class="empty-state">No workouts saved yet. Add a workout first to see its history.</p>';
        return;
    }

    chartDetails.innerHTML = '<p class="chart-picker-text">Choose an exercise to compare its progress over time.</p>';
    const selectionList = document.createElement("div");
    selectionList.className = "selection-list";

    exerciseNames.forEach((exerciseName) => {
        const link = document.createElement("a");
        link.className = "workout-button history-link";
        link.href = `compare.html?exercise=${encodeURIComponent(exerciseName)}`;
        link.textContent = exerciseName;
        selectionList.appendChild(link);
    });

    chartDetails.appendChild(selectionList);
}

function formatDate(value) {
    const date = new Date(value);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function getWorkoutMetric(workout, metric) {
    const details = Array.isArray(workout.setDetails) ? workout.setDetails : [];
    if (metric === "weight") {
        return workout.variableSets && details.length
            ? Math.max(...details.map((set) => Number(set.weight) || 0))
            : Number(workout.weight) || 0;
    }
    if (metric === "reps") {
        return workout.variableSets && details.length
            ? details.reduce((sum, set) => sum + (Number(set.reps) || 0), 0)
            : (Number(workout.reps) || 0) * (Number(workout.sets) || 0);
    }
    return Number(workout.total) || 0;
}

function getPeriodStart(date, group) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    if (group === "month") {
        start.setDate(1);
    } else {
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    }
    return start;
}

function buildChartPoints(workouts, metric, group) {
    if (group === "workout") {
        return workouts.map((workout) => ({ value: getWorkoutMetric(workout, metric), label: formatDate(workout.recordedAt) }));
    }

    const periods = new Map();
    workouts.forEach((workout) => {
        const start = getPeriodStart(new Date(workout.recordedAt), group);
        const key = start.toISOString();
        const value = getWorkoutMetric(workout, metric);
        if (!periods.has(key)) {
            periods.set(key, { start, value });
        } else if (metricOptions[metric].aggregate === "max") {
            periods.get(key).value = Math.max(periods.get(key).value, value);
        } else {
            periods.get(key).value += value;
        }
    });

    return Array.from(periods.values()).map((period) => ({
        value: period.value,
        label: group === "month"
            ? period.start.toLocaleDateString(undefined, { month: "short", year: "numeric" })
            : `Week of ${formatDate(period.start)}`
    }));
}

function getProgressMessage(points, metric) {
    if (points.length < 2) return "";
    const difference = points[points.length - 1].value - points[points.length - 2].value;
    const amount = Math.abs(difference);
    const unit = metricOptions[metric].unit;
    if (difference > 0) return `<div class="progress-message success">Great job! You went up <strong>${amount} ${unit}</strong> from the previous point.</div>`;
    if (difference < 0) return `<div class="progress-message encouraging">You were down <strong>${amount} ${unit}</strong> from the previous point. Keep going!</div>`;
    return '<div class="progress-message neutral">You stayed the same as the previous point. Consistency still counts.</div>';
}

function drawChart(points, metric) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding * 2;
    const maxValue = Math.max(...points.map((point) => point.value), 1);
    const stepX = points.length > 1 ? chartWidth / (points.length - 1) : 0;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    for (let y = padding; y <= height - padding; y += 60) {
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }

    ctx.fillStyle = "#0f172a";
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillText(metricOptions[metric].label, 12, 20);

    const chartPoints = points.map((point, index) => ({
        x: padding + index * stepX,
        y: height - padding - (point.value / maxValue) * chartHeight,
        point
    }));

    ctx.beginPath();
    chartPoints.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    ctx.stroke();

    chartPoints.forEach((chartPoint, index) => {
        ctx.beginPath();
        ctx.arc(chartPoint.x, chartPoint.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = index === chartPoints.length - 1 ? "#1d4ed8" : "#60a5fa";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.fillStyle = "#0f172a";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(chartPoint.point.value, chartPoint.x, chartPoint.y - 12);
        ctx.fillText(chartPoint.point.label, chartPoint.x, height - padding + 20);
    });
}

function renderWorkoutChart(workouts) {
    const metric = metricSelect.value;
    const group = groupSelect.value;
    const points = buildChartPoints(workouts, metric, group);
    const latest = points[points.length - 1];
    const option = metricOptions[metric];
    drawChart(points, metric);
    chartDetails.innerHTML = `${getProgressMessage(points, metric)}<p class="chart-summary">Showing ${points.length} ${group === "workout" ? "workout" : group} point(s) for <strong>${exercise}</strong>.<br>Latest ${option.label.toLowerCase()}: ${latest.value} ${option.unit}.</p>`;
}

const storedWorkouts = getStoredWorkouts();

if (!exercise) {
    renderExercisePicker(storedWorkouts);
} else {
    const workouts = storedWorkouts
        .filter((item) => String(item.exercise || "").toLowerCase() === exercise.toLowerCase())
        .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    compareTitle.innerText = `Workout history for ${exercise}`;
    backButton.innerText = "Choose another exercise";

    if (!workouts.length) {
        canvas.hidden = true;
        chartDetails.innerText = "No matching workout history was found for this exercise.";
    } else {
        chartControls.hidden = false;
        renderWorkoutChart(workouts);
        metricSelect.addEventListener("change", () => renderWorkoutChart(workouts));
        groupSelect.addEventListener("change", () => renderWorkoutChart(workouts));
    }
}

backButton.addEventListener("click", () => {
    window.location.href = exercise ? "compare.html" : "welcome.html";
});
