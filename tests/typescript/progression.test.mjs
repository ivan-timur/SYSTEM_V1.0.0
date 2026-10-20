import assert from 'node:assert/strict';
import { advanceXPTrack, completeQuest } from '../../dist/ts/core/progression.js';

const rules = {
  xpForNextLevel: level => level === 1 ? 100 : 150,
  rankForLevel: level => level >= 5 ? 'A' : 'E',
  achievementRules: [{ id: 'first-quest', predicate: p => p.completedQuestIds.length >= 1 }],
};
const makePlayer = (overrides = {}) => ({
  xp: 90, level: 1, coins: 2, rank: 'E', skills: {}, completedQuestIds: [], xpEvents: [], achievements: [], ...overrides,
});
const makeQuest = (overrides = {}) => ({ id: 'q1', title: 'Test', status: 'available', xpReward: 25, coinReward: 3, skillId: 'math', ...overrides });

let result = completeQuest(makePlayer(), makeQuest(), rules, '2026-10-18T00:00:00.000Z');
assert.equal(result.player.level, 2);
assert.equal(result.player.xp, 15);
assert.equal(result.player.coins, 5);
assert.equal(result.player.skills.math.xp, 25);

const multiSkill = completeQuest(makePlayer(), makeQuest({ skillId: undefined, skillRewards: [
  { skillId: 'math-algebra-i', xpReward: 12 }, { skillId: 'math-functions', xpReward: 7 },
] }), rules, '2026-10-18T00:00:00.000Z');
assert.equal(multiSkill.player.skills['math-algebra-i'].xp, 12, 'one command can update a verified Skill path');
assert.equal(multiSkill.player.skills['math-functions'].xp, 7, 'all requested Skills are changed in the same pure transition');
assert.throws(() => completeQuest(makePlayer(), makeQuest({ skillRewards: [
  { skillId: 'math', xpReward: 1 }, { skillId: 'math', xpReward: 2 },
] }), rules), /duplicate Skill reward/);

const track = advanceXPTrack({ level: 1, xp: 90, xpRequired: 100 }, 160, level => 100 + (level - 1) * 25, 100);
assert.equal(track.level, 3);
assert.equal(track.xp, 25);
assert.equal(track.xpRequired, 150);
assert.equal(track.levelsGained, 2, 'shared XP-track transition supports multi-level awards and carries overflow');
assert.equal(result.player.xpEvents.length, 1);
assert.deepEqual(result.newlyUnlockedAchievements, ['first-quest']);
assert.equal(result.quest.status, 'completed');
assert.equal(result.quest.completedAt, '2026-10-18T00:00:00.000Z');

const duplicate = completeQuest(result.player, result.quest, rules);
assert.equal(duplicate.alreadyCompleted, true);
assert.equal(duplicate.player.xpEvents.length, 1);
assert.equal(duplicate.player.coins, 5);

const multiLevel = completeQuest(makePlayer({ xp: 0 }), makeQuest({ xpReward: 400, coinReward: 0, skillId: undefined }), rules, '2026-10-18T00:00:00.000Z');
assert.deepEqual(multiLevel.leveledUp, [2, 3, 4]);
assert.equal(multiLevel.player.xp, 0);
assert.equal(multiLevel.player.level, 4);

const skillReuse = completeQuest(makePlayer({ skills: { math: { id: 'math', xp: 12, level: 2 } } }), makeQuest(), rules, '2026-10-18T00:00:00.000Z');
assert.equal(skillReuse.player.skills.math.xp, 37);
assert.equal(skillReuse.player.skills.math.level, 2, 'when no Skill curve is provided, compatibility semantics preserve the separate track');
const leveledSkill = completeQuest(
  makePlayer({ skills: { math: { id: 'math', xp: 90, level: 1, xpRequired: 100, totalXp: 90 } } }),
  makeQuest({ skillRewards: [{ skillId: 'math', xpReward: 25 }] }),
  { ...rules, xpForNextSkillLevel: level => 100 + (level - 1) * 25 },
  '2026-10-18T00:00:00.000Z',
);
assert.equal(leveledSkill.player.skills.math.level, 2, 'the unified domain can include Skill level-ups in a Quest transaction');
assert.equal(leveledSkill.player.skills.math.xp, 15, 'Skill XP overflow is preserved');
assert.equal(leveledSkill.player.skills.math.totalXp, 115, 'lifetime Skill XP is preserved across a Skill level-up');

const source = makePlayer();
completeQuest(source, makeQuest(), rules, '2026-10-18T00:00:00.000Z');
assert.equal(source.xp, 90, 'domain transition must not mutate input XP');
assert.equal(source.coins, 2, 'domain transition must not mutate input coins');
assert.deepEqual(source.completedQuestIds, [], 'domain transition must not mutate input history');

for (const [label, player, quest, customRules, time] of [
  ['negative quest XP', makePlayer(), makeQuest({ xpReward: -1 }), rules, '2026-10-18T00:00:00.000Z'],
  ['NaN coin reward', makePlayer(), makeQuest({ coinReward: Number.NaN }), rules, '2026-10-18T00:00:00.000Z'],
  ['invalid player level', makePlayer({ level: 0 }), makeQuest(), rules, '2026-10-18T00:00:00.000Z'],
  ['invalid timestamp', makePlayer(), makeQuest(), rules, 'not-a-date'],
  ['zero XP threshold', makePlayer({ xp: 100 }), makeQuest({ xpReward: 0 }), { ...rules, xpForNextLevel: () => 0 }, '2026-10-18T00:00:00.000Z'],
  ['NaN XP threshold', makePlayer({ xp: 100 }), makeQuest({ xpReward: 0 }), { ...rules, xpForNextLevel: () => Number.NaN }, '2026-10-18T00:00:00.000Z'],
  ['invalid rank value', makePlayer(), makeQuest(), { ...rules, rankForLevel: () => 'X' }, '2026-10-18T00:00:00.000Z'],
  ['duplicate event without completion marker', makePlayer({ xpEvents: [{ id: 'quest:q1', questId: 'q1', amount: 25, createdAt: '2026-10-18T00:00:00.000Z' }] }), makeQuest(), rules, '2026-10-18T00:00:00.000Z'],
]) {
  assert.throws(() => completeQuest(player, quest, customRules, time), undefined, label);
}

assert.throws(() => completeQuest(makePlayer(), makeQuest({ id: ' ' }), rules), /Quest ID is required/);
assert.throws(() => completeQuest(makePlayer(), makeQuest({ title: ' ' }), rules), /Quest title is required/);
assert.throws(() => completeQuest(makePlayer(), makeQuest(), { ...rules, achievementRules: [{ id: 'x', predicate: () => true }, { id: 'x', predicate: () => true }] }), /Duplicate achievement rule/);

// Phase 1 hardening: reject corrupt identity collections before a transition can award anything.
assert.throws(() => completeQuest(makePlayer({ completedQuestIds: ['old', 'old'] }), makeQuest(), rules), /Duplicate completed Quest ID/);
assert.throws(() => completeQuest(makePlayer({ completedQuestIds: [' padded '] }), makeQuest(), rules), /invalid identity/);
assert.throws(() => completeQuest(makePlayer({ achievements: ['first', 'first'] }), makeQuest(), rules), /Duplicate Achievement ID/);
assert.throws(() => completeQuest(makePlayer({ xpEvents: [
  { id: 'evt-1', questId: 'old', amount: 2, createdAt: '2026-10-18T00:00:00.000Z' },
  { id: 'evt-1', questId: 'older', amount: 3, createdAt: '2026-10-18T00:00:00.000Z' },
] }), makeQuest(), rules), /Duplicate XP event ID/);
assert.throws(() => completeQuest(makePlayer({ xpEvents: [
  { id: 'evt-bad', questId: 'old', amount: Number.NaN, createdAt: '2026-10-18T00:00:00.000Z' },
] }), makeQuest(), rules), /invalid event/);
assert.throws(() => completeQuest(makePlayer(), makeQuest({ id: ' q1 ' }), rules), /Quest ID is required/);

console.log('TypeScript progression regression tests passed (domain invariants, identity-ledger integrity, idempotency, level overflow, rewards, and validation).');
