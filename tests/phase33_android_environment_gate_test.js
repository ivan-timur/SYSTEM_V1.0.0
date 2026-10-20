#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const preflight = read('scripts/android-build-preflight.js');
const builder = read('scripts/build-android-debug.js');
const workflow = read('.github/workflows/build-android.yml');
const guide = read('android/README.md');
const checks = [];
function check(condition, message) { assert.ok(condition, message); checks.push(message); }
check(pkg.scripts['android:preflight'] === 'node scripts/android-build-preflight.js', 'Android preflight has a documented npm entrypoint');
check(pkg.scripts['android:build:debug'] === 'node scripts/build-android-debug.js', 'debug APK build uses the guarded build script');
check(preflight.includes('ANDROID_HOME') && preflight.includes('ANDROID_SDK_ROOT'), 'preflight detects missing Android SDK environment configuration');
check(preflight.includes('Gradle CLI') && preflight.includes('platform tools') && preflight.includes('SDK manager'), 'preflight checks Gradle, adb and sdkmanager prerequisites');
check(builder.includes('android-build-preflight.js') && builder.includes('assembleDebug'), 'APK builder runs preflight before invoking Gradle');
check(builder.includes('existsSync') || builder.includes('statSync'), 'APK builder verifies a real artifact rather than assuming build success');
check(workflow.includes('assembleDebug') && workflow.includes('if-no-files-found: error') && workflow.includes('app-debug.apk'), 'CI builds the APK and fails if the expected artifact is missing');
check(guide.includes('Android SDK Platform 36') && guide.includes('Build APK'), 'Android setup guide documents required SDK and APK build path');
check(pkg.scripts['test:static'].includes('phase33_android_environment_gate_test.js'), 'phase 33 gate is part of static regression tests');
console.log(`Phase 33 Android environment gate: PASS (${checks.length} source-contract checks)`);
for (const item of checks) console.log(` - ${item}`);
console.log('This test audits build safeguards; it does not claim an APK was built in this environment.');
