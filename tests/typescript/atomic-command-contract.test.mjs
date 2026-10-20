import assert from 'node:assert/strict';
import fs from 'node:fs';
const storage = fs.readFileSync(new URL('../../src/storage/indexeddb.ts', import.meta.url), 'utf8');
const progression = fs.readFileSync(new URL('../../src/core/progression.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../src/storage/legacy-migration.ts', import.meta.url), 'utf8');
const dailyCommand = fs.readFileSync(new URL('../../src/features/daily-quest-command.ts', import.meta.url), 'utf8');
const rewardCommand = fs.readFileSync(new URL('../../src/core/reward-command.ts', import.meta.url), 'utf8');
assert.match(storage, /SYSTEM_DB_VERSION = 7/);
assert.match(storage, /transactionStores = \['player', 'quests', 'xp_events', 'achievements', 'skills', 'stats', 'activity_history', 'app_state', 'daily_prizes', 'goal_curricula', 'goal_evidence'\]/);
for (const token of ['curriculumGoalStore.put', 'curriculumEvidenceStore.add', 'recordCurriculumEvidence(', 'goalMilestoneQuest', 'statStore.put(updatedStat)', 'activityStore.add(completedActivity)', 'appStateStore.put(', 'dailyPrizeStore.add(prizeRecord)', 'eventStore.add(prizeEvent)', 'advanceXPTrack(', 'calculateDailyQuestStreak(', 'awardedXP: effectiveQuestXP']) {
  assert.ok(storage.includes(token), `Atomic transaction must include ${token}`);
}
assert.match(storage, /eventStore\.get\(dailyPrizeInput\.id\)/, 'all daily prize types must check the canonical XP ledger identity');
assert.match(storage, /activityStore\.index\('eventId'\)\.get\(activityEventId\)/);
assert.match(storage, /Daily prize has already been claimed/);
assert.match(storage, /requiredQuestIds/);
assert.match(storage, /Daily prize gate consistency conflict/);
assert.match(storage, /Daily prize gate XP ledger conflict/);
assert.match(storage, /appStateStore\.put\(nextDailyQuestStreak\)/, 'streak state must commit with the Quest reward');
assert.match(storage, /ledgerEvent\.amount !== \(quest\.awardedXP \?\? quest\.xpReward\)/, 'replay verification must compare against the immutable awarded XP snapshot');
assert.match(rewardCommand, /export function getCanonicalDomainQuestId/);
assert.match(rewardCommand, /export function getLegacyDomainQuestIdAliases/);
for (const type of ['daily-quest', 'ai-daily-quest', 'custom-quest', 'boss-quest']) {
  assert.ok(migration.includes(`getCanonicalDomainQuestId('${type}'`), `Legacy migration must use the canonical ${type} ID contract`);
}
assert.match(dailyCommand, /completeQuestInDatabase/);
assert.match(dailyCommand, /findPersistedQuestByCandidates/);
assert.match(dailyCommand, /Legacy Daily Quest alias has no matching migration provenance/);
assert.doesNotMatch(dailyCommand, /window\.|document\.|localStorage/, 'Daily Quest application logic must remain DOM/storage-adapter independent');
assert.match(storage, /progressCounterDeltas/);
assert.match(progression, /export function advanceXPTrack/);
assert.match(progression, /skillRewards\?: SkillReward\[\]/);
assert.match(migration, /id: 'progress-counters'/);
assert.match(migration, /LEGACY_SOURCE_KEYS\.questStreak/);
assert.match(dailyCommand, /dailyQuestStreak: \{ date: input\.localDateStamp, sourceQuestId: input\.sourceQuestId \}/);
console.log('Atomic progression command contract passed: schema v7, atomic Quest/Goal curriculum/evidence/XP/Skill/Stat/Achievement/History/Counters/Daily Prize transaction surface and fail-closed identities.');
