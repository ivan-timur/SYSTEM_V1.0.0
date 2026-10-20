/* SYSTEM — evidence-based Goal progress.
   Pure, local-first helpers. This module never awards XP or writes storage; callers
   must perform state changes inside runSystemTransaction(). */
(function attachSYSTEMGoalProgress(root) {
    'use strict';

    const VALID_STATS = new Set([
        'entrepreneurship', 'global-skills', 'mathematics',
        'computer', 'physics', 'unique-thinking'
    ]);
    const MAX_TARGET = 20;
    const MAX_EVIDENCE = 20;
    const boundedInt = (value, min, max, fallback) => {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
    };
    const safeText = (value, maxLength, fallback = '') =>
        typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback;
    const isValidDateOnly = value => {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    };
    const isValidTimestamp = value => {
        if (typeof value !== 'string' || value.length > 80) return false;
        const match = value.match(/^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/);
        return Boolean(match && isValidDateOnly(match[1]) && Number.isFinite(Date.parse(value)));
    };

    function normalizeEvidence(entry) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
        const questId = safeText(entry.questId, 200);
        const title = safeText(entry.title, 180);
        const rawAt = safeText(entry.at, 80);
        if (!questId || !title || (rawAt && !isValidTimestamp(rawAt))) return null;
        return {
            questId,
            title,
            at: rawAt || new Date(0).toISOString(),
            stat: VALID_STATS.has(entry.stat) ? entry.stat : null,
            skillId: typeof entry.skillId === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}._:-]{0,199}$/u.test(entry.skillId) ? entry.skillId : null,
            xp: boundedInt(entry.xp, 0, 1_000_000, 0)
        };
    }

    function normalizeGoal(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const id = safeText(value.id, 200);
        const title = safeText(value.title, 100);
        if (!id || !title) return null;
        const targetCount = boundedInt(value.targetCount, 1, MAX_TARGET, 3);
        const evidenceInput = Array.isArray(value.evidence) ? value.evidence : [];
        const seenQuestIds = new Set();
        const evidence = evidenceInput.map(normalizeEvidence).filter(item => {
            if (!item || seenQuestIds.has(item.questId)) return false;
            seenQuestIds.add(item.questId);
            return true;
        }).slice(-MAX_EVIDENCE);
        // Progress is a projection of unique evidence, not a trusted independent counter.
        // Completion mode must agree with the evidence ledger. A stale/corrupt
        // `completed: true` must not bypass an explicitly evidence-based target.
        const progressCount = Math.min(targetCount, evidence.length);
        const requestedMode = ['evidence', 'manual'].includes(value.completionMode) ? value.completionMode : '';
        let completed = false;
        let completionMode = '';
        if (requestedMode === 'evidence') {
            completed = progressCount >= targetCount;
            completionMode = completed ? 'evidence' : '';
        } else if (value.completed === true) {
            // Older versions let the user mark a Goal complete manually and did not
            // always persist a completionMode. Preserve that behavior as a migration.
            completed = true;
            completionMode = 'manual';
        } else if (progressCount >= targetCount) {
            // Repair a stale completion flag from a complete, unique evidence ledger.
            // This repairs state only; it does not issue XP/Coins, avoiding duplicate
            // payouts during load or data normalization.
            completed = true;
            completionMode = 'evidence';
        }
        let completedAt = safeText(value.completedAt, 80, '');
        if (completedAt && !isValidTimestamp(completedAt)) completedAt = '';
        if (!completed) completedAt = '';
        if (completed && completionMode === 'evidence' && !completedAt) {
            const latestEvidence = evidence[evidence.length - 1];
            if (latestEvidence && latestEvidence.at !== new Date(0).toISOString()) completedAt = latestEvidence.at;
        }
        return {
            ...value,
            id,
            title,
            stat: VALID_STATS.has(value.stat) ? value.stat : null,
            targetDate: isValidDateOnly(value.targetDate) ? value.targetDate : '',
            targetCount,
            progressCount,
            evidence,
            completed,
            createdAt: safeText(value.createdAt, 80, ''),
            completedAt,
            completionMode
        };
    }

    /**
     * Project an existing legacy Goal into the typed curriculum definition.
     * Each existing target slot is one sequential evidence milestone. This is a
     * read-only adapter: it never writes, awards XP, or claims skill mastery.
     */
    function toLegacyCurriculum(value) {
        const goal = normalizeGoal(value);
        if (!goal) return null;
        const milestones = Array.from({ length: goal.targetCount }, (_, index) => ({
            id: `legacy-${String(goal.id).slice(0, 150)}-${index + 1}`,
            title: `Linked quest ${index + 1}`,
            requiredEvidence: 1,
            requiredSkillIds: [],
            prerequisiteIds: index ? [`legacy-${String(goal.id).slice(0, 150)}-${index}`] : [],
        }));
        const evidence = goal.evidence.slice(0, goal.targetCount).map((item, index) => ({
            id: `legacy-evidence-${index + 1}`,
            questId: item.questId,
            milestoneId: milestones[index].id,
            title: item.title,
            at: item.at,
            // Older evidence may omit its Stat; preserve the old Goal's branch semantics.
            stat: goal.stat || item.stat || null,
            skillId: item.skillId || null,
            // Legacy evidence indicates completion only, never skill mastery.
            skillVerification: null,
            passed: true,
        }));
        return { id: goal.id, title: goal.title, stat: goal.stat || null, milestones, evidence, completed: goal.completed };
    }

    function evaluateLegacyCurriculum(value) {
        const curriculumApi = root.SYSTEMGoalCurriculum;
        if (!curriculumApi || typeof curriculumApi.evaluate !== 'function') return null;
        const definition = toLegacyCurriculum(value);
        if (!definition) return null;
        try {
            return curriculumApi.evaluate(definition);
        } catch (error) {
            // A diagnostic bridge must never break the legacy Goals screen.
            return null;
        }
    }

    function recordEvidence(goalValues, activity = {}) {
        if (!Array.isArray(goalValues)) return { ok: false, reason: 'invalid_goal_list' };
        const goals = goalValues.map(normalizeGoal).filter(Boolean);
        const goalId = safeText(activity.goalId, 200);
        const questId = safeText(activity.questId, 200);
        const title = safeText(activity.title, 180);
        if (!goalId) return { ok: true, goals, matched: false, completedNow: false };
        if (!questId || !title) return { ok: false, reason: 'invalid_activity' };

        const index = goals.findIndex(goal => goal.id === goalId);
        if (index < 0) return { ok: true, goals, matched: false, staleGoalId: true, completedNow: false };
        const goal = goals[index];
        if (goal.completed) return { ok: true, goals, matched: true, goal, completedNow: false, alreadyComplete: true };
        if (goal.evidence.some(item => item.questId === questId)) {
            return { ok: true, goals, matched: true, goal, completedNow: false, duplicate: true };
        }
        const activityStat = VALID_STATS.has(activity.stat) ? activity.stat : null;
        if (goal.stat && activityStat !== goal.stat) return { ok: false, reason: 'stat_mismatch', goal, goals };

        const evidence = normalizeEvidence({
            questId,
            title,
            at: safeText(activity.at, 80) || new Date().toISOString(),
            stat: activityStat,
            skillId: activity.skillId,
            xp: activity.xp
        });
        if (!evidence) return { ok: false, reason: 'invalid_activity', goal, goals };

        const next = {
            ...goal,
            evidence: [...goal.evidence, evidence].slice(-MAX_EVIDENCE),
            progressCount: Math.min(goal.targetCount, goal.progressCount + 1)
        };
        const completedNow = next.progressCount >= next.targetCount;
        if (completedNow) {
            next.completed = true;
            next.completedAt = evidence.at;
            next.completionMode = 'evidence';
        }
        goals[index] = next;
        // The typed curriculum is the second, read-only consistency gate for the
        // legacy target counter. It does not replace the existing transaction or
        // issue rewards; the transaction planner decides whether a completion bonus
        // may be committed.
        const curriculumEvaluation = evaluateLegacyCurriculum(next);
        if (curriculumEvaluation && completedNow) {
            const milestonesConsistent = curriculumEvaluation.milestoneCount > 0
                && curriculumEvaluation.completedMilestones === curriculumEvaluation.milestoneCount
                && curriculumEvaluation.progressPercent === 100;
            if (!milestonesConsistent) {
                return { ok: false, reason: 'curriculum_inconsistent', goals: goalValues, goal };
            }
        }
        return { ok: true, goals, matched: true, goal: next, completedNow, duplicate: false, curriculumEvaluation };
    }

    root.SYSTEMGoalProgress = Object.freeze({
        version: '9.0.0',
        maxTarget: MAX_TARGET,
        maxEvidence: MAX_EVIDENCE,
        normalizeGoal,
        toLegacyCurriculum,
        evaluateLegacyCurriculum,
        recordEvidence
    });
})(typeof window !== 'undefined' ? window : globalThis);
