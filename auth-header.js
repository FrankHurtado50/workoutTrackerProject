const HEADER_AUTH_STORAGE_KEY = "workoutTrackerAuthV2";
const NOTIFICATION_REFRESH_INTERVAL = 45000;
let notificationRefreshTimer = null;

function getAuthStorage() {
    try {
        const parsed = JSON.parse(localStorage.getItem(HEADER_AUTH_STORAGE_KEY) || "null");
        if (parsed && parsed.users && typeof parsed.users === "object") return parsed;
    } catch (error) {
        console.warn("Unable to read the current workout profile.", error);
    }
    return { users: {}, currentUser: null };
}

function getCurrentUserEmail() {
    const auth = getAuthStorage();
    return auth.currentUser ? auth.currentUser.email : null;
}

function getCurrentUserFirstName() {
    const auth = getAuthStorage();
    return auth.currentUser ? auth.currentUser.firstName : null;
}

function isLoggedIn() {
    return Boolean(getCurrentUserEmail());
}

async function handleLogout(authLink) {
    const previousText = authLink.textContent;
    authLink.textContent = "Logging Out...";
    authLink.setAttribute("aria-disabled", "true");

    try {
        if (window.workoutAuth) await window.workoutAuth.signOut();
        window.navigateWithTransition("login.html", "forward");
    } catch (error) {
        console.error("Unable to log out.", error);
        authLink.textContent = previousText;
        authLink.removeAttribute("aria-disabled");
    }
}

function getOrCreateLogoutButton() {
    let logoutArea = document.getElementById("globalLogoutArea");
    if (!logoutArea) {
        logoutArea = document.createElement("div");
        logoutArea.id = "globalLogoutArea";
        logoutArea.className = "global-logout-area";

        const logoutButton = document.createElement("button");
        logoutButton.type = "button";
        logoutButton.className = "global-logout-button";
        logoutButton.textContent = "Log Out";
        logoutButton.addEventListener("click", () => {
            if (logoutButton.getAttribute("aria-disabled") !== "true") handleLogout(logoutButton);
        });
        logoutArea.appendChild(logoutButton);
        document.body.appendChild(logoutArea);
    }
    return logoutArea.querySelector(".global-logout-button");
}

function removeLogoutButton() {
    const logoutArea = document.getElementById("globalLogoutArea");
    if (logoutArea) logoutArea.remove();
}

function getOrCreateWallLink(authLink) {
    if (!document.querySelector(".home-welcome-card")) return null;

    let wallLink = document.getElementById("globalWallLink");
    if (!wallLink) {
        wallLink = document.createElement("a");
        wallLink.id = "globalWallLink";
        wallLink.className = "login-button wall-header-link";
        wallLink.href = "social.html";
        wallLink.textContent = "The Wall";
    }

    authLink.insertAdjacentElement("afterend", wallLink);
    return wallLink;
}

function removeWallLink() {
    const wallLink = document.getElementById("globalWallLink");
    if (wallLink) wallLink.remove();
}

function formatNotificationTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently";
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getNotificationCopy(notification) {
    const actor = notification.actor_username ? `@${notification.actor_username}` : (notification.actor_display_name || "A friend");
    const workout = notification.workout_name || "your workout";
    if (notification.notification_type === "friend_request") return `${actor} sent you a friend request.`;
    if (notification.notification_type === "friend_accepted") return `${actor} accepted your friend request.`;
    if (notification.notification_type === "post_like") return `${actor} liked ${workout}.`;
    if (notification.notification_type === "post_comment") return `${actor} commented on ${workout}.`;
    return `${actor} has an update for you.`;
}

function getNotificationDestination(notification) {
    if (notification.notification_type === "friend_request" || notification.notification_type === "friend_accepted") {
        return "social.html#find-friends";
    }
    return notification.post_id ? `social.html#post-${notification.post_id}` : "social.html";
}

function getNotificationClient() {
    return window.workoutAuth && typeof window.workoutAuth.getClient === "function"
        ? window.workoutAuth.getClient()
        : null;
}

function renderNotificationItems(center, notifications) {
    const list = center.querySelector(".notification-list");
    const empty = center.querySelector(".notification-empty");
    const badge = center.querySelector(".notification-badge");
    const markAllButton = center.querySelector(".notification-mark-all");
    const unreadCount = notifications.filter((item) => !item.is_read).length;

    badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    badge.hidden = unreadCount === 0;
    markAllButton.hidden = unreadCount === 0;
    list.innerHTML = "";
    empty.hidden = notifications.length > 0;

    notifications.forEach((notification) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `notification-item${notification.is_read ? "" : " unread"}`;

        const copy = document.createElement("span");
        copy.className = "notification-item-copy";
        copy.textContent = getNotificationCopy(notification);

        const time = document.createElement("time");
        time.dateTime = notification.created_at || "";
        time.textContent = formatNotificationTime(notification.created_at);
        button.append(copy, time);

        button.addEventListener("click", async () => {
            const client = getNotificationClient();
            if (client && !notification.is_read) {
                await client.rpc("mark_social_notifications_read", { p_notification_id: notification.id });
            }
            const destination = getNotificationDestination(notification);
            if (typeof window.navigateWithTransition === "function") {
                window.navigateWithTransition(destination, "forward");
            } else {
                window.location.href = destination;
            }
        });
        list.appendChild(button);
    });
}

async function loadHeaderNotifications(center, showErrors = false) {
    if (!center || center.dataset.loading === "true") return;
    const client = getNotificationClient();
    if (!client) return;
    center.dataset.loading = "true";
    const empty = center.querySelector(".notification-empty");

    try {
        const { data, error } = await client.rpc("get_my_social_notifications", { p_limit: 30 });
        if (error) throw error;
        renderNotificationItems(center, Array.isArray(data) ? data : []);
        center.dataset.ready = "true";
    } catch (error) {
        console.warn("Unable to load notifications.", error);
        if (showErrors) {
            empty.hidden = false;
            empty.textContent = "Notifications need one setup step. Run social-notifications-setup.sql in Supabase.";
        }
    } finally {
        center.dataset.loading = "false";
    }
}

function closeNotificationCenter(center) {
    if (!center) return;
    const panel = center.querySelector(".notification-panel");
    const button = center.querySelector(".notification-button");
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
}

function getOrCreateNotificationCenter() {
    const header = document.querySelector(".page-header");
    const themeToggle = header && header.querySelector(".theme-toggle");
    if (!header || !themeToggle) return null;

    let center = document.getElementById("notificationCenter");
    if (center) return center;

    center = document.createElement("div");
    center.id = "notificationCenter";
    center.className = "notification-center";
    center.innerHTML = `
        <button class="notification-button" type="button" aria-label="Open notifications" aria-expanded="false" aria-controls="notificationPanel">
            <span aria-hidden="true">&#128276;</span>
            <span class="notification-badge" hidden>0</span>
        </button>
        <section class="notification-panel" id="notificationPanel" aria-label="Notifications" hidden>
            <header>
                <strong>Notifications</strong>
                <button class="notification-mark-all" type="button" hidden>Mark all read</button>
            </header>
            <div class="notification-list"></div>
            <p class="notification-empty">You are all caught up.</p>
        </section>`;

    themeToggle.insertAdjacentElement("afterend", center);
    header.classList.add("has-notification-center");

    const button = center.querySelector(".notification-button");
    const panel = center.querySelector(".notification-panel");
    button.addEventListener("click", async () => {
        const willOpen = panel.hidden;
        panel.hidden = !willOpen;
        button.setAttribute("aria-expanded", String(willOpen));
        if (willOpen) await loadHeaderNotifications(center, true);
    });

    center.querySelector(".notification-mark-all").addEventListener("click", async () => {
        const client = getNotificationClient();
        if (!client) return;
        const { error } = await client.rpc("mark_social_notifications_read", { p_notification_id: null });
        if (!error) await loadHeaderNotifications(center, true);
    });

    document.addEventListener("click", (event) => {
        if (!center.contains(event.target)) closeNotificationCenter(center);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeNotificationCenter(center);
    });
    return center;
}

function removeNotificationCenter() {
    const center = document.getElementById("notificationCenter");
    if (center) center.remove();
    const header = document.querySelector(".page-header");
    if (header) header.classList.remove("has-notification-center");
    if (notificationRefreshTimer) window.clearInterval(notificationRefreshTimer);
    notificationRefreshTimer = null;
}

function startNotificationRefresh(center) {
    if (!center) return;
    loadHeaderNotifications(center);
    if (notificationRefreshTimer) window.clearInterval(notificationRefreshTimer);
    notificationRefreshTimer = window.setInterval(() => loadHeaderNotifications(center), NOTIFICATION_REFRESH_INTERVAL);
}

function updateAuthHeader() {
    const authLink = document.querySelector(".page-header .login-button");
    if (!authLink) return;

    if (isLoggedIn()) {
        authLink.textContent = "Find Friends";
        authLink.setAttribute("href", "social.html#find-friends");
        authLink.classList.add("friends-header-link");
        authLink.removeAttribute("aria-disabled");
        authLink.onclick = null;
        const notificationCenter = getOrCreateNotificationCenter();
        startNotificationRefresh(notificationCenter);
        getOrCreateWallLink(authLink);
        getOrCreateLogoutButton();
    } else {
        authLink.textContent = "Log In/Sign Up";
        authLink.setAttribute("href", "login.html");
        authLink.classList.remove("friends-header-link");
        authLink.removeAttribute("aria-disabled");
        authLink.onclick = null;
        removeNotificationCenter();
        removeWallLink();
        removeLogoutButton();
    }
}

function updateWelcomeHeading() {
    const welcomeHeading = document.getElementById("welcomeHeading");
    if (!welcomeHeading) return;
    const firstName = getCurrentUserFirstName();
    welcomeHeading.textContent = firstName ? `Welcome ${firstName}` : "Welcome!";
}

function refreshAuthDisplay() {
    updateAuthHeader();
    updateWelcomeHeading();
}

window.addEventListener("DOMContentLoaded", async () => {
    refreshAuthDisplay();
    if (window.workoutAuth) {
        await window.workoutAuth.ready;
        refreshAuthDisplay();
    }
});

window.addEventListener("workout-auth-changed", refreshAuthDisplay);
window.addEventListener("focus", () => {
    const center = document.getElementById("notificationCenter");
    if (center && isLoggedIn()) loadHeaderNotifications(center);
});
