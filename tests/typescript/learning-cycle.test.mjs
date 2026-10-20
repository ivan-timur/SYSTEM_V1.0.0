import assert from 'node:assert/strict';
import { evaluateLearningCycle, createCompletedQuestEvidence } from '../../dist/ts/features/learning-cycle.js';

const goal = {
  id: 'robotics-goal', title: 'Learn robotics', stat: 'computer', completed: false,
  milestones: [
    { id: 'm1', title: 'Foundations', requiredEvidence: 1, requiredSkillIds: ['python'], prerequisiteIds: [] },
    { id: 'm2', title: 'Build a prototype', requiredEvidence: 1, requiredSkillIds: [], prerequisiteIds: ['m1'] },
  ],
  evidence: [],
};
const at = '2026-10-19T12:00:00.000Z';
const evidence = createCompletedQuestEvidence(goal, { id: 'q1', title: 'Python exercise', completed: true, goalId: 'robotics-goal', milestoneId: 'm1', stat: 'computer', skillId: 'python', }, 'e1', at, { method: 'assessment', verifiedAt: at, score: 85 });
assert.equal(evidence.passed, true);
assert.throws(() => createCompletedQuestEvidence(goal, { id: 'q1', title: 'Python exercise', completed: false, goalId: 'robotics-goal', milestoneId: 'm1' }, 'e2', at), /completed quest/);
assert.throws(() => createCompletedQuestEvidence(goal, { id: 'q2', title: 'Wrong goal', completed: true, goalId: 'other', milestoneId: 'm1' }, 'e2', at), /does not belong/);
assert.throws(() => createCompletedQuestEvidence(goal, { id: 'q3', title: 'Bad score', completed: true, goalId: 'robotics-goal', milestoneId: 'm1', skillId: 'python' }, 'e3', at, { method: 'assessment', verifiedAt: at, score: 79 }), /between 80 and 100/);
assert.throws(() => createCompletedQuestEvidence(goal, { id: 'q4', title: 'Bad method', completed: true, goalId: 'robotics-goal', milestoneId: 'm1', skillId: 'python' }, 'e4', at, { method: 'guess', verifiedAt: at, score: 90 }), /method is invalid/);
assert.throws(() => createCompletedQuestEvidence(goal, { id: 'q5', title: 'Bad verification time', completed: true, goalId: 'robotics-goal', milestoneId: 'm1', skillId: 'python' }, 'e5', at, { method: 'assessment', verifiedAt: 'not-a-date', score: 90 }), /timestamp is invalid/);
const populated = { ...goal, evidence: [evidence] };
const result = evaluateLearningCycle({ goal: populated, adaptive: { now: at, skills: [{ skillId: 'python', goalId: 'robotics-goal', milestoneId: 'm1', status: 'verified', lastScore: 85, lastAssessedAt: at }], quests: [{ id: 'q2', title: 'Build robot', skillIds: ['python'], goalId: 'robotics-goal', milestoneId: 'm2', estimatedMinutes: 30, kind: 'project' }], completedQuestIds: ['q1'], preferredMinutes: 30 } });
assert.equal(result.evaluation.completedMilestones, 1);
assert.equal(result.activeMilestoneId, 'm2');
assert.equal(result.diagnostics.rewardsIssued, false);
assert.equal(result.learningPlan.recommendations[0].questId, 'q2');
assert.throws(() => evaluateLearningCycle({ goal: populated, adaptive: { now: at, skills: [], quests: [], completedQuestIds: ['q1', 'q1'] } }), /must be unique/);
assert.throws(() => evaluateLearningCycle({ goal: populated, adaptive: { now: at, skills: [], quests: [], completedQuestIds: [' q1 '] } }), /invalid ID/);
console.log('learning-cycle: PASS');
