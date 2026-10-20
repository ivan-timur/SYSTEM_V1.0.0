'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/core/goal-progress.js'), 'utf8');
let capturedCurriculum = null;
const window = { SYSTEMGoalCurriculum: { evaluate(value) {
    capturedCurriculum = value;
    const completedMilestones = value.evidence.length;
    return { goalId: value.id, milestoneCount: value.milestones.length, completedMilestones,
      progressPercent: Math.round(completedMilestones / value.milestones.length * 100),
      milestones: value.milestones.map((milestone, index) => ({ ...milestone, unlocked: index <= completedMilestones,
        evidenceCount: index < completedMilestones ? 1 : 0, evidenceRequired: 1, complete: index < completedMilestones })),
      readyToComplete: completedMilestones === value.milestones.length && !value.completed,
      alreadyCompleted: value.completed, rewardIssued: false };
} } };
vm.runInNewContext(source, { window, Date, Set, Math, Number, String, Object, Array }, { filename: 'goal-progress.js' });
const api = window.SYSTEMGoalProgress;
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks++; }

check(Boolean(api), 'Goal progress API should register on window.');
equal(api.version, '9.0.0', 'Goal progress API release should be explicit.');
equal(api.maxTarget, 20, 'Goal targets should have a bounded upper limit.');
equal(api.maxEvidence, 20, 'Evidence history per Goal should be bounded to protect local storage.');
check(typeof api.toLegacyCurriculum === 'function', 'Legacy Goal projection should be exposed for the joined learning-cycle runtime.');
const projectedGoal = { id: 'legacy-goal', title: 'Learn Robotics', stat: 'computer', targetCount: 2, completed: false,
  evidence: [{ questId: 'quest-a', title: 'Study Python', at: '2026-10-18T09:00:00.000Z', stat: null, xp: 10 }] };
const definition = api.toLegacyCurriculum(projectedGoal);
check(Boolean(definition), 'Legacy Goal adapter should return a reusable curriculum definition without writing storage.');
equal(definition.id, 'legacy-goal', 'Curriculum definition preserves the Goal identity.');
const projected = api.evaluateLegacyCurriculum(projectedGoal);
check(Boolean(projected), 'Legacy Goal should project into the typed curriculum evaluator when it is available.');
equal(capturedCurriculum.milestones.length, 2, 'Each legacy evidence target should become a milestone.');
equal(capturedCurriculum.evidence[0].milestoneId, capturedCurriculum.milestones[0].id, 'Legacy evidence should map to the corresponding milestone.');
equal(capturedCurriculum.evidence[0].stat, 'computer', 'Legacy evidence without a Stat should retain its Goal branch semantics.');
equal(capturedCurriculum.evidence[0].skillId, null, 'Legacy evidence without a Skill ID should remain compatible.');
equal(capturedCurriculum.milestones[1].prerequisiteIds[0], capturedCurriculum.milestones[0].id, 'Legacy milestones should form a sequential dependency path.');
equal(capturedCurriculum.completed, false, 'Projection must preserve completion state.');


const baseGoal = { id: 'goal-1', title: 'Learn Algebra', stat: 'mathematics', targetCount: 2, progressCount: 0, evidence: [], completed: false };
const first = api.recordEvidence([baseGoal], { goalId: 'goal-1', questId: 'quest-1', title: 'Practice linear equations', stat: 'mathematics', xp: 50, at: '2026-10-15T09:00:00.000Z' });
check(first.ok && first.matched, 'Valid linked quest should record evidence.');
equal(first.goal.progressCount, 1, 'First linked quest should advance the goal by one.');
check(!first.completedNow && !first.goal.completed, 'Goal should remain active below its target.');
equal(first.goal.evidence.length, 1, 'Evidence entry should be persisted in the returned goal.');
equal(first.goal.evidence[0].questId, 'quest-1', 'Evidence should preserve the stable quest ID.');

const linkedSkill = api.recordEvidence([baseGoal], { goalId: 'goal-1', questId: 'quest-skill', title: 'Solve equations', stat: 'mathematics', skillId: 'algebra.linear-equations', xp: 50 });
check(linkedSkill.ok && linkedSkill.goal.evidence[0].skillId === 'algebra.linear-equations', 'Quest evidence should preserve its stable Skill ID.');
const linkedProjection = api.evaluateLegacyCurriculum(linkedSkill.goal);
equal(capturedCurriculum.evidence[0].skillId, 'algebra.linear-equations', 'Curriculum projection should retain the Skill ID as a reference.');
equal(capturedCurriculum.evidence[0].skillVerification, null, 'Quest completion alone must never verify mastery.');

const duplicate = api.recordEvidence(first.goals, { goalId: 'goal-1', questId: 'quest-1', title: 'Practice linear equations', stat: 'mathematics', xp: 50 });
check(duplicate.ok && duplicate.duplicate, 'Repeated evidence for the same quest should be idempotent.');
equal(duplicate.goal.progressCount, 1, 'Duplicate quest evidence must not increase progress.');
equal(duplicate.goal.evidence.length, 1, 'Duplicate quest evidence must not be repeated.');

const second = api.recordEvidence(duplicate.goals, { goalId: 'goal-1', questId: 'quest-2', title: 'Solve quadratic examples', stat: 'mathematics', xp: 75, at: '2026-10-15T10:00:00.000Z' });
check(second.ok && second.completedNow, 'Reaching the target should complete the goal.');
equal(second.goal.progressCount, 2, 'Goal progress must stop at the configured target.');
check(second.goal.completed && second.goal.completionMode === 'evidence', 'Automatic completion should be explicitly marked as evidence-based.');
check(second.curriculumEvaluation && second.curriculumEvaluation.progressPercent === 100, 'Newly completed legacy Goal must pass the typed curriculum consistency gate.');
equal(second.curriculumEvaluation.completedMilestones, second.curriculumEvaluation.milestoneCount, 'All projected milestones must be complete before the Goal completion transaction proceeds.');
equal(second.goal.evidence.length, 2, 'Both unique quests should remain available as evidence.');

const afterComplete = api.recordEvidence(second.goals, { goalId: 'goal-1', questId: 'quest-3', title: 'Extra practice', stat: 'mathematics', xp: 10 });
check(afterComplete.ok && afterComplete.alreadyComplete, 'Completed Goal should not receive extra evidence progress.');
equal(afterComplete.goal.progressCount, 2, 'Completed Goal progress must remain capped.');

const mismatch = api.recordEvidence([baseGoal], { goalId: 'goal-1', questId: 'wrong-stat', title: 'Write a Python script', stat: 'computer', xp: 50 });
check(!mismatch.ok && mismatch.reason === 'stat_mismatch', 'Evidence from the wrong Stat must be rejected.');
equal(mismatch.goals[0].progressCount, 0, 'Rejected evidence must not mutate the original goal.');

const general = api.recordEvidence([{ id: 'general-goal', title: 'Build a habit', stat: null, targetCount: 1, evidence: [] }], {
  goalId: 'general-goal', questId: 'general-quest', title: 'Plan tomorrow', stat: 'global-skills', xp: 20
});
check(general.ok && general.completedNow, 'General Goal can accept valid evidence from any core Stat.');
equal(general.goal.stat, null, 'General Goal must remain branch-neutral.');

const missing = api.recordEvidence([], { goalId: 'deleted-goal', questId: 'quest-1', title: 'Old linked quest', stat: 'mathematics', xp: 10 });
check(missing.ok && missing.staleGoalId, 'Stale Goal references should be reported without blocking a Quest completion.');
const unlinked = api.recordEvidence([baseGoal], { questId: 'quest-1', title: 'Unlinked quest', stat: 'mathematics', xp: 10 });
check(unlinked.ok && !unlinked.matched, 'Unlinked Quest should not mutate Goal progress.');

const normalized = api.normalizeGoal({ id: 'legacy', title: 'Legacy goal', stat: 'unknown-stat', targetCount: 999, progressCount: 500, evidence: [{ questId: 'q', title: 'proof' }, { questId: 'q', title: 'duplicate' }] });
equal(normalized.stat, null, 'Unknown Stat in saved Goal should be normalized to general.');
equal(normalized.targetCount, 20, 'Goal target should be capped to the supported maximum.');
equal(normalized.progressCount, 1, 'Goal progress should be derived from unique evidence, not a corrupt saved counter.');
equal(normalized.evidence.length, 1, 'Legacy duplicate evidence records should be deduplicated.');
equal(normalized.progressCount, 1, 'Goal progress must derive from the deduplicated evidence ledger.');
equal(api.normalizeGoal({ id: 'valid-date', title: 'Leap day', targetDate: '2024-02-29' }).targetDate, '2024-02-29', 'A real leap day should be retained.');
equal(api.normalizeGoal({ id: 'bad-date', title: 'Invalid date', targetDate: '2026-02-29' }).targetDate, '', 'Impossible calendar dates should be discarded during Goal normalization.');
equal(api.normalizeGoal({ id: 'bad-evidence-date', title: 'Bad evidence', evidence: [{ questId: 'q1', title: 'Evidence', at: '2026-99-45' }] }).evidence.length, 0, 'Unparseable evidence timestamps should not be retained.');
equal(api.normalizeGoal({ id: '', title: 'Invalid' }), null, 'Goal without stable identity should be rejected.');


// Persisted completion: must agree with evidence and completion mode.
const inconsistentEvidenceCompletion = api.normalizeGoal({
  id: 'inconsistent-evidence-complete', title: 'Practice Algebra', targetCount: 2,
  progressCount: 2, completed: true, completionMode: 'evidence',
  evidence: [{ questId: 'q1', title: 'One proof', at: '2026-10-15T10:00:00.000Z' }]
});
check(!inconsistentEvidenceCompletion.completed && inconsistentEvidenceCompletion.completionMode === '',
  'A Goal marked evidence-complete without enough unique evidence must be reopened safely.');
equal(inconsistentEvidenceCompletion.progressCount, 1,
  'Inconsistent evidence-completion progress must be reconstructed from real evidence.');

const legacyManualCompletion = api.normalizeGoal({
  id: 'legacy-manual-complete', title: 'Legacy completed goal', targetCount: 3,
  progressCount: 0, completed: true, evidence: []
});
check(legacyManualCompletion.completed && legacyManualCompletion.completionMode === 'manual',
  'Legacy completed goals without a completionMode should remain completed as manual migrations.');

const completedByEvidenceLedger = api.normalizeGoal({
  id: 'repair-evidence-completion', title: 'Learn Python', targetCount: 2,
  progressCount: 0, completed: false, completionMode: '', evidence: [
    { questId: 'python-q1', title: 'Write variables', at: '2026-10-14T09:00:00.000Z' },
    { questId: 'python-q2', title: 'Write a loop', at: '2026-10-15T09:00:00.000Z' }
  ]
});
check(completedByEvidenceLedger.completed && completedByEvidenceLedger.completionMode === 'evidence',
  'A complete unique evidence ledger should repair a stale inactive completion flag.');
equal(completedByEvidenceLedger.progressCount, 2,
  'Repaired Goal progress should match the unique evidence ledger.');
equal(completedByEvidenceLedger.completedAt, '2026-10-15T09:00:00.000Z',
  'Evidence-based completion repair should use the latest evidence timestamp.');

const staleManualMode = api.normalizeGoal({
  id: 'stale-manual-mode', title: 'Incomplete goal', targetCount: 2,
  completed: false, completionMode: 'manual', evidence: []
});
check(!staleManualMode.completed && staleManualMode.completionMode === '',
  'An incomplete Goal must not retain the manual-completion marker.');

const legacySource = fs.readFileSync(path.join(ROOT, 'js/legacy/app-controller.js'), 'utf8');
const completionPlanSource = fs.readFileSync(path.join(ROOT, 'src/features/quest-completion-plan.ts'), 'utf8');
check(legacySource.includes('runSystemTransaction("Inventory redemption"'), 'Inventory redemption must use the rollback transaction helper.');
check(completionPlanSource.includes("type: 'custom-quest'") && completionPlanSource.includes('goalId,') && completionPlanSource.includes('questId, xp, coins') && completionPlanSource.includes('goalEvidence: goalId ? { goalId, questId, title, at: completedAt'), 'Typed Custom Quest completion plan must preserve stable Goal/Quest identities for reward history and evidence.');
check(legacySource.includes('SYSTEMGoalProgress.recordEvidence') && legacySource.includes('recordEvidence(getGoals(), plan.goalEvidence)'), 'Custom Quest completion must feed the typed evidence request to the Goal progress engine.');
check(legacySource.includes('evaluateLegacyCurriculum(goal)') && legacySource.includes('Milestone path'), 'Goals UI should render read-only milestone evaluation from the curriculum bridge.');
check(legacySource.includes('const instanceId = typeof item.instanceId === "string" ? item.instanceId : item.id;') && legacySource.includes('itemId: typeof item.itemId === "string" && item.itemId ? item.itemId : instanceId'), 'Legacy Inventory records must be normalized to the current UI identity.');
const typedQuestSource = fs.readFileSync(path.join(ROOT, 'src/features/quest-command.ts'), 'utf8');
check(legacySource.includes('domain.normalizeLegacyCustomQuests') && typedQuestSource.includes('const seenIds = new Set<string>()')
  && typedQuestSource.includes('seenIds.has(item.id)'), 'Custom Quest ID normalization and duplicate filtering must be owned by the typed Quest domain.');
check(completionPlanSource.includes("type: 'custom-quest'") && completionPlanSource.includes('goalId,') && completionPlanSource.includes('questId, xp, coins') && completionPlanSource.includes('goalEvidence: goalId ? { goalId, questId, title, at: completedAt'), 'Typed Custom Quest completion plan must preserve stable Goal/Quest identities for reward history and evidence.');
check(completionPlanSource.includes("type: 'custom-quest'") && completionPlanSource.includes('goalId,') && completionPlanSource.includes('questId, xp, coins') && completionPlanSource.includes('goalEvidence: goalId ? { goalId, questId, title, at: completedAt'), 'Typed Custom Quest completion plan must preserve stable Goal/Quest identities for reward history and evidence.');
console.log(`SYSTEM goal evidence tests passed: ${checks} checks.`);
