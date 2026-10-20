package com.cronus.system;

import android.app.Activity;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Base64;
import android.webkit.WebView;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Secure, versioned OTA installer for the local WebView app shell. APK updates remain separate. */
final class WebUpdateManager {
    private static final String OWNER = "ivan-timur";
    private static final String REPOSITORY = "SYSTEM_V1.0.0";
    private static final String BRANCH = "system-ota";
    private static final String CONTENTS_API = "https://api.github.com/repos/" + OWNER + "/" + REPOSITORY + "/contents/";
    private static final String MANIFEST_FILE = "latest.json";
    private static final String BUNDLE_FILE = "SYSTEM-Web.zip";
    private static final String PREFS = "system_web_updater";
    private static final String ACTIVE_VERSION = "active_web_version";
    private static final String PREVIOUS_VERSION = "previous_web_version";
    private static final String PENDING_CONFIRMATION = "web_update_pending_confirmation";
    private static final String LAST_CHECK = "last_web_update_check_ms";
    private static final Pattern VERSION_PATTERN = Pattern.compile("^(\\d+)\\.(\\d+)\\.(\\d+)$");
    private static final Pattern SHA256_PATTERN = Pattern.compile("^[a-fA-F0-9]{64}$");
    private static final long MAX_BUNDLE_BYTES = 60L * 1024L * 1024L;
    private static final long MAX_EXPANDED_BYTES = 90L * 1024L * 1024L;
    private static final long MAX_SINGLE_FILE_BYTES = 30L * 1024L * 1024L;
    private static final int MAX_MANIFEST_BYTES = 128 * 1024;
    private static final int MAX_ENTRIES = 6000;
    private static final int MAX_TOKEN_CHARS = 512;

    private final Activity activity;
    private final WebView webView;
    private final GitHubReleaseUpdater githubUpdater;
    private final SharedPreferences preferences;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private volatile JSONObject availableManifest;

    WebUpdateManager(Activity activity, WebView webView, GitHubReleaseUpdater githubUpdater) {
        this.activity = activity;
        this.webView = webView;
        this.githubUpdater = githubUpdater;
        this.preferences = activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
    }

    /** Roll back an update if the previous process died before the new page finished loading. */
    void prepareForLaunch() {
        if (!preferences.getBoolean(PENDING_CONFIRMATION, false)) return;
        String previous = preferences.getString(PREVIOUS_VERSION, bundledVersion());
        if (!isVersionAvailable(previous)) previous = bundledVersion();
        preferences.edit()
                .putString(ACTIVE_VERSION, previous)
                .putBoolean(PENDING_CONFIRMATION, false)
                .remove(PREVIOUS_VERSION)
                .commit();
    }

    void confirmCurrentWebVersion() {
        if (!preferences.getBoolean(PENDING_CONFIRMATION, false)) return;
        preferences.edit().putBoolean(PENDING_CONFIRMATION, false).commit();
        pruneOldVersions();
    }

    String getInstalledWebVersion() {
        String bundled = bundledVersion();
        String active = preferences.getString(ACTIVE_VERSION, "");
        if (!isValidVersion(active)) return bundled;
        if (!isVersionDirectoryAvailable(active)) return bundled;
        try {
            return compareVersions(active, bundled) >= 0 ? active : bundled;
        } catch (UpdateException error) {
            return bundled;
        }
    }

    long getLastCheckMillis() {
        return preferences.getLong(LAST_CHECK, 0L);
    }

    /** Used by MainActivity's local-only WebView asset handler. */
    File getActiveVersionDirectory() {
        String bundled = bundledVersion();
        String active = preferences.getString(ACTIVE_VERSION, "");
        if (!isValidVersion(active) || !isVersionDirectoryAvailable(active)) return null;
        try {
            if (compareVersions(active, bundled) < 0) return null;
        } catch (UpdateException error) {
            return null;
        }
        try {
            File directory = new File(versionsDirectory(), active).getCanonicalFile();
            File root = versionsDirectory().getCanonicalFile();
            return directory.getPath().startsWith(root.getPath() + File.separator) ? directory : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    void checkForUpdates() {
        if (!isTrustedLocalPage()) return;
        String token = githubUpdater == null ? null : githubUpdater.getGitHubTokenForWebUpdate();
        if (token == null) {
            emit("needs-token", "Save the repository's read-only GitHub token first.");
            return;
        }
        if (!busy.compareAndSet(false, true)) return;
        availableManifest = null;
        emit("checking", "");
        worker.execute(() -> {
            try {
                JSONObject manifest = fetchManifest(token);
                validateManifest(manifest);
                preferences.edit().putLong(LAST_CHECK, System.currentTimeMillis()).apply();
                String version = manifest.getString("version");
                String nativeMinimum = manifest.getString("minNativeVersion");
                if (compareVersions(nativeVersion(), nativeMinimum) < 0) {
                    dispatch("incompatible-native", "This web update requires native SYSTEM " + nativeMinimum + " or later.", version, -1L);
                    return;
                }
                String current = getInstalledWebVersion();
                if (compareVersions(version, current) <= 0) {
                    JSONObject result = event("up-to-date");
                    result.put("version", current);
                    result.put("currentVersion", current);
                    dispatch(result);
                    return;
                }
                availableManifest = manifest;
                JSONObject result = event("update-available");
                result.put("version", version);
                result.put("currentVersion", current);
                result.put("size", manifest.optLong("size", -1L));
                result.put("builtAt", clip(manifest.optString("builtAt", ""), 80));
                result.put("sourceCommit", clip(manifest.optString("sourceCommit", ""), 20));
                dispatch(result);
            } catch (UpdateException error) {
                dispatch(error.state, error.getMessage(), "", -1L);
            } catch (Exception error) {
                dispatch("error", safeMessage(error), "", -1L);
            } finally {
                busy.set(false);
            }
        });
    }

    void applyAvailableUpdate() {
        if (!isTrustedLocalPage()) return;
        String token = githubUpdater == null ? null : githubUpdater.getGitHubTokenForWebUpdate();
        JSONObject manifest = availableManifest;
        if (token == null) {
            emit("needs-token", "Save the repository's read-only GitHub token first.");
            return;
        }
        if (manifest == null) {
            emit("error", "Check for web updates again before applying one.");
            return;
        }
        if (!busy.compareAndSet(false, true)) return;
        worker.execute(() -> {
            File download = new File(activity.getCacheDir(), "SYSTEM-Web.zip.part");
            File completedDownload = new File(activity.getCacheDir(), BUNDLE_FILE);
            File staging = null;
            try {
                validateManifest(manifest);
                String version = manifest.getString("version");
                long expectedSize = manifest.getLong("size");
                String expectedHash = manifest.getString("sha256");
                if (compareVersions(nativeVersion(), manifest.getString("minNativeVersion")) < 0) {
                    throw new UpdateException("incompatible-native", "This web update requires native SYSTEM " + manifest.getString("minNativeVersion") + " or later.");
                }
                if (compareVersions(version, getInstalledWebVersion()) <= 0) {
                    throw new UpdateException("error", "This web version is no longer newer than the installed version. Check for updates again.");
                }
                // Remove incomplete leftovers before starting a new transfer.
                //noinspection ResultOfMethodCallIgnored
                download.delete();
                //noinspection ResultOfMethodCallIgnored
                completedDownload.delete();
                emit("downloading", "");
                downloadBundle(token, expectedSize, download);
                if (!verifySha256(download, expectedHash)) {
                    throw new UpdateException("checksum-invalid", "The web update failed SHA-256 verification and was rejected.");
                }
                if (!download.renameTo(completedDownload)) {
                    // A rename is not required for security, but use a stable file name for recovery/debugging.
                    try (InputStream in = new FileInputStream(download); OutputStream out = new FileOutputStream(completedDownload)) {
                        copyBounded(in, out, expectedSize, MAX_BUNDLE_BYTES);
                    }
                    //noinspection ResultOfMethodCallIgnored
                    download.delete();
                }
                emit("installing", "");
                staging = new File(otaDirectory(), "staging-" + version + "-" + System.nanoTime());
                if (!staging.mkdirs()) throw new UpdateException("error", "Could not create a private staging directory for the web update.");
                extractAndValidate(completedDownload, staging, version);

                String previous = getInstalledWebVersion();
                File versions = versionsDirectory();
                if (!versions.exists() && !versions.mkdirs()) throw new UpdateException("error", "Could not prepare the local web version directory.");
                File destination = new File(versions, version);
                if (destination.exists() && !deleteRecursively(destination)) {
                    throw new UpdateException("error", "Could not replace an incomplete folder for this web version.");
                }
                if (!staging.renameTo(destination)) throw new UpdateException("error", "Could not atomically move the verified web update into place.");
                staging = null;
                boolean committed = preferences.edit()
                        .putString(PREVIOUS_VERSION, previous)
                        .putString(ACTIVE_VERSION, version)
                        .putBoolean(PENDING_CONFIRMATION, true)
                        .commit();
                if (!committed) {
                    // Restore the previous selection; the previously active files have not been removed.
                    preferences.edit().putString(ACTIVE_VERSION, previous).putBoolean(PENDING_CONFIRMATION, false).remove(PREVIOUS_VERSION).commit();
                    deleteRecursively(destination);
                    throw new UpdateException("error", "Could not activate the web update. The previous version remains active.");
                }
                JSONObject result = event("applied");
                result.put("version", version);
                result.put("currentVersion", previous);
                result.put("message", "Verified update installed. Reloading SYSTEM.");
                activity.runOnUiThread(() -> {
                    if (webView != null) webView.clearCache(true);
                    dispatch(result);
                });
            } catch (UpdateException error) {
                dispatch(error.state, error.getMessage(), "", -1L);
            } catch (Exception error) {
                dispatch("error", safeMessage(error), "", -1L);
            } finally {
                //noinspection ResultOfMethodCallIgnored
                download.delete();
                //noinspection ResultOfMethodCallIgnored
                completedDownload.delete();
                if (staging != null) deleteRecursively(staging);
                busy.set(false);
            }
        });
    }

    void close() {
        worker.shutdownNow();
    }

    private JSONObject fetchManifest(String token) throws Exception {
        URL url = new URL(CONTENTS_API + MANIFEST_FILE + "?ref=" + BRANCH);
        HttpURLConnection connection = openApiConnection(url, token, "application/vnd.github+json");
        try {
            int code = connection.getResponseCode();
            if (code == 401) throw new UpdateException("token-invalid", "GitHub rejected the saved token.");
            if (code == 403) throw new UpdateException("access-denied", "The token needs read-only Contents access to the private repository.");
            if (code == 404) throw new UpdateException("ota-not-published", "No OTA bundle has been published yet. Run the SYSTEM web OTA workflow first.");
            if (code != HttpURLConnection.HTTP_OK) throw new UpdateException("error", "GitHub returned HTTP " + code + " while checking web updates.");
            JSONObject file = new JSONObject(readBounded(connection.getInputStream(), MAX_MANIFEST_BYTES));
            if (!"base64".equalsIgnoreCase(file.optString("encoding", ""))) {
                throw new UpdateException("manifest-invalid", "GitHub did not return the OTA manifest in the expected format.");
            }
            byte[] content = Base64.decode(file.optString("content", ""), Base64.DEFAULT);
            if (content.length == 0 || content.length > MAX_MANIFEST_BYTES) throw new UpdateException("manifest-invalid", "The OTA manifest is empty or too large.");
            return new JSONObject(new String(content, StandardCharsets.UTF_8));
        } finally {
            connection.disconnect();
        }
    }

    private void validateManifest(JSONObject manifest) throws Exception {
        if (manifest == null || manifest.optInt("schemaVersion", 0) != 1) {
            throw new UpdateException("manifest-invalid", "Unsupported or missing OTA manifest schema.");
        }
        String version = manifest.optString("version", "");
        String minNative = manifest.optString("minNativeVersion", "");
        String zip = manifest.optString("zip", "");
        String hash = manifest.optString("sha256", "");
        long size = manifest.optLong("size", -1L);
        if (!isValidVersion(version) || !isValidVersion(minNative)) {
            throw new UpdateException("manifest-invalid", "The OTA manifest contains an invalid semantic version.");
        }
        if (!BUNDLE_FILE.equals(zip)) throw new UpdateException("manifest-invalid", "The OTA manifest references an unexpected bundle filename.");
        if (!SHA256_PATTERN.matcher(hash).matches()) throw new UpdateException("manifest-invalid", "The OTA manifest SHA-256 value is malformed.");
        if (size <= 0 || size > MAX_BUNDLE_BYTES) throw new UpdateException("manifest-invalid", "The OTA bundle size is missing or exceeds the 60 MB limit.");
    }

    private void downloadBundle(String token, long expectedSize, File destination) throws Exception {
        URL url = new URL(CONTENTS_API + BUNDLE_FILE + "?ref=" + BRANCH);
        HttpURLConnection connection = openApiConnection(url, token, "application/vnd.github.raw+json");
        try {
            int code = connection.getResponseCode();
            if (code == 401) throw new UpdateException("token-invalid", "GitHub rejected the saved token while downloading the web bundle.");
            if (code == 403) throw new UpdateException("access-denied", "The token cannot download the web bundle from the OTA branch.");
            if (code == 404) throw new UpdateException("ota-not-published", "The published web bundle was not found on the OTA branch.");
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                throw new UpdateException("error", "GitHub unexpectedly redirected the private OTA bundle request; the update was stopped safely.");
            }
            if (code != HttpURLConnection.HTTP_OK) throw new UpdateException("error", "GitHub returned HTTP " + code + " while downloading the web bundle.");
            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_BUNDLE_BYTES || (contentLength >= 0 && contentLength != expectedSize)) {
                throw new UpdateException("manifest-invalid", "The downloaded web bundle size does not match the published manifest.");
            }
            try (InputStream input = new BufferedInputStream(connection.getInputStream());
                 OutputStream output = new BufferedOutputStream(new FileOutputStream(destination, false))) {
                copyBounded(input, output, expectedSize, MAX_BUNDLE_BYTES);
            }
            if (destination.length() != expectedSize) throw new UpdateException("error", "The web bundle download was incomplete. Try again on a stable connection.");
        } finally {
            connection.disconnect();
        }
    }

    private HttpURLConnection openApiConnection(URL url, String token, String accept) throws Exception {
        if (!"https".equalsIgnoreCase(url.getProtocol()) || !"api.github.com".equalsIgnoreCase(url.getHost())
                || url.getUserInfo() != null || (url.getPort() != -1 && url.getPort() != 443)) {
            throw new UpdateException("error", "The OTA request URL failed host validation.");
        }
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(60000);
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Accept", accept);
        connection.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
        connection.setRequestProperty("User-Agent", "SYSTEM-Android-Web-OTA");
        return connection;
    }

    private void extractAndValidate(File zipFile, File staging, String expectedVersion) throws Exception {
        long expanded = 0L;
        int count = 0;
        File stageCanonical = staging.getCanonicalFile();
        try (ZipInputStream zip = new ZipInputStream(new BufferedInputStream(new FileInputStream(zipFile)))) {
            ZipEntry entry;
            byte[] buffer = new byte[32 * 1024];
            while ((entry = zip.getNextEntry()) != null) {
                if (++count > MAX_ENTRIES) throw new UpdateException("bundle-invalid", "The web bundle contains too many entries.");
                String name = entry.getName();
                validateZipEntryName(name);
                File target = new File(staging, name).getCanonicalFile();
                if (!target.getPath().startsWith(stageCanonical.getPath() + File.separator)) {
                    throw new UpdateException("bundle-invalid", "The web bundle contains a path outside its permitted directory.");
                }
                if (entry.isDirectory()) {
                    if (!target.isDirectory() && !target.mkdirs()) throw new UpdateException("error", "Could not create a directory while installing the web update.");
                    zip.closeEntry();
                    continue;
                }
                if (!target.getParentFile().exists() && !target.getParentFile().mkdirs()) {
                    throw new UpdateException("error", "Could not create a directory while installing the web update.");
                }
                long fileBytes = 0L;
                try (OutputStream output = new BufferedOutputStream(new FileOutputStream(target, false))) {
                    int read;
                    while ((read = zip.read(buffer)) != -1) {
                        fileBytes += read;
                        expanded += read;
                        if (fileBytes > MAX_SINGLE_FILE_BYTES || expanded > MAX_EXPANDED_BYTES) {
                            throw new UpdateException("bundle-invalid", "The expanded web bundle exceeded a safety size limit.");
                        }
                        output.write(buffer, 0, read);
                    }
                    output.flush();
                }
                zip.closeEntry();
            }
        }
        File webRoot = new File(staging, "www");
        File index = new File(webRoot, "index.html");
        File versionFile = new File(webRoot, "WEB_VERSION");
        if (!webRoot.isDirectory() || !index.isFile() || !versionFile.isFile()) {
            throw new UpdateException("bundle-invalid", "The bundle is missing www/index.html or www/WEB_VERSION.");
        }
        String bundledVersion;
        try (InputStream input = new FileInputStream(versionFile)) {
            bundledVersion = readBounded(input, 64).trim();
        }
        if (!expectedVersion.equals(bundledVersion)) {
            throw new UpdateException("bundle-invalid", "The web bundle version does not match the OTA manifest.");
        }
        if (new File(webRoot, "js/modules/android-native.js").isFile() == false) {
            throw new UpdateException("bundle-invalid", "The web bundle is missing the Android bridge module.");
        }
    }

    private void validateZipEntryName(String name) throws UpdateException {
        if (name == null || name.isEmpty() || name.startsWith("/") || name.startsWith("\\") || name.contains("\\")
                || name.contains(":") || name.indexOf('\u0000') >= 0 || !(name.equals("www") || name.startsWith("www/"))) {
            throw new UpdateException("bundle-invalid", "The web bundle contains a forbidden path.");
        }
        String[] parts = name.split("/");
        for (String part : parts) {
            if (part.equals("..") || part.equals(".")) throw new UpdateException("bundle-invalid", "The web bundle contains a path traversal entry.");
        }
    }

    private void copyBounded(InputStream input, OutputStream output, long expectedSize, long absoluteLimit) throws Exception {
        byte[] buffer = new byte[32 * 1024];
        long copied = 0L;
        int read;
        while ((read = input.read(buffer)) != -1) {
            copied += read;
            if (copied > absoluteLimit || (expectedSize >= 0 && copied > expectedSize)) {
                throw new UpdateException("bundle-invalid", "The transfer exceeded the expected web bundle size.");
            }
            output.write(buffer, 0, read);
        }
        output.flush();
    }

    private boolean verifySha256(File file, String expectedHash) throws Exception {
        if (file == null || !file.isFile() || !SHA256_PATTERN.matcher(expectedHash == null ? "" : expectedHash).matches()) return false;
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new BufferedInputStream(new FileInputStream(file))) {
            byte[] buffer = new byte[32 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
        }
        StringBuilder actual = new StringBuilder(64);
        for (byte value : digest.digest()) actual.append(String.format(Locale.US, "%02x", value & 0xff));
        return MessageDigest.isEqual(actual.toString().getBytes(StandardCharsets.US_ASCII),
                expectedHash.toLowerCase(Locale.US).getBytes(StandardCharsets.US_ASCII));
    }

    private JSONObject event(String state) throws JSONException {
        JSONObject result = new JSONObject();
        result.put("state", state);
        return result;
    }

    private void emit(String state, String message) {
        dispatch(state, message, "", -1L);
    }

    private void dispatch(String state, String message, String version, long size) {
        try {
            JSONObject result = event(state);
            if (message != null && !message.isEmpty()) result.put("message", clip(message, 280));
            if (version != null && !version.isEmpty()) result.put("version", version);
            if (size >= 0) result.put("size", size);
            dispatch(result);
        } catch (JSONException ignored) { }
    }

    private void dispatch(JSONObject data) {
        if (webView == null) return;
        final String payload = JSONObject.quote(data.toString());
        final String script = "window.dispatchEvent(new CustomEvent('system-android-web-update',{detail:JSON.parse(" + payload + ")}));";
        activity.runOnUiThread(() -> {
            try {
                if (webView != null) webView.evaluateJavascript(script, null);
            } catch (RuntimeException ignored) { }
        });
    }

    private boolean isTrustedLocalPage() {
        try {
            Uri uri = Uri.parse(webView == null ? "" : String.valueOf(webView.getUrl()));
            return "https".equalsIgnoreCase(uri.getScheme()) && "appassets.androidplatform.net".equalsIgnoreCase(uri.getHost());
        } catch (Exception ignored) {
            return false;
        }
    }

    private String nativeVersion() {
        String value = BuildConfig.VERSION_NAME == null ? "" : BuildConfig.VERSION_NAME;
        java.util.regex.Matcher matcher = Pattern.compile("(\\d+\\.\\d+\\.\\d+)").matcher(value);
        return matcher.find() ? matcher.group(1) : "1.0.0";
    }

    private String bundledVersion() {
        try (InputStream input = activity.getAssets().open("www/WEB_VERSION")) {
            String value = readBounded(input, 64).trim();
            return isValidVersion(value) ? value : "1.0.0";
        } catch (Exception ignored) {
            return "1.0.0";
        }
    }

    private File otaDirectory() {
        return new File(activity.getFilesDir(), "system-web-ota");
    }

    private File versionsDirectory() {
        return new File(otaDirectory(), "versions");
    }

    private boolean isVersionAvailable(String version) {
        return isValidVersion(version) && (version.equals(bundledVersion()) || isVersionDirectoryAvailable(version));
    }

    private boolean isVersionDirectoryAvailable(String version) {
        if (!isValidVersion(version)) return false;
        try {
            File root = versionsDirectory().getCanonicalFile();
            File directory = new File(root, version).getCanonicalFile();
            return directory.getPath().startsWith(root.getPath() + File.separator)
                    && new File(directory, "www/index.html").isFile()
                    && new File(directory, "www/WEB_VERSION").isFile();
        } catch (Exception ignored) {
            return false;
        }
    }

    private void pruneOldVersions() {
        String active = getInstalledWebVersion();
        String previous = preferences.getString(PREVIOUS_VERSION, "");
        File[] files = versionsDirectory().listFiles();
        if (files == null) return;
        for (File file : files) {
            if (!file.isDirectory() || file.getName().equals(active) || file.getName().equals(previous)) continue;
            deleteRecursively(file);
        }
    }

    private boolean deleteRecursively(File file) {
        if (file == null || !file.exists()) return true;
        File canonical;
        try {
            canonical = file.getCanonicalFile();
            File allowedRoot = otaDirectory().getCanonicalFile();
            if (!canonical.equals(allowedRoot) && !canonical.getPath().startsWith(allowedRoot.getPath() + File.separator)) return false;
        } catch (Exception ignored) {
            return false;
        }
        if (canonical.isDirectory()) {
            File[] children = canonical.listFiles();
            if (children != null) for (File child : children) if (!deleteRecursively(child)) return false;
        }
        return canonical.delete() || !canonical.exists();
    }

    private int compareVersions(String left, String right) throws UpdateException {
        int[] a = parseVersion(left);
        int[] b = parseVersion(right);
        for (int i = 0; i < 3; i++) if (a[i] != b[i]) return Integer.compare(a[i], b[i]);
        return 0;
    }

    private int[] parseVersion(String version) throws UpdateException {
        java.util.regex.Matcher matcher = VERSION_PATTERN.matcher(version == null ? "" : version);
        if (!matcher.matches()) throw new UpdateException("manifest-invalid", "Could not compare semantic version numbers.");
        try {
            return new int[]{Integer.parseInt(matcher.group(1)), Integer.parseInt(matcher.group(2)), Integer.parseInt(matcher.group(3))};
        } catch (NumberFormatException error) {
            throw new UpdateException("manifest-invalid", "The semantic version number is outside the supported range.");
        }
    }

    private boolean isValidVersion(String version) {
        if (version == null) return false;
        java.util.regex.Matcher matcher = VERSION_PATTERN.matcher(version);
        if (!matcher.matches()) return false;
        try {
            for (int i = 1; i <= 3; i++) Integer.parseInt(matcher.group(i));
            return true;
        } catch (NumberFormatException error) {
            return false;
        }
    }

    private String readBounded(InputStream input, int maxBytes) throws Exception {
        try (InputStream source = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = source.read(buffer)) != -1) {
                if (output.size() + read > maxBytes) throw new UpdateException("manifest-invalid", "GitHub returned data above the configured safety limit.");
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private String safeMessage(Exception error) {
        String message = error == null ? "Unexpected network or file error." : error.getMessage();
        if (message == null || message.trim().isEmpty()) return "Unexpected network or file error.";
        return clip(message.replaceAll("[\\r\\n\\t]", " "), 220);
    }

    private String clip(String value, int max) {
        if (value == null) return "";
        String text = value.replace('\u0000', ' ').trim();
        return text.length() > max ? text.substring(0, max) : text;
    }

    private static final class UpdateException extends Exception {
        final String state;
        UpdateException(String state, String message) {
            super(message);
            this.state = state;
        }
    }
}
