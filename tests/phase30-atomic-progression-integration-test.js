#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const failures = [];
const check = (condition, message) => { try { assert.ok(condition, message); } catch (error) { failures.push(error.message); } };

const progression = read('src/core/progression.ts');
const reward = read('src/core/reward-command.ts');
const storage = read('src/storage/indexeddb.ts');
const dailyCommand = read('src/features/daily-quest-command.ts');
const legacyController = read('js/legacy/app-controller.js');
const durableBridge = read('js/modules/durable-storage-gate.js');
const app = read('js/app.js');
const pkg = JSON.parse(read('package.json'));
const changelog = read('CHANGELOG.md');

// Domain ownership and validation boundaries.
check(/export function completeQuest\(/.test(progression), 'Domain core must own canonical Quest completion.');
check(/export function advanceXPTrack\(/.test(progression), 'Domain core must own XP-track arithmetic.');
check(/export function prepareProgressionReward\(/.test(reward), 'Reward inputs must be normalized at the typed boundary.');
check(/getCanonicalDomainQuestId/.test(reward) && /getProgressionRewardIdentity/.test(reward), 'Quest and payout identity must use canonical helpers.');
check(/completeQuestInDatabase\(/.test(dailyCommand), 'Daily Quest command must call the durable transaction boundary.');

// Durable transaction must commit the related state in one IndexedDB readwrite transaction.
check(/transactionStores = \['player', 'quests', 'xp_events', 'achievements', 'skills', 'stats', 'activity_history', 'app_state', 'daily_prizes', 'goal_curricula', 'goal_evidence'\]/.test(storage), 'Durable progression transaction must include all coupled stores.');
for (const token of ['playerStore.put(persistedPlayer)', 'questStore.put(persistedQuest)', 'eventStore.add(baseEvent)', 'skillStore.put(skill)', 'statStore.put(updatedStat)', 'activityStore.add(completedActivity)']) {
  check(storage.includes(token), `Durable transaction must include ${token}.`);
}
check(/tx\.abort\(\)/.test(storage), 'Failure path must abort the IndexedDB transaction.');
check(/tx\.oncomplete/.test(storage), 'Durable completion must settle on transaction completion.');
check(/tx\.onabort/.test(storage), 'Durable completion must handle transaction abort.');
check(/eventStore\.get\(dailyPrizeInput\.id\)/.test(storage), 'Daily prize must check canonical XP-ledger identity.');

// Legacy live UI is deliberately not cut over yet; guard against accidental data-loss migrations.
check(/localStorage\.getItem\(SYSTEM_SAVE_KEY\)/.test(legacyController), 'Legacy live save read path must remain available until approved cutover.');
check(/localStorage\.setItem\(\s*SYSTEM_SAVE_KEY/.test(legacyController), 'Legacy live save write path must remain available until approved cutover.');
check(/legacyStorageRemainsAuthoritative:\s*true/.test(app), 'Live UI must declare legacy storage authority before cutover.');
check(/automaticMigration:\s*false/.test(app), 'Automatic migration must remain disabled.');
check(/dualWrite:\s*false/.test(app), 'Uncontrolled dual-write must remain disabled.');
check(/localStorage remains authoritative until the app performs an explicit cutover/i.test(storage), 'Durable storage must remain gated behind an explicit cutover.');

check(pkg.scripts['test:static'].includes('phase30-atomic-progression-integration-test.js'), 'Phase 30 test must run in test:static.');
check(changelog.includes('Phase 30 Atomic Progression Integration Audit'), 'Phase 30 must be documented in CHANGELOG.');

if (failures.length) {
  console.error(`Phase 30 atomic progression integration audit: FAIL (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Phase 30 atomic progression integration audit: PASS');
console.log('Verified typed domain ownership, durable transaction store boundary, coupled writes, failure handling and legacy cutover safety.');
console.log('This is a source-contract audit; it does not claim real-browser IndexedDB or Android device validation.');
