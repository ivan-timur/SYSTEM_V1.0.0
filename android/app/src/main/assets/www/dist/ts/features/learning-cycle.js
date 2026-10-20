/**
 * End-to-end, pure learning-cycle coordinator.
 * Connects validated goal curriculum state to adaptive recommendations without
 * granting XP, mutating storage, or treating quest completion as skill mastery.
 */
import { evaluateGoalCurriculum, validateGoalCurriculum } from './goal-curriculum.js';
import { recommendAdaptiveLearningPath } from './adaptive-learning-path.js';
/** Create evidence only from a completed quest that belongs to this goal/milestone. */
export function createCompletedQuestEvidence(goalValue, quest, evidenceId, at, skillVerification = null) {
    const goal = validateGoalCurriculum(goalValue);
    const clean = (v, label) => {
        if (typeof v !== 'string' || !v.trim() || v !== v.trim() || v.length > 200)
            throw new Error(`${label} is invalid`);
        return v;
    };
    if (!quest || typeof quest !== 'object')
        throw new Error('Quest record is required');
    const questId = clean(quest.id, 'Quest ID');
    const title = clean(quest.title, 'Quest title');
    const id = clean(evidenceId, 'Evidence ID');
    if (quest.completed !== true)
        throw new Error('Evidence can only be created from a completed quest');
    if (quest.goalId !== goal.id)
        throw new Error('Quest does not belong to this goal');
    const milestoneId = clean(quest.milestoneId, 'Milestone ID');
    if (!goal.milestones.some(m => m.id === milestoneId))
        throw new Error('Quest references an unknown milestone');
    if (goal.evidence.some(e => e.id === id))
        throw new Error('Evidence ID already exists');
    if (goal.evidence.some(e => e.questId === questId && e.milestoneId === milestoneId))
        throw new Error('Quest already has evidence for this milestone');
    const milestoneState = evaluateGoalCurriculum(goal).milestones.find(milestone => milestone.id === milestoneId);
    if (!milestoneState?.unlocked)
        throw new Error('Milestone is locked until its prerequisites are complete');
    if (milestoneState.complete)
        throw new Error('Milestone is already complete and cannot accept additional evidence');
    if (typeof at !== 'string' || !Number.isFinite(Date.parse(at)))
        throw new Error('Evidence timestamp is invalid');
    const stat = quest.stat || null;
    if (stat !== null && stat !== goal.stat && goal.stat !== null)
        throw new Error('Quest Stat does not match the goal Stat');
    const skillId = quest.skillId || null;
    if (skillVerification) {
        if (!skillId)
            throw new Error('Skill verification requires a linked skill');
        if (!['assessment', 'project-review', 'manual-check'].includes(skillVerification.method))
            throw new Error('Skill verification method is invalid');
        if (typeof skillVerification.verifiedAt !== 'string' || !Number.isFinite(Date.parse(skillVerification.verifiedAt)))
            throw new Error('Skill verification timestamp is invalid');
        if (typeof skillVerification.score !== 'number' || !Number.isFinite(skillVerification.score) || skillVerification.score < 80 || skillVerification.score > 100) {
            throw new Error('Skill verification score must be between 80 and 100');
        }
    }
    return { id, questId, milestoneId, title, at, stat: stat, skillId, skillVerification, passed: true };
}
/**
 * Evaluate one complete cycle. Active milestone selection is deterministic:
 * first unlocked incomplete milestone in the goal's declared order.
 */
export function evaluateLearningCycle(input) {
    if (!input || !input.adaptive)
        throw new Error('Learning-cycle input is required');
    const goal = validateGoalCurriculum(input.goal);
    const completedIds = input.adaptive.completedQuestIds ?? [];
    if (!Array.isArray(completedIds))
        throw new Error('Completed Quest IDs must be a list');
    const seenCompletedIds = new Set();
    for (const completedId of completedIds) {
        if (typeof completedId !== 'string' || !completedId.trim() || completedId !== completedId.trim() || completedId.length > 200) {
            throw new Error('Completed Quest IDs contain an invalid ID');
        }
        if (seenCompletedIds.has(completedId))
            throw new Error('Completed Quest IDs must be unique');
        seenCompletedIds.add(completedId);
    }
    if (input.activeGoalId !== undefined && input.activeGoalId !== null &&
        (typeof input.activeGoalId !== 'string' || !input.activeGoalId.trim() || input.activeGoalId !== input.activeGoalId.trim() || input.activeGoalId.length > 200)) {
        throw new Error('Active Goal ID is invalid');
    }
    const evaluation = evaluateGoalCurriculum(goal);
    const activeMilestoneId = evaluation.milestones.find(m => m.unlocked && !m.complete)?.id ?? null;
    const goalMatchesActiveGoal = !input.activeGoalId || input.activeGoalId === goal.id;
    const adaptiveInput = {
        ...input.adaptive,
        activeGoalId: goalMatchesActiveGoal ? goal.id : input.activeGoalId,
        activeMilestoneId: goalMatchesActiveGoal ? activeMilestoneId : null,
    };
    const learningPlan = recommendAdaptiveLearningPath(adaptiveInput);
    const completedQuestIdsUnique = true; // Validated before planning, before any result is produced.
    const current = activeMilestoneId ? evaluation.milestones.find(m => m.id === activeMilestoneId) : null;
    const nextAction = evaluation.alreadyCompleted
        ? 'goal-complete'
        : !goalMatchesActiveGoal
            ? 'create-relevant-quests'
            : !activeMilestoneId
                ? 'goal-complete'
                : current && current.evidenceCount < current.evidenceRequired
                    ? learningPlan.recommendations.length ? 'work-on-recommendation' : 'complete-milestone-evidence'
                    : current && current.requiredSkillIds.some(id => !current.verifiedSkillIds.includes(id))
                        ? 'verify-required-skills'
                        : learningPlan.recommendations.length ? 'work-on-recommendation' : 'create-relevant-quests';
    return { goal, evaluation, learningPlan, activeMilestoneId, nextAction,
        diagnostics: { goalMatchesActiveGoal, completedQuestIdsUnique, rewardsIssued: false } };
}
