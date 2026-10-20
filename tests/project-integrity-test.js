"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks++; }

const version = read('VERSION').trim();
const pkg = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('manifest.webmanifest'));
const versionModule = read('js/modules/version.js');
const appEntry = read('js/app.js');
const legacy = read('js/legacy/app-controller.js');
const sw = read('sw.js');
const readme = read('README.md');
const changelog = read('CHANGELOG.md');
const storageCore = read('js/core/storage.js');
const autoBackup = read('js/features/auto-snapshots.js');
const progressionMath = read('js/core/progression-math.js');
const progressionMathRuntime = read('js/generated/progression-math.js');
const progressionMathTypeScript = read('src/core/progression-math-runtime.ts');
const workflow = read('.github/workflows/quality.yml');

check(/^\d+\.\d+\.\d+$/.test(version), 'VERSION must contain semantic version x.y.z.');
equal(pkg.version, version, 'package.json must match canonical VERSION.');
equal(manifest.version, version, 'PWA manifest must match canonical VERSION.');
check(!fs.existsSync(path.join(ROOT, 'js/VERSION')), 'VERSION must have a single canonical source.');
check(versionModule.includes(`APP_VERSION = "${version}"`), 'ES module version must match canonical VERSION.');
check(legacy.includes(`const SYSTEM_APP_VERSION = "${version}"`), 'Legacy version must match canonical VERSION.');
check(sw.includes(`const APP_VERSION = "${version}"`), 'Service Worker version must match canonical VERSION.');
check(readme.startsWith(`# SYSTEM v${version}`), 'README title must match canonical VERSION.');
check(changelog.startsWith(`## ${version} —`), 'CHANGELOG must start with the current release.');
check(storageCore.includes('Backup is missing the main player save') && storageCore.includes('system_v2_save'), 'Backup restore must require the core player save before replacing the app namespace.');
check(storageCore.includes('validateBackup(data);'), 'Backup creation must validate its output with the restore validator before calling it verified.');
check(storageCore.includes('Unsafe backup entry encountered before applying any changes.'), 'Restore must preflight every entry before mutating localStorage.');
check(storageCore.includes('Free space before rollback') && storageCore.indexOf('for (const key of incomingKeys) {\n                try { target.removeItem(key); }') < storageCore.indexOf('for (const [key, value] of old) {\n                try { value === null ? target.removeItem(key) : target.setItem(key, value); }'), 'Quota-safe rollback must remove incoming values before restoring older, potentially larger values.');
check(autoBackup.includes('always preserving at least one previously successful recovery point') && !autoBackup.includes('list().forEach(function (k) { localStorage.removeItem(k); })'), 'A failed auto-snapshot must not delete all previous recovery points.');
check(legacy.includes('const savedPlayer =') && legacy.includes('Older saves used a flat { level, xp, coins } record'), 'Legacy flat player saves must remain loadable.');
check(changelog.startsWith(`## ${version} —`) && read('data/README.md').includes('منبع runtime نیستند'), 'Release docs must explain the current data-source limitation.');

const scriptPaths = [...appEntry.matchAll(/"\.\/(core\/[^"']+|features\/[^"']+|legacy\/[^"']+)"/g)].map(match => `js/${match[1]}`);
check(scriptPaths.length >= 10, 'Entry point must retain the expected ordered legacy-script chain.');
for (const file of scriptPaths) check(fs.existsSync(path.join(ROOT, file)), `Entry-point script must exist: ${file}`);
check(appEntry.includes('system-app-error') && appEntry.includes('system-boot-error'), 'Failed bootstrap must expose an accessible visible diagnostic.');
check(appEntry.includes('window.SYSTEM_APP_BOOT_STATE = "ready"'), 'Successful bootstrap must mark runtime ready.');
check(appEntry.includes('textContent = `Required module unavailable:'), 'Bootstrap error copy must be rendered as text, not HTML.');
check(appEntry.indexOf('./core/progression-math.js') >= 0 && appEntry.indexOf('./core/progression-math.js') < appEntry.indexOf('./legacy/app-controller.js'), 'Shared progression arithmetic must load before the legacy compatibility controller.');
check(progressionMathRuntime.includes('root.SYSTEMProgressionMath = Object.freeze({') && progressionMathRuntime.includes('advanceXPTrack'), 'Generated progression runtime must expose the immutable TypeScript API.');
check(progressionMathTypeScript.includes('function advanceXPTrack(') && progressionMathTypeScript.includes('function getPlayerXPRequired(') && progressionMathTypeScript.includes('function getStatXPRequired('), 'TypeScript must be the source of truth for XP and rank calculations.');
check(!/function getPlayerXPRequired|function getStatXPRequired|while\s*\(/.test(progressionMath), 'The compatibility JavaScript file must not reimplement progression arithmetic.');
check(read('js/app.js').indexOf('./generated/progression-math.js') < read('js/app.js').indexOf('./core/progression-math.js'), 'Generated TypeScript runtime must load before the compatibility adapter.');
check(read('js/app.js').includes('../dist/ts/core/progression.js') && read('js/app.js').includes('SYSTEMTypeScriptProgression'), 'The active app entry must import and expose the TypeScript completeQuest domain engine.');
check(read('js/app.js').includes('../dist/ts/core/activity-ledger.js') && read('js/app.js').includes('SYSTEMTypeScriptActivityLedger'), 'The active app entry must expose TypeScript activity-ledger rules before the legacy adapter.');
check(legacy.includes('SYSTEMActivityLedgerDomain.createActivityRecord') && legacy.includes('SYSTEMActivityLedgerDomain.updateActivityEvidence'), 'The legacy adapter must delegate activity validation and evidence updates instead of owning duplicate rules.');
check(legacy.includes('localStorage.setItem(SYSTEM_PROGRESS_HISTORY_KEY, JSON.stringify(nextHistory));') && legacy.indexOf('localStorage.setItem(SYSTEM_PROGRESS_HISTORY_KEY, JSON.stringify(nextHistory));') < legacy.indexOf('systemProgressHistory = nextHistory;'), 'The activity adapter must persist new rows before committing them to live memory.');
check(pkg.scripts.build.includes('npm run build:ts') && read('scripts/build-sw.js').includes("'dist/ts'") && read('scripts/sync-android-assets.js').includes("'dist', 'ts'"), 'Compiled TypeScript modules must be built, precached offline, and copied into Android assets.');
check(pkg.scripts['build:ts'].includes('write-dist-module-marker.js') && read('scripts/write-dist-module-marker.js').includes("{ type: 'module' }"), 'Compiled TypeScript output must declare its ESM scope without changing root classic-script test semantics.');
check(pkg.scripts['test:ts'].includes('activity-ledger.test.mjs') && fs.existsSync(path.join(ROOT, 'tests/typescript/activity-ledger.test.mjs')), 'Activity-ledger validation and transaction semantics must have an automated TypeScript test.');
check(legacy.includes('return math.getPlayerXPRequired(level)') && legacy.includes('return math.getStatXPRequired(level)') && legacy.includes('return math.getRankForLevel(level)'), 'Legacy progression call sites must delegate to the shared math module.');
check(legacy.includes('transition = math.advanceXPTrack(') && legacy.includes('SYSTEM TypeScript Player XP transition failed') && legacy.includes('SYSTEM TypeScript Stat XP transition failed'), 'Live Player and Stat XP transitions must call the TypeScript engine.');
const progressionIdempotency = read('js/core/progression-idempotency.js');
check(appEntry.indexOf('./core/progression-idempotency.js') >= 0 && appEntry.indexOf('./core/progression-idempotency.js') < appEntry.indexOf('./legacy/app-controller.js'), 'Reward identity guard must load before the controller that applies rewards.');
check(progressionIdempotency.includes('MAX_ENTRIES = 5000') && progressionIdempotency.includes('function inspect(storage, id, referenceDate)') && progressionIdempotency.includes('function commit(storage, id, referenceDate)'), 'Progression idempotency must have bounded persistent inspect/commit operations.');
check(legacy.includes('idempotency.inspect(localStorage, eventId, getLocalDateStamp())') && legacy.includes('idempotency.commit(localStorage, eventId, getLocalDateStamp())'), 'The live reward pipeline must check and commit stable IDs around the side effects.');
check(storageCore.includes("key === 'system_v2_progression_event_ids'") && storageCore.includes('progression event ledger contains invalid or duplicate IDs'), 'Backup restore must validate the persistent progression idempotency ledger.');
check(sw.includes('\"js/core/progression-math.js\"'), 'Offline shell must precache the progression math module.');
check(fs.existsSync(path.join(ROOT, 'tests/progression-math-test.js')), 'Progression math regression tests must be included.');
check(workflow.includes('npm test') && workflow.includes('npm run doctor') && workflow.includes('npm run test:e2e'), 'CI must run static, health, and real-browser tests.');
check(workflow.includes('npm install --no-package-lock --no-audit --no-fund') && !workflow.includes('cache: npm'), 'CI must install Playwright before use and must not require a missing npm lockfile.');
check(workflow.includes('playwright install --with-deps chromium') && workflow.includes("actions/upload-artifact@v7"), 'CI must install the browser and preserve diagnostics on failure.');
const androidBuildWorkflow = read('.github/workflows/build-android.yml');
check(androidBuildWorkflow.includes('Read canonical application version') && androidBuildWorkflow.includes('SYSTEM-v${{ steps.version.outputs.version }}-debug-apk'), 'Android debug artifact names must be derived from VERSION instead of hard-coded.');

const e2eRunner = read('scripts/run-playwright-tests.js');
check(e2eRunner.includes("require.resolve('@playwright/test')"), 'E2E runner must check for the local Playwright test dependency.');
check(e2eRunner.includes('npm install') && e2eRunner.includes('npx playwright install chromium'), 'E2E dependency errors must explain recovery steps.');
check(pkg.scripts['test:e2e'].includes('run-playwright-tests.js'), 'E2E command must use the local dependency preflight.');
check(pkg.scripts['test:e2e:mobile'].includes('run-playwright-tests.js'), 'Mobile E2E command must use the local dependency preflight.');

const html = read('index.html');
check(html.includes('href="css/system.css"'), 'HTML must load the generated CSS bundle.');
check(html.includes('type="module" src="js/app.js"'), 'HTML must load the ES module entry point.');
check(fs.existsSync(path.join(ROOT, 'css/system.css')), 'Generated CSS bundle must exist after build.');
check(fs.existsSync(path.join(ROOT, 'data/README.md')), 'Data directory must explain its current seed/reference role.');
check(sw.includes('"js/modules/ai-workspace-navigation.js"'), 'Service Worker must cache critical runtime modules.');
check(sw.includes('"js/core/goal-progress.js"'), 'Service Worker must precache the Goal evidence engine for offline use.');
check(fs.existsSync(path.join(ROOT, 'css/features/goal-progress.css')) && fs.readFileSync(path.join(ROOT, 'css/system.css'), 'utf8').includes('Source: css/features/goal-progress.css'), 'Goal progress styles must be included in the active CSS bundle.');
check(!sw.includes('"data/'), 'Inactive reference JSONs must not inflate the runtime app-shell cache.');

const i18n = read('js/features/i18n.js');
for (const localizedPhrase of ['Create a Goal', 'Linked mission target', 'Storage health', 'Export verified backup (.json)', 'Attention recommended: one or more saved values']) {
  check(i18n.includes(localizedPhrase), `Dari dictionary should include the new Goal/Data Health copy: ${localizedPhrase}.`);
}
check(read('js/core/goal-progress.js').includes('isValidDateOnly'), 'Goal normalization must check actual calendar dates, not only date-string shape.');
check(read('js/core/goal-progress.js').includes("requestedMode === 'evidence'") && read('js/core/goal-progress.js').includes('Older versions let the user mark a Goal complete manually'), 'Goal completion mode must reconcile evidence-based state while preserving legacy manual completion.');
check(read('js/core/storage.js').includes('isValidTimestamp'), 'Backup validation must reject malformed evidence timestamps.');
check(legacy.includes('goal.completionMode === "evidence" ? "VERIFIED BY MISSIONS" : "MANUALLY MARKED"') && legacy.includes('<span>${goal.completed ? "COMPLETED" : "IN PROGRESS"}</span>'), 'Goal state phrases must be isolated for dynamic bilingual translation.');

console.log(`SYSTEM project-integrity tests passed: ${checks} checks; release ${version}.`);
