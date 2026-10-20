/**
 * Typed orchestration plans for legacy Custom/Boss Quest completion.
 *
 * These pure functions decide which state changes are permitted and which reward
 * commands are emitted. They do not touch DOM, localStorage, or player state;
 * the compatibility controller executes the plan inside SYSTEM's rollback
 * transaction so the established save format remains stable during migration.
 */
import { SYSTEM_STAT_IDS } from '../core/reward-command.js';
import { canCompleteCustomQuest, getBossQuestDefinitions, getBossQuestStatus } from './quest-command.js';
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function requiredId(value, label) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 200) {
        throw new Error(`${label} must be a non-empty trimmed ID of at most 200 characters`);
    }
    return value;
}
function safeRewardInteger(value, label, min, max) {
    if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) {
        throw new Error(`${label} must be an integer from ${min} to ${max}`);
    }
    return Number(value);
}
/** Create a deterministic execution plan for a valid, not-yet-completed Custom Quest. */
export function planCustomQuestCompletion(value, completedAt = new Date().toISOString()) {
    if (!canCompleteCustomQuest(value) || !isRecord(value))
        return null;
    if (typeof completedAt !== 'string' || !Number.isFinite(Date.parse(completedAt))) {
        throw new Error('Custom Quest completion timestamp is invalid');
    }
    const questId = requiredId(value.id, 'Custom Quest ID');
    const title = typeof value.title === 'string' ? value.title.trim() : '';
    if (!title || title.length > 80)
        throw new Error('Custom Quest title is invalid');
    const xp = safeRewardInteger(value.xp, 'Custom Quest XP', 5, 1000);
    const coins = safeRewardInteger(value.coins, 'Custom Quest Coins', 0, 500);
    const stat = value.stat === null || value.stat === undefined || value.stat === '' ? null : value.stat;
    if (stat !== null && (typeof stat !== 'string' || !SYSTEM_STAT_IDS.includes(stat))) {
        throw new Error('Custom Quest Stat is invalid');
    }
    // Preserve the old adapter's behavior for forward-compatible saves: a Skill
    // is only credited when its parent Stat is known. General missions discard a
    // stale Skill hint instead of becoming impossible to complete after upgrade.
    const skillCandidate = value.skillId === null || value.skillId === undefined || value.skillId === '' ? null : value.skillId;
    if (skillCandidate !== null && (typeof skillCandidate !== 'string' || !skillCandidate.trim() || skillCandidate !== skillCandidate.trim() || skillCandidate.length > 200)) {
        throw new Error('Custom Quest Skill assignment is invalid');
    }
    const skillId = stat === null ? null : skillCandidate;
    const goalId = value.goalId === null || value.goalId === undefined || value.goalId === '' ? null : requiredId(value.goalId, 'Custom Quest Goal ID');
    const description = typeof value.description === 'string' ? value.description.slice(0, 180) : '';
    return {
        questId,
        completedAt,
        progressField: 'totalCustomQuestsCompleted',
        reward: {
            type: 'custom-quest', title, matchingText: `${title} ${description}`.slice(0, 320),
            stat: stat, skillId: skillId, goalId,
            questId, xp, coins,
        },
        goalEvidence: goalId ? { goalId, questId, title, at: completedAt, stat: stat, skillId: skillId, xp } : null,
    };
}
/** Return a reward plan only when this known Boss Quest is currently eligible and unclaimed. */
export function planBossQuestClaim(value) {
    if (!isRecord(value))
        return null;
    let questId;
    try {
        questId = requiredId(value.questId, 'Boss Quest ID');
    }
    catch {
        return null;
    }
    const claimedIds = Array.isArray(value.claimedIds) ? value.claimedIds.filter((item) => typeof item === 'string') : [];
    if (claimedIds.includes(questId))
        return null;
    const status = getBossQuestStatus(questId, value.snapshot);
    if (!status || !status.eligible)
        return null;
    const quest = getBossQuestDefinitions().find(item => item.id === questId);
    if (!quest)
        return null;
    return {
        questId,
        title: quest.title,
        progressField: 'totalBossQuestsCompleted',
        reward: {
            type: 'boss-quest', questId: quest.id, title: quest.title, stat: null, skillId: null,
            xp: quest.xp, coins: quest.coins,
        },
    };
}
/**
 * Interpret the legacy Goal evidence helper's result into one safe action.
 * Mismatched/stale links are detached, invalid processing aborts the encompassing
 * transaction, and only newly completed Goals receive the fixed completion bonus.
 */
export function planGoalEvidenceDecision(value) {
    if (!isRecord(value))
        return { action: 'abort', reason: 'Goal evidence result is not an object' };
    if (value.ok !== true) {
        if (value.reason === 'stat_mismatch')
            return { action: 'detach-link', reason: 'stat-mismatch' };
        return { action: 'abort', reason: typeof value.reason === 'string' ? value.reason : 'Goal evidence validation failed' };
    }
    if (value.staleGoalId === true)
        return { action: 'detach-link', reason: 'stale-goal' };
    // A duplicate/already-complete response is an intentional idempotent no-op.
    // A merely unmatched result is not: silently accepting it would complete and
    // reward the Quest while dropping its requested Goal evidence.
    if (value.alreadyComplete === true || value.duplicate === true)
        return { action: 'no-op' };
    if (value.matched !== true)
        return { action: 'abort', reason: 'Goal evidence did not match an active Goal and milestone' };
    if (!Array.isArray(value.goals))
        return { action: 'abort', reason: 'Goal evidence result omitted the updated Goal collection' };
    if (value.completedNow !== true)
        return { action: 'persist-goals', goals: value.goals, completionReward: null };
    // When the runtime curriculum bridge is available, require it to agree with
    // the legacy evidence target before authorizing the one-time Goal bonus. Older
    // compatible helper results without this optional field remain supported.
    if (value.curriculumEvaluation !== undefined) {
        const evaluation = value.curriculumEvaluation;
        if (!isRecord(evaluation)
            || !Number.isSafeInteger(evaluation.milestoneCount) || Number(evaluation.milestoneCount) < 1
            || !Number.isSafeInteger(evaluation.completedMilestones)
            || Number(evaluation.completedMilestones) !== Number(evaluation.milestoneCount)
            || evaluation.progressPercent !== 100) {
            return { action: 'abort', reason: 'Goal curriculum evaluation disagrees with completion state' };
        }
    }
    if (!isRecord(value.goal))
        return { action: 'abort', reason: 'Goal completion result omitted the completed Goal' };
    let goalId;
    try {
        goalId = requiredId(value.goal.id, 'Completed Goal ID');
    }
    catch {
        return { action: 'abort', reason: 'Completed Goal identity is invalid' };
    }
    if (typeof value.goal.title !== 'string' || !value.goal.title.trim() || value.goal.title.trim().length > 100) {
        return { action: 'abort', reason: 'Completed Goal title is invalid' };
    }
    const storedGoal = value.goals.find(item => isRecord(item) && item.id === goalId);
    if (!isRecord(storedGoal) || storedGoal.completed !== true || storedGoal.completionMode !== 'evidence'
        || typeof storedGoal.title !== 'string' || !storedGoal.title.trim() || storedGoal.title.trim().length > 100) {
        return { action: 'abort', reason: 'Completed Goal is not present as a valid evidence-completed record in the persisted plan' };
    }
    const rawStat = storedGoal.stat;
    const stat = rawStat === null || rawStat === undefined || rawStat === '' ? null : rawStat;
    if (stat !== null && (typeof stat !== 'string' || !SYSTEM_STAT_IDS.includes(stat))) {
        return { action: 'abort', reason: 'Completed Goal Stat is invalid' };
    }
    // Evidence-based Goal completion is keyed by the Goal, not by whichever linked
    // Custom Quest happened to push it over the target, preventing a second payout.
    let evidenceQuestId;
    try {
        evidenceQuestId = requiredIdFromEvidence(storedGoal, value.goals);
    }
    catch {
        return { action: 'abort', reason: 'Completed Goal evidence has no valid Quest ID' };
    }
    return {
        action: 'persist-goals',
        goals: value.goals,
        completionReward: {
            type: 'goal-evidence-completion', title: storedGoal.title.trim(), stat: stat,
            goalId, questId: evidenceQuestId, xp: 50, coins: 10,
        },
    };
}
function requiredIdFromEvidence(goal, goals) {
    // Prefer explicit completing activity metadata attached by the adapter. Older
    // Goal helper results don't include it, so derive the final evidence ID from
    // the evidence record that belongs to the just-completed Goal.
    const evidence = Array.isArray(goal.evidence) ? goal.evidence : [];
    const last = evidence.length ? evidence[evidence.length - 1] : null;
    if (isRecord(last))
        return requiredId(last.questId, 'Goal evidence Quest ID');
    // Defensive fallback for compatible helper results: find the latest normalized
    // Goal entry and use its final evidence record, never invent an ID.
    const id = typeof goal.id === 'string' ? goal.id : '';
    const stored = goals.find(item => isRecord(item) && item.id === id);
    if (isRecord(stored) && Array.isArray(stored.evidence) && stored.evidence.length) {
        const item = stored.evidence[stored.evidence.length - 1];
        if (isRecord(item))
            return requiredId(item.questId, 'Goal evidence Quest ID');
    }
    throw new Error('Completed Goal evidence has no Quest ID');
}
