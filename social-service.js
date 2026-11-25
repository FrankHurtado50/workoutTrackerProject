(function initializeWorkoutSocial() {
    let session = null;
    let profile = null;
    let setupError = null;
    let engagementReady = true;

    function getClient() {
        return window.workoutAuth && typeof window.workoutAuth.getClient === "function"
            ? window.workoutAuth.getClient()
            : null;
    }

    function normalizeUsername(value) {
        return String(value || "").trim().toLowerCase().replace(/^@/, "");
    }

    function validateUsername(value) {
        const username = normalizeUsername(value);
        if (username.length < 3 || username.length > 20) {
            return "Username must be between 3 and 20 characters.";
        }
        if (!/^[a-z0-9_]+$/.test(username)) {
            return "Use only letters, numbers, and underscores.";
        }
        return "";
    }

    async function requireSession() {
        if (!window.workoutAuth || !window.workoutAuth.isConfigured) {
            throw new Error("Online login is not configured.");
        }
        await window.workoutAuth.ready;
        session = await window.workoutAuth.getSession();
        if (!session || !session.user) throw new Error("Please log in to use friends and your wall.");
        return session;
    }

    async function loadMyProfile() {
        await requireSession();
        const client = getClient();
        const { data, error } = await client
            .from("profiles")
            .select("user_id, username, display_name, created_at")
            .eq("user_id", session.user.id)
            .maybeSingle();
        if (error) throw error;
        profile = data || null;
        return profile;
    }

    const ready = loadMyProfile().catch((error) => {
        setupError = error;
        return null;
    });

    async function isUsernameAvailable(value) {
        const username = normalizeUsername(value);
        const validationError = validateUsername(username);
        if (validationError) return { available: false, message: validationError, username };
        const client = getClient();
        if (!client) throw new Error("Online login is not configured.");
        const { data, error } = await client.rpc("is_username_available", { p_username: username });
        if (error) throw error;
        return {
            available: Boolean(data),
            message: data ? `@${username} is available.` : `@${username} is already taken.`,
            username
        };
    }

    async function setMyUsername(value) {
        await requireSession();
        const username = normalizeUsername(value);
        const validationError = validateUsername(username);
        if (validationError) throw new Error(validationError);
        const client = getClient();
        const { data, error } = await client.rpc("set_my_username", { p_username: username });
        if (error) throw error;
        profile = Array.isArray(data) ? data[0] : data;
        return profile;
    }

    async function searchUsers(query) {
        await ready;
        const cleanQuery = normalizeUsername(query);
        if (!cleanQuery) return [];
        const client = getClient();
        const { data, error } = await client.rpc("search_social_profiles", { p_query: cleanQuery });
        if (error) throw error;
        return Array.isArray(data) ? data : [];
    }

    async function getConnections() {
        await ready;
        const client = getClient();
        const { data, error } = await client.rpc("get_my_social_connections");
        if (error) throw error;
        return Array.isArray(data) ? data : [];
    }

    async function sendFriendRequest(userId) {
        await ready;
        const client = getClient();
        const { data, error } = await client.rpc("send_friend_request", { p_user_id: userId });
        if (error) throw error;
        return data;
    }

    async function respondToFriendRequest(connectionId, accept) {
        await ready;
        const client = getClient();
        const { data, error } = await client.rpc("respond_to_friend_request", {
            p_connection_id: connectionId,
            p_accept: Boolean(accept)
        });
        if (error) throw error;
        return data;
    }

    async function removeConnection(userId) {
        await ready;
        const client = getClient();
        const { data, error } = await client.rpc("remove_social_connection", { p_user_id: userId });
        if (error) throw error;
        return Boolean(data);
    }

    async function getWallPosts() {
        await ready;
        const client = getClient();
        let result = await client
            .from("wall_posts")
            .select("id, user_id, workout_id, workout, caption, created_at, author:profiles!wall_posts_user_id_fkey(username, display_name), likes:wall_post_likes(user_id), comments:wall_post_comments(id, user_id, body, created_at, author:profiles!wall_post_comments_user_id_fkey(username, display_name))")
            .order("created_at", { ascending: false })
            .limit(100);
        if (result.error) {
            const message = String(result.error.message || "").toLowerCase();
            const missingEngagementSetup = message.includes("wall_post_likes")
                || message.includes("wall_post_comments")
                || (message.includes("relationship") && message.includes("wall_posts"));
            if (!missingEngagementSetup) throw result.error;
            engagementReady = false;
            result = await client
                .from("wall_posts")
                .select("id, user_id, workout_id, workout, caption, created_at, author:profiles!wall_posts_user_id_fkey(username, display_name)")
                .order("created_at", { ascending: false })
                .limit(100);
        } else {
            engagementReady = true;
        }
        if (result.error) throw result.error;
        return Array.isArray(result.data) ? result.data : [];
    }

    function buildWorkoutSnapshot(workout) {
        const snapshot = {
            exercise: String(workout && workout.exercise || "Workout").trim(),
            sets: Number(workout && workout.sets) || 0,
            total: Number(workout && workout.total) || 0,
            variableSets: Boolean(workout && workout.variableSets),
            recordedAt: workout && workout.recordedAt ? workout.recordedAt : new Date().toISOString()
        };
        if (snapshot.variableSets && Array.isArray(workout.setDetails)) {
            snapshot.setDetails = workout.setDetails.map((set) => ({
                reps: Number(set.reps) || 0,
                weight: Number(set.weight) || 0
            }));
        } else {
            snapshot.reps = Number(workout && workout.reps) || 0;
            snapshot.weight = Number(workout && workout.weight) || 0;
        }
        return snapshot;
    }

    async function createWallPost(workout, caption) {
        await ready;
        await requireSession();
        if (!profile || !profile.username) throw new Error("Choose a username before posting to your wall.");
        const client = getClient();
        const row = {
            user_id: session.user.id,
            workout_id: String(workout && workout.id || "") || null,
            workout: buildWorkoutSnapshot(workout),
            caption: String(caption || "").trim().slice(0, 300)
        };
        const { data, error } = await client.from("wall_posts").insert(row).select("id").single();
        if (error) throw error;
        return data;
    }

    async function deleteWallPost(postId) {
        await ready;
        await requireSession();
        const client = getClient();
        const { error } = await client
            .from("wall_posts")
            .delete()
            .eq("id", postId)
            .eq("user_id", session.user.id);
        if (error) throw error;
    }

    async function toggleWallPostLike(postId, isLiked) {
        await ready;
        await requireSession();
        const client = getClient();
        if (isLiked) {
            const { error } = await client
                .from("wall_post_likes")
                .delete()
                .eq("post_id", postId)
                .eq("user_id", session.user.id);
            if (error) throw error;
            return false;
        }
        const { error } = await client
            .from("wall_post_likes")
            .insert({ post_id: postId, user_id: session.user.id });
        if (error) throw error;
        return true;
    }

    async function addWallPostComment(postId, body) {
        await ready;
        await requireSession();
        const cleanBody = String(body || "").trim();
        if (!cleanBody) throw new Error("Write a comment before posting.");
        const client = getClient();
        const { data, error } = await client
            .from("wall_post_comments")
            .insert({ post_id: postId, user_id: session.user.id, body: cleanBody.slice(0, 240) })
            .select("id")
            .single();
        if (error) throw error;
        return data;
    }

    async function deleteWallPostComment(commentId) {
        await ready;
        await requireSession();
        const client = getClient();
        const { error } = await client
            .from("wall_post_comments")
            .delete()
            .eq("id", commentId);
        if (error) throw error;
    }

    window.workoutSocial = {
        ready,
        normalizeUsername,
        validateUsername,
        isUsernameAvailable,
        setMyUsername,
        loadMyProfile,
        searchUsers,
        getConnections,
        sendFriendRequest,
        respondToFriendRequest,
        removeConnection,
        getWallPosts,
        createWallPost,
        deleteWallPost,
        toggleWallPostLike,
        addWallPostComment,
        deleteWallPostComment,
        get profile() {
            return profile;
        },
        get userId() {
            return session && session.user ? session.user.id : null;
        },
        get error() {
            return setupError;
        },
        get engagementReady() {
            return engagementReady;
        }
    };
})();
