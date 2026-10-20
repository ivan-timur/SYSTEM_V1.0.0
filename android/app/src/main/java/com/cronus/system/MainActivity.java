package com.cronus.system;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.MimeTypeMap;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String START_URL = "https://appassets.androidplatform.net/assets/www/index.html";
    private static final int REQUEST_FILE_CHOOSER = 7101;
    private static final int REQUEST_CREATE_FILE = 7102;
    private static final int REQUEST_POST_NOTIFICATIONS = 7103;
    private static final String PREFS = "system_native_preferences";
    private WebView webView;
    private GitHubReleaseUpdater githubReleaseUpdater;
    private WebUpdateManager webUpdateManager;
    private ValueCallback<Uri[]> fileChooserCallback;
    private String pendingText;
    private String pendingFilename;
    private String pendingMimeType;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(3, 6, 17));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets safeArea = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(safeArea.left, safeArea.top, safeArea.right, safeArea.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        githubReleaseUpdater = new GitHubReleaseUpdater(this, webView);
        webUpdateManager = new WebUpdateManager(this, webView, githubReleaseUpdater);
        webUpdateManager.prepareForLaunch();

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new SystemAssetPathHandler())
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                android.webkit.WebResourceResponse local = assetLoader.shouldInterceptRequest(request.getUrl());
                return local != null ? local : super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (webUpdateManager != null && url != null
                        && url.startsWith("https://appassets.androidplatform.net/assets/www/index.html")) {
                    webUpdateManager.confirmCurrentWebVersion();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    startActivityForResult(intent, REQUEST_FILE_CHOOSER);
                    return true;
                } catch (RuntimeException error) {
                    fileChooserCallback = null;
                    callback.onReceiveValue(null);
                    toast("No file picker is available on this device.");
                    return false;
                }
            }
        });

        webView.addJavascriptInterface(new SystemBridge(), "SYSTEMAndroid");
        setContentView(webView);
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);
        webView.loadUrl(START_URL);
    }

    private void configureSystemBars() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
            window.setStatusBarContrastEnforced(false);
        }
    }

    private boolean handleNavigation(Uri uri) {
        if (uri == null) return true;
        String host = uri.getHost();
        if ("https".equalsIgnoreCase(uri.getScheme()) && "appassets.androidplatform.net".equalsIgnoreCase(host)) {
            return false;
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if ("https".equals(scheme) || "http".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme)) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
                toast("No compatible app is installed for this link.");
            }
        }
        return true;
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (githubReleaseUpdater != null) githubReleaseUpdater.installPendingUpdateIfAllowed();
    }

    @Override
    protected void onDestroy() {
        if (webUpdateManager != null) webUpdateManager.close();
        if (githubReleaseUpdater != null) githubReleaseUpdater.close();
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_FILE_CHOOSER) {
            if (fileChooserCallback != null) {
                Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                fileChooserCallback.onReceiveValue(results);
                fileChooserCallback = null;
            }
            return;
        }
        if (requestCode == REQUEST_CREATE_FILE) {
            Uri destination = resultCode == RESULT_OK && data != null ? data.getData() : null;
            boolean saved = false;
            String errorMessage = "";
            if (destination != null && pendingText != null) {
                try (OutputStream output = getContentResolver().openOutputStream(destination, "w")) {
                    if (output == null) throw new IllegalStateException("Unable to open the selected file.");
                    output.write(pendingText.getBytes(StandardCharsets.UTF_8));
                    output.flush();
                    saved = true;
                } catch (Exception error) {
                    errorMessage = error.getMessage() == null ? "Could not write the file." : error.getMessage();
                }
            }
            String filename = pendingFilename == null ? "file" : pendingFilename;
            pendingText = null;
            pendingFilename = null;
            pendingMimeType = null;
            if (saved) {
                toast("Saved: " + filename);
                dispatchSaveResult(true, filename, "");
            } else if (destination != null) {
                toast("File could not be saved.");
                dispatchSaveResult(false, filename, errorMessage);
            } else {
                dispatchSaveResult(false, filename, "Save cancelled.");
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_POST_NOTIFICATIONS) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (granted && prefs.getBoolean("reminder_enabled", false)) {
            SystemReminderScheduler.schedule(this);
            toast("SYSTEM daily reminder enabled.");
            dispatchReminderResult(true);
        } else if (!granted) {
            prefs.edit().putBoolean("reminder_enabled", false).apply();
            toast("Allow notifications in Android Settings to use reminders.");
            dispatchReminderResult(false);
        }
    }

    private void beginSaveTextFile(String filename, String mimeType, String content) {
        if (content == null) content = "";
        if (content.getBytes(StandardCharsets.UTF_8).length > 10 * 1024 * 1024) {
            toast("This export is larger than the 10 MB safety limit.");
            dispatchSaveResult(false, filename, "File exceeds 10 MB.");
            return;
        }
        String safeName = (filename == null || filename.trim().isEmpty()) ? "system-export.txt" : filename.trim();
        safeName = safeName.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (safeName.length() > 100) safeName = safeName.substring(safeName.length() - 100);
        pendingText = content;
        pendingFilename = safeName;
        String requestedMime = (mimeType == null || mimeType.trim().isEmpty()) ? "text/plain" : mimeType.trim();
        pendingMimeType = requestedMime.split(";", 2)[0].trim();
        if (!pendingMimeType.contains("/")) pendingMimeType = "text/plain";
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(pendingMimeType);
        intent.putExtra(Intent.EXTRA_TITLE, pendingFilename);
        try {
            startActivityForResult(intent, REQUEST_CREATE_FILE);
        } catch (ActivityNotFoundException error) {
            pendingText = null;
            pendingFilename = null;
            pendingMimeType = null;
            toast("No file-saving app is available on this device.");
            dispatchSaveResult(false, safeName, "No file picker available.");
        }
    }

    private void dispatchSaveResult(boolean ok, String filename, String message) {
        if (webView == null) return;
        String script = "window.dispatchEvent(new CustomEvent('system-android-file-saved',{detail:{ok:"
                + ok + ",filename:" + JSONObject.quote(filename) + ",message:" + JSONObject.quote(message) + "}}));";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void dispatchReminderResult(boolean enabled) {
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('system-android-reminder-status',{detail:{enabled:" + enabled + "}}));", null));
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    /** Serves a verified active OTA bundle locally; never loads executable files from a remote URL. */
    private final class SystemAssetPathHandler implements WebViewAssetLoader.PathHandler {
        private final WebViewAssetLoader.AssetsPathHandler bundled = new WebViewAssetLoader.AssetsPathHandler(MainActivity.this);

        @Override
        public WebResourceResponse handle(String path) {
            if (path != null && path.startsWith("www/")) {
                File activeRoot = webUpdateManager == null ? null : webUpdateManager.getActiveVersionDirectory();
                if (activeRoot != null) {
                    try {
                        File root = activeRoot.getCanonicalFile();
                        File candidate = new File(root, path).getCanonicalFile();
                        if (!candidate.getPath().startsWith(root.getPath() + File.separator)) {
                            return errorResponse(403, "Forbidden");
                        }
                        if (!candidate.isFile()) {
                            // Do not mix an OTA version with files from the older bundled version.
                            return errorResponse(404, "Not Found");
                        }
                        String extension = "";
                        int dot = candidate.getName().lastIndexOf('.');
                        if (dot >= 0 && dot + 1 < candidate.getName().length()) {
                            extension = candidate.getName().substring(dot + 1).toLowerCase(Locale.US);
                        }
                        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                        if (mime == null) {
                            if ("js".equals(extension) || "mjs".equals(extension)) mime = "text/javascript";
                            else if ("json".equals(extension) || "webmanifest".equals(extension)) mime = "application/json";
                            else if ("svg".equals(extension)) mime = "image/svg+xml";
                            else mime = "application/octet-stream";
                        }
                        Map<String, String> headers = new HashMap<>();
                        headers.put("Cache-Control", "no-store");
                        headers.put("X-Content-Type-Options", "nosniff");
                        return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, new FileInputStream(candidate));
                    } catch (Exception ignored) {
                        return errorResponse(404, "Not Found");
                    }
                }
            }
            return bundled.handle(path);
        }

        private WebResourceResponse errorResponse(int statusCode, String reason) {
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            headers.put("X-Content-Type-Options", "nosniff");
            return new WebResourceResponse("text/plain", "UTF-8", statusCode, reason, headers,
                    new java.io.ByteArrayInputStream(new byte[0]));
        }
    }

    private class SystemBridge {
        @JavascriptInterface
        public String getPlatform() {
            return "android";
        }

        @JavascriptInterface
        public String getInstalledVersion() {
            return githubReleaseUpdater == null ? BuildConfig.VERSION_NAME : githubReleaseUpdater.getInstalledVersion();
        }

        @JavascriptInterface
        public boolean hasGitHubToken() {
            return githubReleaseUpdater != null && githubReleaseUpdater.hasGitHubToken();
        }

        @JavascriptInterface
        public long getLastUpdateCheckMillis() {
            return githubReleaseUpdater == null ? 0L : githubReleaseUpdater.getLastUpdateCheckMillis();
        }

        @JavascriptInterface
        public boolean saveGitHubToken(String token) {
            return githubReleaseUpdater != null && githubReleaseUpdater.saveGitHubToken(token);
        }

        @JavascriptInterface
        public void clearGitHubToken() {
            if (githubReleaseUpdater != null) githubReleaseUpdater.clearGitHubToken();
        }

        @JavascriptInterface
        public void checkForUpdates() {
            if (githubReleaseUpdater != null) githubReleaseUpdater.checkForUpdates();
        }

        @JavascriptInterface
        public void downloadLatestUpdate() {
            if (githubReleaseUpdater != null) githubReleaseUpdater.downloadLatestUpdate();
        }

        @JavascriptInterface
        public String getInstalledWebVersion() {
            return webUpdateManager == null ? "1.0.0" : webUpdateManager.getInstalledWebVersion();
        }

        @JavascriptInterface
        public long getLastWebUpdateCheckMillis() {
            return webUpdateManager == null ? 0L : webUpdateManager.getLastCheckMillis();
        }

        @JavascriptInterface
        public void checkForWebUpdates() {
            if (webUpdateManager != null) webUpdateManager.checkForUpdates();
        }

        @JavascriptInterface
        public void applyWebUpdate() {
            if (webUpdateManager != null) webUpdateManager.applyAvailableUpdate();
        }

        @JavascriptInterface
        public boolean isDailyReminderEnabled() {
            return getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("reminder_enabled", false);
        }

        @JavascriptInterface
        public int getDailyReminderHour() {
            return getSharedPreferences(PREFS, MODE_PRIVATE).getInt("reminder_hour", 20);
        }

        @JavascriptInterface
        public void scheduleDailyReminder(int hour, String title, String message) {
            int safeHour = Math.max(0, Math.min(23, hour));
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            prefs.edit()
                    .putBoolean("reminder_enabled", true)
                    .putInt("reminder_hour", safeHour)
                    .putString("reminder_title", safeText(title, "SYSTEM — Daily Review", 100))
                    .putString("reminder_message", safeText(message, "Review today's goals and quests.", 240))
                    .apply();
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_POST_NOTIFICATIONS);
                } else {
                    SystemReminderScheduler.schedule(MainActivity.this);
                    toast("SYSTEM daily reminder saved.");
                }
            });
        }

        @JavascriptInterface
        public void cancelDailyReminder() {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("reminder_enabled", false).apply();
            SystemReminderScheduler.cancel(MainActivity.this);
            runOnUiThread(() -> toast("SYSTEM daily reminder disabled."));
        }

        @JavascriptInterface
        public void saveTextFile(String filename, String mimeType, String content) {
            runOnUiThread(() -> beginSaveTextFile(filename, mimeType, content));
        }

        @JavascriptInterface
        public void showToast(String message) {
            runOnUiThread(() -> toast(safeText(message, "SYSTEM", 120)));
        }
    }

    private static String safeText(String value, String fallback, int limit) {
        if (value == null || value.trim().isEmpty()) return fallback;
        String cleaned = value.replace('\u0000', ' ').trim();
        return cleaned.length() > limit ? cleaned.substring(0, limit) : cleaned;
    }
}
