import assert from 'node:assert/strict';
import { recommendAdaptiveLearningPath } from '../../dist/ts/features/adaptive-learning-path.js';
const base = {
 now: '2026-10-18T12:00:00.000Z', activeGoalId: 'goal-python', activeMilestoneId: 'milestone-functions', preferredMinutes: 25,
 skills: [
  { skillId: 'python-basics', goalId: 'goal-python', milestoneId: 'milestone-functions', status: 'needs-practice', lastScore: 45, lastAssessedAt: '2026-10-17T12:00:00.000Z' },
  { skillId: 'math-basics', status: 'verified', lastScore: 95, lastAssessedAt: '2026-10-01T12:00:00.000Z', reviewIntervalDays: 7 },
  { skillId: 'advanced-python', status: 'learning' },
 ],
 quests: [
  { id: 'q-python-review', title: 'Python fundamentals practice', skillIds: ['python-basics'], goalId: 'goal-python', milestoneId: 'milestone-functions', estimatedMinutes: 25, difficulty: 2 },
  { id: 'q-math-review', title: 'Math spaced review', skillIds: ['math-basics'], kind: 'review', estimatedMinutes: 20 },
  { id: 'q-advanced', title: 'Advanced Python project', skillIds: ['advanced-python'], prerequisiteSkillIds: ['python-basics'], estimatedMinutes: 40, difficulty: 5 },
  { id: 'q-done', title: 'Already completed', skillIds: ['python-basics'], estimatedMinutes: 25 },
 ]
};
const plan = recommendAdaptiveLearningPath({ ...base, completedQuestIds: ['q-done'], limit: 3 });
assert.equal(plan.recommendations[0].questId, 'q-python-review');
assert.ok(plan.recommendations.some(q => q.questId === 'q-math-review'));
assert.deepEqual(plan.blockedQuestIds, ['q-advanced']);
assert.equal(plan.diagnostics.excludedCompleted, 1);
assert.equal(plan.diagnostics.excludedPrerequisites, 1);
assert.equal(plan.diagnostics.rewardIssued, false);
assert.throws(() => recommendAdaptiveLearningPath({ ...base, passThreshold: 0 }), /passThreshold/);
assert.throws(() => recommendAdaptiveLearningPath({ ...base, skills: [...base.skills, base.skills[0]] }), /unique/);
assert.throws(() => recommendAdaptiveLearningPath({ ...base, quests: [...base.quests, base.quests[0]] }), /unique/);
assert.throws(() => recommendAdaptiveLearningPath({ ...base, now: 'bad-date' }), /valid date/);
assert.throws(() => recommendAdaptiveLearningPath({ ...base, completedQuestIds: ['q-done', 'q-done'] }), /must be unique/);
assert.throws(() => recommendAdaptiveLearningPath({ ...base, skills: [{ skillId: 'x', status: 'mastered' }] }), /Invalid status/);
assert.throws(() => recommendAdaptiveLearningPath({ ...base, skills: [{ skillId: 'x', reviewIntervalDays: 0 }] }), /review interval/);
assert.throws(() => recommendAdaptiveLearningPath({ ...base, quests: [{ id: 'x', title: 'X', skillIds: ['a', 'a'] }] }), /unique valid skill IDs/);
assert.throws(() => recommendAdaptiveLearningPath({ ...base, quests: [{ id: 'x', title: 'X', skillIds: ['a'], kind: 'reward' }] }), /quest kind/);
assert.throws(() => recommendAdaptiveLearningPath({ ...base, quests: [{ id: 'x', title: 'X', skillIds: ['a'], prerequisiteSkillIds: ['  '] }] }), /prerequisite skills/);
const sameSkillAlternatives = recommendAdaptiveLearningPath({
 now: base.now,
 skills: [{ skillId: 'python-basics', status: 'needs-practice', lastScore: 50 }],
 quests: [
  { id: 'python-a', title: 'Python practice A', skillIds: ['python-basics'], estimatedMinutes: 25 },
  { id: 'python-b', title: 'Python practice B', skillIds: ['python-basics'], estimatedMinutes: 25 },
  { id: 'python-c', title: 'Python practice C', skillIds: ['python-basics'], estimatedMinutes: 25 },
 ],
 limit: 3
});
assert.deepEqual(sameSkillAlternatives.recommendations.map(item => item.questId), ['python-a', 'python-b', 'python-c'], 'Planner should fill requested slots with the best alternatives when only one skill is available.');
console.log('Adaptive learning path tests passed: 17 assertions, including strict input contracts, single-skill fallback, and duplicate completion rejection.');
