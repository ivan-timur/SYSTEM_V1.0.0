import assert from 'node:assert/strict';
import {
  canCompleteCustomQuest,
  createCustomQuestRecord,
  getBossQuestDefinitions,
  getBossQuestStatus,
  normalizeLegacyCustomQuests,
} from '../../dist/ts/features/quest-command.js';

const validStats = ['mathematics', 'computer', 'physics', 'global-skills', 'entrepreneurship', 'unique-thinking'];
let checks = 0;
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks += 1; }
function ok(value, message) { assert.ok(value, message); checks += 1; }
function rejected(fn, pattern, message) { assert.throws(fn, pattern, message); checks += 1; }

const normalized = normalizeLegacyCustomQuests([
  { id: ' quest-bad ', title: 'Invalid identity', xp: 20 },
  { id: 'quest-1', title: '  Learn Python  ', description: 'x'.repeat(220), stat: 'computer', goalId: 'goal-1', xp: 45.8, coins: 17.9, completed: true, customMetadata: 'preserve' },
  { id: 'quest-1', title: 'Duplicate should be ignored', xp: 99 },
  { id: 'quest-2', title: 'Unknown branch', stat: 'untrusted-stat', xp: -100, coins: 900 },
  { id: 'quest-3', title: 'Fallback rewards', xp: 'not-a-number', coins: 'not-a-number', skillId: 's'.repeat(129) },
  null,
  { id: 'quest-4', title: '  ' },
], validStats);
equal(normalized.length, 3, 'malformed and duplicate legacy Custom Quests are filtered');
equal(normalized[0].title, 'Learn Python', 'title is trimmed and remains within the compatibility cap');
equal(normalized[0].description.length, 180, 'description length is bounded when loading legacy data');
equal(normalized[0].xp, 45, 'legacy fractional XP is floored');
equal(normalized[0].coins, 17, 'legacy fractional Coins are floored');
equal(normalized[0].completed, true, 'completed status is preserved');
equal(normalized[0].customMetadata, 'preserve', 'forward-compatible metadata is preserved');
equal(normalized[1].stat, null, 'unknown legacy Stat is normalized to general progress');
equal(normalized[1].xp, 5, 'invalid legacy XP is clamped to the supported minimum when numeric');
equal(normalized[1].coins, 500, 'legacy Coins are clamped to the supported maximum');
equal(normalized[2].xp, 50, 'non-numeric legacy XP gets the historical fallback');
equal(normalized[2].coins, 10, 'non-numeric legacy Coins get the historical fallback');
equal(normalized[2].skillId, null, 'oversized legacy Skill IDs are discarded');
equal(normalizeLegacyCustomQuests({ nope: true }, validStats).length, 0, 'non-array legacy payload fails closed');
equal(normalizeLegacyCustomQuests(Array.from({ length: 1005 }, (_, index) => ({ id: `q-${index}`, title: `Quest ${index}` })), validStats).length, 1000, 'legacy history retains only the most recent 1000 missions');

const draft = createCustomQuestRecord({
  id: 'custom-quest-test-1', title: '  Complete algebra set  ', description: 'Practice ten problems',
  stat: 'mathematics', goalId: 'goal-active', xp: 50, coins: 10,
  createdAt: '2026-10-18T10:00:00.000Z',
}, validStats, ['goal-active']);
equal(draft.title, 'Complete algebra set', 'new title is trimmed');
equal(draft.stat, 'mathematics', 'valid Stat is retained');
equal(draft.goalId, 'goal-active', 'only active linked Goals can be assigned');
equal(draft.completed, false, 'new Custom Quest always starts incomplete');
ok(canCompleteCustomQuest(draft), 'new valid Custom Quest may be completed');
ok(!canCompleteCustomQuest({ ...draft, completed: true }), 'completed Custom Quest cannot be completed again');
ok(!canCompleteCustomQuest({ ...draft, id: ' bad ' }), 'invalid Custom Quest identity fails closed');

rejected(() => createCustomQuestRecord({ ...draft, id: ' bad ' }, validStats, ['goal-active']), /Custom Quest ID/);
rejected(() => createCustomQuestRecord({ ...draft, title: '  ' }, validStats, ['goal-active']), /title is required/);
rejected(() => createCustomQuestRecord({ ...draft, stat: 'nope' }, validStats, ['goal-active']), /Stat is not valid/);
rejected(() => createCustomQuestRecord({ ...draft, goalId: 'stale-goal' }, validStats, ['goal-active']), /Goal is not active/);
rejected(() => createCustomQuestRecord({ ...draft, xp: 1001 }, validStats, ['goal-active']), /XP must be an integer/);
rejected(() => createCustomQuestRecord({ ...draft, coins: -1 }, validStats, ['goal-active']), /Coins must be an integer/);
rejected(() => createCustomQuestRecord({ ...draft, createdAt: 'yesterday' }, validStats, ['goal-active']), /timestamp is invalid/);

const definitions = getBossQuestDefinitions();
equal(definitions.length, 3, 'all three permanent Boss Quest definitions are exposed from the canonical catalogue');
equal(definitions[0].description, 'Complete three Daily Quests in the current day.', 'Boss Quest description has a single catalogue owner');
const consistencyLocked = getBossQuestStatus('boss-consistency', { completedDailyQuestCount: 2, playerLevel: 1, bestStatLevel: 1 });
ok(consistencyLocked && !consistencyLocked.eligible, 'Consistency Trial remains locked before three Daily Quests');
equal(consistencyLocked.progressLabel, '2 / 3 Daily Quests', 'daily Boss progress label remains compatible');
ok(getBossQuestStatus('boss-consistency', { completedDailyQuestCount: 4 }).eligible, 'Consistency Trial unlocks at three Daily Quests');
equal(getBossQuestStatus('boss-consistency', { completedDailyQuestCount: 4 }).progressLabel, '3 / 3 Daily Quests', 'daily Boss progress is capped at the target');
ok(getBossQuestStatus('boss-awakening', { playerLevel: 3 }).eligible, 'Awakening Trial unlocks at Player Level 3');
equal(getBossQuestStatus('boss-awakening', { playerLevel: 4 }).progressLabel, 'Level 4 / 3', 'Player-level progress label remains compatible');
ok(getBossQuestStatus('boss-skill-ascendant', { bestStatLevel: 3 }).eligible, 'Skill Ascendant unlocks when a Stat reaches Level 3');
equal(getBossQuestStatus('boss-skill-ascendant', { bestStatLevel: 2 }).progressLabel, 'Best Stat Level: 2 / 3', 'Stat progress label remains compatible');
ok(!getBossQuestStatus('boss-awakening', { playerLevel: Number.POSITIVE_INFINITY }).eligible, 'malformed values fail closed');
equal(getBossQuestStatus('no-such-boss', {}), null, 'unknown Boss Quest IDs return no status');

console.log(`Typed Quest command tests passed: ${checks} assertions across legacy normalization, draft validation, duplicate completion prevention, and Boss eligibility.`);
