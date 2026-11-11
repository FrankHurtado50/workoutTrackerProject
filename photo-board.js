(function initializePhotoBoard() {
    const PHOTO_TABLE = "photo_board_items";
    const PHOTO_BUCKET = "photo-board";
    const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
    const MAX_IMAGE_DIMENSION = 1800;
    const SIGNED_URL_SECONDS = 60 * 60;

    const boardGrid = document.getElementById("photoBoardGrid");
    const boardStatus = document.getElementById("photoBoardStatus");
    const boardAddButton = document.getElementById("photoBoardAddButton");
    const welcomeAddButton = document.getElementById("openPhotoUpload");
    const welcomeFeaturedPreview = document.getElementById("welcomeFeaturedPreview");
    const welcomeFeaturedImage = document.getElementById("welcomeFeaturedImage");

    if (!boardGrid && !boardAddButton && !welcomeAddButton && !welcomeFeaturedPreview) return;

    let client = null;
    let userId = null;
    let photos = [];
    let previewUrl = null;

    function navigateToLogin() {
        if (typeof window.navigateWithTransition === "function") {
            window.navigateWithTransition("login.html");
        } else {
            window.location.href = "login.html";
        }
    }

    function createUploadModal() {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = `
            <div class="photo-upload-modal" id="photoUploadModal" hidden>
                <div class="photo-upload-backdrop" data-close-photo-modal></div>
                <section class="photo-upload-dialog" role="dialog" aria-modal="true" aria-labelledby="photoUploadTitle">
                    <button type="button" class="photo-upload-close" data-close-photo-modal aria-label="Close photo upload">&times;</button>
                    <p class="photo-board-eyebrow">Make it yours</p>
                    <h2 id="photoUploadTitle">Add a Photo</h2>
                    <p class="photo-upload-intro">Add inspiration or save a moment from your progress.</p>

                    <form id="photoUploadForm" class="photo-upload-form">
                        <label for="photoUploadFile">Choose a photo</label>
                        <input type="file" id="photoUploadFile" accept="image/jpeg,image/png,image/webp" required>
                        <p class="input-help">JPEG, PNG, or WebP. Large phone photos are resized before uploading.</p>

                        <div class="photo-upload-preview" id="photoUploadPreview" hidden>
                            <img id="photoUploadPreviewImage" alt="Selected photo preview">
                        </div>

                        <label for="photoUploadType">Photo type</label>
                        <select id="photoUploadType">
                            <option value="inspiration">Inspiration</option>
                            <option value="progress">Progress</option>
                        </select>

                        <label for="photoUploadCaption">Caption <span class="optional-label">Optional</span></label>
                        <input type="text" id="photoUploadCaption" maxlength="120" placeholder="What keeps you going?">

                        <label for="photoUploadDate">Date <span class="optional-label">Optional</span></label>
                        <input type="date" id="photoUploadDate">

                        <label class="photo-option-row">
                            <input type="checkbox" id="photoUploadFeatured">
                            <span>Feature this photo on my board sticker</span>
                        </label>

                        <label class="photo-option-row">
                            <input type="checkbox" id="photoUploadBackground">
                            <span>Use this as my home background</span>
                        </label>

                        <p id="photoUploadMessage" class="photo-upload-message" aria-live="polite"></p>
                        <button type="submit" id="photoUploadSubmit" class="photo-upload-submit">Add to My Board</button>
                    </form>
                </section>
            </div>
        `;
        document.body.appendChild(wrapper.firstElementChild);
    }

    createUploadModal();

    const uploadModal = document.getElementById("photoUploadModal");
    const uploadForm = document.getElementById("photoUploadForm");
    const uploadFile = document.getElementById("photoUploadFile");
    const uploadType = document.getElementById("photoUploadType");
    const uploadCaption = document.getElementById("photoUploadCaption");
    const uploadDate = document.getElementById("photoUploadDate");
    const uploadFeatured = document.getElementById("photoUploadFeatured");
    const uploadBackground = document.getElementById("photoUploadBackground");
    const uploadPreview = document.getElementById("photoUploadPreview");
    const uploadPreviewImage = document.getElementById("photoUploadPreviewImage");
    const uploadMessage = document.getElementById("photoUploadMessage");
    const uploadSubmit = document.getElementById("photoUploadSubmit");

    function setBoardStatus(message, type = "") {
        if (!boardStatus) return;
        boardStatus.textContent = message;
        boardStatus.className = `photo-board-status${type ? ` ${type}` : ""}`;
    }

    function setUploadMessage(message, type = "") {
        uploadMessage.textContent = message;
        uploadMessage.className = `photo-upload-message${type ? ` ${type}` : ""}`;
    }

    function revokePreviewUrl() {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }

    function openUploadModal() {
        if (!userId) {
            navigateToLogin();
            return;
        }

        uploadForm.reset();
        uploadDate.value = new Date().toISOString().slice(0, 10);
        uploadFeatured.checked = photos.length === 0;
        uploadPreview.hidden = true;
        uploadPreviewImage.removeAttribute("src");
        revokePreviewUrl();
        setUploadMessage("");
        uploadModal.hidden = false;
        document.body.classList.add("photo-modal-open");
        window.setTimeout(() => uploadFile.focus(), 0);
    }

    function closeUploadModal() {
        uploadModal.hidden = true;
        document.body.classList.remove("photo-modal-open");
        revokePreviewUrl();
        uploadPreviewImage.removeAttribute("src");
    }

    uploadModal.querySelectorAll("[data-close-photo-modal]").forEach((element) => {
        element.addEventListener("click", closeUploadModal);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !uploadModal.hidden) closeUploadModal();
    });

    if (welcomeAddButton) welcomeAddButton.addEventListener("click", openUploadModal);
    if (boardAddButton) boardAddButton.addEventListener("click", openUploadModal);

    uploadFile.addEventListener("change", () => {
        revokePreviewUrl();
        const file = uploadFile.files && uploadFile.files[0];
        if (!file) {
            uploadPreview.hidden = true;
            uploadPreviewImage.removeAttribute("src");
            return;
        }

        previewUrl = URL.createObjectURL(file);
        uploadPreviewImage.src = previewUrl;
        uploadPreview.hidden = false;
        setUploadMessage("");
    });

    function friendlyPhotoError(error) {
        const message = String(error && error.message || error || "");
        if (/photo_board_items|photo-board|bucket not found|relation .* does not exist/i.test(message)) {
            return "The private photo board still needs its one-time Supabase setup.";
        }
        if (/row-level security|policy/i.test(message)) {
            return "Your photo could not be saved securely. Please check the photo-board setup in Supabase.";
        }
        if (/payload too large|maximum allowed size|file size/i.test(message)) {
            return "That photo is too large. Please choose a smaller image.";
        }
        return message || "Something went wrong with the photo board. Please try again.";
    }

    async function loadImage(file) {
        if (typeof createImageBitmap === "function") {
            try {
                return await createImageBitmap(file, { imageOrientation: "from-image" });
            } catch (error) {
                // Fall through to the regular image loader for older browsers.
            }
        }

        const objectUrl = URL.createObjectURL(file);
        try {
            const image = new Image();
            image.src = objectUrl;
            await image.decode();
            return image;
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }

    async function preparePhoto(file) {
        const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
        if (!file || !allowedTypes.has(file.type)) {
            throw new Error("Please choose a JPEG, PNG, or WebP image.");
        }
        if (file.size > MAX_SOURCE_BYTES) {
            throw new Error("That photo is too large. Please choose an image under 16 MB.");
        }

        const source = await loadImage(file);
        const sourceWidth = source.width || source.naturalWidth;
        const sourceHeight = source.height || source.naturalHeight;
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight));
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { alpha: false });
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(source, 0, 0, width, height);
        if (typeof source.close === "function") source.close();

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
        if (!blob) throw new Error("This browser could not prepare that photo. Please try another image.");
        return blob;
    }

    function createPhotoPath() {
        const id = window.crypto && typeof window.crypto.randomUUID === "function"
            ? window.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return `${userId}/${id}.jpg`;
    }

    async function clearPhotoFlag(flagName) {
        const { error } = await client
            .from(PHOTO_TABLE)
            .update({ [flagName]: false })
            .eq("user_id", userId);
        if (error) throw error;
    }

    async function uploadPhoto(event) {
        event.preventDefault();
        const file = uploadFile.files && uploadFile.files[0];
        if (!file) {
            setUploadMessage("Choose a photo first.", "error");
            uploadFile.focus();
            return;
        }

        uploadSubmit.disabled = true;
        uploadSubmit.textContent = "Preparing Photo...";
        setUploadMessage("Resizing your photo for a faster upload...");
        let storagePath = null;
        let metadataSaved = false;

        try {
            const preparedPhoto = await preparePhoto(file);
            storagePath = createPhotoPath();
            uploadSubmit.textContent = "Uploading...";

            const { error: uploadError } = await client.storage
                .from(PHOTO_BUCKET)
                .upload(storagePath, preparedPhoto, {
                    contentType: "image/jpeg",
                    cacheControl: "3600",
                    upsert: false
                });
            if (uploadError) throw uploadError;

            if (uploadFeatured.checked) await clearPhotoFlag("is_featured");
            if (uploadBackground.checked) await clearPhotoFlag("is_home_background");

            const metadata = {
                user_id: userId,
                storage_path: storagePath,
                caption: uploadCaption.value.trim(),
                photo_type: uploadType.value === "progress" ? "progress" : "inspiration",
                photo_date: uploadDate.value || null,
                is_featured: uploadFeatured.checked || photos.length === 0,
                is_home_background: uploadBackground.checked
            };
            const { error: metadataError } = await client.from(PHOTO_TABLE).insert(metadata);
            if (metadataError) throw metadataError;
            metadataSaved = true;

            setUploadMessage("Photo added to your board!", "success");
            await refreshPhotos();
            closeUploadModal();
            setBoardStatus("Photo added to your board.", "success");
        } catch (error) {
            if (storagePath && !metadataSaved) {
                await client.storage.from(PHOTO_BUCKET).remove([storagePath]).catch(() => undefined);
            }
            console.error("Unable to add the photo.", error);
            setUploadMessage(friendlyPhotoError(error), "error");
        } finally {
            uploadSubmit.disabled = false;
            uploadSubmit.textContent = "Add to My Board";
        }
    }

    uploadForm.addEventListener("submit", uploadPhoto);

    async function getSignedPhotoUrl(storagePath) {
        const { data, error } = await client.storage
            .from(PHOTO_BUCKET)
            .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
        if (error) throw error;
        return data.signedUrl;
    }

    async function fetchPhotos() {
        const { data, error } = await client
            .from(PHOTO_TABLE)
            .select("id, storage_path, caption, photo_type, photo_date, is_featured, is_home_background, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
        if (error) throw error;

        return Promise.all((data || []).map(async (photo) => ({
            ...photo,
            signedUrl: await getSignedPhotoUrl(photo.storage_path)
        })));
    }

    function formatPhotoDate(photo) {
        const rawDate = photo.photo_date || photo.created_at;
        if (!rawDate) return "";
        const date = photo.photo_date
            ? new Date(`${photo.photo_date}T12:00:00`)
            : new Date(photo.created_at);
        return Number.isNaN(date.getTime())
            ? ""
            : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }

    function makeActionButton(label, action, photo, options = {}) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `photo-card-action${options.danger ? " danger" : ""}`;
        button.textContent = label;
        button.dataset.photoAction = action;
        button.dataset.photoId = photo.id;
        if (options.disabled) button.disabled = true;
        return button;
    }

    function renderPhotoCard(photo, index) {
        const card = document.createElement("article");
        card.className = "photo-board-card";
        card.style.setProperty("--photo-tilt", `${[-2.4, 1.8, -1.1, 2.6][index % 4]}deg`);

        const imageWrap = document.createElement("div");
        imageWrap.className = "photo-card-image-wrap";
        const image = document.createElement("img");
        image.src = photo.signedUrl;
        image.alt = photo.caption || `${photo.photo_type === "progress" ? "Progress" : "Inspiration"} photo`;
        image.loading = "lazy";
        imageWrap.appendChild(image);

        if (photo.is_featured) {
            const featured = document.createElement("span");
            featured.className = "photo-featured-pin";
            featured.textContent = "Featured";
            imageWrap.appendChild(featured);
        }

        const meta = document.createElement("div");
        meta.className = "photo-card-meta";
        const type = document.createElement("span");
        type.className = `photo-type-badge ${photo.photo_type}`;
        type.textContent = photo.photo_type === "progress" ? "Progress" : "Inspiration";
        const date = document.createElement("time");
        date.textContent = formatPhotoDate(photo);
        meta.append(type, date);

        card.append(imageWrap, meta);
        if (photo.caption) {
            const caption = document.createElement("p");
            caption.className = "photo-card-caption";
            caption.textContent = photo.caption;
            card.appendChild(caption);
        }

        const actions = document.createElement("div");
        actions.className = "photo-card-actions";
        actions.append(
            makeActionButton(photo.is_featured ? "Featured" : "Feature", "feature", photo, { disabled: photo.is_featured }),
            makeActionButton(photo.is_home_background ? "Remove Background" : "Use as Background", "background", photo),
            makeActionButton("Delete", "delete", photo, { danger: true })
        );
        card.appendChild(actions);
        return card;
    }

    function renderBoard() {
        if (!boardGrid) return;
        boardGrid.innerHTML = "";
        if (!photos.length) {
            const emptyState = document.createElement("div");
            emptyState.className = "photo-board-empty";
            emptyState.innerHTML = `
                <span aria-hidden="true">&#10022;</span>
                <h2>Your board is ready</h2>
                <p>Add an inspiration photo or your first progress picture.</p>
            `;
            const addButton = document.createElement("button");
            addButton.type = "button";
            addButton.className = "photo-board-add-button";
            addButton.textContent = "+ Add Your First Photo";
            addButton.addEventListener("click", openUploadModal);
            emptyState.appendChild(addButton);
            boardGrid.appendChild(emptyState);
            setBoardStatus("");
            return;
        }

        photos.forEach((photo, index) => boardGrid.appendChild(renderPhotoCard(photo, index)));
        setBoardStatus(`${photos.length} ${photos.length === 1 ? "photo" : "photos"} on your private board.`);
    }

    function renderWelcomePersonalization() {
        if (!welcomeFeaturedPreview || !welcomeFeaturedImage) return;
        const featuredPhoto = photos.find((photo) => photo.is_featured) || photos[0];
        if (featuredPhoto) {
            welcomeFeaturedImage.src = featuredPhoto.signedUrl;
            welcomeFeaturedPreview.hidden = false;
        } else {
            welcomeFeaturedImage.removeAttribute("src");
            welcomeFeaturedPreview.hidden = true;
        }

        const backgroundPhoto = photos.find((photo) => photo.is_home_background);
        if (backgroundPhoto) {
            document.body.style.setProperty("--user-home-photo", `url("${backgroundPhoto.signedUrl}")`);
            document.body.classList.add("user-photo-background");
        } else {
            document.body.style.removeProperty("--user-home-photo");
            document.body.classList.remove("user-photo-background");
        }
    }

    async function refreshPhotos() {
        photos = await fetchPhotos();
        renderBoard();
        renderWelcomePersonalization();
    }

    async function setFeaturedPhoto(photo) {
        await clearPhotoFlag("is_featured");
        const { error } = await client
            .from(PHOTO_TABLE)
            .update({ is_featured: true })
            .eq("id", photo.id)
            .eq("user_id", userId);
        if (error) throw error;
    }

    async function toggleBackgroundPhoto(photo) {
        if (photo.is_home_background) {
            const { error } = await client
                .from(PHOTO_TABLE)
                .update({ is_home_background: false })
                .eq("id", photo.id)
                .eq("user_id", userId);
            if (error) throw error;
            return;
        }

        await clearPhotoFlag("is_home_background");
        const { error } = await client
            .from(PHOTO_TABLE)
            .update({ is_home_background: true })
            .eq("id", photo.id)
            .eq("user_id", userId);
        if (error) throw error;
    }

    async function deletePhoto(photo) {
        const confirmed = window.confirm("Are you sure you would like to remove this photo?");
        if (!confirmed) return false;

        const { error: fileError } = await client.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
        if (fileError) throw fileError;
        const { error: rowError } = await client
            .from(PHOTO_TABLE)
            .delete()
            .eq("id", photo.id)
            .eq("user_id", userId);
        if (rowError) throw rowError;
        return true;
    }

    if (boardGrid) {
        boardGrid.addEventListener("click", async (event) => {
            const button = event.target.closest("[data-photo-action]");
            if (!button || button.disabled) return;
            const photo = photos.find((item) => item.id === button.dataset.photoId);
            if (!photo) return;

            const originalText = button.textContent;
            button.disabled = true;
            button.textContent = "Saving...";
            setBoardStatus("");
            try {
                if (button.dataset.photoAction === "feature") await setFeaturedPhoto(photo);
                if (button.dataset.photoAction === "background") await toggleBackgroundPhoto(photo);
                if (button.dataset.photoAction === "delete") {
                    const deleted = await deletePhoto(photo);
                    if (!deleted) return;
                }
                await refreshPhotos();
            } catch (error) {
                console.error("Unable to update the photo board.", error);
                setBoardStatus(friendlyPhotoError(error), "error");
                button.disabled = false;
                button.textContent = originalText;
            }
        });
    }

    async function startPhotoBoard() {
        try {
            if (!window.workoutAuth) throw new Error("Login is still loading. Please refresh and try again.");
            await window.workoutAuth.ready;
            const session = await window.workoutAuth.getSession();
            if (!session || !session.user) {
                if (boardGrid) {
                    boardGrid.innerHTML = "";
                    setBoardStatus("Log in to create your private motivation board.", "login-required");
                }
                return;
            }

            client = window.workoutAuth.getClient();
            userId = session.user.id;
            await refreshPhotos();
        } catch (error) {
            console.error("Unable to load the photo board.", error);
            setBoardStatus(friendlyPhotoError(error), "error");
        }
    }

    startPhotoBoard();
})();
