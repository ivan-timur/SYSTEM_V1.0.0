/** Native Android host integration. Safe no-op in ordinary browsers/PWA mode. */
export function initAndroidNative() {
    const bridge = window.SYSTEMAndroid;
    if (!bridge || typeof bridge.getPlatform !== "function" || bridge.getPlatform() !== "android") return false;

    document.documentElement.dataset.systemPlatform = "android";
    document.documentElement.dataset.systemOfflineAssets = "bundled";

    // Keep a direct Blob reference so exports work even when the app's CSP disallows
    // fetching blob: URLs. The native document picker receives only text exports.
    const blobUrls = new Map();
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => {
        const url = originalCreateObjectURL(blob);
        blobUrls.set(url, blob);
        return url;
    };
    URL.revokeObjectURL = url => {
        originalRevokeObjectURL(url);
        window.setTimeout(() => blobUrls.delete(url), 10000);
    };

    // WebView does not consistently expose Blob-URL downloads through DownloadListener.
    // Capture downloads initiated by the existing app and hand their text to the native
    // Android Storage Access Framework so users can save a real backup file.
    document.addEventListener("click", event => {
        const link = event.target instanceof Element ? event.target.closest("a[download]") : null;
        if (!link || !link.href || !link.href.startsWith("blob:")) return;
        const href = link.href;
        const filename = link.download || "system-export.json";
        const trackedBlob = blobUrls.get(href);
        event.preventDefault();
        event.stopImmediatePropagation();
        const blobPromise = trackedBlob ? Promise.resolve(trackedBlob) : fetch(href).then(response => response.blob());
        blobPromise.then(async blob => {
            const content = typeof blob.text === "function"
                ? await blob.text()
                : await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ""));
                    reader.onerror = () => reject(reader.error || new Error("Could not read export blob."));
                    reader.readAsText(blob);
                });
            bridge.saveTextFile(filename, (blob.type || "application/octet-stream").split(";")[0], content);
        }).catch(error => {
            console.error("SYSTEM Android export failed", error);
            if (typeof window.notifySystem === "function") {
                window.notifySystem(document.documentElement.lang.startsWith("fa")
                    ? "صادرکردن فایل ناموفق بود. دوباره تلاش کن."
                    : "Export failed. Please try again.");
            }
        });
    }, true);

    window.addEventListener("system-android-file-saved", event => {
        const detail = event.detail || {};
        const fa = document.documentElement.lang.startsWith("fa");
        if (detail.filename && detail.filename.startsWith("system-backup-")) {
            const status = document.getElementById("system-backup-status");
            if (status && status.isConnected && detail.ok) {
                status.textContent = fa ? `نسخهٔ پشتیبان در ${detail.filename} ذخیره شد. آن را در جای امن نگه‌دار.`
                    : `Verified backup saved as ${detail.filename}. Keep it somewhere safe.`;
            } else if (status && status.isConnected && detail.message && detail.message !== "Save cancelled.") {
                status.textContent = fa ? "ذخیرهٔ نسخهٔ پشتیبان ناموفق بود. فضای ذخیره‌سازی را بررسی کن."
                    : "Backup could not be saved. Check storage space and try again.";
            }
        }
        if (detail.ok || detail.message === "Save cancelled.") return;
        if (typeof window.notifySystem === "function") {
            window.notifySystem(fa ? "ذخیرهٔ فایل انجام نشد." : "File was not saved.");
        }
    });

    window.addEventListener("system-android-reminder-status", event => {
        const checkbox = document.getElementById("exp-native-reminder");
        if (checkbox && event.detail && event.detail.enabled === false) checkbox.checked = false;
    });

    initGithubReleaseUpdater(bridge);
    initWebOtaUpdater(bridge);
    return true;
}

/** GitHub release updater UI. Secrets never enter web storage; native Android encrypts them. */
function initGithubReleaseUpdater(bridge) {
    const card = document.getElementById("system-github-updater");
    if (!card) return;
    card.hidden = false;

    const tokenInput = document.getElementById("system-github-token");
    const saveTokenButton = document.getElementById("system-github-token-save");
    const clearTokenButton = document.getElementById("system-github-token-clear");
    const checkButton = document.getElementById("system-update-check");
    const downloadButton = document.getElementById("system-update-download");
    const status = document.getElementById("system-update-status");
    const versionBadge = document.getElementById("system-update-current-version");
    const releaseNotes = document.getElementById("system-update-release-notes");
    const hasNativeMethod = method => typeof bridge[method] === "function";
    const installedVersion = hasNativeMethod("getInstalledVersion") ? String(bridge.getInstalledVersion()) : "—";
    const lastCheck = hasNativeMethod("getLastUpdateCheckMillis") ? Number(bridge.getLastUpdateCheckMillis()) || 0 : 0;
    let currentDetail = { state: "idle" };

    const isDari = () => String(document.documentElement.lang || "en").toLowerCase().startsWith("fa")
        || document.body.dataset.systemLanguage === "fa";
    const tx = (english, dari) => isDari() ? dari : english;
    const localNumber = value => Number(value).toLocaleString(isDari() ? "fa-AF" : "en-US");
    const tokenExists = () => hasNativeMethod("hasGitHubToken") && bridge.hasGitHubToken();

    function renderTokenState() {
        const exists = tokenExists();
        clearTokenButton.disabled = !exists;
        tokenInput.placeholder = exists
            ? tx("Token saved securely on this device", "توکن به‌گونهٔ امن در این دستگاه ذخیره شده است")
            : "github_pat_…";
    }

    function renderStaticCopy() {
        const eyebrow = card.querySelector(".system-update-eyebrow");
        const title = document.getElementById("system-update-title");
        const description = card.querySelector(".system-update-description");
        const tokenLabel = card.querySelector('label[for="system-github-token"]');
        const help = document.getElementById("system-github-token-help");
        const footnote = card.querySelector(".system-update-footnote");
        if (eyebrow) eyebrow.textContent = tx("SYSTEM RELEASE CHANNEL", "کانال انتشار SYSTEM");
        if (title) title.textContent = tx("App updates", "به‌روزرسانی برنامه");
        if (description) description.textContent = tx(
            "Check for signed SYSTEM updates from your private GitHub repository.",
            "به‌روزرسانی‌های امضاشدهٔ SYSTEM را از مخزن خصوصی GitHub بررسی کنید."
        );
        if (tokenLabel) tokenLabel.textContent = tx("Fine-grained GitHub token", "توکن GitHub با دسترسی محدود");
        if (help) help.textContent = tx(
            "Use a fine-grained token limited to ivan-timur/SYSTEM_V1.0.0 with read-only Contents access. The token is encrypted with Android Keystore on this device and is not written to app web storage.",
            "از یک توکن محدود به مخزن ivan-timur/SYSTEM_V1.0.0 با دسترسی فقط‌خواندنی Contents استفاده کنید. توکن با Android Keystore رمزنگاری می‌شود و در ذخیره‌سازی وب برنامه نوشته نمی‌شود."
        );
        saveTokenButton.textContent = tx("Save token", "ذخیرهٔ توکن");
        clearTokenButton.textContent = tx("Remove saved token", "حذف توکن ذخیره‌شده");
        checkButton.textContent = tx("Check for updates", "بررسی به‌روزرسانی‌ها");
        downloadButton.textContent = tx("Download and install", "بارگیری و نصب");
        if (footnote) footnote.textContent = tx(
            "Updates are downloaded over HTTPS. Android will ask you to approve installation; SYSTEM cannot silently install APKs. Install the signed Release APK first—debug builds cannot update themselves.",
            "به‌روزرسانی‌ها از طریق HTTPS دریافت می‌شوند. اندروید برای نصب از شما تأیید می‌خواهد؛ SYSTEM نمی‌تواند APK را بی‌اجازه نصب کند. نخست نسخهٔ امضاشدهٔ Release را نصب کنید؛ نسخهٔ Debug خود را به‌روزرسانی نمی‌کند."
        );
        versionBadge.textContent = tx(`Current version: ${installedVersion}`, `نسخهٔ فعلی: ${installedVersion}`);
    }

    function idleStatus() {
        if (lastCheck > 0 && Date.now() - lastCheck < 24 * 60 * 60 * 1000) {
            const hoursAgo = Math.max(0, Math.round((Date.now() - lastCheck) / (60 * 60 * 1000)));
            return hoursAgo < 1
                ? tx("Last automatic update check: less than an hour ago. You can check again manually.", "آخرین بررسی خودکار کمتر از یک ساعت پیش بود. می‌توانید دوباره به‌صورت دستی بررسی کنید.")
                : tx(`Last automatic update check: ${hoursAgo} hours ago. You can check again manually.`, `آخرین بررسی خودکار ${localNumber(hoursAgo)} ساعت پیش بود. می‌توانید دوباره به‌صورت دستی بررسی کنید.`);
        }
        return tx("Update check has not run yet.", "بررسی به‌روزرسانی هنوز اجرا نشده است.");
    }

    function statusFor(detail) {
        const version = detail.version ? String(detail.version) : "";
        switch (detail.state) {
            case "idle": return idleStatus();
            case "checking": return tx("Checking the latest SYSTEM release on GitHub…", "در حال بررسی آخرین انتشار SYSTEM در GitHub…");
            case "needs-token": return tx(
                "Save a fine-grained GitHub token with read-only Contents access for ivan-timur/SYSTEM_V1.0.0.",
                "یک توکن GitHub محدود به مخزن ivan-timur/SYSTEM_V1.0.0 با دسترسی فقط‌خواندنی Contents ذخیره کنید."
            );
            case "up-to-date": return tx(`SYSTEM is up to date (latest release: ${version || "current"}).`, `SYSTEM به‌روز است (آخرین انتشار: ${version || "نسخهٔ فعلی"}).`);
            case "update-available": return tx(
                `SYSTEM ${version} is available. Review the release notes, then choose Download and install.`,
                `نسخهٔ SYSTEM ${version} موجود است. توضیحات انتشار را بررسی کرده و سپس «بارگیری و نصب» را انتخاب کنید.`
            );
            case "downloading": return tx("Downloading the signed APK from the private GitHub release…", "در حال دریافت APK امضاشده از انتشار خصوصی GitHub…");
            case "download-progress": return tx(`Downloading SYSTEM update… ${localNumber(Math.max(0, Math.min(100, Number(detail.progress) || 0)))}%`, `در حال دریافت به‌روزرسانی SYSTEM… ${localNumber(Math.max(0, Math.min(100, Number(detail.progress) || 0)))}٪`);
            case "downloaded": return tx("APK downloaded. Android’s package installer should open next.", "APK دریافت شد. اکنون نصب‌کنندهٔ بستهٔ اندروید باید باز شود.");
            case "install-permission-needed": return tx("Allow SYSTEM to install apps from this source in Android Settings. When you return, the installer will open.", "در تنظیمات اندروید اجازهٔ نصب برنامه از این منبع را به SYSTEM بدهید. پس از بازگشت، نصب‌کننده باز می‌شود.");
            case "debug-build": return tx("This is a debug APK. Install the signed Release APK first; debug APKs cannot self-update.", "این APK نسخهٔ Debug است. نخست APK امضاشدهٔ Release را نصب کنید؛ نسخهٔ Debug نمی‌تواند خودش را به‌روزرسانی کند.");
            case "token-invalid": return tx("GitHub rejected this token. Replace it with an active fine-grained token that has read-only Contents access to this repository.", "GitHub این توکن را نپذیرفت. توکن فعال و محدود با دسترسی فقط‌خواندنی Contents برای این مخزن وارد کنید.");
            case "access-denied": return tx("GitHub could not access the private repository. Check the repository name and the token’s repository access/Contents permission.", "GitHub به مخزن خصوصی دسترسی نیافت. نام مخزن و مجوز دسترسی توکن به مخزن و Contents را بررسی کنید.");
            case "no-apk": return tx("The latest GitHub release has no compatible SYSTEM APK asset. Publish a signed SYSTEM-version.apk asset first.", "در آخرین انتشار GitHub فایل APK سازگار SYSTEM وجود ندارد. نخست فایل امضاشدهٔ SYSTEM-version.apk را منتشر کنید.");
            case "checksum-missing": return tx("The latest GitHub release has no SHA-256 checksum asset. Update blocked for safety; publish SYSTEM-version.apk.sha256 and try again.", "آخرین انتشار GitHub فایل چک‌سام SHA-256 ندارد. برای ایمنی به‌روزرسانی متوقف شد؛ فایل SYSTEM-version.apk.sha256 را منتشر و دوباره تلاش کنید.");
            case "checksum-invalid": return tx("The Release checksum file is malformed. The APK download was stopped for safety.", "فایل چک‌سام انتشار خراب یا نامعتبر است. برای ایمنی بارگیری APK متوقف شد.");
            case "error":
                return detail.message
                    ? tx(`Update check failed: ${String(detail.message).slice(0, 240)}`, `بررسی به‌روزرسانی ناموفق بود: ${String(detail.message).slice(0, 240)}`)
                    : tx("Update check failed. Check your connection and token, then try again.", "بررسی به‌روزرسانی ناموفق بود. اتصال و توکن را بررسی و دوباره تلاش کنید.");
            default: return tx("Update check has not run yet.", "بررسی به‌روزرسانی هنوز اجرا نشده است.");
        }
    }

    function renderEvent(detail) {
        currentDetail = detail || { state: "idle" };
        const state = currentDetail.state || "idle";
        checkButton.disabled = state === "checking" || state === "downloading" || state === "download-progress";
        downloadButton.disabled = state === "downloading" || state === "download-progress";
        downloadButton.hidden = state !== "update-available";
        status.textContent = statusFor(currentDetail);
        status.dataset.state = state;
        if (state === "update-available" && currentDetail.notes) {
            releaseNotes.textContent = String(currentDetail.notes).slice(0, 1600);
            releaseNotes.hidden = false;
        } else if (state !== "update-available") {
            releaseNotes.hidden = true;
            releaseNotes.textContent = "";
        }
        if (state === "needs-token" || state === "token-invalid" || state === "access-denied") renderTokenState();
    }

    saveTokenButton.addEventListener("click", () => {
        const token = tokenInput.value.trim();
        if (!token) {
            status.textContent = tx("Paste your fine-grained GitHub token first.", "نخست توکن محدود GitHub خود را وارد کنید.");
            tokenInput.focus();
            return;
        }
        if (!hasNativeMethod("saveGitHubToken") || !bridge.saveGitHubToken(token)) {
            status.textContent = tx("Token was not saved. Check that it is a valid GitHub token (github_pat_… or ghp_…).", "توکن ذخیره نشد. معتبر بودن توکن GitHub (github_pat_… یا ghp_…) را بررسی کنید.");
            return;
        }
        tokenInput.value = "";
        renderTokenState();
        status.textContent = tx("GitHub token saved securely. Checking releases…", "توکن GitHub به‌صورت امن ذخیره شد. در حال بررسی انتشارها…");
        if (hasNativeMethod("checkForUpdates")) bridge.checkForUpdates();
        if (hasNativeMethod("checkForWebUpdates")) bridge.checkForWebUpdates();
    });

    clearTokenButton.addEventListener("click", () => {
        if (hasNativeMethod("clearGitHubToken")) bridge.clearGitHubToken();
        tokenInput.value = "";
        downloadButton.hidden = true;
        renderTokenState();
        status.textContent = tx("Saved GitHub token removed from this device.", "توکن GitHub ذخیره‌شده از این دستگاه حذف شد.");
    });

    checkButton.addEventListener("click", () => {
        if (!tokenExists()) {
            status.textContent = tx("Save a fine-grained GitHub token with read-only Contents access before checking this private repository.", "پیش از بررسی این مخزن خصوصی، توکن محدود GitHub با دسترسی فقط‌خواندنی Contents ذخیره کنید.");
            tokenInput.focus();
            return;
        }
        checkButton.disabled = true;
        downloadButton.hidden = true;
        releaseNotes.hidden = true;
        status.textContent = tx("Checking the latest SYSTEM release on GitHub…", "در حال بررسی آخرین انتشار SYSTEM در GitHub…");
        if (hasNativeMethod("checkForUpdates")) bridge.checkForUpdates();
    });

    downloadButton.addEventListener("click", () => {
        if (!hasNativeMethod("downloadLatestUpdate")) {
            status.textContent = tx("This Android build does not include the native updater. Install the latest signed Release APK first.", "این ساخت اندروید به‌روزرسان بومی ندارد. نخست آخرین APK امضاشدهٔ Release را نصب کنید.");
            return;
        }
        downloadButton.disabled = true;
        status.textContent = tx("Starting secure APK download…", "در حال آغاز دریافت امن APK…");
        bridge.downloadLatestUpdate();
    });

    window.addEventListener("system-android-update", event => renderEvent(event.detail || {}));
    window.addEventListener("system-language-change", () => {
        renderStaticCopy();
        renderTokenState();
        renderEvent(currentDetail);
    });

    renderStaticCopy();
    renderTokenState();
    renderEvent(currentDetail);
    // Check at most once per 24 hours on app launch; the user can always check manually.
    if (tokenExists() && Date.now() - lastCheck >= 24 * 60 * 60 * 1000) {
        window.setTimeout(() => {
            if (tokenExists() && hasNativeMethod("checkForUpdates")) bridge.checkForUpdates();
        }, 1200);
    }
}


/** Web-only updater: applies a verified local bundle without installing a new APK. */
function initWebOtaUpdater(bridge) {
    const section = document.getElementById("system-web-updater");
    if (!section) return;

    const checkButton = document.getElementById("system-web-update-check");
    const applyButton = document.getElementById("system-web-update-apply");
    const status = document.getElementById("system-web-update-status");
    const versionBadge = document.getElementById("system-web-update-version");
    const footnote = document.getElementById("system-web-update-footnote");
    const hasMethod = method => typeof bridge[method] === "function";
    const isDari = () => String(document.documentElement.lang || "en").toLowerCase().startsWith("fa")
        || document.body.dataset.systemLanguage === "fa";
    const tx = (english, dari) => isDari() ? dari : english;
    const currentVersion = () => hasMethod("getInstalledWebVersion") ? String(bridge.getInstalledWebVersion()) : "—";
    const lastCheck = hasMethod("getLastWebUpdateCheckMillis") ? Number(bridge.getLastWebUpdateCheckMillis()) || 0 : 0;
    let currentDetail = { state: "idle" };

    function renderStaticCopy() {
        const title = document.getElementById("system-web-update-title");
        const descriptions = section.querySelector(".system-update-description");
        const eyebrow = section.querySelector(".system-update-eyebrow");
        if (eyebrow) eyebrow.textContent = tx("SYSTEM WEB CHANNEL", "کانال وب SYSTEM");
        if (title) title.textContent = tx("Interface and feature updates", "به‌روزرسانی ظاهر و امکانات");
        if (descriptions) descriptions.textContent = tx(
            "Update compatible web UI and JavaScript features without reinstalling the APK.",
            "ظاهر و امکانات سازگار JavaScript را بدون نصب دوبارهٔ APK به‌روز کنید."
        );
        checkButton.textContent = tx("Check web updates", "بررسی به‌روزرسانی وب");
        applyButton.textContent = tx("Apply web update", "اعمال به‌روزرسانی وب");
        if (footnote) footnote.textContent = tx(
            "Web packages are verified before activation. SYSTEM keeps the previous version so it can recover if a new page fails to start. Native Android changes still require an APK update.",
            "بستهٔ وب پیش از فعال‌شدن بررسی می‌شود. نسخهٔ قبلی حفظ می‌شود تا اگر صفحهٔ تازه اجرا نشد، بازیابی شود. تغییرات بومی اندروید هنوز به APK تازه نیاز دارند."
        );
        versionBadge.textContent = tx(`Web ${currentVersion()}`, `نسخهٔ وب ${currentVersion()}`);
    }

    function statusFor(detail) {
        const version = detail.version ? String(detail.version) : "";
        const message = detail.message ? String(detail.message).slice(0, 220) : "";
        switch (detail.state) {
            case "idle": return lastCheck > 0
                ? tx("Web updater ready. You can check again at any time.", "به‌روزرسان وب آماده است؛ هر زمان می‌توانید دوباره بررسی کنید.")
                : tx("No web update check has run yet.", "بررسی به‌روزرسانی وب هنوز انجام نشده است.");
            case "checking": return tx("Checking the private SYSTEM OTA channel…", "در حال بررسی کانال خصوصی به‌روزرسانی SYSTEM…");
            case "needs-token": return tx("Save the read-only GitHub token above before checking the private OTA channel.", "پیش از بررسی کانال خصوصی، توکن GitHub فقط‌خواندنی را در بخش بالا ذخیره کنید.");
            case "up-to-date": return tx(`Web features are up to date (${version || currentVersion()}).`, `امکانات وب به‌روز است (${version || currentVersion()}).`);
            case "update-available": return tx(`Web update ${version} is available. Applying it will reload SYSTEM; no APK install is required.`, `به‌روزرسانی وب ${version} موجود است. با اعمال آن SYSTEM دوباره بارگذاری می‌شود؛ نصب APK نیاز نیست.`);
            case "downloading": return tx("Downloading the web package over HTTPS…", "در حال دریافت بستهٔ وب از راه HTTPS…");
            case "installing": return tx("Verifying and preparing the update safely…", "در حال بررسی و آماده‌سازی امن به‌روزرسانی…");
            case "applied": return tx(`Web update ${version} is installed. Reloading SYSTEM…`, `به‌روزرسانی وب ${version} نصب شد؛ SYSTEM دوباره بارگذاری می‌شود…`);
            case "incompatible-native": return tx(message || "This web update needs a newer native APK.", message || "این به‌روزرسانی وب به APK بومی تازه‌تری نیاز دارد.");
            case "ota-not-published": return tx(message || "The OTA bundle has not been published yet.", message || "بستهٔ OTA هنوز منتشر نشده است.");
            case "token-invalid": return tx("GitHub rejected the saved token. Replace it with a valid read-only token.", "GitHub توکن ذخیره‌شده را نپذیرفت؛ یک توکن معتبر فقط‌خواندنی جایگزین کنید.");
            case "access-denied": return tx(message || "GitHub access was denied. Check the token's repository access.", message || "دسترسی GitHub رد شد؛ دسترسی توکن به مخزن را بررسی کنید.");
            case "manifest-invalid": return tx(message || "The update manifest is invalid; nothing was applied.", message || "فهرست به‌روزرسانی نامعتبر است؛ هیچ تغییری اعمال نشد.");
            case "checksum-invalid": return tx(message || "The update package failed verification and was rejected.", message || "بستهٔ به‌روزرسانی تأیید نشد و رد گردید.");
            case "bundle-invalid": return tx(message || "The web package failed safety checks and was rejected.", message || "بستهٔ وب بررسی‌های ایمنی را نگذشت و رد شد.");
            case "error": return tx(message ? `Web update failed: ${message}` : "Web update failed. Check your connection and try again.", message ? `به‌روزرسانی وب ناموفق شد: ${message}` : "به‌روزرسانی وب ناموفق شد؛ اتصال را بررسی و دوباره تلاش کنید.");
            default: return tx("Web updater ready.", "به‌روزرسان وب آماده است.");
        }
    }

    function renderEvent(detail) {
        currentDetail = detail || { state: "idle" };
        const state = currentDetail.state || "idle";
        checkButton.disabled = ["checking", "downloading", "installing"].includes(state);
        applyButton.disabled = ["downloading", "installing"].includes(state);
        applyButton.hidden = state !== "update-available";
        status.textContent = statusFor(currentDetail);
        status.dataset.state = state;
        if (state === "applied") {
            versionBadge.textContent = tx(`Web ${currentDetail.version || currentVersion()}`, `نسخهٔ وب ${currentDetail.version || currentVersion()}`);
            window.setTimeout(() => window.location.reload(), 900);
        }
        if (["needs-token", "token-invalid", "access-denied"].includes(state)) {
            const tokenInput = document.getElementById("system-github-token");
            if (tokenInput && !tokenInput.value) tokenInput.focus();
        }
    }

    checkButton.addEventListener("click", () => {
        if (!hasMethod("checkForWebUpdates")) {
            status.textContent = tx("This Android build does not include the web OTA manager. Install the newer signed APK first.", "این نسخهٔ اندروید مدیر OTA وب را ندارد؛ نخست APK امضاشدهٔ تازه‌تر را نصب کنید.");
            return;
        }
        checkButton.disabled = true;
        applyButton.hidden = true;
        status.textContent = tx("Checking the latest web bundle…", "در حال بررسی آخرین بستهٔ وب…");
        bridge.checkForWebUpdates();
    });

    applyButton.addEventListener("click", () => {
        if (!hasMethod("applyWebUpdate")) {
            status.textContent = tx("This Android build cannot apply web updates.", "این نسخهٔ اندروید نمی‌تواند به‌روزرسانی وب را اعمال کند.");
            return;
        }
        applyButton.disabled = true;
        status.textContent = tx("Starting verified web update…", "در حال آغاز به‌روزرسانی تأییدشدهٔ وب…");
        bridge.applyWebUpdate();
    });

    window.addEventListener("system-android-web-update", event => renderEvent(event.detail || {}));
    window.addEventListener("system-language-change", () => {
        renderStaticCopy();
        renderEvent(currentDetail);
    });
    renderStaticCopy();
    renderEvent(currentDetail);

    if (hasMethod("getLastWebUpdateCheckMillis") && Date.now() - lastCheck >= 24 * 60 * 60 * 1000
        && hasMethod("hasGitHubToken") && bridge.hasGitHubToken() && hasMethod("checkForWebUpdates")) {
        window.setTimeout(() => bridge.checkForWebUpdates(), 1800);
    }
}
