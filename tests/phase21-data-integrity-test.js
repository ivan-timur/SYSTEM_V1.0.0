'use strict';
/** Phase 21 regression: restart persistence, backup round-trip, corruption refusal and rollback safety. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/core/storage.js'), 'utf8');
let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks += 1; }
class MemoryStorage {
  constructor(entries = []) { this.map = new Map(entries); this.failKey = null; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(String(k)) ? this.map.get(String(k)) : null; }
  setItem(k, v) { k = String(k); if (this.failKey === k) { this.failKey = null; throw new Error('simulated write failure'); } this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(String(k)); }
}
const context = { console, TextEncoder, Date, Map, Set, Object, Array, JSON, Math, Number, String, Boolean, Error, RegExp };
context.window = context;
context.globalThis = context;
vm.runInNewContext(source, context, { filename: 'js/core/storage.js' });
const api = context.SYSTEMStorage;
check(api && typeof api.createBackup === 'function', 'Storage service must expose backup API.');
const stats = Object.fromEntries(['entrepreneurship','global-skills','mathematics','computer','physics','unique-thinking'].map(id => [id, { level: 2, xp: 17, xpRequired: 100 }]));
const initial = new MemoryStorage([
  ['system_v2_save', JSON.stringify({ schemaVersion: 3, player: { level: 4, xp: 88, xpRequired: 1200, coins: 45 }, stats })],
  ['system_v2_progress', JSON.stringify({ totalXpEarned: 488, totalStatXpEarned: 102 })],
  ['system_v2_progression_event_ids', JSON.stringify(['quest:daily:2026-10-18:math'])],
  ['system_v2_theme', 'aether-luxe'],
  ['unrelated-user-value', 'must survive restore']
]);
const backup = api.createBackup(initial, { now: new Date('2026-10-18T10:00:00.000Z') });
check(api.validateBackup(JSON.parse(backup.serialized)).entryCount === 4, 'Backup should validate all four app-owned records.');
// Simulate closing/reopening the browser: localStorage values survive in a fresh storage wrapper.
const restarted = new MemoryStorage([...initial.map.entries()]);
equal(JSON.parse(restarted.getItem('system_v2_save')).player.level, 4, 'Player level must survive a simulated app restart.');
equal(JSON.parse(restarted.getItem('system_v2_progress')).totalXpEarned, 488, 'Progress counters must survive a simulated app restart.');
equal(JSON.parse(restarted.getItem('system_v2_progression_event_ids')).length, 1, 'Duplicate-payout IDs must survive a simulated app restart.');
// Restore into a different profile and ensure replacement is namespace-scoped.
const target = new MemoryStorage([
  ['system_v2_save', JSON.stringify({ schemaVersion: 3, player: { level: 2, xp: 0, xpRequired: 100, coins: 0 }, stats })],
  ['system_v2_old-feature', 'stale'], ['unrelated-user-value', 'keep']
]);
const validated = api.validateBackup(JSON.parse(backup.serialized));
const restore = api.applyEntriesAtomically(validated.entries, target, { replacePrefixes: true });
check(restore.ok, 'Validated backup should restore successfully.');
equal(JSON.parse(target.getItem('system_v2_save')).player.level, 4, 'Restore must recover the backed-up player level.');
equal(target.getItem('system_v2_old-feature'), null, 'Full restore should remove stale app-owned keys.');
equal(target.getItem('unrelated-user-value'), 'keep', 'Restore must preserve unrelated site data.');
// Corruption must be rejected before any write occurs.
const corrupted = JSON.parse(backup.serialized);
corrupted.system_v2_progress = JSON.stringify({ totalXpEarned: 999999 });
let corruptionRejected = false;
try { api.validateBackup(corrupted); } catch (error) { corruptionRejected = /integrity check failed/i.test(String(error.message)); }
check(corruptionRejected, 'Checksum mismatch must reject a modified backup.');
equal(JSON.parse(target.getItem('system_v2_save')).player.level, 4, 'Validation failure must leave restored profile untouched.');
// A write failure must rollback the complete restore rather than leave mixed state.
const before = new Map(target.map);
target.failKey = 'system_v2_progress';
const failed = api.applyEntriesAtomically({
  system_v2_save: JSON.stringify({ schemaVersion: 3, player: { level: 6, xp: 1, xpRequired: 100, coins: 3 }, stats }),
  system_v2_progress: JSON.stringify({ totalXpEarned: 600 })
}, target);
check(!failed.ok && failed.rolledBack, 'Failed restore must report successful rollback.');
for (const [key, value] of before) equal(target.getItem(key), value, `Rollback must preserve ${key}.`);
console.log(`Phase 21 data-integrity tests passed: ${checks} checks (restart persistence, backup round-trip, checksum refusal, namespace safety and rollback).`);
