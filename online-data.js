(function initializeOnlineWorkoutData() {
    const AUTH_STORAGE_KEY = "workoutTrackerAuthV2";
    let activeUserId = null;
    let databaseAvailable = false;
    let lastError = null;
    let saveQueue = Promise.resolve();

    function normalizeEmail(email) {
        return String(email || "").trim().toLowerCase();
    }

    function readAuthStorage() {
        try {
            const parsed = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
            if (parsed && parsed.users && typeof parsed.users === "object") return parsed;
        } catch (error) {
            console.warn("Unable to read the local workout data cache.", error);
        }
        return { users: {}, currentUser: null };
    }

    function writeAuthStorage(auth) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    }

    function getUserStorageKey(auth, email) {
        const normalizedEmail = normalizeEmail(email);
        if (normalizedEmail in auth.users) return normalizedEmail;
        return Object.keys(auth.users).find((key) => normalizeEmail(key) === normalizedEmail) || normalizedEmail;
    }

    function getCurrentProfile() {
        const auth = readAuthStorage();
        const email = auth.currentUser ? normalizeEmail(auth.currentUser.email) : "";
        if (!email) return { auth, userKey: null, profile: null };

        const userKey = getUserStorageKey(auth, email);
        if (!auth.users[userKey] || typeof auth.users[userKey] !== "object") auth.users[userKey] = {};
        const profile = auth.users[userKey];
        if (!Array.isArray(profile.workouts)) profile.workouts = [];
        if (!Array.isArray(profile.routines)) profile.routines = [];
        if (!profile.routineProgress || typeof profile.routineProgress !== "object") profile.routineProgress = {};
        return { auth, userKey, profile };
    }

    function hydrateLocalProfile(row, sessionUser) {
        const { auth, userKey, profile } = getCurrentProfile();
        if (!userKey || !profile) return;

        profile.id = sessionUser.id;
        profile.email = normalizeEmail(sessionUser.email);
        profile.firstName = String(row.first_name || profile.firstName || "").trim();
        profile.workouts = Array.isArray(row.workouts) ? row.workouts : [];
        profile.routines = Array.isArray(row.routines) ? row.routines : [];
        profile.routineProgress = row.routine_progress && typeof row.routine_progress === "object"
            ? row.routine_progress
            : {};
        auth.users[userKey] = profile;
        auth.currentUser = {
            id: sessionUser.id,
            email: profile.email,
            firstName: profile.firstName
        };
        writeAuthStorage(auth);
        window.dispatchEvent(new CustomEvent("workout-data-synced", { detail: { source: "supabase" } }));
    }

    function buildDatabaseRow(userId) {
        const { profile } = getCurrentProfile();
        if (!profile) return null;
        return {
            user_id: userId,
            first_name: String(profile.firstName || "").trim(),
            workouts: Array.isArray(profile.workouts) ? profile.workouts : [],
            routines: Array.isArray(profile.routines) ? profile.routines : [],
            routine_progress: profile.routineProgress && typeof profile.routineProgress === "object"
                ? profile.routineProgress
                : {},
            updated_at: new Date().toISOString()
        };
    }

    function getClient() {
        return window.workoutAuth && typeof window.workoutAuth.getClient === "function"
            ? window.workoutAuth.getClient()
            : null;
    }

    async function loadOnlineData() {
        if (!window.workoutAuth || !window.workoutAuth.isConfigured) return null;
        await window.workoutAuth.ready;

        const session = await window.workoutAuth.getSession();
        if (!session || !session.user) return null;

        const client = getClient();
        if (!client) return null;
        activeUserId = session.user.id;

        const { data, error } = await client
            .from("user_data")
            .select("user_id, first_name, workouts, routines, routine_progress, updated_at")
            .eq("user_id", activeUserId)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            hydrateLocalProfile(data, session.user);
        } else {
            const row = buildDatabaseRow(activeUserId);
            const { error: insertError } = await client.from("user_data").insert(row);
            if (insertError) throw insertError;
        }

        databaseAvailable = true;
        lastError = null;
        return data;
    }

    const ready = loadOnlineData().catch((error) => {
        databaseAvailable = false;
        lastError = error;
        console.error("Online workout data is not ready. Run the Supabase database setup script.", error);
        return null;
    });

    async function saveCurrentUserData() {
        await ready;
        const session = window.workoutAuth ? await window.workoutAuth.getSession() : null;
        if (!session || !session.user) return;
        if (!databaseAvailable) {
            throw new Error("Online data storage is not set up yet. Run database-setup.sql in Supabase first.");
        }

        const client = getClient();
        const row = buildDatabaseRow(session.user.id);
        if (!client || !row) return;

        const { error } = await client.from("user_data").upsert(row, { onConflict: "user_id" });
        if (error) throw error;
        activeUserId = session.user.id;
        lastError = null;
        window.dispatchEvent(new CustomEvent("workout-data-saved"));
    }

    function save() {
        saveQueue = saveQueue.catch(() => undefined).then(saveCurrentUserData);
        return saveQueue;
    }

    async function getLeaderboardExercises() {
        await ready;
        if (!databaseAvailable) return [];
        const client = getClient();
        const { data, error } = await client.rpc("get_workout_leaderboard_exercises");
        if (error) throw error;
        return (Array.isArray(data) ? data : []).map((row) => row.exercise).filter(Boolean);
    }

    async function getLeaderboard(exercise, metric) {
        await ready;
        if (!databaseAvailable) return [];
        const client = getClient();
        const { data, error } = await client.rpc("get_workout_leaderboard", {
            p_exercise: exercise,
            p_metric: metric
        });
        if (error) throw error;
        return (Array.isArray(data) ? data : []).map((row) => ({
            name: row.display_name || "Athlete",
            score: Number(row.score) || 0,
            recordedAt: row.recorded_at,
            isCurrentUser: Boolean(row.is_current_user)
        }));
    }

    window.workoutData = {
        ready,
        save,
        getLeaderboard,
        getLeaderboardExercises,
        get isAvailable() {
            return databaseAvailable;
        },
        get error() {
            return lastError;
        },
        get userId() {
            return activeUserId;
        }
    };
})();
