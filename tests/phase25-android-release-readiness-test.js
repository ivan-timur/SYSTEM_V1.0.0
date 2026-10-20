'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const json = (name) => JSON.parse(read(name));
const version = read('VERSION').trim().split(/\s+/)[0];
const androidRoot = 'android/app/src/main/assets/www';
const checks = [];
function check(condition, message) { assert.ok(condition, message); checks.push(message); }

check(/^\d+\.\d+\.\d+$/.test(version), 'Canonical release version uses semantic versioning.');
check(json('package.json').version === version, 'package.json matches VERSION.');
check(json('manifest.webmanifest').version === version, 'Web manifest version matches VERSION.');
check(read('js/modules/version.js').includes(`APP_VERSION = "${version}"`), 'Runtime ES-module version matches VERSION.');
check(read('js/legacy/app-controller.js').includes(`SYSTEM_APP_VERSION = "${version}"`), 'Legacy runtime version matches VERSION.');
check(read('README.md').startsWith(`# SYSTEM v${version}`), 'README release heading matches VERSION.');
check(read('CHANGELOG.md').startsWith(`## ${version} —`), 'Changelog starts with the current release section.');

const gradle = read('android/app/build.gradle');
const [, major, minor, patch] = version.match(/^(\d+)\.(\d+)\.(\d+)$/).map(Number);
const expectedCode = (major + 9) * 1000000 + minor * 1000 + patch;
const actualCode = Number((gradle.match(/versionCode\s+(\d+)/) || [])[1]);
check(gradle.includes(`versionName '${version}'`), 'Android versionName matches VERSION.');
check(actualCode === expectedCode, 'Android versionCode follows the documented monotonic mapping.');

const sw = read('sw.js');
const shellMatch = sw.match(/const SHELL = (\[[\s\S]*?\]);\n\nself\.addEventListener/);
assert.ok(shellMatch, 'Generated service worker contains a parseable precache shell.');
const shell = JSON.parse(shellMatch[1]);
check(shell.includes('index.html') && shell.includes('VERSION') && shell.includes('manifest.webmanifest'), 'Offline shell includes app entry point and release metadata.');
check(shell.includes('dist/ts/core/progression.js'), 'Offline shell includes compiled TypeScript runtime.');
const missing = shell.filter((entry) => entry !== './' && !fs.existsSync(path.join(ROOT, entry)));
check(missing.length === 0, `All ${shell.length} precache entries exist on disk${missing.length ? `; missing: ${missing.join(', ')}` : ''}.`);
check(sw.includes('await cache.addAll(SHELL)'), 'Service-worker installation fails atomically when a required shell asset is missing.');
check(sw.includes('key !== CACHE_NAME') && sw.includes('caches.delete(key)'), 'Service-worker activation removes obsolete SYSTEM caches.');
check(sw.includes('request.mode === "navigate"'), 'Offline navigation falls back to the cached app entry point.');

const nativeManifest = read('android/app/src/main/AndroidManifest.xml');
const activity = read('android/app/src/main/java/com/cronus/system/MainActivity.java');
check(nativeManifest.includes('android:usesCleartextTraffic="false"'), 'Native manifest blocks cleartext HTTP traffic.');
check(nativeManifest.includes('android.permission.INTERNET'), 'Native app declares network access for explicitly online features.');
check(activity.includes('WebViewAssetLoader') && activity.includes('https://appassets.androidplatform.net/assets/www/index.html'), 'WebView uses the HTTPS app-assets origin for local resources.');
check(activity.includes('settings.setDomStorageEnabled(true)'), 'WebView DOM storage is enabled for saved browser data.');
check(activity.includes('settings.setAllowFileAccess(false)'), 'WebView file:// access is disabled.');
check(activity.includes('WebSettings.MIXED_CONTENT_NEVER_ALLOW'), 'WebView mixed-content loading is blocked.');
check(activity.includes('BuildConfig.DEBUG') && activity.includes('WebView.setWebContentsDebuggingEnabled(true)'), 'WebView debugging is limited to debug builds.');
check(read('js/features/experience.js').includes('!runningInNativeAndroid'), 'Native Android skips service-worker registration and uses bundled offline assets.');

for (const relative of ['index.html', 'VERSION', 'manifest.webmanifest', 'sw.js', 'css/system.css', 'js/app.js', 'js/modules/version.js', 'js/modules/visual-effects.js', 'dist/ts/core/progression.js']) {
  const source = path.join(ROOT, relative);
  const bundled = path.join(ROOT, androidRoot, relative);
  check(fs.existsSync(bundled), `Android bundle contains ${relative}.`);
  check(fs.readFileSync(source).equals(fs.readFileSync(bundled)), `Android bundle ${relative} matches its release source.`);
}
check(read(`${androidRoot}/VERSION`).trim() === version, 'Bundled Android VERSION matches canonical VERSION.');
console.log(`SYSTEM Phase 25 Android release-readiness checks passed: ${checks.length} checks; release ${version}.`);
