#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const ANDROID = path.join(ROOT, 'android');
const strict = process.argv.includes('--strict');
const results = [];

function check(label, ok, detail = '') {
  results.push({ label, ok: Boolean(ok), detail });
}
function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}
function commandVersion(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 10000 });
  if (result.error) return { available: false, text: result.error.code || result.error.message };
  const text = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  return { available: result.status === 0, text };
}

const version = read('VERSION').trim();
const gradleConfig = read('android/build.gradle');
const appConfig = read('android/app/build.gradle');
const workflows = [read('.github/workflows/build-android.yml'), read('.github/workflows/release-android.yml')];
const java = commandVersion('java', ['-version']);
const gradle = commandVersion('gradle', ['--version']);
const adb = commandVersion('adb', ['version']);
const sdkmanager = commandVersion('sdkmanager', ['--version']);
const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
const sdkPathPresent = Boolean(sdkRoot && fs.existsSync(sdkRoot));
const javaMajor = (() => {
  const match = java.text.match(/version "(?:1\.)?(\d+)/i) || java.text.match(/openjdk (\d+)/i);
  return match ? Number(match[1]) : null;
})();

check('Canonical project version is 1.0.0 and valid semver', version === '1.0.0' && /^\d+\.\d+\.\d+$/.test(version), version);
check('Android versionName matches canonical version', appConfig.includes(`versionName '${version}'`));
check('Android Gradle Plugin version is pinned', /com\.android\.application' version '8\.13\.2'/.test(gradleConfig));
check('CI pins Gradle 8.13 for debug and release builds', workflows.every(w => /gradle-version:\s*'8\.13'/.test(w)));
check('Android SDK platform 36 is configured', /compileSdk 36/.test(appConfig) && workflows.every(w => /platforms;android-36/.test(w)));
check('JDK is available and version 17 or newer', java.available && javaMajor !== null && javaMajor >= 17, java.available ? `detected major ${javaMajor ?? 'unknown'}` : java.text);
check('Gradle CLI is available locally', gradle.available, gradle.available ? gradle.text.split('\n')[0] : gradle.text);
check('Android SDK environment path is configured and exists', sdkPathPresent, sdkRoot || 'ANDROID_HOME / ANDROID_SDK_ROOT not set');
check('Android platform tools (adb) are available', adb.available, adb.available ? adb.text.split('\n')[0] : adb.text);
check('Android SDK manager is available', sdkmanager.available, sdkmanager.available ? sdkmanager.text.split('\n')[0] : sdkmanager.text);
check('Debug APK output path is documented', read('android/README.md').includes('app/build/outputs/apk/debug/app-debug.apk'));
check('Release workflow verifies APK signature and checksum', /apksigner\" verify/.test(workflows[1]) && /sha256sum/.test(workflows[1]));
check('Gradle wrapper is present or CI explicitly installs Gradle', fs.existsSync(path.join(ANDROID, 'gradlew')) || workflows.every(w => /gradle\/actions\/setup-gradle@v4/.test(w)));

console.log(`SYSTEM Android build preflight — release ${version}`);
for (const item of results) {
  console.log(`${item.ok ? 'PASS' : 'BLOCK'} ${item.label}${item.detail ? ` — ${item.detail}` : ''}`);
}
const blocked = results.filter(r => !r.ok);
if (blocked.length) {
  console.log(`\n${blocked.length} preflight item(s) need attention. A real APK build has NOT been confirmed in this environment.`);
  if (strict) process.exitCode = 2;
} else {
  console.log('\nPreflight checks passed. Run the actual Gradle build and install test to confirm APK readiness.');
}
