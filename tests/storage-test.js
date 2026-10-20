'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/core/storage.js'), 'utf8');
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks++; }

class MemoryStorage {
    constructor() { this.map = new Map(); this.throwOnSetKey = null; }
    get length() { return this.map.size; }
    key(index) { return [...this.map.keys()][index] ?? null; }
    getItem(key) { key = String(key); return this.map.has(key) ? this.map.get(key) : null; }
    setItem(key, value) {
        key = String(key);
        if (this.throwOnSetKey === key) { this.throwOnSetKey = null; const error = new Error('simulated quota error'); error.name = 'QuotaExceededError'; throw error; }
        this.map.set(key, String(value));
    }
    removeItem(key) { this.map.delete(String(key)); }
}

class QuotaStorage extends MemoryStorage {
    constructor(maxBytes) { super(); this.maxBytes = maxBytes; }
    setItem(key, value) {
        key = String(key); value = String(value);
        if (this.throwOnSetKey === key) { this.throwOnSetKey = null; const error = new Error('simulated quota error'); error.name = 'QuotaExceededError'; throw error; }
        const sizeOf = (k, v) => String(k).length + String(v).length;
        let nextSize = sizeOf(key, value);
        for (const [existingKey, existingValue] of this.map) {
            if (existingKey !== key) nextSize += sizeOf(existingKey, existingValue);
        }
        if (nextSize > this.maxBytes) { const error = new Error('quota exceeded'); error.name = 'QuotaExceededError'; throw error; }
        this.map.set(key, value);
    }
}
const STAT_IDS = ['entrepreneurship', 'global-skills', 'mathematics', 'computer', 'physics', 'unique-thinking'];
function validSave(overrides = {}) {
    const stats = Object.fromEntries(STAT_IDS.map(id => [id, { level: 1, xp: 0, xpRequired: 100 }]));
    const base = { schemaVersion: 3, player: { level: 2, xp: 25, xpRequired: 1250, coins: 100 }, stats };
    return { ...base, ...overrides, player: { ...base.player, ...(overrides.player || {}) }, stats: { ...base.stats, ...(overrides.stats || {}) } };
}
function seedCoreSave(target, save = validSave()) {
    target.setItem('system_v2_save', JSON.stringify(save));
    return target;
}
function rawBackup(target, formatVersion = 2) {
    const entries = {};
    for (let i = 0; i < target.length; i++) {
        const key = target.key(i);
        if (key && api.isAppKey(key)) entries[key] = target.getItem(key);
    }
    const meta = { app: 'SYSTEM', formatVersion, exportedAt: '2026-10-15T00:00:00.000Z', storageKeys: Object.keys(entries).length };
    if (formatVersion === 2) { meta.checksumAlgorithm = 'fnv1a32'; meta.checksum = api.checksumForEntries(entries); meta.checksumPurpose = 'accidental-corruption-detection-only'; }
    return { ...entries, __system_backup_meta: JSON.stringify(meta) };
}

const storage = new MemoryStorage();
storage.setItem('system_v2_save', JSON.stringify(validSave({
    schemaVersion: 2,
    player: { level: 2, xp: 25, xpRequired: 1250, coins: 100 },
    stats: { mathematics: { level: 1, xp: 5, xpRequired: 100 } }
})));
storage.setItem('system_v2_progress', JSON.stringify({ totalXpEarned: 600, totalStatXpEarned: 5 }));
storage.setItem('system_v2_theme', 'cosmic');
storage.setItem('unrelated-user-value', 'keep me');

const window = { localStorage: storage, TextEncoder };
const context = { window, TextEncoder, Date, JSON, Object, Array, Number, String, Math, Set, Map, Error };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'js/core/storage.js' });
const api = window.SYSTEMStorage;
check(Boolean(api), 'Storage API should attach to the browser window.');

const backup = api.createBackup(storage, { now: new Date('2026-10-13T00:00:00.000Z') });
const parsed = JSON.parse(backup.serialized);
equal(backup.meta.formatVersion, 2, 'New backup should use format version 2.');
equal(backup.meta.storageKeys, 3, 'Backup metadata should report namespaced app data only.');
const validated = api.validateBackup(parsed);
equal(validated.entryCount, 3, 'Valid backup should pass validation.');
check(validated.meta.checksum === backup.meta.checksum, 'Validated backup should preserve the checksum.');
check(backup.serialized.includes('accidental-corruption-detection-only'), 'Backup should clearly scope its checksum to accidental corruption detection.');

const ledgerBackupStorage = seedCoreSave(new MemoryStorage());
ledgerBackupStorage.setItem('system_v2_progression_event_ids', JSON.stringify(['v1|custom-quest|quest-one']));
const ledgerBackup = rawBackup(ledgerBackupStorage);
check(api.validateBackup(ledgerBackup).entryCount === 2, 'A valid progression idempotency ledger should round-trip through backups.');
const duplicateLedgerBackupStorage = seedCoreSave(new MemoryStorage());
duplicateLedgerBackupStorage.setItem('system_v2_progression_event_ids', JSON.stringify(['v1|custom-quest|quest-one', 'v1|custom-quest|quest-one']));
let duplicateLedgerRejected = false;
try { api.validateBackup(rawBackup(duplicateLedgerBackupStorage)); } catch (error) { duplicateLedgerRejected = /progression event ledger contains invalid or duplicate IDs/i.test(error.message); }
check(duplicateLedgerRejected, 'Backup validation must reject duplicate IDs inside the idempotency ledger even when its checksum matches.');

const corrupted = JSON.parse(backup.serialized);
corrupted.system_v2_progress = JSON.stringify({ totalXpEarned: 999999 });
let checksumRejected = false;
try { api.validateBackup(corrupted); } catch (error) { checksumRejected = /integrity check failed/i.test(error.message); }
check(checksumRejected, 'Backup validation should reject a value that changed after export.');

const invalidSchema = JSON.parse(backup.serialized);
const invalidEntries = { ...invalidSchema };
invalidEntries.system_v2_save = JSON.stringify({ player: { level: 1, xp: 0, xpRequired: 100, coins: -1 } });
const meta = JSON.parse(invalidEntries.__system_backup_meta);
meta.checksum = api.checksumForEntries(Object.fromEntries(Object.entries(invalidEntries).filter(([key]) => key !== '__system_backup_meta')));
invalidEntries.__system_backup_meta = JSON.stringify(meta);
let schemaRejected = false;
try { api.validateBackup(invalidEntries); } catch (error) { schemaRejected = /player\.coins/i.test(error.message); }
check(schemaRejected, 'Schema validation should reject negative player balances even when checksum matches.');

const skillProgressBackup = JSON.parse(backup.serialized);
skillProgressBackup.system_v2_save = JSON.stringify(validSave({
    player: { level: 1, xp: 0, xpRequired: 100, coins: 0 },
    skillProgress: { 'math-algebra-i': { level: 2, xp: 10, xpRequired: 106, totalXp: 90, lastActivityAt: '2026-10-14T00:00:00.000Z' } }
}));
const skillMeta = JSON.parse(skillProgressBackup.__system_backup_meta);
skillMeta.checksum = api.checksumForEntries(Object.fromEntries(Object.entries(skillProgressBackup).filter(([key]) => key !== '__system_backup_meta')));
skillProgressBackup.__system_backup_meta = JSON.stringify(skillMeta);
check(api.validateBackup(skillProgressBackup).entryCount === 3, 'Valid per-skill XP should be accepted in backups.');
const invalidSkillProgress = JSON.parse(JSON.stringify(skillProgressBackup));
invalidSkillProgress.system_v2_save = JSON.stringify(validSave({ player: { level: 1, xp: 0, xpRequired: 100, coins: 0 }, skillProgress: { 'math-algebra-i': { level: -1, xp: 0, xpRequired: 80, totalXp: 0 } } }));
const invalidSkillMeta = JSON.parse(invalidSkillProgress.__system_backup_meta);
invalidSkillMeta.checksum = api.checksumForEntries(Object.fromEntries(Object.entries(invalidSkillProgress).filter(([key]) => key !== '__system_backup_meta')));
invalidSkillProgress.__system_backup_meta = JSON.stringify(invalidSkillMeta);
let invalidSkillRejected = false;
try { api.validateBackup(invalidSkillProgress); } catch (error) { invalidSkillRejected = /skillProgress\.math-algebra-i\.level/i.test(error.message); }
check(invalidSkillRejected, 'Backup validation should reject invalid individual skill levels.');

const legacy = {
    system_v2_save: JSON.stringify({ level: 3, xp: 30, xpRequired: 900, coins: 15 }),
    system_v2_theme: 'ice',
    system_v2_progress: JSON.stringify({ totalXpEarned: 10 }),
    __system_backup_meta: JSON.stringify({ app: 'SYSTEM', formatVersion: 1, storageKeys: 3, exportedAt: '2026-01-01T00:00:00.000Z' })
};
equal(api.validateBackup(legacy).entryCount, 3, 'Valid v1 backups with a recognized flat legacy save should remain restorable.');

const restoreStorage = new MemoryStorage();
restoreStorage.setItem('system_v2_save', 'old-save');
restoreStorage.setItem('system_v2_old-feature', 'old');
restoreStorage.setItem('unrelated-user-value', 'keep me');
const restored = api.applyEntriesAtomically({
    system_v2_save: JSON.stringify({ player: { level: 3 } }),
    system_v2_progress: JSON.stringify({ totalXpEarned: 200 })
}, restoreStorage, { replacePrefixes: true });
check(restored.ok, 'Valid entries should apply successfully.');
equal(restoreStorage.getItem('system_v2_old-feature'), null, 'Full restore should remove stale namespaced keys absent from the backup.');
equal(restoreStorage.getItem('unrelated-user-value'), 'keep me', 'Restore should not change unrelated localStorage keys.');

const rollbackStorage = new MemoryStorage();
rollbackStorage.setItem('system_v2_save', 'previous-save');
rollbackStorage.setItem('system_v2_progress', 'previous-progress');
rollbackStorage.throwOnSetKey = 'system_v2_progress';
const failed = api.applyEntriesAtomically({ system_v2_save: 'new-save', system_v2_progress: 'new-progress' }, rollbackStorage);
check(!failed.ok, 'Failed storage write should return a failure result.');
check(failed.rolledBack, 'Failed storage write should attempt and confirm rollback.');
equal(rollbackStorage.getItem('system_v2_save'), 'previous-save', 'Rollback should restore earlier values.');
equal(rollbackStorage.getItem('system_v2_progress'), 'previous-progress', 'Rollback should restore the value whose write failed.');


// Rollback safety: must free incoming bytes before restoring the old, potentially larger save.
const quotaStorage = new QuotaStorage(480);
quotaStorage.map.set('system_v2_save', 'S'.repeat(120));
quotaStorage.map.set('system_v2_progress', 'P'.repeat(120));
quotaStorage.map.set('system_v2_old-feature', 'O'.repeat(120));
quotaStorage.map.set('unrelated-user-value', 'keep-this-value');
const quotaFailure = api.applyEntriesAtomically({
    system_v2_save: 'new-save-is-small',
    system_v2_progress: 'new-progress-is-small',
    system_v2_custom_quests: 'C'.repeat(250),
    system_v2_reward_state: 'R'.repeat(100)
}, quotaStorage, { replacePrefixes: true });
check(!quotaFailure.ok && quotaFailure.rolledBack,
    'A quota failure during restore should report a successful rollback after freeing incoming space first.');
equal(quotaStorage.getItem('system_v2_save'), 'S'.repeat(120), 'Quota rollback must restore the original large player save.');
equal(quotaStorage.getItem('system_v2_progress'), 'P'.repeat(120), 'Quota rollback must restore the original progress ledger.');
equal(quotaStorage.getItem('system_v2_old-feature'), 'O'.repeat(120), 'Quota rollback must restore app keys deleted by replace mode.');
equal(quotaStorage.getItem('system_v2_custom_quests'), null, 'Quota rollback must remove newly introduced keys.');
equal(quotaStorage.getItem('unrelated-user-value'), 'keep-this-value', 'Quota rollback must preserve unrelated site data.');

const preflightStorage = new MemoryStorage();
preflightStorage.setItem('system_v2_save', 'previous-save');
preflightStorage.setItem('system_v2_old-feature', 'preserve-old-feature');
const preflightResult = api.applyEntriesAtomically({
    system_v2_save: 'new-save',
    'unrelated-user-value': 'must-not-be-applied'
}, preflightStorage, { replacePrefixes: true });
check(!preflightResult.ok, 'Unsafe entries must be rejected before applying a restore.');
equal(preflightStorage.getItem('system_v2_save'), 'previous-save', 'Preflight rejection must leave the core save untouched.');
equal(preflightStorage.getItem('system_v2_old-feature'), 'preserve-old-feature', 'Preflight rejection must not remove old app keys.');
equal(preflightStorage.getItem('unrelated-user-value'), null, 'Preflight rejection must not write unrelated keys.');

const diagnosticStorage = new MemoryStorage();
diagnosticStorage.setItem('system_v2_save', '{broken');
const health = api.inspect(diagnosticStorage);
equal(health.malformedJsonKeys.length, 1, 'Health inspection should find malformed app JSON.');
check(!health.backupReady, 'Health inspection should flag malformed data for review.');
const noCoreHealth = api.inspect(new MemoryStorage());
check(noCoreHealth.missingCoreData.includes('system_v2_save') && !noCoreHealth.backupReady,
    'Storage health must mark the profile not backup-ready until the main player save exists.');
const schemaStorage = new MemoryStorage();
schemaStorage.setItem('system_v2_save', JSON.stringify({ player: { level: 0, xp: -2, coins: -5 } }));
const schemaHealth = api.inspect(schemaStorage);
equal(schemaHealth.invalidDataKeys.length, 1, 'Health inspection should detect valid JSON that violates the player data schema.');
check(!schemaHealth.backupReady, 'Health inspection should not mark schema-invalid data backup-ready.');

// Full-restore safety: backups must never be allowed to wipe the core player save.
const noCoreStorage = new MemoryStorage();
noCoreStorage.setItem('system_v2_theme', 'cosmic');
let missingCoreExportRejected = false;
try { api.createBackup(noCoreStorage); } catch (error) { missingCoreExportRejected = /main player save/i.test(error.message); }
check(missingCoreExportRejected, 'Backup creation should refuse to label a snapshot restorable when core player data is absent.');
let missingCoreRestoreRejected = false;
try { api.validateBackup(rawBackup(noCoreStorage)); } catch (error) { missingCoreRestoreRejected = /missing the main player save/i.test(error.message); }
check(missingCoreRestoreRejected, 'Restore validation must reject a partial backup before it can replace the app namespace.');
const incompleteSaveStorage = seedCoreSave(new MemoryStorage(), { player: { level: 5, xp: 20, coins: 100 }, stats: {} });
const incompleteSaveHealth = api.inspect(incompleteSaveStorage);
check(incompleteSaveHealth.invalidDataKeys.includes('system_v2_save') && !incompleteSaveHealth.backupReady,
    'Health inspection must flag a partial nested save that would lose Stat progress on restore.');
const incompleteBackup = rawBackup(incompleteSaveStorage);
let incompleteSaveRestoreRejected = false;
try { api.validateBackup(incompleteBackup); } catch (error) { incompleteSaveRestoreRejected = /stats field is required|stats\./i.test(error.message); }
check(incompleteSaveRestoreRejected, 'Restore validation must reject nested player saves missing their Stat records.');

const dailyPrizeStorage = seedCoreSave(new MemoryStorage());
dailyPrizeStorage.setItem('system_v2_daily_prize', JSON.stringify({
    id: 'stardust-cache', date: '2026-10-15', claimed: true, claimedAt: '2026-10-15T12:00:00.000Z',
    nameEn: 'Stardust Cache', nameFa: 'گنجینهٔ غبار ستاره‌ای', rarity: 'COMMON', xp: 160, coins: 50, symbol: '✧'
}));
const validPrizeBackup = api.createBackup(dailyPrizeStorage);
check(api.validateBackup(JSON.parse(validPrizeBackup.serialized)).entryCount === 2, 'A valid Daily Prize record should round-trip with the required core player save.');
const invalidPrizeBackup = JSON.parse(validPrizeBackup.serialized);
invalidPrizeBackup.system_v2_daily_prize = JSON.stringify({
    id: 'stardust-cache', date: '2026-10-15', claimed: true, nameEn: 'Stardust Cache', nameFa: 'گنجینه', rarity: 'COMMON', xp: 999999, coins: 50, symbol: '✧'
});
const prizeMeta = JSON.parse(invalidPrizeBackup.__system_backup_meta);
prizeMeta.checksum = api.checksumForEntries(Object.fromEntries(Object.entries(invalidPrizeBackup).filter(([key]) => key !== '__system_backup_meta')));
invalidPrizeBackup.__system_backup_meta = JSON.stringify(prizeMeta);
let invalidPrizeRejected = false;
try { api.validateBackup(invalidPrizeBackup); } catch (error) { invalidPrizeRejected = /daily prize record is invalid/i.test(error.message); }
check(invalidPrizeRejected, 'Backup validation should reject a Daily Prize with out-of-range reward values.');
const impossiblePrizeDateBackup = JSON.parse(api.createBackup(dailyPrizeStorage).serialized);
impossiblePrizeDateBackup.system_v2_daily_prize = JSON.stringify({
    id: 'stardust-cache', date: '2026-02-30', claimed: true, claimedAt: '2026-10-15T12:00:00.000Z',
    nameEn: 'Stardust Cache', nameFa: 'گنجینهٔ غبار ستاره‌ای', rarity: 'COMMON', xp: 160, coins: 50, symbol: '✧'
});
const impossiblePrizeMeta = JSON.parse(impossiblePrizeDateBackup.__system_backup_meta);
impossiblePrizeMeta.checksum = api.checksumForEntries(Object.fromEntries(Object.entries(impossiblePrizeDateBackup).filter(([key]) => key !== '__system_backup_meta')));
impossiblePrizeDateBackup.__system_backup_meta = JSON.stringify(impossiblePrizeMeta);
let impossiblePrizeDateRejected = false;
try { api.validateBackup(impossiblePrizeDateBackup); } catch (error) { impossiblePrizeDateRejected = /daily prize record is invalid/i.test(error.message); }
check(impossiblePrizeDateRejected, 'Backup must reject impossible Daily Prize calendar dates.');

// ---- Inventory schema compatibility and evidence-aware goals ----
const currentInventoryStorage = seedCoreSave(new MemoryStorage());
currentInventoryStorage.setItem('system_v2_inventory', JSON.stringify([{
    instanceId: 'inventory-instance-1', itemId: 'reward-video-break', name: 'Watch a Saved Video',
    description: 'A planned reward.', category: 'Personal Reward', price: 60,
    purchasedAt: '2026-10-15T10:00:00.000Z', redeemed: false
}]));
const currentInventoryBackup = api.createBackup(currentInventoryStorage);
check(api.validateBackup(JSON.parse(currentInventoryBackup.serialized)).entryCount === 2,
    'Backup should accept current Inventory entries using instanceId and itemId.');

const legacyInventoryStorage = seedCoreSave(new MemoryStorage());
legacyInventoryStorage.setItem('system_v2_inventory', JSON.stringify([{ id: 'old-inventory-entry', name: 'Legacy reward' }]));
check(api.validateBackup(JSON.parse(api.createBackup(legacyInventoryStorage).serialized)).entryCount === 2,
    'Backup should retain compatibility with legacy Inventory entries using id.');

const invalidInventoryStorage = seedCoreSave(new MemoryStorage());
invalidInventoryStorage.setItem('system_v2_inventory', JSON.stringify([{ name: 'No stable ID' }]));
let invalidInventoryRejected = false;
try { api.validateBackup(rawBackup(invalidInventoryStorage)); }
catch (error) { invalidInventoryRejected = /inventory is invalid/i.test(error.message); }
check(invalidInventoryRejected, 'Backup should reject Inventory rows with no stable identity.');
const emptyInventoryStorage = seedCoreSave(new MemoryStorage());
emptyInventoryStorage.setItem('system_v2_inventory', '[]');
const emptyInventoryId = JSON.parse(api.createBackup(emptyInventoryStorage).serialized);
emptyInventoryId.system_v2_inventory = JSON.stringify([{ instanceId: '', itemId: '', id: '' }]);
const emptyInventoryMeta = JSON.parse(emptyInventoryId.__system_backup_meta);
emptyInventoryMeta.checksum = api.checksumForEntries(Object.fromEntries(Object.entries(emptyInventoryId).filter(([key]) => key !== '__system_backup_meta')));
emptyInventoryId.__system_backup_meta = JSON.stringify(emptyInventoryMeta);
let emptyIdentityRejected = false;
try { api.validateBackup(emptyInventoryId); } catch (error) { emptyIdentityRejected = /inventory is invalid/i.test(error.message); }
check(emptyIdentityRejected, 'Backup should reject empty Inventory identifiers, not merely typed strings.');
const duplicateInventoryBackup = JSON.parse(api.createBackup(currentInventoryStorage).serialized);
duplicateInventoryBackup.system_v2_inventory = JSON.stringify([
    { instanceId: 'duplicate-instance', itemId: 'first', name: 'One' },
    { instanceId: 'duplicate-instance', itemId: 'second', name: 'Two' }
]);
const duplicateInventoryMeta = JSON.parse(duplicateInventoryBackup.__system_backup_meta);
duplicateInventoryMeta.checksum = api.checksumForEntries(Object.fromEntries(Object.entries(duplicateInventoryBackup).filter(([key]) => key !== '__system_backup_meta')));
duplicateInventoryBackup.__system_backup_meta = JSON.stringify(duplicateInventoryMeta);
let duplicateInventoryRejected = false;
try { api.validateBackup(duplicateInventoryBackup); } catch (error) { duplicateInventoryRejected = /inventory is invalid/i.test(error.message); }
check(duplicateInventoryRejected, 'Backup should reject duplicate Inventory instance identities.');

const goalStorage = seedCoreSave(new MemoryStorage());
goalStorage.setItem('system_v2_goals', JSON.stringify([{
    id: 'goal-evidence-1', title: 'Learn Algebra', stat: 'mathematics', targetDate: '2026-10-31',
    targetCount: 2, progressCount: 1, completed: false,
    evidence: [{ questId: 'quest-evidence-1', title: 'Linear equations', stat: 'mathematics', xp: 50, at: '2026-10-15T10:00:00.000Z' }]
}]));
check(api.validateBackup(JSON.parse(api.createBackup(goalStorage).serialized)).entryCount === 2,
    'Backup should round-trip evidence-aware Goal records.');
const invalidGoalBackup = JSON.parse(api.createBackup(goalStorage).serialized);
invalidGoalBackup.system_v2_goals = JSON.stringify([{ id: 'goal-evidence-1', title: 'Learn Algebra', targetCount: 99, progressCount: 0 }]);
const invalidGoalMeta = JSON.parse(invalidGoalBackup.__system_backup_meta);
invalidGoalMeta.checksum = api.checksumForEntries(Object.fromEntries(Object.entries(invalidGoalBackup).filter(([key]) => key !== '__system_backup_meta')));
invalidGoalBackup.__system_backup_meta = JSON.stringify(invalidGoalMeta);
let invalidGoalRejected = false;
try { api.validateBackup(invalidGoalBackup); } catch (error) { invalidGoalRejected = /valid goal records/i.test(error.message); }
check(invalidGoalRejected, 'Backup should reject evidence Goal targets outside the supported range.');
const duplicateGoalBackup = JSON.parse(api.createBackup(goalStorage).serialized);
duplicateGoalBackup.system_v2_goals = JSON.stringify([
    { id: 'same-goal', title: 'First Goal', targetCount: 2, progressCount: 0 },
    { id: 'same-goal', title: 'Second Goal', targetCount: 2, progressCount: 0 }
]);
const duplicateGoalMeta = JSON.parse(duplicateGoalBackup.__system_backup_meta);
duplicateGoalMeta.checksum = api.checksumForEntries(Object.fromEntries(Object.entries(duplicateGoalBackup).filter(([key]) => key !== '__system_backup_meta')));
duplicateGoalBackup.__system_backup_meta = JSON.stringify(duplicateGoalMeta);
let duplicateGoalRejected = false;
try { api.validateBackup(duplicateGoalBackup); } catch (error) { duplicateGoalRejected = /valid goal records/i.test(error.message); }
check(duplicateGoalRejected, 'Backup should reject duplicate Goal identities.');
const overEvidenceBackup = JSON.parse(api.createBackup(goalStorage).serialized);
overEvidenceBackup.system_v2_goals = JSON.stringify([{ id: 'over-evidence', title: 'Too many evidence records', targetCount: 20, progressCount: 20,
    evidence: Array.from({ length: 21 }, (_, index) => ({ questId: `quest-${index}`, title: `Proof ${index}` })) }]);
const overEvidenceMeta = JSON.parse(overEvidenceBackup.__system_backup_meta);
overEvidenceMeta.checksum = api.checksumForEntries(Object.fromEntries(Object.entries(overEvidenceBackup).filter(([key]) => key !== '__system_backup_meta')));
overEvidenceBackup.__system_backup_meta = JSON.stringify(overEvidenceMeta);
let overEvidenceRejected = false;
try { api.validateBackup(overEvidenceBackup); } catch (error) { overEvidenceRejected = /valid goal records/i.test(error.message); }
check(overEvidenceRejected, 'Backup schema should match the runtime evidence cap of 20 records.');

function recalculateChecksum(backup) {
    const meta = JSON.parse(backup.__system_backup_meta);
    meta.checksum = api.checksumForEntries(Object.fromEntries(Object.entries(backup).filter(([key]) => key !== '__system_backup_meta')));
    backup.__system_backup_meta = JSON.stringify(meta);
    return backup;
}
const invalidCalendarBackup = recalculateChecksum(JSON.parse(api.createBackup(goalStorage).serialized));
invalidCalendarBackup.system_v2_goals = JSON.stringify([{ id: 'bad-calendar', title: 'Invalid calendar date', targetDate: '2026-02-30', targetCount: 2, progressCount: 0, completed: false }]);
recalculateChecksum(invalidCalendarBackup);
let invalidCalendarRejected = false;
try { api.validateBackup(invalidCalendarBackup); } catch (error) { invalidCalendarRejected = /valid goal records/i.test(error.message); }
check(invalidCalendarRejected, 'Backup must reject impossible calendar dates even when the JSON and checksum are valid.');
const badEvidenceTimeBackup = JSON.parse(api.createBackup(goalStorage).serialized);
badEvidenceTimeBackup.system_v2_goals = JSON.stringify([{ id: 'bad-evidence-time', title: 'Bad timestamp', targetCount: 2, progressCount: 1, completed: false, evidence: [{ questId: 'q1', title: 'Proof', at: 'not-a-date' }] }]);
recalculateChecksum(badEvidenceTimeBackup);
let badEvidenceTimeRejected = false;
try { api.validateBackup(badEvidenceTimeBackup); } catch (error) { badEvidenceTimeRejected = /valid goal records/i.test(error.message); }
check(badEvidenceTimeRejected, 'Backup must reject malformed evidence timestamps.');
const impossibleCompletionBackup = JSON.parse(api.createBackup(goalStorage).serialized);
impossibleCompletionBackup.system_v2_goals = JSON.stringify([{ id: 'impossible', title: 'Unfinished but full', targetCount: 2, progressCount: 2, completed: false }]);
recalculateChecksum(impossibleCompletionBackup);
let impossibleCompletionRejected = false;
try { api.validateBackup(impossibleCompletionBackup); } catch (error) { impossibleCompletionRejected = /valid goal records/i.test(error.message); }
check(impossibleCompletionRejected, 'Backup must reject an active Goal whose progress has already reached its target.');
const paddedIdentityBackup = JSON.parse(api.createBackup(currentInventoryStorage).serialized);
paddedIdentityBackup.system_v2_inventory = JSON.stringify([{ instanceId: ' inventory-padded ', itemId: 'catalog-item', name: 'Padded identity' }]);
recalculateChecksum(paddedIdentityBackup);
let paddedIdentityRejected = false;
try { api.validateBackup(paddedIdentityBackup); } catch (error) { paddedIdentityRejected = /inventory is invalid/i.test(error.message); }
check(paddedIdentityRejected, 'Backup must reject whitespace-padded Inventory identities that can hide duplicates.');

console.log(`SYSTEM storage tests passed: ${checks} checks.`);

// ---- Auto-snapshot module ----
(function () {
    const fs = require('fs'), vm = require('vm'), path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'features', 'auto-snapshots.js'), 'utf8');
    const store = {};
    const ls = { get length() { return Object.keys(store).length; }, key: i => Object.keys(store)[i] || null,
        getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
    const win = { localStorage: ls };
    const sandbox = { window: win, localStorage: ls, document: { readyState: 'complete', addEventListener() {}, body: {}, getElementById: () => null },
        navigator: {}, location: { protocol: 'file:' }, MutationObserver: class { observe() {} }, console };
    vm.createContext(sandbox);
    const storageSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'storage.js'), 'utf8');
    vm.runInContext(storageSrc, Object.assign(sandbox, { global: win }));
    sandbox.window.SYSTEMStorage = sandbox.window.SYSTEMStorage || win.SYSTEMStorage;
    vm.runInContext(src, sandbox);
    const api = win.SYSTEMAutoBackup;
    if (!api) throw new Error('SYSTEMAutoBackup was not exposed');
    ls.setItem('system_v2_save', JSON.stringify({ level: 1, xp: 0, coins: 5 }));
    if (!api.snapshot()) throw new Error('Snapshot should succeed with a player save present.');
    if (api.list().length !== 1) throw new Error('One snapshot expected.');
    if (api.list()[0].indexOf('system_v2_') === 0) throw new Error('Snapshots must not use a SYSTEM-owned prefix.');
    ls.setItem('system_v2_save', JSON.stringify({ level: 1, xp: 0, coins: 999 }));
    const r = api.restoreLatest();
    if (!r.ok || JSON.parse(ls.getItem('system_v2_save')).coins !== 5) throw new Error('Restore should roll back to snapshot: ' + JSON.stringify(r));
    const safeSnapshotKey = api.list()[0];
    const safeSnapshotValue = ls.getItem(safeSnapshotKey);
    ls.setItem('system_v2_goals', '{broken');
    if (api.snapshot() !== false) throw new Error('Snapshot should refuse to export malformed data.');
    if (ls.getItem(safeSnapshotKey) !== safeSnapshotValue || api.list().length !== 1) throw new Error('A failed snapshot must preserve the last valid recovery point.');
    ls.removeItem('system_v2_goals');
    for (let d = 1; d <= 5; d++) ls.setItem('sys_autosnap_2020-01-0' + d, '{}');
    api.snapshot();
    if (api.list().length > 3) throw new Error('Snapshot rotation should keep at most 3.');
    console.log('SYSTEM auto-snapshot tests passed: 7 checks.');
})();
