import assert from 'node:assert/strict';
import { createLegacyMigrationPlan, previewLegacyLocalStorageMigration, createLegacyMigrationApproval, validateLegacyMigrationApproval, LEGACY_SOURCE_KEYS } from '../../dist/ts/storage/legacy-migration.js';

const now = new Date('2026-10-18T10:15:00.000Z');
const values = new Map([
  [LEGACY_SOURCE_KEYS.save, JSON.stringify({
    schemaVersion: 3,
    player: { level: 4, xp: 42, xpRequired: 500, coins: 123, rank: 'C' },
    stats: {
      mathematics: { name: 'Mathematics', level: 3, xp: 25, xpRequired: 150 },
      computer: { name: 'Computer', level: 2, xp: 10, xpRequired: 125 },
    },
    skillProgress: {
      'math-algebra-i': { level: 2, xp: 17, xpRequired: 100, totalXp: 117, lastActivityAt: '2026-10-17T10:00:00.000Z' },
    },
  })],
  [LEGACY_SOURCE_KEYS.dailyDate, '2026-10-18'],
  [LEGACY_SOURCE_KEYS.dailyCompleted, JSON.stringify({ study: true, coding: false })],
  [LEGACY_SOURCE_KEYS.aiDaily, JSON.stringify({ date: '2026-10-18', items: [
    { id: 'ai-english-1', title: 'Recall English words', xp: 30, coins: 4, stat: 'global-skills', skillId: 'english-vocabulary' },
  ] })],
  [LEGACY_SOURCE_KEYS.customQuests, JSON.stringify([
    { id: 'custom-1', title: 'Build a small tool', xp: 40, coins: 8, stat: 'computer', skillId: 'python-basics', goalId: 'goal-2', completed: true },
    { id: 'custom-2', title: 'Read a chapter', xp: 25, coins: 3, stat: 'computer', goalId: 'goal-2', completed: false },
  ])],
  [LEGACY_SOURCE_KEYS.goals, JSON.stringify([
    { id: 'goal-1', title: 'Finish portfolio', status: 'completed', stat: 'computer' },
    { id: 'goal-2', title: 'Learn functions', status: 'active', stat: 'computer', targetCount: 2, evidence: [
      { questId: 'custom-1', title: 'Build a small tool', at: '2026-10-17T18:00:00.000Z', stat: 'computer', skillId: 'python-basics', xp: 40 },
    ] },
  ])],
  [LEGACY_SOURCE_KEYS.bossCompleted, JSON.stringify(['boss-awakening'])],
  [LEGACY_SOURCE_KEYS.history, JSON.stringify([
    { at: '2026-10-18T09:00:00.000Z', type: 'daily-quest', title: 'Mathematics Practice', questId: 'study', stat: 'mathematics', skillId: 'math-algebra-i', xp: 135, coins: 20, eventId: 'v1|daily-quest|study|2026-10-18' },
    { at: '2026-10-17T18:00:00.000Z', type: 'custom-quest', title: 'Build a small tool', questId: 'custom-1', stat: 'computer', skillId: 'python-basics', xp: 40, coins: 8, eventId: 'v1|custom-quest|custom-1' },
    { at: '2026-10-17T19:00:00.000Z', type: 'goal', title: 'Finish portfolio', goalId: 'goal-1', questId: 'goal-1', xp: 50, coins: 10 },
  ])],
  [LEGACY_SOURCE_KEYS.progress, JSON.stringify({ totalXpEarned: 800, totalDailyQuestsCompleted: 7, totalBossQuestsCompleted: 1, totalCustomQuestsCompleted: 3 })],
  [LEGACY_SOURCE_KEYS.questStreak, JSON.stringify({ last: '2026-10-17', streak: 4 })],
]);
const reads = [];
const storage = {
  getItem(key) { reads.push(key); return values.has(key) ? values.get(key) : null; },
};

const plan = createLegacyMigrationPlan(storage, now);
assert.equal(plan.player.level, 4);
assert.equal(plan.player.xp, 42);
assert.equal(plan.player.coins, 123);
assert.equal(plan.player.rank, 'C');
assert.equal(plan.player.skills['math-algebra-i'].xp, 17);
assert.equal(plan.stats.find(stat => stat.statId === 'mathematics').level, 3);
assert.equal(plan.stats.length, 6, 'all six Stats must be represented, including older saves with missing Stat rows');
assert.equal(plan.summary.questCount, 6 + 1 + 2 + 2 + 3, 'built-in Daily, AI Daily, Custom, Goal and Boss catalogs are imported');
assert.equal(plan.summary.completedQuestCount, 4, 'only the explicitly completed daily/custom/goal/boss records are marked completed');
assert.equal(plan.xpEvents.length, plan.summary.completedQuestCount);

const dailyStudy = plan.quests.find(quest => quest.id === 'daily-quest:study:2026-10-18');
assert.equal(dailyStudy.status, 'completed');
assert.equal(dailyStudy.xpReward, 135, 'the actual XP from history must be preserved, including a Daily streak bonus');
assert.equal(dailyStudy.skillId, 'math-algebra-i');
const aiDaily = plan.quests.find(quest => quest.id === 'ai-daily-quest:ai-english-1:2026-10-18');
assert.ok(aiDaily, 'AI Daily Quest import uses the runtime canonical ID');
const custom = plan.quests.find(quest => quest.id === 'custom-quest:custom-1');
assert.equal(custom.status, 'completed');
assert.equal(custom.xpReward, 40);
const goal = plan.quests.find(quest => quest.id === 'goal:goal-1');
assert.equal(goal.status, 'completed');
assert.equal(goal.xpReward, 50);
const boss = plan.quests.find(quest => quest.id === 'boss-quest:boss-awakening');
assert.equal(boss.status, 'completed');
assert.ok(plan.player.completedQuestIds.includes(boss.id), 'claimed Boss Quest must not be made payable again');
assert.equal(plan.goalCurricula.length, 2, 'legacy Goals are projected into typed curriculum records');
assert.equal(plan.goalEvidence.length, 1, 'legacy Goal evidence is copied into the append-only evidence ledger');
const durableGoal = plan.goalCurricula.find(item => item.id === 'goal-2');
assert.equal(durableGoal.milestones.length, 2, 'legacy Goal target becomes a sequential milestone path');
assert.equal(durableGoal.evidence[0].questId, 'custom-quest:custom-1', 'historical evidence uses the canonical durable Quest ID');
assert.equal(durableGoal.evidence[0].skillVerification, null, 'legacy completion is never upgraded to verified Skill mastery');
assert.equal(plan.goalEvidence[0].id, durableGoal.evidence[0].id, 'Goal snapshot and append-only ledger share the same evidence identity');
assert.equal(plan.quests.find(quest => quest.id === 'custom-quest:custom-1').milestoneId, durableGoal.evidence[0].milestoneId,
  'completed linked Quest is attached to the milestone proved by its historical evidence');
assert.equal(plan.quests.find(quest => quest.id === 'custom-quest:custom-2').milestoneId, durableGoal.milestones[1].id,
  'an active linked Quest is bound to the next unoccupied milestone');
assert.equal(plan.xpEvents.every(event => event.id === `quest:${event.questId}`), true);
assert.equal(plan.xpEvents.every(event => plan.quests.find(quest => quest.id === event.questId)?.xpReward === event.amount), true,
  'the persisted completed Quest reward must match its imported XP event for replay consistency');
assert.equal(plan.activities.length, 3);
assert.equal(plan.progressCounters.totalDailyQuestsCompleted, 7);
assert.equal(plan.dailyQuestStreak.lastDate, '2026-10-17', 'migration preserves the previous local streak date');
assert.equal(plan.dailyQuestStreak.streak, 4, 'migration preserves the active streak count');
assert.equal(plan.dailyQuestStreak.bestStreak, 4, 'migration initializes the best streak from the available historical streak data');
assert.equal(plan.warnings.length > 0, true, 'completed records without matching historical events should be visibly flagged');

const preview = previewLegacyLocalStorageMigration(storage, now);
assert.equal(preview.destructive, false);
assert.equal(preview.destination, 'system-progress (IndexedDB)');
assert.deepEqual(preview.summary, plan.summary);
assert.equal(values.get(LEGACY_SOURCE_KEYS.save).includes('"coins":123'), true, 'preview must not modify legacy save JSON');
assert.equal(reads.length, Object.values(LEGACY_SOURCE_KEYS).length * 2, 'preview and plan only read selected legacy keys');
assert.throws(() => createLegacyMigrationApproval(preview, { confirmed: false }, now), /explicit user confirmation/,
  'a migration must not proceed without explicit approval');
assert.throws(() => createLegacyMigrationApproval(preview, { confirmed: true }, now), /acknowledge them/,
  'when a preview has warnings, acknowledgement is required');
const approval = createLegacyMigrationApproval(preview, { confirmed: true, warningsAcknowledged: true }, now);
const approvedPlan = validateLegacyMigrationApproval(storage, approval, now);
assert.equal(approvedPlan.sourceFingerprint, preview.sourceFingerprint, 'approval is bound to the reviewed source fingerprint');
assert.deepEqual(approvedPlan.summary, preview.summary, 'approved plan matches the preview summary');
const changedValues = new Map(values);
changedValues.set(LEGACY_SOURCE_KEYS.save, JSON.stringify({ player: { level: 4, xp: 42, coins: 124, rank: 'C' } }));
assert.throws(() => validateLegacyMigrationApproval({ getItem: key => changedValues.has(key) ? changedValues.get(key) : null }, approval, now), /stale because legacy localStorage changed/,
  'changed localStorage must invalidate the prior preview');
assert.throws(() => validateLegacyMigrationApproval(storage, approval, new Date('2026-10-19T00:01:00.000Z')), /preview date has changed/,
  'date rollover must invalidate a prior approval');

// Unresolvable or still-open legacy Quest references must not become durable
// Goal evidence or consume the first milestone slot ahead of valid proof.
const evidenceIntegrityValues = new Map([
  [LEGACY_SOURCE_KEYS.save, JSON.stringify({ player: { level: 1, xp: 0, coins: 0, rank: 'E' } })],
  [LEGACY_SOURCE_KEYS.customQuests, JSON.stringify([
    { id: 'evidence-open', title: 'Not finished yet', xp: 10, coins: 1, stat: 'computer', goalId: 'evidence-goal', completed: false },
    { id: 'evidence-valid', title: 'Finished work', xp: 10, coins: 1, stat: 'computer', goalId: 'evidence-goal', completed: true },
  ])],
  [LEGACY_SOURCE_KEYS.goals, JSON.stringify([{ id: 'evidence-goal', title: 'Evidence integrity', status: 'active', stat: 'computer', targetCount: 2, evidence: [
    { questId: 'missing-quest', title: 'Missing quest proof', at: now.toISOString(), stat: 'computer' },
    { questId: 'evidence-open', title: 'Unfinished quest proof', at: now.toISOString(), stat: 'computer' },
    { questId: 'evidence-valid', title: 'Finished work', at: now.toISOString(), stat: 'computer' },
  ] }])],
  [LEGACY_SOURCE_KEYS.dailyDate, '2026-10-18'],
]);
const evidenceIntegrityPlan = createLegacyMigrationPlan({ getItem: key => evidenceIntegrityValues.get(key) ?? null }, now);
const integrityGoal = evidenceIntegrityPlan.goalCurricula.find(item => item.id === 'evidence-goal');
assert.equal(evidenceIntegrityPlan.goalEvidence.length, 1, 'missing and unfinished linked Quests cannot be imported as evidence');
assert.equal(integrityGoal.evidence[0].questId, 'custom-quest:evidence-valid', 'the valid completed Quest evidence is preserved despite earlier invalid legacy entries');
assert.equal(integrityGoal.evidence[0].milestoneId, integrityGoal.milestones[0].id, 'the first accepted evidence occupies the first available milestone');
assert.equal(integrityGoal.completed, false, 'rejected historical records cannot falsely complete an active Goal');
assert.equal(evidenceIntegrityPlan.quests.find(item => item.id === 'custom-quest:evidence-open').milestoneId, integrityGoal.milestones[1].id,
  'an active linked Quest receives the next available milestone after invalid evidence is rejected');

const broken = { getItem(key) { return key === LEGACY_SOURCE_KEYS.save ? '{bad-json' : null; } };
assert.throws(() => createLegacyMigrationPlan(broken, now), /invalid JSON/);
const missingSave = { getItem() { return null; } };
assert.throws(() => createLegacyMigrationPlan(missingSave, now), /No valid system_v2_save/);
const malformedQuestList = { getItem(key) {
  if (key === LEGACY_SOURCE_KEYS.save) return JSON.stringify({ player: { level: 1, xp: 0, coins: 0, rank: 'E' } });
  if (key === LEGACY_SOURCE_KEYS.customQuests) return '{}';
  if (key === LEGACY_SOURCE_KEYS.dailyDate) return '2026-10-18';
  return null;
} };
assert.throws(() => createLegacyMigrationPlan(malformedQuestList, now), /Custom Quest list is not an array/);
console.log('Legacy migration planner tests passed: read-only preview, all five Quest types, six Stats, Skill progress, namespacing, Daily streak preservation, completion consistency, history/counters and fail-closed validation.');
