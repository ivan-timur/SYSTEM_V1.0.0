/**
 * Phase 3 curriculum command boundary.
 * Provides immutable, validated commands for authoring milestones and recording
 * completed-quest evidence. It deliberately never writes storage or grants rewards;
 * callers must persist the returned snapshot inside their existing transaction.
 */
import { evaluateGoalCurriculum, validateGoalCurriculum, } from './goal-curriculum.js';
import { createCompletedQuestEvidence } from './learning-cycle.js';
function cleanId(value, label) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 200) {
        throw new Error(`${label} must be a non-empty trimmed ID of at most 200 characters`);
    }
    return value;
}
/** Add a milestone only when its prerequisites already exist and the graph remains valid. */
export function addCurriculumMilestone(goalValue, milestoneValue) {
    const goal = validateGoalCurriculum(goalValue);
    if (goal.completed)
        throw new Error('Completed goals cannot be edited');
    if (!milestoneValue || typeof milestoneValue !== 'object' || Array.isArray(milestoneValue)) {
        throw new Error('Milestone definition must be an object');
    }
    const raw = milestoneValue;
    const id = cleanId(raw.id, 'Milestone ID');
    if (goal.milestones.some(item => item.id === id))
        throw new Error(`Duplicate Milestone ID: ${id}`);
    const milestone = {
        id,
        title: typeof raw.title === 'string' ? raw.title.trim() : '',
        requiredEvidence: raw.requiredEvidence,
        requiredSkillIds: raw.requiredSkillIds === undefined ? [] : raw.requiredSkillIds,
        prerequisiteIds: raw.prerequisiteIds === undefined ? [] : raw.prerequisiteIds,
    };
    // Validate the complete proposed graph before returning a changed snapshot.
    const proposed = validateGoalCurriculum({ ...goal, milestones: [...goal.milestones, milestone] });
    return { goal: proposed, evaluation: evaluateGoalCurriculum(proposed), changed: true, command: 'add-milestone', rewardIssued: false };
}
/**
 * Append evidence from a completed, goal-linked quest. Validation and evaluation
 * occur before returning, so a caller can persist atomically or discard the plan.
 */
export function recordCurriculumEvidence(goalValue, quest, evidenceId, at, skillVerification = null) {
    const goal = validateGoalCurriculum(goalValue);
    if (goal.completed)
        throw new Error('Completed goals cannot accept new evidence');
    const evidence = createCompletedQuestEvidence(goal, quest, evidenceId, at, skillVerification);
    const proposed = validateGoalCurriculum({ ...goal, evidence: [...goal.evidence, evidence] });
    return { goal: proposed, evaluation: evaluateGoalCurriculum(proposed), changed: true, command: 'record-evidence', rewardIssued: false };
}
/** A read-only decision for transaction adapters; completion is never a payout command. */
export function getCurriculumCompletionDecision(goalValue) {
    const goal = validateGoalCurriculum(goalValue);
    const evaluation = evaluateGoalCurriculum(goal);
    return { goalId: goal.id, eligible: evaluation.readyToComplete, alreadyCompleted: evaluation.alreadyCompleted,
        progressPercent: evaluation.progressPercent, rewardIssued: false };
}
