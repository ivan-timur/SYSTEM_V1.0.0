'use strict';
// Phase 40: audit the active application/storage boundary without changing user data.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const app = read('js/app.js');
const controller = read('js/legacy/app-controller.js');
const migration = read('src/storage/legacy-migration.ts');
const idb = read('src/storage/indexeddb.ts');
const packageJson = JSON.parse(read('package.json'));
const html = read('index.html');

// Safety invariants: durable migration must remain explicit until browser/device gates pass.
check(app.includes('preview: () => previewLegacyLocalStorageMigration(window.localStorage)'),
  'Migration preview must remain an explicit API over existing localStorage data.');
check(app.includes('migrate: (approval) => migrateLegacyLocalStorageToIndexedDB(window.localStorage, approval)'),
  'Migration must require an explicit approval object.');
check(app.includes('The legacy UI remains on localStorage') && app.includes('until a separate approved migration/cutover is performed'),
  'Legacy UI storage authority must not be silently switched to IndexedDB.');
check(migration.includes('createLegacyMigrationApproval') && migration.includes('previewLegacyLocalStorageMigration') && migration.includes('migrateLegacyLocalStorageToIndexedDB'),
  'Migration module must expose preview, approval, and execution as separate stages.');
check(/localStorage/.test(controller), 'Live legacy controller storage boundary must be explicitly accounted for.');
check(/indexedDB|IndexedDB/.test(idb), 'IndexedDB implementation must remain present for the opt-in durable path.');
check(html.includes('type="module" src="js/app.js"'), 'Application must load the module entry point.');
check(packageJson.scripts && packageJson.scripts['test:browser-idb'], 'Browser IndexedDB test command must be declared.');
check(packageJson.scripts && packageJson.scripts['android:build:debug'], 'Android debug build command must be declared.');

// A lockfile is an explicit release-readiness item; do not fabricate one without registry metadata.
const lockPresent = exists('package-lock.json');
const localStorageMatches = [];
for (const rel of ['js/app.js', 'js/legacy/app-controller.js', 'js/core/storage.js', 'js/core/progression-idempotency.js', 'js/features/grok-suite.js']) {
  if (!exists(rel)) continue;
  const source = read(rel);
  const count = (source.match(/localStorage/g) || []).length;
  localStorageMatches.push(`${rel}=${count}`);
}

if (failures.length) {
  console.error(`Phase 40 live-path audit FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('Phase 40 live-path audit PASSED: legacy authority remains explicit; migration is opt-in; IndexedDB and browser/Android validation commands remain available.');
console.log(`Phase 40 observation: package-lock.json ${lockPresent ? 'present' : 'MISSING — reproducible dependency install remains blocked until generated with registry access'}.`);
console.log(`Phase 40 localStorage reference counts (static signal, not a complete call-graph): ${localStorageMatches.join(', ')}.`);
console.log('Release caveat: this static audit does not claim a real-browser IndexedDB pass, APK build, or physical-device validation.');
