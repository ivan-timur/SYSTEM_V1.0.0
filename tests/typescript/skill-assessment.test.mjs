import assert from 'node:assert/strict';
import { evaluateSkillAssessment } from '../../dist/ts/features/skill-assessment.js';
const questions = [
 { id:'q1', skillId:'math-basics', prompt:'2 + 2?', choices:['3','4'], correctChoice:1 },
 { id:'q2', skillId:'math-basics', prompt:'3 + 1?', choices:['4','5'], correctChoice:0 },
 { id:'q3', skillId:'python-basics', prompt:'Which is a string?', choices:['7','"hi"'], correctChoice:1 },
 { id:'q4', skillId:'python-basics', prompt:'Boolean?', choices:['True','hello'], correctChoice:0 },
];
const result = evaluateSkillAssessment({ assessmentId:'assessment-1', attemptId:'attempt-1', questions, answers:[{questionId:'q1',choice:1},{questionId:'q2',choice:0},{questionId:'q3',choice:0},{questionId:'q4',choice:1}] });
assert.equal(result.score, 50);
assert.equal(result.passed, false);
assert.deepEqual(result.verifiedSkillIds, ['math-basics']);
assert.deepEqual(result.weakSkillIds, ['python-basics']);
assert.equal(result.rewardIssued, false);
assert.throws(() => evaluateSkillAssessment({ assessmentId:'a', attemptId:'b', questions, answers:[{questionId:'q1',choice:1},{questionId:'q1',choice:1}] }), /Duplicate answer/);
assert.throws(() => evaluateSkillAssessment({ assessmentId:'a', attemptId:'b', questions:[...questions,{...questions[0]}], answers:[] }), /Duplicate question/);
console.log('Skill assessment tests passed: 7 assertions.');
