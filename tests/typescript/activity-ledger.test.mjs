import assert from 'node:assert/strict';
import {
  SYSTEM_ACTIVITY_STATS,
  SYSTEM_LEARNING_MODES,
  SYSTEM_MAX_ACTIVITY_RECORDS,
  SYSTEM_PROGRESS_COUNTER_CAP,
  appendActivityRecord,
  countActivitiesByStat,
  createActivityRecord,
  createDefaultProgressCounters,
  listActivities,
  normalizeActivityHistory,
  normalizeProgressCounters,
  proposeProgressCounterIncrement,
  selectActivitiesInRange,
  summarizeActivities,
  updateActivityEvidence,
} from '../../dist/ts/core/activity-ledger.js';

const zeroCounters = createDefaultProgressCounters();
assert.deepEqual(Object.values(zeroCounters), [0, 0, 0, 0, 0, 0, 0]);
assert.deepEqual(Object.keys(zeroCounters).length, 7);

const normalized = normalizeProgressCounters({
  totalXpEarned: 15.9,
  totalStatXpEarned: -1,
  totalDailyQuestsCompleted: '8',
  totalCustomQuestsCompleted: 'corrupt',
  totalBossQuestsCompleted: 1e20,
  totalLevelsGained: null,
  unrelatedField: 700,
});
assert.equal(normalized.totalXpEarned, 15);
assert.equal(normalized.totalStatXpEarned, 0);
assert.equal(normalized.totalDailyQuestsCompleted, 8);
assert.equal(normalized.totalCustomQuestsCompleted, 0);
assert.equal(normalized.totalBossQuestsCompleted, SYSTEM_PROGRESS_COUNTER_CAP);
assert.equal(normalized.totalLevelsGained, 0);
assert.equal('unrelatedField' in normalized, false);

assert.deepEqual(proposeProgressCounterIncrement(zeroCounters, 'totalXpEarned', 25), { ok: true, value: 25 });
assert.deepEqual(proposeProgressCounterIncrement({ totalXpEarned: 99 }, 'totalXpEarned', 0.5), { ok: true, value: 99 }, 'positive fractional increments preserve legacy accepted/no-op behavior');
assert.deepEqual(proposeProgressCounterIncrement({ totalXpEarned: SYSTEM_PROGRESS_COUNTER_CAP }, 'totalXpEarned', 100), { ok: true, value: SYSTEM_PROGRESS_COUNTER_CAP });
assert.equal(proposeProgressCounterIncrement(zeroCounters, 'unknownCounter', 1).ok, false);
assert.equal(proposeProgressCounterIncrement(zeroCounters, 'totalXpEarned', -1).ok, false);
assert.equal(proposeProgressCounterIncrement(zeroCounters, 'totalXpEarned', Number.NaN).ok, false);

const timestamp = '2026-10-18T10:00:00.000Z';
const activity = createActivityRecord({
  type: 'a'.repeat(45),
  title: '  Algebra practice  ',
  stat: 'mathematics',
  skillId: 'math-algebra-i',
  goalId: 'goal-1',
  questId: 'quest-1',
  eventId: 'v1|daily-quest|quest-1|2026-10-18',
  xp: 1501.8,
  coins: -3,
  learningMode: 'assessment',
  learningModeSource: 'planned',
  evidenceType: 'quiz',
  durationMinutes: 1800,
  score: 120,
  passed: true,
}, timestamp);
assert.equal(activity.at, timestamp);
assert.equal(activity.type.length, 40);
assert.equal(activity.title, 'Algebra practice');
assert.equal(activity.stat, 'mathematics');
assert.equal(activity.xp, 1000);
assert.equal(activity.coins, 0);
assert.equal(activity.learningMode, 'assessment');
assert.equal(activity.learningModeSource, 'planned');
assert.equal(activity.durationMinutes, 1440);
assert.equal(activity.score, 100);
assert.equal(activity.passed, true);

const invalid = createActivityRecord({
  stat: '__proto__',
  skillId: 'x'.repeat(129),
  goalId: 'x'.repeat(201),
  questId: 'x'.repeat(201),
  eventId: '',
  learningMode: 'invented',
  xp: Number.NaN,
  coins: Infinity,
  score: 'not-a-number',
  passed: 'yes',
}, timestamp);
assert.equal(invalid.stat, null);
assert.equal(invalid.skillId, null);
assert.equal(invalid.goalId, null);
assert.equal(invalid.questId, null);
assert.equal('eventId' in invalid, false);
assert.equal('learningMode' in invalid, false);
assert.equal(invalid.xp, 0);
assert.equal(invalid.coins, 0);
assert.equal('score' in invalid, false);
assert.equal('passed' in invalid, false);
assert.deepEqual([...SYSTEM_ACTIVITY_STATS], ['entrepreneurship', 'global-skills', 'mathematics', 'computer', 'physics', 'unique-thinking']);
assert.ok(SYSTEM_LEARNING_MODES.includes('assessment'));

const legacyRecords = Array.from({ length: SYSTEM_MAX_ACTIVITY_RECORDS + 7 }, (_, index) => ({
  at: timestamp,
  title: `Legacy ${index}`,
  type: 'quest',
  legacyField: index,
}));
const normalizedHistory = normalizeActivityHistory([
  null,
  { at: 5, title: 'bad timestamp type' },
  { at: timestamp },
  ...legacyRecords,
]);
assert.equal(normalizedHistory.length, SYSTEM_MAX_ACTIVITY_RECORDS);
assert.equal(normalizedHistory[0].title, 'Legacy 7');
assert.equal(normalizedHistory.at(-1).legacyField, SYSTEM_MAX_ACTIVITY_RECORDS + 6);
assert.equal(normalizeActivityHistory('{"not":"an array"}').length, 0);

const first = createActivityRecord({ type: 'ai-daily-quest', questId: 'ai-1', title: 'Recall facts', stat: 'mathematics', xp: 25, coins: 3 }, '2026-10-17T10:00:00.000Z');
const second = createActivityRecord({ type: 'ai-daily-quest', questId: 'ai-1', title: 'Recall facts', stat: 'mathematics', xp: 35, coins: 4, learningMode: 'practice' }, timestamp);
const history = [first, second];
const evidenceResult = updateActivityEvidence(history, { id: 'ai-1', title: 'Recall facts' }, {
  learningMode: 'assessment', score: 88, passed: true, durationMinutes: 12,
});
assert.equal(evidenceResult.ok, true);
if (evidenceResult.ok) {
  assert.equal(evidenceResult.updatedIndex, 1, 'update targets the most recent matching AI Daily Quest');
  assert.equal(evidenceResult.activities[1].learningMode, 'assessment');
  assert.equal(evidenceResult.activities[1].learningModeSource, 'explicit');
  assert.equal(evidenceResult.activities[1].score, 88);
  assert.equal(evidenceResult.activities[1].passed, true);
  assert.equal(evidenceResult.activities[1].durationMinutes, 12);
  assert.equal(evidenceResult.activities[1].xp, 35, 'evidence metadata cannot alter XP');
  assert.equal(history[1].learningMode, 'practice', 'updates are immutable until the adapter commits them');
}
assert.deepEqual(updateActivityEvidence(history, null).reason, 'invalid-quest');
assert.deepEqual(updateActivityEvidence(history, { id: 'ai-1', title: 'Recall facts' }, { score: 101 }).reason, 'invalid-evidence');
assert.deepEqual(updateActivityEvidence(history, { id: 'missing', title: 'None' }).reason, 'activity-not-found');

const legacyTitleFallback = updateActivityEvidence([
  { at: timestamp, type: 'ai-daily-quest', title: 'Old title-based record', xp: 12 },
], { id: 'ai-old', title: 'Old title-based record' }, { passed: false });
assert.equal(legacyTitleFallback.ok, true, 'old records without questId remain enrichable through exact-title fallback');

const reportingHistory = [
  createActivityRecord({ title: 'Today math', stat: 'mathematics', xp: 20, coins: 2 }, '2026-10-18T08:00:00.000Z'),
  createActivityRecord({ title: 'Yesterday computer', stat: 'computer', xp: 15, coins: 1 }, '2026-10-17T08:00:00.000Z'),
  createActivityRecord({ title: 'Old physics', stat: 'physics', xp: 70, coins: 7 }, '2026-09-01T08:00:00.000Z'),
  createActivityRecord({ title: 'Future math', stat: 'mathematics', xp: 100, coins: 10 }, '2026-10-19T08:00:00.000Z'),
  { at: 'bad-date', title: 'Invalid time', xp: 1000, coins: 100 },
];
const summary = summarizeActivities(reportingHistory, 7, Date.parse('2026-10-18T12:00:00.000Z'));
assert.equal(summary.days, 7);
assert.equal(summary.activities, 3, 'summary keeps the legacy API behavior for future-dated rows, filtering only the lower date bound');
assert.equal(summary.xp, 135);
assert.equal(summary.coins, 13);
assert.equal(summary.byStat.mathematics, 2);
assert.equal(summary.byStat.computer, 1);

const strictRecent = selectActivitiesInRange(reportingHistory, Date.parse('2026-10-11T12:00:00.000Z'), Date.parse('2026-10-18T12:00:00.000Z'));
assert.equal(strictRecent.length, 2, 'AI snapshot window excludes future and malformed timestamps');
assert.deepEqual(countActivitiesByStat(strictRecent), { mathematics: 1, computer: 1 });
assert.deepEqual(listActivities(reportingHistory, 2).map(item => item.title), ['Invalid time', 'Future math']);

let bounded = [];
for (let index = 0; index < SYSTEM_MAX_ACTIVITY_RECORDS + 5; index += 1) {
  bounded = appendActivityRecord(bounded, { at: timestamp, title: `Activity ${index}` });
}
assert.equal(bounded.length, SYSTEM_MAX_ACTIVITY_RECORDS);
assert.equal(bounded[0].title, 'Activity 5');
assert.equal(bounded.at(-1).title, `Activity ${SYSTEM_MAX_ACTIVITY_RECORDS + 4}`);

console.log('TypeScript activity-ledger tests passed (counter guards, metadata validation, evidence updates, bounded history, and summaries).');
