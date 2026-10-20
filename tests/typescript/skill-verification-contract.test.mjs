import assert from 'node:assert/strict';
import { evaluateGoalCurriculum, validateGoalCurriculum } from '../../dist/ts/features/goal-curriculum.js';

const goal = {
  id: 'goal-skill-proof', title: 'Demonstrate skill', stat: 'computer', completed: false,
  milestones: [{ id: 'm1', title: 'Verified milestone', requiredEvidence: 1, requiredSkillIds: ['python-basics'], prerequisiteIds: [] }],
  evidence: [{ id: 'e1', questId: 'q1', milestoneId: 'm1', title: 'Complete a Python task', at: '2026-10-18T10:00:00.000Z', stat: 'computer', skillId: 'python-basics', passed: true }],
};
assert.equal(evaluateGoalCurriculum(goal).milestones[0].complete, false, 'skill assignment does not equal skill mastery');
const verified = { ...goal, evidence: [{ ...goal.evidence[0], skillVerification: { method: 'assessment', verifiedAt: '2026-10-18T10:01:00.000Z', score: 80 } }] };
assert.equal(evaluateGoalCurriculum(verified).milestones[0].complete, true, 'score of 80 meets the verification threshold');
const belowThreshold = { ...verified, evidence: [{ ...verified.evidence[0], skillVerification: { ...verified.evidence[0].skillVerification, score: 79.99 } }] };
assert.equal(evaluateGoalCurriculum(belowThreshold).milestones[0].complete, false, 'score below 80 does not meet the threshold');
assert.throws(() => validateGoalCurriculum({ ...goal, evidence: [{ ...goal.evidence[0], skillVerification: { method: 'made-up', verifiedAt: '2026-10-18T10:01:00.000Z', score: 99 } }] }), /method is invalid/);
assert.throws(() => validateGoalCurriculum({ ...goal, evidence: [{ ...goal.evidence[0], skillVerification: { method: 'assessment', verifiedAt: 'invalid', score: 99 } }] }), /timestamp is invalid/);
console.log('Skill verification contract tests passed: 5 assertions.');
