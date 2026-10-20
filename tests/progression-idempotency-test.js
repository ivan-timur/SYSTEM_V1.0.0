'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/core/progression-idempotency.js'), 'utf8');
class MemoryStorage {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); this.failWrites = false; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { if (this.failWrites) throw new Error('quota exceeded'); this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const window = {};
vm.runInNewContext(source, { window, console }, { filename: 'progression-idempotency.js' });
const api = window.SYSTEMProgressionIdempotency;
assert.ok(api, 'idempotency API must be exposed before the app controller loads');
let checks = 1;
function check(value, message) { assert.ok(value, message); checks++; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks++; }
const storage = new MemoryStorage();
const custom = api.createKey({ type: 'custom-quest', questId: 'custom-17' }, '2026-10-18');
equal(custom, 'v1|custom-quest|custom-17', 'Custom Quest IDs are stable and not tied to current time');
equal(api.inspect(storage, custom).status, 'new', 'An unclaimed reward ID should be available');
equal(api.commit(storage, custom).status, 'committed', 'A new ID should be durably recorded');
equal(api.inspect(storage, custom).status, 'duplicate', 'A replay must be rejected after commit');
equal(api.commit(storage, custom).status, 'duplicate', 'Commit must not write a repeated ID twice');

const dayOne = api.createKey({ type: 'daily-quest', questId: 'daily-math' }, '2026-10-18');
const dayTwo = api.createKey({ type: 'daily-quest', questId: 'daily-math' }, '2026-10-19');
check(dayOne !== dayTwo, 'Daily reward IDs must roll over at local date boundary');
const dailyStorage = new MemoryStorage();
equal(api.commit(dailyStorage, dayOne, '2026-10-18').status, 'committed', 'Daily IDs can be committed for their local date');
equal(api.inspect(dailyStorage, dayOne, '2026-10-18').status, 'duplicate', 'A Daily Quest cannot pay twice within the same date');
equal(api.inspect(dailyStorage, dayTwo, '2026-10-19').status, 'new', 'The next date remains eligible for its new Daily reward');
const oldDayKey = api.createKey({ type: 'ai-daily-quest', questId: 'old-ai-quest' }, '2025-01-01');
dailyStorage.setItem(api.storageKey, JSON.stringify([dayOne, oldDayKey]));
const compactedStatus = api.inspect(dailyStorage, 'v1|custom-quest|fresh-quest', '2026-10-18');
equal(compactedStatus.compacted, 1, 'Expired daily IDs can be compacted while permanent Quest IDs remain durable');
equal(api.createKey({ type: 'ai-daily-quest', questId: 'ai-quest-1' }, '2026-10-18'), 'v1|ai-daily-quest|ai-quest-1|2026-10-18', 'AI Daily IDs include quest and date');
const goalManual = api.createKey({ type: 'goal', goalId: 'goal-9' });
const goalEvidence = api.createKey({ type: 'goal-evidence-completion', goalId: 'goal-9', questId: 'quest-1' });
equal(goalManual, goalEvidence, 'Manual and evidence-based routes share one Goal payout identity');
equal(api.createKey({ type: 'activity', title: 'study' }), null, 'Unkeyed generic activities remain outside Quest idempotency guard');
assert.throws(() => api.createKey({ type: 'custom-quest' }), /Quest ID/, 'Quest-like rewards without a stable Quest ID must be rejected'); checks++;
assert.throws(() => api.createKey({ type: 'daily-quest', questId: 'q1' }, '2026-02-30'), /real calendar date/, 'Impossible daily reward dates must be rejected'); checks++;

const malformed = new MemoryStorage({ [api.storageKey]: '{bad json' });
equal(api.inspect(malformed, 'v1|custom-quest|x').status, 'invalid', 'Corrupt ledger fails closed');
const duplicateRaw = new MemoryStorage({ [api.storageKey]: JSON.stringify(['same', 'same']) });
equal(api.inspect(duplicateRaw, 'new-id').status, 'invalid', 'Duplicate IDs inside imported ledger fail closed');
const full = new MemoryStorage({ [api.storageKey]: JSON.stringify(Array.from({ length: api.maxEntries }, (_, i) => `id-${i}`)) });
equal(api.inspect(full, 'another-id').status, 'full', 'Full ledger rejects new rewards instead of evicting replay guards');
equal(api.inspect(full, 'id-1').status, 'duplicate', 'Existing IDs remain recognizable when the ledger is at capacity');
const quota = new MemoryStorage(); quota.failWrites = true;
equal(api.commit(quota, 'v1|custom-quest|quota').status, 'invalid', 'Storage-write failure must be surfaced to transaction caller');
console.log(`Progression idempotency tests passed: ${checks} checks (stable keys, daily rollover, goal identity, replay rejection, corrupt/full ledger safety).`);
