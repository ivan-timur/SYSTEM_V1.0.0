"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const version = read("VERSION").trim();
const checks = [];
function check(condition, message) { assert.ok(condition, message); checks.push(message); }

const quality = read(".github/workflows/quality.yml");
const build = read(".github/workflows/build-android.yml");
const release = read(".github/workflows/release-android.yml");
const packageJson = JSON.parse(read("package.json"));
const gradle = read("android/app/build.gradle");
const updater = read("android/app/src/main/java/com/cronus/system/GitHubReleaseUpdater.java");
const nativeModule = read("js/modules/android-native.js");
const html = read("index.html");

check(/^\d+\.\d+\.\d+$/.test(version), "Canonical VERSION is semantic versioning.");
check(packageJson.version === version, "package.json matches canonical VERSION.");
check(gradle.includes(`versionName '${version}'`), "Android versionName matches canonical VERSION.");
const androidVersionCode = Number((gradle.match(/versionCode\s+(\d+)/) || [])[1]);
check(Number.isSafeInteger(androidVersionCode) && androidVersionCode > 9007000, "Android versionCode remains higher than the previous application build so the v1 version line can install as an update.");
check(quality.includes("npm install --no-package-lock --no-audit --no-fund"), "Quality CI installs the exact declared test dependency without assuming a missing lockfile.");
check(quality.includes("playwright install --with-deps chromium") && quality.includes("npm run test:browser-idb") && quality.includes("npm run test:e2e"), "Quality CI installs Chromium before running IndexedDB and UI browser tests.");
check(build.includes("npm test") && build.includes("npm run doctor"), "Manual APK packaging cannot skip the static regression and project health gates.");
check(release.includes("npm test") && release.includes("npm run doctor") && release.includes("npm run test:browser-idb") && release.includes("npm run test:e2e"), "Signed release publication is gated by static, IndexedDB transaction and UI browser tests.");
check(release.indexOf("Run real-browser release checks") < release.indexOf("Build and bundle the offline web app"), "Real-browser checks run before final Android assets are packaged.");
check(release.includes("apksigner") && release.includes("sha256sum"), "Release pipeline verifies the signed APK and publishes a checksum.");
check(updater.includes("JSONObject.quote(data.toString())") && updater.includes("JSON.parse("), "Native update events are safely serialized before entering JavaScript.");
check(updater.includes("host.equals(\"release-assets.githubusercontent.com\")") && updater.includes("host.equals(\"objects.githubusercontent.com\")"), "Updater uses an explicit GitHub asset redirect host allowlist.");
check(nativeModule.includes("system-language-change"), "Native update UI remains wired to interface language changes.");
check(html.includes("id=\"system-github-updater\""), "Updater UI is present in the application document.");
console.log(`SYSTEM release-pipeline tests passed: ${checks.length} checks; release ${version}.`);
