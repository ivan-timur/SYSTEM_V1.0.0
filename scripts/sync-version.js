#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim().split(/\s+/)[0];
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`VERSION must begin with semantic version x.y.z; received: ${version}`);
const initialChangelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
if (!initialChangelog.includes(`## ${version}`)) {
  throw new Error(`CHANGELOG.md must contain a section for ${version} before building this release.`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}
function writeJson(file, value) {
  fs.writeFileSync(path.join(ROOT, file), `${JSON.stringify(value, null, 2)}\n`);
}

const appModulePath = path.join(ROOT, 'js/app.js');
let appModule = fs.readFileSync(appModulePath, 'utf8');
appModule = appModule.replace(/^\/\*\* SYSTEM release [^\n]*\*\/\n/, '');
appModule = `/** SYSTEM release ${version}. Runtime version value is imported from modules/version.js. */\n${appModule}`;
fs.writeFileSync(appModulePath, appModule);

const versionModule = `/** Canonical application version, synchronized from VERSION during the build. */\nexport const APP_VERSION = "${version}";\n`;
fs.writeFileSync(path.join(ROOT, 'js/modules/version.js'), versionModule);
const legacyPath = path.join(ROOT, 'js/legacy/app-controller.js');
const legacy = fs.readFileSync(legacyPath, 'utf8');
if (!/const SYSTEM_APP_VERSION\s*=\s*"[^"]+"/.test(legacy)) throw new Error('Could not find the legacy app version constant.');
fs.writeFileSync(legacyPath, legacy.replace(/const SYSTEM_APP_VERSION\s*=\s*"[^"]+"/, `const SYSTEM_APP_VERSION = "${version}"`));

const packageJson = readJson('package.json');
packageJson.version = version;
writeJson('package.json', packageJson);

// Keep Android's native package version in sync with the canonical VERSION file.
// Preserve upgradeability from the previous 9.x application while the visible release line restarts at 1.x.
// The +9 epoch offsets Android versionCode only; app/manifest/release labels remain semantic 1.x versions.
const [major, minor, patch] = version.split('.').map(Number);
if (minor > 999 || patch > 999) throw new Error(`Android versionCode mapping requires minor/patch < 1000; received ${version}.`);
const androidVersionCode = (major + 9) * 1000000 + minor * 1000 + patch;
if (!Number.isSafeInteger(androidVersionCode) || androidVersionCode <= 0 || androidVersionCode > 2100000000) {
  throw new Error(`Version ${version} cannot be mapped to a valid Android versionCode.`);
}
const androidGradlePath = path.join(ROOT, 'android', 'app', 'build.gradle');
let androidGradle = fs.readFileSync(androidGradlePath, 'utf8');
if (!/versionCode\s+\d+/.test(androidGradle) || !/versionName\s+'[^']+'/.test(androidGradle)) {
  throw new Error('Could not locate Android versionCode/versionName in android/app/build.gradle.');
}
androidGradle = androidGradle.replace(/versionCode\s+\d+/, `versionCode ${androidVersionCode}`);
androidGradle = androidGradle.replace(/versionName\s+'[^']+'/, `versionName '${version}'`);
fs.writeFileSync(androidGradlePath, androidGradle);

const manifest = readJson('manifest.webmanifest');
manifest.version = version;
writeJson('manifest.webmanifest', manifest);

// Keep the user-facing README version aligned with the canonical release.
const readmePath = path.join(ROOT, 'README.md');
let readme = fs.readFileSync(readmePath, 'utf8');
readme = readme.replace(/^# SYSTEM v\d+\.\d+\.\d+/m, `# SYSTEM v${version}`);
fs.writeFileSync(readmePath, readme);

console.log(`Version metadata synchronized to ${version} from VERSION.`);
