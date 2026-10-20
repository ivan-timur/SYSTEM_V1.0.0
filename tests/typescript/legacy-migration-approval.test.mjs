import assert from 'node:assert/strict';
import {
  createLegacyMigrationApproval,
  previewLegacyLocalStorageMigration,
  validateLegacyMigrationApproval,
  LEGACY_SOURCE_KEYS,
} from '../../dist/ts/storage/legacy-migration.js';

const now = new Date('2026-10-18T10:15:00.000Z');
const values = new Map([
  [LEGACY_SOURCE_KEYS.save, JSON.stringify({ player: { level: 2, xp: 35, coins: 9, rank: 'D' } })],
  [LEGACY_SOURCE_KEYS.dailyDate, '2026-10-18'],
  [LEGACY_SOURCE_KEYS.dailyCompleted, JSON.stringify({ study: true })],
  [LEGACY_SOURCE_KEYS.customQuests, JSON.stringify([{ id: 'migration-check', title: 'Build a test', xp: 20, coins: 2 }])],
  [LEGACY_SOURCE_KEYS.history, JSON.stringify([])],
]);
const storage = { getItem(key) { return values.has(key) ? values.get(key) : null; } };
const preview = previewLegacyLocalStorageMigration(storage, now);
assert.equal(preview.destructive, false);
assert.equal(preview.migrationId, 'legacy-localstorage-v1');
assert.throws(() => createLegacyMigrationApproval(preview, { confirmed: false }, now), /explicit user confirmation/,
  'migration cannot be approved without an affirmative confirmation');
if (preview.warnings.length > 0) {
  assert.throws(() => createLegacyMigrationApproval(preview, { confirmed: true }, now), /acknowledge them/,
    'warnings must be acknowledged before migration approval');
}
const approval = createLegacyMigrationApproval(preview, { confirmed: true, warningsAcknowledged: true }, now);
assert.equal(approval.confirmed, true);
assert.equal(approval.sourceFingerprint, preview.sourceFingerprint);
const plan = validateLegacyMigrationApproval(storage, approval, now);
assert.equal(plan.sourceFingerprint, preview.sourceFingerprint);
assert.equal(plan.summary.questCount, preview.summary.questCount);
assert.equal(values.get(LEGACY_SOURCE_KEYS.save).includes('"coins":9'), true,
  'approval and validation never modify the legacy save');

const changedValues = new Map(values);
changedValues.set(LEGACY_SOURCE_KEYS.save, JSON.stringify({ player: { level: 2, xp: 35, coins: 10, rank: 'D' } }));
const changedStorage = { getItem(key) { return changedValues.has(key) ? changedValues.get(key) : null; } };
assert.throws(() => validateLegacyMigrationApproval(changedStorage, approval, now), /stale because legacy localStorage changed/,
  'stale source data must be rejected before IndexedDB can be opened');
assert.throws(() => validateLegacyMigrationApproval(storage, approval, new Date('2026-10-19T00:01:00.000Z')), /preview date has changed/,
  'approval expires when the local calendar date changes');
assert.throws(() => createLegacyMigrationApproval(preview, { confirmed: true, warningsAcknowledged: true }, new Date('2026-10-19T00:01:00.000Z')), /another date/,
  'an old preview cannot be approved after midnight');
assert.throws(() => validateLegacyMigrationApproval(storage, { ...approval, confirmedAt: '2026-10-18T11:00:00.000Z' }, now), /in the future/,
  'a future-dated confirmation is rejected');
console.log('Legacy migration approval tests passed: explicit opt-in, warning acknowledgement, fingerprint binding, stale-source rejection, date rollover, future timestamp rejection, and legacy-save preservation.');
