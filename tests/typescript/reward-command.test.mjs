import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { getCanonicalDomainQuestId, getLegacyDomainQuestIdAliases, getProgressionRewardIdentity, prepareProgressionReward, SYSTEM_QUEST_REWARD_TYPES, SYSTEM_STAT_IDS } from '../../dist/ts/core/reward-command.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const date = '2026-10-18';
const now = '2026-10-18T12:00:00.000Z';
const base = { title: 'Practice', xp: 20, coins: 3, stat: 'mathematics', skillId: 'math-algebra-i' };
let checks = 0;
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks += 1; }
function ok(value, message) { assert.ok(value, message); checks += 1; }

const daily = prepareProgressionReward({ ...base, type: 'daily-quest', questId: 'daily-study' }, date, SYSTEM_STAT_IDS, 1e12, now);
equal(daily.idempotencyKey, 'v1|daily-quest|daily-study|2026-10-18', 'Daily Quest identity is stable for its local date');
equal(daily.domainQuestId, 'daily-quest:daily-study:2026-10-18', 'Daily domain Quest ID has the established namespaced format');
equal(daily.xp, 20, 'XP is normalized to an integer');
equal(daily.coins, 3, 'Coins are normalized to an integer');

equal(getCanonicalDomainQuestId('custom-quest', 'custom-1'), 'custom-quest:custom-1', 'Custom Quest uses the canonical persisted ID contract');
equal(getCanonicalDomainQuestId('boss-quest', 'boss-1'), 'boss-quest:boss-1', 'Boss Quest uses the canonical persisted ID contract');
equal(getLegacyDomainQuestIdAliases('custom-quest', 'custom-1')[0], 'custom:custom-1', 'old Custom Quest IDs are available only as compatibility aliases');
equal(getLegacyDomainQuestIdAliases('boss-quest', 'boss-1')[0], 'boss:boss-1', 'old Boss Quest IDs are available only as compatibility aliases');
equal(getLegacyDomainQuestIdAliases('goal-evidence-completion', 'goal-1').length, 0, 'Goal evidence has no redundant alias because it shares the canonical Goal ID');

const nextDay = prepareProgressionReward({ ...base, type: 'daily-quest', questId: 'daily-study' }, '2026-10-19', SYSTEM_STAT_IDS, 1e12, now);
ok(daily.idempotencyKey !== nextDay.idempotencyKey, 'Daily Quest identity changes only with the local date');

const expected = new Map([
  ['daily-quest', 'v1|daily-quest|daily-1|2026-10-18'],
  ['ai-daily-quest', 'v1|ai-daily-quest|ai-1|2026-10-18'],
  ['custom-quest', 'v1|custom-quest|custom-1'],
  ['boss-quest', 'v1|boss-quest|boss-1'],
  ['goal', 'v1|goal|goal-1'],
  ['goal-evidence-completion', 'v1|goal|goal-1'],
]);
for (const type of SYSTEM_QUEST_REWARD_TYPES) {
  const source = ['goal', 'goal-evidence-completion'].includes(type)
    ? { ...base, type, goalId: 'goal-1', questId: type === 'goal-evidence-completion' ? 'custom-1' : undefined }
    : { ...base, type, questId: ({ 'daily-quest': 'daily-1', 'ai-daily-quest': 'ai-1', 'custom-quest': 'custom-1', 'boss-quest': 'boss-1' })[type] };
  const command = prepareProgressionReward(source, date, SYSTEM_STAT_IDS, 1e12, now);
  equal(command.idempotencyKey, expected.get(type), `${type} maps to its canonical identity`);
  equal(command.rewardType, type, `${type} remains clearly named in the command`);
  ok(command.domainQuestId.startsWith(`${type === 'goal-evidence-completion' ? 'goal' : type}:`), `${type} gets its canonical persisted Quest identity`);
}

const goalManual = getProgressionRewardIdentity({ type: 'goal', goalId: 'goal-shared' });
const goalEvidence = getProgressionRewardIdentity({ type: 'goal-evidence-completion', goalId: 'goal-shared', questId: 'quest-other' });
equal(goalManual.idempotencyKey, goalEvidence.idempotencyKey, 'Manual and evidence-based Goal completion share one duplicate guard');
const generic = prepareProgressionReward({ type: 'activity', title: 'General study', xp: 8 }, date, SYSTEM_STAT_IDS, 1e12, now);
equal(generic.idempotencyKey, null, 'Generic activities are not accidentally added to the Quest-only duplicate ledger');
equal(generic.statId, null, 'General activities do not get a guessed Stat');
equal(generic.title, 'General study', 'Text is retained by canonical normalization');
const malformedTitle = prepareProgressionReward({ type: 'activity', title: '   ', xp: 1 }, date, SYSTEM_STAT_IDS, 1e12, now);
equal(malformedTitle.title, 'Completed activity', 'Blank titles receive a safe fallback');
const oversized = prepareProgressionReward({ type: 'activity', title: 'Cap', xp: 2e12, coins: 2e12 }, date, SYSTEM_STAT_IDS, 1e12, now);
equal(oversized.xp, 1e12, 'XP is clamped to the established numeric cap');
equal(oversized.coins, 1e12, 'Coins are clamped to the established numeric cap');

assert.throws(() => prepareProgressionReward({ type: 'custom-quest', xp: 10 }, date, SYSTEM_STAT_IDS, 1e12, now), /Quest ID/); checks += 1;
assert.throws(() => prepareProgressionReward({ type: 'goal', xp: 10 }, date, SYSTEM_STAT_IDS, 1e12, now), /Goal ID/); checks += 1;
assert.throws(() => prepareProgressionReward({ type: 'daily-quest', questId: 'daily-1', xp: 10 }, '2026-02-30', SYSTEM_STAT_IDS, 1e12, now), /valid local date|real calendar date/); checks += 1;
assert.throws(() => prepareProgressionReward({ type: 'custom-quest', questId: 'custom-1', xp: 0 }, date, SYSTEM_STAT_IDS, 1e12, now), /positive finite/); checks += 1;
assert.throws(() => prepareProgressionReward({ type: 'custom-quest', questId: 'custom-1', xp: 1, coins: -1 }, date, SYSTEM_STAT_IDS, 1e12, now), /non-negative/); checks += 1;
assert.throws(() => prepareProgressionReward({ type: 'activity', xp: 1, stat: 'not-a-stat' }, date, SYSTEM_STAT_IDS, 1e12, now), /Unknown Stat/); checks += 1;
assert.throws(() => prepareProgressionReward({ type: 'activity', xp: 1, skillId: 'math-algebra-i' }, date, SYSTEM_STAT_IDS, 1e12, now), /parent Stat/); checks += 1;

// Verify the live local idempotency API delegates to the TS identity contract.
const idempotencyWindow = {
  SYSTEMTypeScriptProgression: { getRewardIdentity: getProgressionRewardIdentity },
};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/core/progression-idempotency.js'), 'utf8'), { window: idempotencyWindow, console });
const runtimeKey = idempotencyWindow.SYSTEMProgressionIdempotency.createKey({ type: 'ai-daily-quest', questId: 'delegated-ai' }, date);
equal(runtimeKey, 'v1|ai-daily-quest|delegated-ai|2026-10-18', 'Legacy storage guard delegates live identity generation to TypeScript');
console.log(`TypeScript unified reward-command tests passed: ${checks} checks across all six reward routes, validation, normalization and live identity delegation.`);
