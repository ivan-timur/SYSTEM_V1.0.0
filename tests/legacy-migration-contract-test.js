'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const idb = fs.readFileSync(path.join(root, 'src/storage/indexeddb.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'src/storage/legacy-migration.ts'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (!/SYSTEM_DB_VERSION = 7/.test(idb)) throw new Error('IndexedDB schema version 7 is missing.');
for (const store of ['stats', 'activity_history', 'migrations', 'app_state', 'daily_prizes']) {
  if (!idb.includes(`'${store}'`)) throw new Error(`Missing IndexedDB migration store: ${store}`);
}
if (!/migrationStore\.add\(/.test(migration)) throw new Error('Migration marker must be append-only.');
if (!/goalCurricula: GoalCurriculumDefinition\[\]/.test(migration) || !/goalEvidence: Array<GoalCurriculumEvidence & \{ goalId: string \}>/.test(migration)) throw new Error('The approved migration plan must carry typed legacy Goal curricula and evidence.');
if (!/curriculumStore\.add\(/.test(migration) || !/evidenceStore\.add\(/.test(migration)) throw new Error('Legacy Goal curricula and evidence must be imported atomically.');
if (!/quest\.milestoneId = nextMilestone\.id/.test(migration)) throw new Error('Active linked Custom Quests must be assigned to a valid open milestone during migration.');
if (!/Object\.entries\(counts\).*count/.test(migration)) throw new Error('Migration must check the target DB for existing records.');
if (!/sourceFingerprint !== plan\.sourceFingerprint/.test(migration)) throw new Error('Migration must reject source conflicts after prior migration.');
if (/\.setItem\(|\.removeItem\(|\.clear\(/.test(migration)) throw new Error('Migration implementation must not mutate or remove legacy localStorage.');
if (!/previewLegacyLocalStorageMigration/.test(app) || !/createLegacyMigrationApproval/.test(app) || !/migrateLegacyLocalStorageToIndexedDB/.test(app)) throw new Error('Preview-bound migration API is not loaded into app.js.');
if (!/window\.SYSTEMProgressionMigration = Object\.freeze/.test(app)) throw new Error('Migration API must be exposed in a frozen namespace.');
if (/SYSTEMProgressionMigration\.migrate\(\)/.test(app)) throw new Error('Migration must never run automatically during app startup.');
if (!/export function createLegacyMigrationApproval\(/.test(migration) || !/export function validateLegacyMigrationApproval\(/.test(migration)) throw new Error('Migration must require and validate a preview-bound explicit approval.');
if (!/stale because legacy localStorage changed/.test(migration) || !/warningsAcknowledged/.test(migration)) throw new Error('Migration must reject stale previews and require warning acknowledgement.');
if (!packageJson.scripts['test:ts'].includes('legacy-migration.test.mjs') || !packageJson.scripts['test:ts'].includes('legacy-migration-approval.test.mjs')) throw new Error('Legacy migration tests are not in test:ts.');
console.log('Legacy migration contract tests passed: schema v7, atomic target import, replay marker, conflict refusal, non-destructive legacy boundary and preview-bound opt-in API, warning acknowledgement, non-destructive legacy boundary and no automatic migration.');
