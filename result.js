const resultText = document.getElementById("resultText");
const backButton = document.getElementById("backButton");

const params = new URLSearchParams(window.location.search);
const exercise = params.get("exercise");
const total = params.get("total");
const sets = params.get("sets");
const variableSets = params.get("variableSets") === "true";

function formatDetailText() {
    if (variableSets) {
        const setLines = [];
        for (let i = 1; i <= 3; i += 1) {
            const repsValue = params.get(`reps${i}`);
            const weightValue = params.get(`weight${i}`);
            if (!repsValue || !weightValue) {
                return "";
            }
            setLines.push(`Set ${i}: ${repsValue} reps × ${weightValue} lbs`);
        }
        return setLines.join(" | ");
    }

    const repsValue = params.get("reps");
    const weightValue = params.get("weight");
    return repsValue && sets && weightValue
        ? `${sets} sets × ${repsValue} reps × ${weightValue} lbs`
        : "";
}

if (exercise && total) {
    const details = formatDetailText();
    resultText.innerText = `Total weight lifted for ${exercise}: ${total}` + (details ? `\n(${details})` : "");
} else {
    resultText.innerText = "No workout data was found. Please add a workout first.";
}

backButton.addEventListener("click", () => {
    window.location.href = "tracker.html";
});
