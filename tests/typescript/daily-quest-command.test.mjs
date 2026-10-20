import assert from 'node:assert/strict';
import {
  completeDailyQuestCommand,
  getDailyQuestIdCandidates,
} from '../../dist/ts/features/daily-quest-command.js';
import { getCanonicalDomainQuestId } from '../../dist/ts/core/reward-command.js';
import { SYSTEM_CORE_DAILY_QUESTS } from '../../dist/ts/data/quest-catalog.js';

const date = '2026-10-18';
const now = '2026-10-18T12:00:00.000Z';
const rules = {
  xpForNextLevel: level => 100 + (level - 1) * 25,
  xpForNextStatLevel: level => 100 + (level - 1) * 25,
  xpForNextSkillLevel: level => 100 + (level - 1) * 25,
  rankForLevel: level => level >= 20 ? 'A' : level >= 10 ? 'B' : level >= 5 ? 'C' : level >= 2 ? 'D' : 'E',
};
let checks = 0;
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks += 1; }
function ok(value, message) { assert.ok(value, message); checks += 1; }
function quest(id, extras = {}) {
  return { id, title: 'Stored Mathematics Practice', status: 'available', xpReward: 100, coinReward: 20, skillId: 'math-algebra-i', statId: 'mathematics', ...extras };
}
function makePort(records) {
  const byId = new Map(records.map(item => [item.id, item]));
  const calls = [];
  return {
    calls,
    async findQuest(ids) { for (const id of ids) if (byId.has(id)) return byId.get(id); return undefined; },
    async complete(id, passedRules, passedNow, effects) {
      calls.push({ id, passedRules, passedNow, effects });
      return { player: {}, quest: byId.get(id), achievements: [], alreadyCompleted: false, leveledUp: [], newlyUnlockedAchievements: [], progressCounters: {} };
    },
  };
}

const canonical = 'daily-quest:study:2026-10-18';
const candidates = getDailyQuestIdCandidates('daily-quest', 'study', date);
equal(candidates[0], canonical, 'the canonical Daily Quest ID matches the central reward contract');
equal(candidates[1], 'daily:2026-10-18:study', 'the old migration ID remains a read-only compatibility alias');
equal(getCanonicalDomainQuestId('ai-daily-quest', 'ai-english-1', date), 'ai-daily-quest:ai-english-1:2026-10-18', 'AI Daily Quest shares the central persisted identity convention');

// Canonical route: the persisted Quest remains authoritative for the reward.
const canonicalPort = makePort([quest(canonical, { xpReward: 135, coinReward: 22, statId: 'mathematics' })]);
await completeDailyQuestCommand({ type: 'daily-quest', sourceQuestId: 'study', localDateStamp: date, statId: 'mathematics', now }, rules, canonicalPort);
equal(canonicalPort.calls.length, 1, 'one canonical Daily Quest command reaches the transaction port');
equal(canonicalPort.calls[0].id, canonical, 'the transaction receives the persisted canonical Quest ID');
equal(canonicalPort.calls[0].effects.statAward.xpAmount, 135, 'Stat XP uses the persisted Quest XP, not any caller-supplied reward');
equal(canonicalPort.calls[0].effects.activity.eventId, 'v1|daily-quest|study|2026-10-18', 'activity history uses the canonical idempotency identity');
equal(canonicalPort.calls[0].effects.progressCounterDeltas.totalDailyQuestsCompleted, 1, 'Daily Quest increments its canonical category counter');
equal(canonicalPort.calls[0].effects.dailyQuestStreak.date, date, 'core Daily Quest sends a date-scoped streak command to the transaction');
equal(canonicalPort.calls[0].effects.dailyQuestStreak.sourceQuestId, 'study', 'streak source comes from the canonical core catalogue');
equal(canonicalPort.calls[0].effects.activity.skillId, 'math-algebra-i', 'Skill metadata comes from the persisted Quest');

// Old persisted IDs are accepted only when migration provenance proves the alias.
const alias = 'daily:2026-10-18:study';
const legacyPort = makePort([quest(alias, { legacySourceType: 'daily-quest', legacySourceId: 'study', statId: 'mathematics' })]);
await completeDailyQuestCommand({ type: 'daily-quest', sourceQuestId: 'study', localDateStamp: date, statId: 'mathematics', now }, rules, legacyPort);
equal(legacyPort.calls[0].id, alias, 'older migrated saves complete through their recorded Quest key without rewriting data');
const unsafeAliasPort = makePort([quest(alias)]);
await assert.rejects(() => completeDailyQuestCommand({ type: 'daily-quest', sourceQuestId: 'study', localDateStamp: date, now }, rules, unsafeAliasPort), /provenance/); checks += 1;

// AI Daily Quest is a separate namespace and counter.
const aiId = 'ai-daily-quest:ai-english-1:2026-10-18';
const aiPort = makePort([quest(aiId, { title: 'Recall English words', statId: 'global-skills', skillId: 'english-vocabulary' })]);
await completeDailyQuestCommand({ type: 'ai-daily-quest', sourceQuestId: 'ai-english-1', localDateStamp: date, statId: 'global-skills', now }, rules, aiPort);
equal(aiPort.calls[0].effects.progressCounterDeltas.totalAIDailyQuestsCompleted, 1, 'AI Daily Quest uses its own category counter');
equal(aiPort.calls[0].effects.activity.type, 'ai-daily-quest', 'AI completion history remains distinguishable');
equal(aiPort.calls[0].effects.dailyQuestStreak, undefined, 'AI Daily Quest cannot alter the core Daily Quest streak');

// The Daily Prize request resolves all six current-date core tasks and carries
// the full gate into the same atomic persistence command.
const dailyRecords = SYSTEM_CORE_DAILY_QUESTS.map(item => {
  const id = getCanonicalDomainQuestId('daily-quest', item.id, date);
  return quest(id, {
    title: item.title,
    status: item.id === 'study' ? 'available' : 'completed',
    xpReward: item.xp,
    coinReward: item.coins,
    statId: item.stat ?? undefined,
    legacySourceType: 'daily-quest',
    legacySourceId: item.id,
  });
});
const prizePort = makePort(dailyRecords);
await completeDailyQuestCommand({
  type: 'daily-quest', sourceQuestId: 'study', localDateStamp: date, statId: 'mathematics', now,
  dailyPrize: { type: 'xp-coins', title: 'Daily surprise', xpReward: 15, coinReward: 4 },
}, rules, prizePort);
const prizeEffects = prizePort.calls[0].effects.dailyPrize;
equal(prizeEffects.id, 'daily-prize:2026-10-18', 'daily prize uses a stable date-scoped identity');
equal(prizeEffects.requiredQuestIds.length, 6, 'daily prize carries all six core Quest IDs into the transaction');
ok(prizeEffects.requiredQuestIds.includes(canonical), 'the final Daily Quest must be part of the six-Quest gate');

const missingGateRecords = dailyRecords.filter(item => item.id !== 'daily-quest:planning:2026-10-18');
const missingGatePort = makePort(missingGateRecords);
await assert.rejects(() => completeDailyQuestCommand({
  type: 'daily-quest', sourceQuestId: 'study', localDateStamp: date, statId: 'mathematics', now,
  dailyPrize: { type: 'xp-coins', title: 'Daily surprise', xpReward: 15, coinReward: 4 },
}, rules, missingGatePort), /missing core Quest planning/); checks += 1;
equal(missingGatePort.calls.length, 0, 'a missing core Quest prevents the transaction from being called');

await assert.rejects(() => completeDailyQuestCommand({ type: 'daily-quest', sourceQuestId: 'study', localDateStamp: '2026-02-30', now }, rules, canonicalPort), /valid local date/); checks += 1;
await assert.rejects(() => completeDailyQuestCommand({ type: 'daily-quest', sourceQuestId: 'study', localDateStamp: date, statId: 'not-a-stat', now }, rules, canonicalPort), /Unknown Daily Quest Stat/); checks += 1;
const missingPort = makePort([]);
await assert.rejects(() => completeDailyQuestCommand({ type: 'daily-quest', sourceQuestId: 'study', localDateStamp: date, now }, rules, missingPort), /has not been seeded/); checks += 1;
equal(missingPort.calls.length, 0, 'missing Quest records fail closed without awarding rewards');
console.log(`Daily Quest application-command tests passed: ${checks} checks across canonical IDs, migration aliases, authoritative rewards, Stat/Skill metadata, AI separation, Daily Prize gate and fail-closed validation.`);
