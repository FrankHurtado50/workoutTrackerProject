(function initializeWorkoutAuth() {
    const APP_AUTH_STORAGE_KEY = "workoutTrackerAuthV2";
    const LEGACY_AUTH_STORAGE_KEY = "workoutTrackerAuth";
    const config = window.WORKOUT_TRACKER_SUPABASE_CONFIG || {};
    const initialAuthType = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type");
    let isPasswordRecovery = initialAuthType === "recovery";
    const hasSupabaseLibrary = Boolean(window.supabase && typeof window.supabase.createClient === "function");
    const isConfigured =
        /^https:\/\/.+\.supabase\.co\/?$/i.test(String(config.url || "").trim()) &&
        /^(sb_publishable_|eyJ)/.test(String(config.publishableKey || "").trim());

    try {
        localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    } catch (error) {
        console.warn("Unable to remove the old browser-only account data.", error);
    }

    function normalizeEmail(email) {
        return String(email || "").trim().toLowerCase();
    }

    function readAppAuth() {
        try {
            const parsed = JSON.parse(localStorage.getItem(APP_AUTH_STORAGE_KEY) || "null");
            if (parsed && parsed.users && typeof parsed.users === "object") return parsed;
        } catch (error) {
            console.warn("Unable to read local workout profile data.", error);
        }
        return { users: {}, currentUser: null };
    }

    function writeAppAuth(auth) {
        localStorage.setItem(APP_AUTH_STORAGE_KEY, JSON.stringify(auth));
    }

    function getUserStorageKey(auth, email) {
        const normalizedEmail = normalizeEmail(email);
        if (normalizedEmail in auth.users) return normalizedEmail;
        return Object.keys(auth.users).find((key) => normalizeEmail(key) === normalizedEmail) || normalizedEmail;
    }

    function getFirstName(user, existingProfile) {
        const metadataName = user && user.user_metadata
            ? String(user.user_metadata.first_name || user.user_metadata.firstName || "").trim()
            : "";
        return metadataName || String(existingProfile && existingProfile.firstName || "").trim();
    }

    function syncLocalProfile(user) {
        const auth = readAppAuth();

        if (!user || !user.email) {
            auth.currentUser = null;
            writeAppAuth(auth);
            window.dispatchEvent(new CustomEvent("workout-auth-changed", { detail: { user: null } }));
            return null;
        }

        const email = normalizeEmail(user.email);
        const userKey = getUserStorageKey(auth, email);
        const existingProfile = auth.users[userKey] && typeof auth.users[userKey] === "object"
            ? auth.users[userKey]
            : {};
        const firstName = getFirstName(user, existingProfile);

        delete existingProfile.password;
        existingProfile.id = user.id;
        existingProfile.email = email;
        existingProfile.firstName = firstName;
        if (!Array.isArray(existingProfile.workouts)) existingProfile.workouts = [];
        if (!Array.isArray(existingProfile.routines)) existingProfile.routines = [];
        if (!existingProfile.routineProgress || typeof existingProfile.routineProgress !== "object") {
            existingProfile.routineProgress = {};
        }

        auth.users[userKey] = existingProfile;
        auth.currentUser = { id: user.id, email, firstName };
        writeAppAuth(auth);
        window.dispatchEvent(new CustomEvent("workout-auth-changed", { detail: { user: auth.currentUser } }));
        return auth.currentUser;
    }

    let client = null;
    if (hasSupabaseLibrary && isConfigured) {
        client = window.supabase.createClient(
            String(config.url).trim().replace(/\/$/, ""),
            String(config.publishableKey).trim(),
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );
    }

    const ready = client
        ? client.auth.getSession().then(({ data, error }) => {
            if (error) throw error;
            return syncLocalProfile(data.session ? data.session.user : null);
        }).catch((error) => {
            syncLocalProfile(null);
            console.error("Unable to restore the login session.", error);
            return null;
        })
        : Promise.resolve(syncLocalProfile(null));

    if (client) {
        client.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY") isPasswordRecovery = true;
            if (["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED", "PASSWORD_RECOVERY"].includes(event)) {
                syncLocalProfile(session ? session.user : null);
            }
        });
    }

    window.workoutAuth = {
        isConfigured: Boolean(client),
        ready,
        getClient() {
            return client;
        },
        async signIn(email, password) {
            if (!client) throw new Error("Online login has not been configured yet.");
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            syncLocalProfile(data.user);
            return data;
        },
        async signUp(email, password, firstName) {
            if (!client) throw new Error("Online login has not been configured yet.");
            const emailRedirectTo = new URL("email-confirmed.html", window.location.href).href;
            const { data, error } = await client.auth.signUp({
                email,
                password,
                options: {
                    data: { first_name: firstName },
                    emailRedirectTo
                }
            });
            if (error) throw error;
            if (data.session && data.user) syncLocalProfile(data.user);
            return data;
        },
        async requestPasswordReset(email) {
            if (!client) throw new Error("Online login has not been configured yet.");
            const redirectTo = new URL("reset-password.html", window.location.href).href;
            const { data, error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
            if (error) throw error;
            return data;
        },
        async updatePassword(password) {
            if (!client) throw new Error("Online login has not been configured yet.");
            const { data, error } = await client.auth.updateUser({ password });
            if (error) throw error;
            return data;
        },
        get isPasswordRecovery() {
            return isPasswordRecovery;
        },
        async signOut() {
            if (!client) {
                syncLocalProfile(null);
                return;
            }
            const { error } = await client.auth.signOut({ scope: "local" });
            if (error) throw error;
            syncLocalProfile(null);
        },
        async getSession() {
            if (!client) return null;
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            return data.session;
        }
    };
})();
