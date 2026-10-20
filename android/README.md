# SYSTEM Android wrapper

Open this folder with Android Studio. The app package is `com.cronus.system`.

Before building after web files change, run `npm run prepare:android` from the parent project folder. This rebuilds the CSS/Service Worker and copies `index.html`, `assets/`, `css/`, and `js/` into `app/src/main/assets/www/`.

The launcher loads the bundled interface through AndroidX `WebViewAssetLoader` at `https://appassets.androidplatform.net/assets/www/index.html`, keeping ES modules and same-origin local assets compatible. AI requests are HTTPS network calls and require internet. The rest of the interface and bundled images are available offline.

Build a debug APK from the project root with `npm run android:build:debug`. The command first runs a strict toolchain preflight, rebuilds and syncs the web assets, then runs `gradle --no-daemon assembleDebug` from this folder and verifies that the APK exists and is non-empty. It requires JDK 17+, Gradle 8.13, Android SDK Platform 36, Build Tools 36.0.0, `adb`, and `sdkmanager` available on `PATH`/`ANDROID_HOME` or `ANDROID_SDK_ROOT`. If using Android Studio, you can alternatively select **Build > Build APK(s)** after installing those SDK packages. The APK output is `app/build/outputs/apk/debug/app-debug.apk`. The automated command does not claim a build succeeded unless the artifact is actually created.


## Private GitHub release updates

The native updater checks `ivan-timur/SYSTEM_V1.0.0` Releases and can download a matching `SYSTEM-x.y.z.apk` release asset. For a private repo, the user enters a fine-grained GitHub PAT with **Contents: Read-only** access; Android Keystore encrypts the token at rest. The app checks on launch at most once every 24 hours and also exposes a manual check in Settings. APK installation always goes through Android's package installer and requires the user to approve it. Debug APKs are intentionally blocked from self-updating.

To publish signed releases, configure these repository Actions secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. Keep the JKS file out of source control and never rotate the signing key for the same package ID. Push a release tag matching the current canonical version (for example, `v<VERSION>`) only after `VERSION` and the matching `CHANGELOG.md` heading have been verified. The `Publish signed SYSTEM Android release` workflow runs the static tests, project doctor and Playwright browser suite first, then creates a signed APK and SHA-256 checksum on that release. Full setup instructions are in `ANDROID_APP_GUIDE_FA.md`.


## Web-only OTA updates (no APK rebuild for web changes)

SYSTEM now has a separate OTA channel for the bundled web interface and JavaScript logic. The native Android update channel above remains available for changes to Java/Android APIs, permissions, or native dependencies.

- Increment root `WEB_VERSION` whenever HTML/CSS/JavaScript/data changes should be published. The first baseline in this source is `1.0.0`.
- Keep `WEB_MIN_NATIVE_VERSION` at the oldest compatible Android native version; raise it only when a web package depends on newly added native APIs.
- Push web changes and the new `WEB_VERSION` to `main`. The `Publish SYSTEM web-only OTA bundle` workflow runs project tests, builds the web bundle, and publishes only `latest.json`, `SYSTEM-Web.zip`, and its checksum to the separate `system-ota` branch. That workflow does not run `assembleDebug` or `assembleRelease`.
- On the phone, open **Settings → App updates → Interface and feature updates**, select **Check web updates**, then **Apply web update**. It uses the same saved, read-only GitHub token as APK updates. A version is also checked automatically at most once every 24 hours; applying it is user-initiated.
- The first APK containing `WebUpdateManager` and the local OTA asset handler must be built and installed once. After that, compatible web changes can be delivered without another APK. Changes to Java/Kotlin, the JavaScript bridge, Android permissions, package/build configuration, or native dependencies still need a new signed APK.

The native manager downloads the bundle over HTTPS from the private repository Contents API, checks the manifest and SHA-256 digest, enforces download/extraction size limits, rejects unsafe ZIP paths, and extracts to private app storage. A version is activated only after validation; the previous version is kept and is selected again if the app process restarts before the newly loaded page is confirmed. The OTA bundle is always served through the local `WebViewAssetLoader` path—never directly from a remote executable URL.

See [`docs/WEB_OTA_GUIDE_FA.md`](../docs/WEB_OTA_GUIDE_FA.md) for the step-by-step publishing workflow.
