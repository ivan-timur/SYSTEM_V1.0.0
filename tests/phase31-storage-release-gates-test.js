#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const failures = [];
function check(condition, message) { try { assert.ok(condition, message); } catch (error) { failures.push(error.message); } }

const browserRunner = read('tests/run-indexeddb-browser-test.js');
const browserPage = read('tests/browser/indexeddb-transaction-test.html');
const browserTest = read('tests/browser/indexeddb-transaction-test.js');
const androidSync = read('scripts/sync-android-assets.js');
const androidBuild = read('android/app/build.gradle');
const version = read('VERSION').trim();
const manifest = JSON.parse(read('manifest.webmanifest'));

check(pkg.scripts['test:browser-idb'] && pkg.scripts['test:browser-idb'].includes('run-indexeddb-browser-test.js'), 'A dedicated real-browser IndexedDB validation command must exist.');
check(browserRunner.includes('launch({ headless: true })') && browserRunner.includes('TEST_PATH'), 'Browser runner must launch a browser and target the isolated IndexedDB test page.');
check(browserPage.includes('data-test-status="running"') && browserPage.includes('indexeddb-transaction-test.js'), 'Browser test page must expose a machine-readable completion status.');
check(browserTest.includes('close()') && browserTest.includes('openSystemDatabase()'), 'Browser integration test must exercise database close/reopen persistence.');
check(browserTest.includes('alreadyCompleted') && browserTest.includes('migration') && browserTest.includes('transaction'), 'Browser integration test must cover duplicate completion and migration/transaction scenarios.');
check(androidSync.includes("'index.html', 'VERSION', 'WEB_VERSION', 'manifest.webmanifest', 'sw.js'") && androidSync.includes("'assets', 'css', 'js'"), 'Android asset synchronization must copy the app shell and runtime directories.');
check(androidSync.includes('dist', 'ts') || androidSync.includes("'dist', 'ts'"), 'Android asset synchronization must include compiled TypeScript runtime.');
check(androidBuild.includes(`versionName '${version}'`), 'Android versionName must match canonical VERSION for the release configuration.');
check(manifest.version === version, 'Web manifest version must match canonical VERSION.');
check(pkg.scripts.build && pkg.scripts['prepare:android'], 'Build and Android preparation commands must exist.');
check(pkg.scripts['test:static'].includes('phase31-storage-release-gates-test.js'), 'Phase 31 gate test must be included in the static regression suite.');

if (failures.length) {
  console.error(`Phase 31 storage/release gate audit: FAIL (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Phase 31 storage/release gate audit: PASS');
console.log('Verified browser IndexedDB test entrypoint, close/reopen coverage, Android asset sync and release version contracts.');
console.log('This is a source-contract audit; it does not claim that browser tests, APK build or physical-device validation ran.');
