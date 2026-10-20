#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));
const browserTest = read('tests/browser/indexeddb-transaction-test.js');
const runner = read('tests/run-indexeddb-browser-test.js');
const idb = read('src/storage/indexeddb.ts');
const migration = read('src/storage/legacy-migration.ts');
const health = read('src/storage/database-health.ts');
const gate = read('js/modules/durable-storage-gate.js');

assert.match(browserTest, /Phase 15: verify a committed record survives closing and reopening/,
  'real-browser suite must check durability after closing and reopening IndexedDB');
for (const field of ['xp', 'level', 'rank', 'completedQuestIds']) {
  assert.match(browserTest, new RegExp(`durability probe preserves .*${field === 'completedQuestIds' ? 'Quest identity' : field === 'xp' ? 'XP value' : field === 'level' ? 'Level value' : 'Rank value'}`, 'i'),
    `browser durability suite must preserve ${field}`);
}
assert.match(browserTest, /transactionDone\(tx\)/, 'browser suite must wait for transaction commit before asserting persistence');
assert.match(browserTest, /durabilityReader\.close\(\)/, 'browser suite must close its read connection');
assert.match(runner, /indexeddb-transaction-test\.html/, 'durability check must run in the real-browser IndexedDB page');
assert.match(pkg.scripts['test:browser-idb'], /run-indexeddb-browser-test\.js/, 'documented browser test command must invoke the browser runner');
assert.match(migration, /confirmed/, 'migration remains explicit');
assert.match(migration, /warningsAcknowledged/, 'migration requires warning acknowledgement');
assert.match(migration, /refuses to overwrite a non-empty target database/i, 'migration must fail closed on conflicting target data');
assert.match(idb, /db\.onversionchange = \(\) => db\.close\(\)/, 'database connections must close to permit safe schema upgrades');
assert.match(health, /readOnly: true/, 'health diagnostics remain read-only');
assert.match(gate, /requestPersistentStorage/, 'persistent storage remains an explicit capability request');
assert.doesNotMatch(gate, /localStorage\.clear\(|indexedDB\.deleteDatabase\(/, 'storage capability checks may not erase data');
assert.match(pkg.scripts['test:static'], /phase15-storage-durability-test\.js/, 'Phase 15 contract test must be in static suite');
console.log('Phase 15 storage durability contract passed: real-browser close/reopen probe, transaction commit boundary, explicit migration, read-only diagnostics, and non-destructive storage gate.');
