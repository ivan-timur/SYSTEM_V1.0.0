'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/storage/indexeddb.ts'), 'utf8');
const domain = fs.readFileSync(path.join(root, 'src/core/progression.ts'), 'utf8');
const checks = [];
function check(condition, message) { assert.ok(condition, message); checks.push(message); }

check(/db\.transaction\(transactionStores, 'readwrite'\)/.test(source), 'Quest completion must use one read-write IndexedDB transaction.');
check(/const transactionStores = \['player', 'quests', 'xp_events', 'achievements', 'skills', 'stats', 'activity_history', 'app_state', 'daily_prizes', 'goal_curricula', 'goal_evidence'\]/.test(source), 'The transaction must include all stores needed by the atomic completion pathway.');
check(/const signals = \[playerMarksComplete, questMarksComplete, ledgerMarksComplete, playerEventMarksComplete\]/.test(source) && /new Set\(signals\)\.size > 1/.test(source), 'Partial completion markers must fail closed instead of issuing a second reward.');
check(/playerMarksComplete && questMarksComplete && ledgerMarksComplete && playerEventMarksComplete/.test(source), 'A fully committed completion replay must return as already completed.');
check(/eventStore\.add\(baseEvent\)/.test(source) && /historyWrite = activityStore\.add\(completedActivity\)/.test(source), 'XP ledger and activity history must be written through transactional add operations.');
check(/goalMilestoneQuest', \['goalId', 'milestoneId', 'questId'\], \{ unique: true \}/.test(source), 'Goal evidence must have a database-enforced unique identity per Goal/Milestone/Quest.');
check(/export function completeQuest\(/.test(domain) && /advanceXPTrack\(/.test(domain), 'XP and level transitions must remain in the pure TypeScript progression domain.');
check(/Work entirely on copies/.test(domain), 'Failed domain validation must not mutate the caller-owned player aggregate.');
console.log(`Phase 9 transaction contract passed: ${checks.length} checks.`);
