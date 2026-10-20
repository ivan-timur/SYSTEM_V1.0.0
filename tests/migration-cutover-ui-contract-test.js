'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

const migration = source('src/storage/legacy-migration.ts');
const app = source('js/app.js');
const controller = source('js/legacy/app-controller.js');
const packageJson = JSON.parse(source('package.json'));

assert.match(migration, /export async function getLegacyMigrationDatabaseStatus\(\)/,
  'the current database migration receipt must be inspectable');
assert.match(migration, /db\.transaction\(\['migrations'\], 'readonly'\)/,
  'migration status must be read-only');
assert.match(app, /status: \(\) => getLegacyMigrationDatabaseStatus\(\)/,
  'the typed migration status must be exposed to the UI');
assert.match(controller, /id="system-idb-preview"/, 'settings must expose an explicit preview action');
assert.match(controller, /id="system-idb-import" disabled/, 'import must remain disabled until a preview succeeds');
assert.match(controller, /window\.confirm\(`Import this reviewed SYSTEM save into IndexedDB\?/,
  'import must require direct user confirmation');
assert.match(controller, /window\.SYSTEMProgressionMigration\.approve\(preview, \{ confirmed: true, warningsAcknowledged \}\)/,
  'the UI must use the preview-bound approval contract');
assert.match(controller, /currentPreview\.sourceFingerprint !== stored\.sourceFingerprint/,
  'status must identify when the local save has diverged from its imported snapshot');
assert.match(controller, /active UI still uses localStorage/,
  'the UI must explicitly disclose that migration is not a production cutover');
assert.match(controller, /legacy save remains untouched/,
  'the completion message must state that the original save is preserved');
assert.match(packageJson.scripts['test:static'], /migration-cutover-ui-contract-test\.js/,
  'the migration/cutover contract must run as part of static regression tests');

// The migration path is explicit: it is exposed as a method but not invoked during app startup.
const appSetup = app.slice(app.indexOf('window.SYSTEMProgressionMigration ='), app.indexOf('// Read-only IndexedDB diagnostics'));
assert.doesNotMatch(appSetup, /\.migrate\(.*\);\s*$/,
  'app boot must never automatically run a migration');
console.log('Migration/cutover UI contract tests passed: read-only receipt, reviewed import, confirmation, snapshot-drift warning and no automatic cutover.');
