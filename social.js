const socialOnboarding = document.getElementById("socialOnboarding");
const socialShell = document.getElementById("socialShell");
const socialError = document.getElementById("socialError");
const socialErrorTitle = document.getElementById("socialErrorTitle");
const socialErrorMessage = document.getElementById("socialErrorMessage");
const usernameClaimForm = document.getElementById("usernameClaimForm");
const claimUsername = document.getElementById("claimUsername");
const claimUsernameStatus = document.getElementById("claimUsernameStatus");
const socialIdentity = document.getElementById("socialIdentity");
const wallFeed = document.getElementById("wallFeed");
const wallStatus = document.getElementById("wallStatus");
const userSearchForm = document.getElementById("userSearchForm");
const userSearchInput = document.getElementById("userSearchInput");
const searchStatus = document.getElementById("searchStatus");
const searchResults = document.getElementById("searchResults");
const friendRequests = document.getElementById("friendRequests");
const friendsList = document.getElementById("friendsList");
const refreshSocialButton = document.getElementById("refreshSocialButton");

let availabilityTimer = null;

function focusFriendSearch() {
    if (window.location.hash !== "#find-friends" || socialShell.hidden) return;
    window.setTimeout(() => {
        document.getElementById("find-friends").scrollIntoView({ behavior: "smooth", block: "start" });
        userSearchInput.focus({ preventScroll: true });
    }, 120);
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(value, options) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently";
    return date.toLocaleDateString(undefined, options || { month: "short", day: "numeric", year: "numeric" });
}

function getWorkoutDetails(workout) {
    if (!workout) return "Workout details unavailable";
    if (workout.variableSets && Array.isArray(workout.setDetails)) {
        return workout.setDetails
            .map((set, index) => `Set ${index + 1}: ${Number(set.reps) || 0} reps × ${Number(set.weight) || 0} lbs`)
            .join(" · ");
    }
    return `${Number(workout.sets) || 0} sets × ${Number(workout.reps) || 0} reps × ${Number(workout.weight) || 0} lbs`;
}

function setStatus(element, message, type = "") {
    element.textContent = message;
    element.className = `social-status ${type}`.trim();
}

function getFriendlyError(error) {
    const message = String(error && error.message || "");
    const lower = message.toLowerCase();
    if (lower.includes("relation") && lower.includes("does not exist")) return "Run social-setup.sql in your Supabase SQL Editor, then refresh this page.";
    if (lower.includes("could not find the function") || lower.includes("schema cache")) return "Finish the social database setup, then wait a few seconds and refresh.";
    if (lower.includes("username") && lower.includes("taken")) return "That username is already taken. Try another one.";
    if (lower.includes("please log in") || lower.includes("must be signed in")) return "Please log in to use friends and your wall.";
    return message || "Something went wrong. Please try again.";
}

function renderPerson(person, location) {
    const item = document.createElement("article");
    item.className = "person-row";
    const copy = document.createElement("div");
    copy.className = "person-copy";
    copy.innerHTML = `<strong>@${escapeHtml(person.username)}</strong><span>${escapeHtml(person.display_name || "Athlete")}</span>`;
    const actions = document.createElement("div");
    actions.className = "person-actions";

    const addButton = (label, className, handler) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.className = className || "";
        button.addEventListener("click", async () => {
            button.disabled = true;
            try {
                await handler();
                await refreshConnections();
                if (userSearchInput.value.trim()) await runSearch();
                await loadWall();
            } catch (error) {
                setStatus(searchStatus, getFriendlyError(error), "error");
                button.disabled = false;
            }
        });
        actions.appendChild(button);
    };

    if (person.relationship === "none") {
        addButton("Add Friend", "", () => window.workoutSocial.sendFriendRequest(person.user_id));
    } else if (person.relationship === "pending_sent") {
        const label = document.createElement("span");
        label.className = "relationship-label";
        label.textContent = "Request sent";
        actions.appendChild(label);
    } else if (person.relationship === "pending_received") {
        addButton("Accept", "", () => window.workoutSocial.respondToFriendRequest(person.connection_id, true));
        addButton("Decline", "secondary danger-text", () => window.workoutSocial.respondToFriendRequest(person.connection_id, false));
    } else if (person.relationship === "friend") {
        if (location === "friends") {
            addButton("Remove", "secondary danger-text", async () => {
                if (!window.confirm(`Remove @${person.username} from your friends?`)) return;
                await window.workoutSocial.removeConnection(person.user_id);
            });
        } else {
            const label = document.createElement("span");
            label.className = "relationship-label friend";
            label.textContent = "Friends";
            actions.appendChild(label);
        }
    }

    item.append(copy, actions);
    return item;
}

async function loadWall() {
    setStatus(wallStatus, "Loading your wall...");
    wallFeed.innerHTML = "";
    try {
        const posts = await window.workoutSocial.getWallPosts();
        if (!posts.length) {
            setStatus(wallStatus, "");
            wallFeed.innerHTML = `
                <div class="social-empty">
                    <span aria-hidden="true">🏋️</span>
                    <h3>Your wall is ready</h3>
                    <p>Open workout history, select a point on the graph, and choose “Post to Wall.” Posts from accepted friends will appear here too.</p>
                    <a href="compare.html">Go to workout history</a>
                </div>`;
            return;
        }
        setStatus(wallStatus, `${posts.length} recent ${posts.length === 1 ? "post" : "posts"}`);
        posts.forEach((post) => {
            const workout = post.workout || {};
            const author = Array.isArray(post.author) ? post.author[0] : post.author;
            const isOwnPost = post.user_id === window.workoutSocial.userId;
            const card = document.createElement("article");
            card.className = "wall-post";
            card.innerHTML = `
                <div class="wall-post-header">
                    <div class="wall-avatar" aria-hidden="true">${escapeHtml((author && author.display_name || "A").charAt(0).toUpperCase())}</div>
                    <div>
                        <strong>${escapeHtml(author && author.display_name || "Athlete")}</strong>
                        <span>@${escapeHtml(author && author.username || "athlete")} · ${escapeHtml(formatDate(post.created_at, { month: "short", day: "numeric" }))}</span>
                    </div>
                    ${isOwnPost ? '<button class="wall-delete" type="button" aria-label="Delete this wall post">Delete</button>' : ""}
                </div>
                ${post.caption ? `<p class="wall-caption">${escapeHtml(post.caption)}</p>` : ""}
                <div class="workout-share-card">
                    <p class="workout-share-kicker">COMPLETED WORKOUT</p>
                    <h3>${escapeHtml(workout.exercise || "Workout")}</h3>
                    <strong>${Number(workout.total) || 0} lbs total volume</strong>
                    <span>${escapeHtml(getWorkoutDetails(workout))}</span>
                    <time>${escapeHtml(formatDate(workout.recordedAt))}</time>
                </div>`;
            const deleteButton = card.querySelector(".wall-delete");
            if (deleteButton) {
                deleteButton.addEventListener("click", async () => {
                    if (!window.confirm("Delete this post from your wall? Your saved workout will not be deleted.")) return;
                    deleteButton.disabled = true;
                    try {
                        await window.workoutSocial.deleteWallPost(post.id);
                        await loadWall();
                    } catch (error) {
                        setStatus(wallStatus, getFriendlyError(error), "error");
                        deleteButton.disabled = false;
                    }
                });
            }
            wallFeed.appendChild(card);
        });
    } catch (error) {
        setStatus(wallStatus, getFriendlyError(error), "error");
    }
}

async function refreshConnections() {
    friendRequests.innerHTML = "";
    friendsList.innerHTML = "";
    const connections = await window.workoutSocial.getConnections();
    const requests = connections.filter((connection) => connection.relationship === "pending_received");
    const friends = connections.filter((connection) => connection.relationship === "friend");

    if (!requests.length) friendRequests.innerHTML = '<p class="connections-empty">No new requests.</p>';
    requests.forEach((request) => friendRequests.appendChild(renderPerson(request, "requests")));
    if (!friends.length) friendsList.innerHTML = '<p class="connections-empty">Search for a friend to get started.</p>';
    friends.forEach((friend) => friendsList.appendChild(renderPerson(friend, "friends")));
}

async function runSearch() {
    const query = window.workoutSocial.normalizeUsername(userSearchInput.value);
    searchResults.innerHTML = "";
    if (!query) {
        setStatus(searchStatus, "Enter the start of a username.");
        return;
    }
    setStatus(searchStatus, "Searching...");
    try {
        const results = await window.workoutSocial.searchUsers(query);
        setStatus(searchStatus, results.length ? `${results.length} ${results.length === 1 ? "user" : "users"} found` : `No usernames begin with @${query}.`);
        results.forEach((person) => searchResults.appendChild(renderPerson(person, "search")));
    } catch (error) {
        setStatus(searchStatus, getFriendlyError(error), "error");
    }
}

claimUsername.addEventListener("input", () => {
    window.clearTimeout(availabilityTimer);
    const username = window.workoutSocial.normalizeUsername(claimUsername.value);
    const validationError = window.workoutSocial.validateUsername(username);
    claimUsernameStatus.textContent = validationError || (username ? "Checking availability..." : "");
    claimUsernameStatus.className = `username-status ${validationError ? "error" : ""}`.trim();
    if (validationError || !username) return;
    availabilityTimer = window.setTimeout(async () => {
        try {
            const result = await window.workoutSocial.isUsernameAvailable(username);
            claimUsernameStatus.textContent = result.message;
            claimUsernameStatus.className = `username-status ${result.available ? "success" : "error"}`;
        } catch (error) {
            claimUsernameStatus.textContent = getFriendlyError(error);
            claimUsernameStatus.className = "username-status error";
        }
    }, 350);
});

usernameClaimForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = usernameClaimForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
    try {
        const result = await window.workoutSocial.isUsernameAvailable(claimUsername.value);
        if (!result.available) throw new Error(result.message);
        await window.workoutSocial.setMyUsername(result.username);
        socialOnboarding.hidden = true;
        socialShell.hidden = false;
        await initializeSocialContent();
    } catch (error) {
        claimUsernameStatus.textContent = getFriendlyError(error);
        claimUsernameStatus.className = "username-status error";
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Save Username";
    }
});

userSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch();
});

refreshSocialButton.addEventListener("click", async () => {
    refreshSocialButton.disabled = true;
    refreshSocialButton.textContent = "Refreshing...";
    await Promise.allSettled([loadWall(), refreshConnections()]);
    refreshSocialButton.disabled = false;
    refreshSocialButton.textContent = "Refresh";
});

async function initializeSocialContent() {
    const profile = window.workoutSocial.profile;
    socialIdentity.textContent = `${profile.display_name || "Athlete"} · @${profile.username}`;
    await Promise.allSettled([loadWall(), refreshConnections()]);
    focusFriendSearch();
}

async function initializeSocialPage() {
    try {
        await window.workoutSocial.ready;
        if (window.workoutSocial.error) throw window.workoutSocial.error;
        const profile = window.workoutSocial.profile;
        if (!profile) throw new Error("Your social profile could not be loaded. Run social-setup.sql in Supabase.");
        if (!profile.username) {
            socialOnboarding.hidden = false;
            claimUsername.focus();
            return;
        }
        socialShell.hidden = false;
        await initializeSocialContent();
    } catch (error) {
        socialError.hidden = false;
        socialErrorMessage.textContent = getFriendlyError(error);
        if (String(error && error.message || "").toLowerCase().includes("log in")) {
            socialErrorTitle.textContent = "Log in to use Friends & Wall";
            const link = document.createElement("a");
            link.className = "social-login-link";
            link.href = "login.html";
            link.textContent = "Log In / Sign Up";
            socialError.appendChild(link);
        }
    }
}

initializeSocialPage();
window.addEventListener("hashchange", focusFriendSearch);
