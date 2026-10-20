#!/usr/bin/env node
'use strict';
// Phase 41: strengthen source-level guarantees around atomic progression commands.
// This is a contract audit, not a substitute for executing IndexedDB in a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const failures = [];
const check = (condition, message) => { try { assert.ok(condition, message); } catch (error) { failures.push(error.message); } };

const storage = read('src/storage/indexeddb.ts');
const daily = read('src/features/daily-quest-command.ts');
const quest = read('src/features/quest-command.ts');
const reward = read('src/core/reward-command.ts');
const legacy = read('js/legacy/app-controller.js');
const app = read('js/app.js');
const pkg = JSON.parse(read('package.json'));
const changelog = read('CHANGELOG.md');

// One transaction owns all coupled progression records and settles on commit.
check(/const transactionStores = \['player', 'quests', 'xp_events', 'achievements', 'skills', 'stats', 'activity_history', 'app_state', 'daily_prizes', 'goal_curricula', 'goal_evidence'\]/.test(storage), 'All coupled progression stores must share one readwrite transaction.');
check(/db\.transaction\(transactionStores,\s*'readwrite'\)/.test(storage), 'Progression transaction must use readwrite mode.');
check(/tx\.oncomplete/.test(storage) && /tx\.onabort/.test(storage), 'Command result must distinguish commit from abort.');
check(/const fail = \(value: unknown\)/.test(storage) && /tx\.abort\(\)/.test(storage), 'Write/request failures must abort the transaction.');

// Duplicate and inconsistent completion states must fail closed; replay must not pay twice.
check(/const signals = \[playerMarksComplete, questMarksComplete, ledgerMarksComplete, playerEventMarksComplete\]/.test(storage), 'Duplicate detection must compare all persisted completion signals.');
check(/Progression consistency conflict/.test(storage), 'Conflicting persisted completion signals must stop reward application.');
check(/if \(playerMarksComplete && questMarksComplete && ledgerMarksComplete && playerEventMarksComplete\)/.test(storage), 'A fully recorded completion must take the idempotent replay path.');
check(/ledgerEvent\.amount !== \(quest\.awardedXP \?\? quest\.xpReward\)/.test(storage), 'Replay must validate against immutable awarded XP, not only catalog base XP.');
check(/activityStore\.index\('eventId'\)\.get\(activityEventId\)/.test(storage), 'Activity identity must be checked before append.');
check(/eventStore\.get\(dailyPrizeInput\.id\)/.test(storage), 'Daily prize claim must verify its canonical ledger identity.');

// Caller/UI must not become the authority for reward values or storage cutover.
check((/The saved Quest record is authoritative for/.test(daily) && /caller-supplied reward numbers are never used/.test(daily)), 'Daily Quest command must document persisted reward authority.');
check(/quest\.xpReward/.test(daily) && /quest\.coinReward/.test(daily), 'Daily command must derive reward metadata from the persisted Quest.');
check(/getProgressionRewardIdentity/.test(daily) && /getCanonicalDomainQuestId/.test(reward), 'Reward identity must use canonical helpers.');
check(/localStorage remains authoritative until the app performs an explicit cutover/i.test(storage), 'Legacy storage authority must remain explicit until approved cutover.');
check(/automaticMigration:\s*false/.test(app) && /dualWrite:\s*false/.test(app), 'Automatic migration and uncontrolled dual-write must remain disabled.');
check(/localStorage\.setItem\(\s*SYSTEM_SAVE_KEY/.test(legacy), 'Existing live save writer must remain intact during staged migration.');

check(pkg.scripts['test:static'].includes('phase41-atomic-progression-hardening-test.js'), 'Phase 41 audit must run in the static suite.');
check(changelog.includes('Phase 41 — Atomic Progression Hardening'), 'Phase 41 must be documented in CHANGELOG.');

if (failures.length) {
  console.error(`Phase 41 atomic progression hardening: FAIL (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Phase 41 atomic progression hardening: PASS');
console.log('Verified transaction boundary, abort/commit handling, duplicate replay, immutable awarded-XP checks, activity/prize identities, reward authority and staged storage safety.');
console.log('Scope: source-contract audit only; real-browser IndexedDB and Android validation remain separate gates.');
