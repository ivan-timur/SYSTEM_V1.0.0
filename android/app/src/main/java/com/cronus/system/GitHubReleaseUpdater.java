package com.cronus.system;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.WebView;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
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
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Checks private GitHub Releases and hands user-approved APK installation to Android. */
final class GitHubReleaseUpdater {
    private static final String OWNER = "ivan-timur";
    private static final String REPOSITORY = "SYSTEM_V1.0.0";
    private static final String RELEASE_API = "https://api.github.com/repos/" + OWNER + "/" + REPOSITORY + "/releases/latest";
    private static final String ASSET_API = "https://api.github.com/repos/" + OWNER + "/" + REPOSITORY + "/releases/assets/";
    private static final String UPDATE_PREFS = "system_github_updater";
    private static final String TOKEN_ENCRYPTED_KEY = "github_token_encrypted";
    private static final String PENDING_INSTALL_KEY = "pending_update_apk";
    private static final String LAST_CHECK_KEY = "last_update_check_ms";
    private static final String KEY_ALIAS = "SYSTEM_GITHUB_TOKEN_AES_GCM_V1";
    private static final int MAX_APK_BYTES = 180 * 1024 * 1024;
    private static final int MAX_CHECKSUM_BYTES = 1024;
    private static final int MAX_TOKEN_CHARS = 512;
    private static final Pattern SHA256_PATTERN = Pattern.compile("^[a-fA-F0-9]{64}$");
    private static final Pattern VERSION_PATTERN = Pattern.compile("^v?(\\d+)\\.(\\d+)\\.(\\d+)$");
    private static final Pattern TOKEN_PATTERN = Pattern.compile("^(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})$");

    private final Activity activity;
    private final WebView webView;
    private final SharedPreferences preferences;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private volatile long latestAssetId = -1;
    private volatile long latestAssetSize = -1;
    private volatile long latestChecksumAssetId = -1;
    private volatile long latestChecksumAssetSize = -1;
    private volatile String latestVersion = "";

    GitHubReleaseUpdater(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.preferences = activity.getSharedPreferences(UPDATE_PREFS, Activity.MODE_PRIVATE);
    }

    String getInstalledVersion() {
        Matcher matcher = Pattern.compile("(\\d+\\.\\d+\\.\\d+)").matcher(BuildConfig.VERSION_NAME);
        return matcher.find() ? matcher.group(1) : BuildConfig.VERSION_NAME;
    }

    boolean hasGitHubToken() {
        return preferences.contains(TOKEN_ENCRYPTED_KEY);
    }

    /** Shares the device-encrypted, read-only repository token with the native OTA manager. */
    String getGitHubTokenForWebUpdate() {
        if (!isTrustedLocalPage()) return null;
        return readGitHubToken();
    }

    long getLastUpdateCheckMillis() {
        return preferences.getLong(LAST_CHECK_KEY, 0L);
    }

    boolean saveGitHubToken(String token) {
        if (!isTrustedLocalPage() || token == null) return false;
        String cleaned = token.trim();
        if (cleaned.length() > MAX_TOKEN_CHARS || !TOKEN_PATTERN.matcher(cleaned).matches()) return false;
        try {
            SecretKey key = getOrCreateEncryptionKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] iv = cipher.getIV();
            byte[] encrypted = cipher.doFinal(cleaned.getBytes(StandardCharsets.UTF_8));
            byte[] packed = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, packed, 0, iv.length);
            System.arraycopy(encrypted, 0, packed, iv.length, encrypted.length);
            preferences.edit().putString(TOKEN_ENCRYPTED_KEY, Base64.encodeToString(packed, Base64.NO_WRAP)).apply();
            return true;
        } catch (Exception error) {
            return false;
        }
    }

    void clearGitHubToken() {
        if (!isTrustedLocalPage()) return;
        preferences.edit().remove(TOKEN_ENCRYPTED_KEY).remove(PENDING_INSTALL_KEY).apply();
        latestAssetId = -1;
        latestAssetSize = -1;
        latestChecksumAssetId = -1;
        latestChecksumAssetSize = -1;
        latestVersion = "";
    }

    void checkForUpdates() {
        if (!isTrustedLocalPage()) return;
        final String token = readGitHubToken();
        if (token == null) {
            emit("needs-token");
            return;
        }
        if (!busy.compareAndSet(false, true)) return;
        latestAssetId = -1;
        latestAssetSize = -1;
        latestChecksumAssetId = -1;
        latestChecksumAssetSize = -1;
        latestVersion = "";
        emit("checking");
        worker.execute(() -> {
            try {
                JSONObject release = fetchLatestRelease(token);
                preferences.edit().putLong(LAST_CHECK_KEY, System.currentTimeMillis()).apply();
                String tag = release.optString("tag_name", "");
                Matcher versionMatcher = VERSION_PATTERN.matcher(tag);
                if (!versionMatcher.matches()) {
                    throw new UpdateException("error", "Latest release tag must use vMAJOR.MINOR.PATCH format.");
                }
                String version = versionMatcher.group(1) + "." + versionMatcher.group(2) + "." + versionMatcher.group(3);
                JSONArray assets = release.optJSONArray("assets");
                JSONObject apk = findReleaseApk(assets, version);
                if (compareVersions(version, getInstalledVersion()) <= 0) {
                    latestAssetId = -1;
                    latestAssetSize = -1;
                    latestChecksumAssetId = -1;
                    latestChecksumAssetSize = -1;
                    latestVersion = version;
                    JSONObject result = event("up-to-date");
                    result.put("version", version);
                    dispatch(result);
                    return;
                }
                if (apk == null) {
                    latestAssetId = -1;
                    latestAssetSize = -1;
                    latestChecksumAssetId = -1;
                    latestChecksumAssetSize = -1;
                    latestVersion = version;
                    JSONObject result = event("no-apk");
                    result.put("version", version);
                    dispatch(result);
                    return;
                }
                JSONObject checksum = findReleaseChecksum(assets, version);
                if (checksum == null) {
                    latestAssetId = -1;
                    latestAssetSize = -1;
                    latestChecksumAssetId = -1;
                    latestChecksumAssetSize = -1;
                    latestVersion = version;
                    throw new UpdateException("checksum-missing", "The latest Release is missing its SYSTEM-" + version + ".apk.sha256 verification file.");
                }
                long assetSize = apk.optLong("size", -1L);
                long checksumSize = checksum.optLong("size", -1L);
                if (assetSize <= 0 || assetSize > MAX_APK_BYTES) {
                    throw new UpdateException("error", "The release APK size is missing or exceeds the 180 MB limit.");
                }
                if (checksumSize <= 0 || checksumSize > MAX_CHECKSUM_BYTES || checksum.optLong("id", -1L) <= 0) {
                    throw new UpdateException("error", "The release SHA-256 checksum asset is invalid or exceeds the 1 KB limit.");
                }
                latestAssetId = apk.getLong("id");
                latestAssetSize = assetSize;
                latestChecksumAssetId = checksum.getLong("id");
                latestChecksumAssetSize = checksumSize;
                latestVersion = version;

                JSONObject result = event("update-available");
                result.put("version", version);
                result.put("tag", tag);
                result.put("releaseUrl", release.optString("html_url", ""));
                result.put("notes", clip(release.optString("body", ""), 1600));
                result.put("apkSize", assetSize);
                dispatch(result);
            } catch (UpdateException error) {
                dispatch(error.state, error.getMessage());
            } catch (Exception error) {
                dispatch("error", safeMessage(error));
            } finally {
                busy.set(false);
            }
        });
    }

    void downloadLatestUpdate() {
        if (!isTrustedLocalPage()) return;
        if (BuildConfig.DEBUG || BuildConfig.APPLICATION_ID.endsWith(".debug")) {
            emit("debug-build");
            return;
        }
        final String token = readGitHubToken();
        final long assetId = latestAssetId;
        final long assetSize = latestAssetSize;
        final long checksumAssetId = latestChecksumAssetId;
        final long checksumAssetSize = latestChecksumAssetSize;
        final String version = latestVersion;
        if (token == null) {
            emit("needs-token");
            return;
        }
        if (assetId <= 0 || checksumAssetId <= 0 || version.isEmpty() || assetSize <= 0 || checksumAssetSize <= 0) {
            dispatch("error", "Check for updates again and confirm the Release has a SHA-256 checksum before downloading.");
            return;
        }
        if (!busy.compareAndSet(false, true)) return;
        emit("downloading");
        worker.execute(() -> {
            File apkFile = null;
            File checksumFile = null;
            try {
                File updateDirectory = new File(activity.getCacheDir(), "updates");
                if (!updateDirectory.exists() && !updateDirectory.mkdirs()) {
                    throw new UpdateException("error", "Could not create the temporary update directory.");
                }
                apkFile = new File(updateDirectory, "SYSTEM-" + version + ".apk");
                checksumFile = new File(updateDirectory, "SYSTEM-" + version + ".apk.sha256");
                downloadAsset(checksumAssetId, checksumAssetSize, token, checksumFile);
                String expectedSha256 = readExpectedSha256(checksumFile, apkFile.getName());
                downloadAsset(assetId, assetSize, token, apkFile);
                if (!verifySha256(apkFile, expectedSha256)) {
                    //noinspection ResultOfMethodCallIgnored
                    apkFile.delete();
                    //noinspection ResultOfMethodCallIgnored
                    checksumFile.delete();
                    throw new UpdateException("error", "The downloaded APK failed SHA-256 verification and was deleted.");
                }
                //noinspection ResultOfMethodCallIgnored
                checksumFile.delete();
                if (!looksLikeApk(apkFile)) {
                    // Delete malformed content before returning control to the UI.
                    // A valid Android package installer will also enforce package signatures.
                    // No token or Authorization header is ever sent to the asset CDN redirect.
                    //noinspection ResultOfMethodCallIgnored
                    apkFile.delete();
                    throw new UpdateException("error", "GitHub did not return a valid APK file.");
                }
                emit("downloaded");
                File finalApkFile = apkFile;
                activity.runOnUiThread(() -> requestInstall(finalApkFile));
            } catch (UpdateException error) {
                if (apkFile != null && apkFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    apkFile.delete();
                }
                if (checksumFile != null && checksumFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    checksumFile.delete();
                }
                dispatch(error.state, error.getMessage());
            } catch (Exception error) {
                if (apkFile != null && apkFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    apkFile.delete();
                }
                if (checksumFile != null && checksumFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    checksumFile.delete();
                }
                dispatch("error", safeMessage(error));
            } finally {
                busy.set(false);
            }
        });
    }

    void installPendingUpdateIfAllowed() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !activity.getPackageManager().canRequestPackageInstalls()) return;
        String path = preferences.getString(PENDING_INSTALL_KEY, null);
        if (path == null || path.trim().isEmpty()) return;
        preferences.edit().remove(PENDING_INSTALL_KEY).apply();
        File pendingApk;
        try {
            File updateDirectory = new File(activity.getCacheDir(), "updates").getCanonicalFile();
            pendingApk = new File(path).getCanonicalFile();
            if (pendingApk.getParentFile() == null
                    || !updateDirectory.equals(pendingApk.getParentFile())
                    || !pendingApk.getName().matches("SYSTEM-\\d+\\.\\d+\\.\\d+\\.apk")
                    || !looksLikeApk(pendingApk)) {
                dispatch("error", "The saved update file failed validation. Download it again.");
                return;
            }
        } catch (Exception error) {
            dispatch("error", "The saved update file could not be validated. Download it again.");
            return;
        }
        installApkFile(pendingApk);
    }

    void close() {
        worker.shutdownNow();
    }

    private boolean isTrustedLocalPage() {
        try {
            Uri uri = Uri.parse(webView == null ? "" : String.valueOf(webView.getUrl()));
            return "https".equalsIgnoreCase(uri.getScheme())
                    && "appassets.androidplatform.net".equalsIgnoreCase(uri.getHost());
        } catch (Exception ignored) {
            return false;
        }
    }

    private SecretKey getOrCreateEncryptionKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return generator.generateKey();
    }

    private String readGitHubToken() {
        String encoded = preferences.getString(TOKEN_ENCRYPTED_KEY, null);
        if (encoded == null) return null;
        if (encoded.isEmpty()) {
            preferences.edit().remove(TOKEN_ENCRYPTED_KEY).apply();
            return null;
        }
        try {
            byte[] packed = Base64.decode(encoded, Base64.NO_WRAP);
            final int ivLength = 12;
            if (packed.length <= ivLength) throw new IllegalArgumentException("Stored token ciphertext is incomplete.");
            byte[] iv = new byte[ivLength];
            byte[] encrypted = new byte[packed.length - ivLength];
            System.arraycopy(packed, 0, iv, 0, ivLength);
            System.arraycopy(packed, ivLength, encrypted, 0, encrypted.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateEncryptionKey(), new GCMParameterSpec(128, iv));
            String token = new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
            if (token.length() > MAX_TOKEN_CHARS || !TOKEN_PATTERN.matcher(token).matches()) {
                throw new IllegalArgumentException("Stored token has an invalid format.");
            }
            return token;
        } catch (Exception error) {
            // A ciphertext saved under a reset/invalidated Keystore key cannot be recovered.
            // Remove the stale marker and invalid key so the user can save a fresh token.
            preferences.edit().remove(TOKEN_ENCRYPTED_KEY).apply();
            try {
                KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
                keyStore.load(null);
                if (keyStore.containsAlias(KEY_ALIAS)) keyStore.deleteEntry(KEY_ALIAS);
            } catch (Exception ignored) { }
            return null;
        }
    }

    private JSONObject fetchLatestRelease(String token) throws Exception {
        HttpURLConnection connection = openApiConnection(new URL(RELEASE_API), token, "application/vnd.github+json");
        try {
            int code = connection.getResponseCode();
            if (code == 401) throw new UpdateException("token-invalid", "GitHub rejected the token.");
            if (code == 403) throw new UpdateException("access-denied", "GitHub denied access. Check token permissions or API rate limits.");
            if (code == 404) throw new UpdateException("access-denied", "The private repository or latest release was not found for this token.");
            if (code != HttpURLConnection.HTTP_OK) {
                throw new UpdateException("error", "GitHub API returned HTTP " + code + ".");
            }
            return new JSONObject(readBounded(connection.getInputStream(), 2 * 1024 * 1024));
        } finally {
            connection.disconnect();
        }
    }

    private JSONObject findReleaseApk(JSONArray assets, String version) throws JSONException {
        if (assets == null) return null;
        String expectedName = "SYSTEM-" + version + ".apk";
        for (int i = 0; i < assets.length(); i++) {
            JSONObject asset = assets.optJSONObject(i);
            if (asset == null) continue;
            String name = asset.optString("name", "");
            if (expectedName.equalsIgnoreCase(name) && asset.optLong("id", -1L) > 0) return asset;
        }
        return null;
    }

    private JSONObject findReleaseChecksum(JSONArray assets, String version) throws JSONException {
        if (assets == null) return null;
        String expectedName = "SYSTEM-" + version + ".apk.sha256";
        for (int i = 0; i < assets.length(); i++) {
            JSONObject asset = assets.optJSONObject(i);
            if (asset == null) continue;
            String name = asset.optString("name", "");
            if (expectedName.equalsIgnoreCase(name) && asset.optLong("id", -1L) > 0) return asset;
        }
        return null;
    }

    private String readExpectedSha256(File checksumFile, String expectedApkName) throws Exception {
        if (checksumFile == null || !checksumFile.isFile() || expectedApkName == null || expectedApkName.trim().isEmpty()) {
            throw new UpdateException("checksum-invalid", "The Release checksum file could not be read.");
        }
        String checksumText = readBounded(new FileInputStream(checksumFile), MAX_CHECKSUM_BYTES).trim();
        // The release workflow emits standard sha256sum output: digest, whitespace, APK filename.
        // Require the filename too, so a valid hash copied from a different asset cannot be accepted.
        String[] parts = checksumText.split("\\s+", 2);
        if (parts.length != 2 || !SHA256_PATTERN.matcher(parts[0]).matches()) {
            throw new UpdateException("checksum-invalid", "The Release checksum file does not contain a valid SHA-256 value and filename.");
        }
        String checkedName = parts[1].trim();
        if (checkedName.startsWith("*")) checkedName = checkedName.substring(1);
        if (!expectedApkName.equals(checkedName)) {
            throw new UpdateException("checksum-invalid", "The Release checksum refers to a different APK filename.");
        }
        return parts[0].toLowerCase(Locale.US);
    }

    private boolean verifySha256(File apkFile, String expectedSha256) throws Exception {
        if (apkFile == null || expectedSha256 == null || !SHA256_PATTERN.matcher(expectedSha256).matches()
                || !apkFile.isFile()) return false;
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new BufferedInputStream(new FileInputStream(apkFile))) {
            byte[] buffer = new byte[32 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        byte[] bytes = digest.digest();
        StringBuilder actual = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) actual.append(String.format(Locale.US, "%02x", value & 0xff));
        return MessageDigest.isEqual(actual.toString().getBytes(StandardCharsets.US_ASCII),
                expectedSha256.toLowerCase(Locale.US).getBytes(StandardCharsets.US_ASCII));
    }

    private void downloadAsset(long assetId, long expectedSize, String token, File destination) throws Exception {
        URL assetUrl = new URL(ASSET_API + assetId);
        HttpURLConnection connection = openApiConnection(assetUrl, token, "application/octet-stream");
        try {
            int responseCode = connection.getResponseCode();
            if (responseCode == 401) throw new UpdateException("token-invalid", "GitHub rejected the token while downloading the APK.");
            if (responseCode == 403) throw new UpdateException("access-denied", "The token cannot download this release asset.");
            if (responseCode == 301 || responseCode == 302 || responseCode == 303 || responseCode == 307 || responseCode == 308) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                connection = null;
                if (location == null || location.trim().isEmpty()) throw new UpdateException("error", "GitHub returned an empty asset redirect.");
                URL redirected = new URL(assetUrl, location);
                validateAssetRedirect(redirected);
                connection = (HttpURLConnection) redirected.openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(60000);
                connection.setRequestMethod("GET");
                // Intentionally do not forward the GitHub Authorization header to the CDN.
                responseCode = connection.getResponseCode();
            }
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw new UpdateException("error", "Release asset download returned HTTP " + responseCode + ".");
            }
            long responseLength = connection.getContentLengthLong();
            if (responseLength > MAX_APK_BYTES || (responseLength > 0 && Math.abs(responseLength - expectedSize) > 0)) {
                throw new UpdateException("error", "Release asset size did not match GitHub release metadata.");
            }
            long downloaded = 0L;
            int lastPercent = -1;
            try (InputStream input = new BufferedInputStream(connection.getInputStream());
                 OutputStream output = new BufferedOutputStream(new FileOutputStream(destination, false))) {
                byte[] buffer = new byte[32 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    downloaded += count;
                    if (downloaded > MAX_APK_BYTES || downloaded > expectedSize) {
                        throw new UpdateException("error", "The downloaded file exceeded its expected size.");
                    }
                    output.write(buffer, 0, count);
                    int percent = expectedSize > 0 ? (int) Math.min(100L, downloaded * 100L / expectedSize) : -1;
                    if (percent >= 0 && percent != lastPercent) {
                        lastPercent = percent;
                        JSONObject update = event("download-progress");
                        update.put("progress", percent);
                        dispatch(update);
                    }
                }
                output.flush();
            }
            if (downloaded != expectedSize) {
                throw new UpdateException("error", "The downloaded APK was incomplete; try again on a stable connection.");
            }
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private HttpURLConnection openApiConnection(URL url, String token, String accept) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Accept", accept);
        connection.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
        connection.setRequestProperty("User-Agent", "SYSTEM-Android-Updater");
        return connection;
    }

    private void validateAssetRedirect(URL url) throws UpdateException {
        String host = url.getHost() == null ? "" : url.getHost().toLowerCase(Locale.US);
        int port = url.getPort();
        boolean standardHttpsPort = port == -1 || port == 443;
        boolean noUserInfo = url.getUserInfo() == null;
        boolean allowedHost = host.equals("release-assets.githubusercontent.com")
                || host.equals("objects.githubusercontent.com")
                || host.equals("github-production-release-asset-2e65be.s3.amazonaws.com");
        if (!"https".equalsIgnoreCase(url.getProtocol()) || !allowedHost || !standardHttpsPort || !noUserInfo) {
            throw new UpdateException("error", "GitHub returned an unexpected APK download host.");
        }
    }

    private boolean looksLikeApk(File file) {
        if (file == null || file.length() < 1024 || file.length() > MAX_APK_BYTES) return false;
        try (InputStream input = new FileInputStream(file)) {
            return input.read() == 'P' && input.read() == 'K' && input.read() == 3 && input.read() == 4;
        } catch (Exception ignored) {
            return false;
        }
    }

    private void requestInstall(File apkFile) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.getPackageManager().canRequestPackageInstalls()) {
            preferences.edit().putString(PENDING_INSTALL_KEY, apkFile.getAbsolutePath()).apply();
            dispatch("install-permission-needed", "");
            try {
                Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName()));
                activity.startActivity(settingsIntent);
            } catch (ActivityNotFoundException error) {
                preferences.edit().remove(PENDING_INSTALL_KEY).apply();
                dispatch("error", "Open Android Settings and allow installs from this app, then try again.");
            }
            return;
        }
        installApkFile(apkFile);
    }

    private void installApkFile(File apkFile) {
        try {
            File updateDirectory = new File(activity.getCacheDir(), "updates").getCanonicalFile();
            File validatedApk = apkFile.getCanonicalFile();
            if (validatedApk.getParentFile() == null
                    || !updateDirectory.equals(validatedApk.getParentFile())
                    || !validatedApk.getName().matches("SYSTEM-\\d+\\.\\d+\\.\\d+\\.apk")
                    || !looksLikeApk(validatedApk)) {
                throw new IllegalArgumentException("The update APK failed local file validation.");
            }
            Uri apkUri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".updateprovider", validatedApk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        } catch (Exception error) {
            dispatch("error", "Could not open Android's package installer: " + safeMessage(error));
        }
    }

    private int compareVersions(String left, String right) throws UpdateException {
        int[] a = parseVersion(left);
        int[] b = parseVersion(right);
        for (int i = 0; i < 3; i++) {
            if (a[i] != b[i]) return Integer.compare(a[i], b[i]);
        }
        return 0;
    }

    private int[] parseVersion(String version) throws UpdateException {
        Matcher matcher = VERSION_PATTERN.matcher(version == null ? "" : version);
        if (!matcher.matches()) throw new UpdateException("error", "Could not compare the installed and release versions.");
        return new int[]{Integer.parseInt(matcher.group(1)), Integer.parseInt(matcher.group(2)), Integer.parseInt(matcher.group(3))};
    }

    private String readBounded(InputStream input, int maxBytes) throws Exception {
        try (InputStream source = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = source.read(buffer)) != -1) {
                if (output.size() + count > maxBytes) throw new UpdateException("error", "GitHub response exceeded the size limit.");
                output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private JSONObject event(String state) throws JSONException {
        JSONObject data = new JSONObject();
        data.put("state", state);
        return data;
    }

    private void emit(String state) {
        try { dispatch(event(state)); } catch (JSONException ignored) { }
    }

    private void dispatch(String state, String message) {
        try {
            JSONObject data = event(state);
            data.put("message", clip(message == null ? "" : message, 280));
            dispatch(data);
        } catch (JSONException ignored) { }
    }

    private void dispatch(JSONObject data) {
        if (webView == null) return;
        // Never splice raw JSON into executable source. Quote the complete payload first,
        // then parse it inside the page so release notes and error text remain data only.
        final String payload = JSONObject.quote(data.toString());
        final String script = "window.dispatchEvent(new CustomEvent('system-android-update',{detail:JSON.parse(" + payload + ")}));";
        activity.runOnUiThread(() -> {
            try {
                if (webView != null) webView.evaluateJavascript(script, null);
            } catch (RuntimeException ignored) { }
        });
    }

    private String safeMessage(Exception error) {
        String message = error == null ? "Unexpected error." : error.getMessage();
        if (message == null || message.trim().isEmpty()) return "Unexpected network or file error.";
        return clip(message.replaceAll("[\\r\\n\\t]", " "), 220);
    }

    private String clip(String value, int maxLength) {
        if (value == null) return "";
        String cleaned = value.replace('\u0000', ' ').trim();
        return cleaned.length() > maxLength ? cleaned.substring(0, maxLength) : cleaned;
    }

    private static final class UpdateException extends Exception {
        final String state;
        UpdateException(String state, String message) {
            super(message);
            this.state = state;
        }
    }
}
