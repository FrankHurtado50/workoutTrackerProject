const STORAGE_KEY = "workoutTrackerWorkouts";
const params = new URLSearchParams(window.location.search);
const exercise = params.get("exercise");
const compareTitle = document.getElementById("compareTitle");
const chartDetails = document.getElementById("chartDetails");
const canvas = document.getElementById("historyChart");
const backButton = document.getElementById("backButton");

function getStoredWorkouts() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
}

function formatDate(iso) {
    const date = new Date(iso);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function getProgressMessage(entries) {
    if (entries.length < 2) {
        return "";
    }

    const previous = entries[entries.length - 2];
    const latest = entries[entries.length - 1];
    const difference = latest.total - previous.total;
    const absDifference = Math.abs(difference);

    if (difference > 0) {
        return `<div class="progress-message success">Great job! You went up <strong>${absDifference} lbs</strong> from your last workout.</div>`;
    }

    if (difference < 0) {
        return `<div class="progress-message encouraging">Nice work — you were down <strong>${absDifference} lbs</strong> from your last workout. Looks like it was a high gravity day.</div>`;
    }

    return `<div class="progress-message neutral">You stayed the same as your last workout. Consistency still counts.</div>`;
}

function drawChart(entries) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding * 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    const totals = entries.map(entry => entry.total);
    const maxTotal = Math.max(...totals, 1);
    const stepX = entries.length > 1 ? chartWidth / (entries.length - 1) : 0;

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
    ctx.fillText("Total Weight", 12, 20);

    const points = entries.map((entry, index) => {
        const x = padding + index * stepX;
        const pointHeight = (entry.total / maxTotal) * chartHeight;
        const y = height - padding - pointHeight;
        return { x, y, entry };
    });

    ctx.beginPath();
    points.forEach((point, index) => {
        if (index === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    ctx.stroke();

    points.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = index === points.length - 1 ? "#1d4ed8" : "#60a5fa";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(point.entry.total, point.x, point.y - 12);
        ctx.fillText(formatDate(point.entry.recordedAt), point.x, height - padding + 20);
    });
}

if (!exercise) {
    compareTitle.innerText = "No exercise selected";
    chartDetails.innerText = "Open the tracker and choose a previous workout to compare its history.";
} else {
    const workouts = getStoredWorkouts().filter(item => item.exercise.toLowerCase() === exercise.toLowerCase());
    const sortedWorkouts = workouts.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

    compareTitle.innerText = `Workout history for ${exercise}`;

    if (sortedWorkouts.length === 0) {
        chartDetails.innerText = "No matching workout history was found for this exercise.";
    } else {
        function workoutSummary(workout) {
            if (workout.variableSets && Array.isArray(workout.setDetails)) {
                return workout.setDetails
                    .map((set, index) => `Set ${index + 1}: ${set.reps} reps × ${set.weight} lbs`)
                    .join(", ");
            }
            return `${workout.sets} sets × ${workout.reps} reps × ${workout.weight} lbs`;
        }

        drawChart(sortedWorkouts);
        const last = sortedWorkouts[sortedWorkouts.length - 1];
        const details = workoutSummary(last);
        const progressMessage = getProgressMessage(sortedWorkouts);
        chartDetails.innerHTML = `${progressMessage}<p class="chart-summary">Showing ${sortedWorkouts.length} recorded workout(s) for <strong>${exercise}</strong>.<br>Latest total: ${last.total} lbs (${details}).</p>`;
    }
}

backButton.addEventListener("click", () => {
    window.location.href = "tracker.html";
});
