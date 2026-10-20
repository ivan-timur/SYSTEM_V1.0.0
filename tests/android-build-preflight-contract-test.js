'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const script = read('scripts/android-build-preflight.js');
const packageJson = JSON.parse(read('package.json'));
const debugWorkflow = read('.github/workflows/build-android.yml');
const releaseWorkflow = read('.github/workflows/release-android.yml');
assert.match(script, /ANDROID_HOME\s*\|\|\s*process\.env\.ANDROID_SDK_ROOT/);
assert.match(script, /Gradle CLI is available locally/);
assert.match(script, /JDK is available and version 17 or newer/);
assert.match(script, /Android SDK manager is available/);
assert.match(script, /A real APK build has NOT been confirmed/);
assert.equal(packageJson.scripts['android:preflight'], 'node scripts/android-build-preflight.js');
assert.match(packageJson.scripts['test:static'], /android-build-preflight-contract-test\.js/);
for (const workflow of [debugWorkflow, releaseWorkflow]) {
  assert.match(workflow, /gradle-version:\s*'8\.13'/);
  assert.match(workflow, /platforms;android-36/);
}
assert.match(releaseWorkflow, /apksigner\" verify/);
assert.match(releaseWorkflow, /sha256sum/);
console.log('PASS Android build preflight contract checks');
