import assert from 'node:assert/strict';
import { evaluateGoalCurriculum, validateGoalCurriculum } from '../../dist/ts/features/goal-curriculum.js';

let checks = 0;
const equal = (a, b, message) => { assert.equal(a, b, message); checks++; };
const ok = (value, message) => { assert.ok(value, message); checks++; };
const rejects = (fn, pattern, message) => { assert.throws(fn, pattern, message); checks++; };
const base = {
  id: 'goal-robotics', title: 'Build a robotics prototype', stat: 'computer', completed: false,
  milestones: [
    { id: 'm1', title: 'Learn foundations', requiredEvidence: 2, requiredSkillIds: ['python-basics'], prerequisiteIds: [] },
    { id: 'm2', title: 'Build prototype', requiredEvidence: 1, requiredSkillIds: ['robotics-prototype'], prerequisiteIds: ['m1'] },
  ],
  evidence: [
    { id: 'e1', questId: 'q1', milestoneId: 'm1', title: 'Write a Python script', at: '2026-10-18T09:00:00.000Z', stat: 'computer', skillId: 'python-basics', skillVerification: { method: 'assessment', verifiedAt: '2026-10-18T09:05:00.000Z', score: 85 }, passed: true },
    { id: 'e2', questId: 'q2', milestoneId: 'm1', title: 'Explain the script', at: '2026-10-18T10:00:00.000Z', stat: 'computer', skillId: null, passed: true },
    { id: 'e3', questId: 'q3', milestoneId: 'm2', title: 'Build a prototype', at: '2026-10-18T11:00:00.000Z', stat: 'computer', skillId: 'robotics-prototype', skillVerification: { method: 'project-review', verifiedAt: '2026-10-18T11:05:00.000Z', score: 90 }, passed: true },
  ],
};
const evaluation = evaluateGoalCurriculum(base);
equal(evaluation.progressPercent, 100, 'all complete milestones produce 100 percent progress');
equal(evaluation.completedMilestones, 2, 'milestones are evaluated through prerequisite links');
ok(evaluation.readyToComplete, 'an active goal is ready only when all milestones meet evidence and skill requirements');
equal(evaluation.rewardIssued, false, 'pure evaluator explicitly never issues a reward');
const assignmentOnly = { ...base, evidence: base.evidence.map(item => item.id === 'e1' ? { ...item, skillVerification: null } : item) };
equal(evaluateGoalCurriculum(assignmentOnly).milestones[0].complete, false, 'Quest Skill assignment alone does not prove mastery');
const lowScore = { ...base, evidence: base.evidence.map(item => item.id === 'e1' ? { ...item, skillVerification: { method: 'assessment', verifiedAt: '2026-10-18T09:05:00.000Z', score: 79 } } : item) };
equal(evaluateGoalCurriculum(lowScore).milestones[0].complete, false, 'skill verification below 80 percent does not satisfy a required Skill');
equal(evaluation.milestones[1].unlocked, true, 'second milestone unlocks when its prerequisite is complete');
const reordered = { ...base, milestones: [...base.milestones].reverse() };
equal(evaluateGoalCurriculum(reordered).progressPercent, 100, 'evaluation is independent of milestone array order');
const missingSkill = { ...base, evidence: base.evidence.map(item => item.id === 'e1' ? { ...item, skillId: null, skillVerification: null } : item) };
equal(evaluateGoalCurriculum(missingSkill).milestones[0].complete, false, 'activity/evidence count alone does not imply Skill verification');
const failedEvidence = { ...base, evidence: base.evidence.map(item => item.id === 'e2' ? { ...item, passed: false } : item) };
equal(evaluateGoalCurriculum(failedEvidence).progressPercent, 0, 'failed evidence does not count toward milestone completion');
const wrongStat = { ...base, evidence: base.evidence.map(item => item.id === 'e1' ? { ...item, stat: 'physics' } : item) };
equal(evaluateGoalCurriculum(wrongStat).milestones[0].complete, false, 'evidence in the wrong Stat cannot advance a Goal');
const completed = evaluateGoalCurriculum({ ...base, completed: true });
equal(completed.readyToComplete, false, 'completed goals cannot become newly eligible for completion');
equal(completed.alreadyCompleted, true, 'completed status is reported independently from progress');
rejects(() => validateGoalCurriculum({ ...base, milestones: [...base.milestones, { ...base.milestones[0] }] }), /Duplicate Milestone ID/, 'duplicate milestone IDs are rejected');
rejects(() => validateGoalCurriculum({ ...base, milestones: [{ ...base.milestones[0], prerequisiteIds: ['missing'] }, base.milestones[1]] }), /Unknown prerequisite/, 'dangling prerequisite links are rejected');
rejects(() => validateGoalCurriculum({ ...base, milestones: [
  { ...base.milestones[0], prerequisiteIds: ['m2'] }, base.milestones[1],
] }), /cycle detected/, 'cyclic milestone dependencies are rejected');
rejects(() => validateGoalCurriculum({ ...base, evidence: [...base.evidence, { ...base.evidence[0], id: 'e4' }] }), /Duplicate Quest evidence/, 'same Quest cannot count twice for one milestone');
rejects(() => validateGoalCurriculum({ ...base, evidence: [{ ...base.evidence[0], at: 'not-a-date' }] }), /timestamp is invalid/, 'invalid evidence timestamps are rejected');
rejects(() => validateGoalCurriculum({ ...base, evidence: [{ ...base.evidence[0], skillVerification: { method: 'assessment', verifiedAt: '2026-10-18T09:05:00.000Z', score: 101 } }] }), /score is invalid/, 'skill verification score outside 0-100 is rejected');
rejects(() => validateGoalCurriculum({ ...base, evidence: [{ ...base.evidence[0], skillId: null, skillVerification: { method: 'assessment', verifiedAt: '2026-10-18T09:05:00.000Z', score: 90 } }] }), /requires a Skill ID/, 'skill verification without a Skill identity is rejected');
rejects(() => validateGoalCurriculum({ ...base, milestones: [{ ...base.milestones[0], requiredEvidence: 0 }, base.milestones[1]] }), /evidence target is invalid/, 'zero evidence target is rejected');
const blocked = { ...base, evidence: base.evidence.filter(item => item.milestoneId !== 'm1') };
const blockedEval = evaluateGoalCurriculum(blocked);
equal(blockedEval.milestones[1].unlocked, false, 'downstream milestone stays locked until prerequisite completion');
equal(blockedEval.progressPercent, 0, 'locked milestone evidence does not inflate goal progress');
console.log(`Goal curriculum tests passed: ${checks} assertions.`);
