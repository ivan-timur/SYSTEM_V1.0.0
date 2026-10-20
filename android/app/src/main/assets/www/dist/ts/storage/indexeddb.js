/** Typed IndexedDB persistence for the TypeScript progression domain.
 * Legacy localStorage remains untouched until an explicit, tested migration is performed.
 */
import { advanceXPTrack, completeQuest } from '../core/progression.js';
import { SYSTEM_CORE_DAILY_QUEST_IDS } from '../data/quest-catalog.js';
import { calculateDailyQuestStreak } from '../core/daily-quest-streak.js';
import { getCanonicalDomainQuestId, getLegacyDomainQuestIdAliases } from '../core/reward-command.js';
import { evaluateGoalCurriculum, validateGoalCurriculum } from '../features/goal-curriculum.js';
import { recordCurriculumEvidence } from '../features/curriculum-command.js';
export const SYSTEM_DB_NAME = 'system-progress';
/** Version 7 adds transactional curriculum and append-only Goal evidence stores. */
export const SYSTEM_DB_VERSION = 7;
export const SYSTEM_PLAYER_KEY = 'main';
export const SYSTEM_STORES = ['player', 'quests', 'xp_events', 'achievements', 'seasons', 'skills', 'stats', 'activity_history', 'migrations', 'app_state', 'daily_prizes', 'assessment_attempts', 'skill_assessments', 'goal_curricula', 'goal_evidence'];
function errorFrom(value, fallback) {
    return value instanceof Error ? value : new Error(value instanceof DOMException && value.message ? value.message : fallback);
}
export function openSystemDatabase() {
    if (typeof indexedDB === 'undefined')
        return Promise.reject(new Error('IndexedDB is not available in this environment'));
    return new Promise((resolve, reject) => {
        let settled = false;
        const request = indexedDB.open(SYSTEM_DB_NAME, SYSTEM_DB_VERSION);
        const rejectOnce = (error) => {
            if (settled)
                return;
            settled = true;
            reject(error);
        };
        request.onupgradeneeded = () => {
            const db = request.result;
            const upgradeTransaction = request.transaction;
            if (!upgradeTransaction) {
                rejectOnce(new Error('SYSTEM database upgrade transaction is unavailable'));
                return;
            }
            if (!db.objectStoreNames.contains('player'))
                db.createObjectStore('player', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('quests'))
                db.createObjectStore('quests', { keyPath: 'id' });
            const xpEvents = db.objectStoreNames.contains('xp_events')
                ? upgradeTransaction.objectStore('xp_events')
                : db.createObjectStore('xp_events', { keyPath: 'id' });
            // Existing version-1 databases may have the store but not both indexes.
            if (!xpEvents.indexNames.contains('createdAt'))
                xpEvents.createIndex('createdAt', 'createdAt');
            if (!xpEvents.indexNames.contains('questId'))
                xpEvents.createIndex('questId', 'questId');
            if (!db.objectStoreNames.contains('achievements'))
                db.createObjectStore('achievements', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('seasons'))
                db.createObjectStore('seasons', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('skills'))
                db.createObjectStore('skills', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('stats'))
                db.createObjectStore('stats', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('activity_history')) {
                const history = db.createObjectStore('activity_history', { keyPath: 'id' });
                history.createIndex('at', 'at');
                history.createIndex('type', 'type');
                history.createIndex('eventId', 'eventId');
            }
            else {
                const history = upgradeTransaction.objectStore('activity_history');
                if (!history.indexNames.contains('at'))
                    history.createIndex('at', 'at');
                if (!history.indexNames.contains('type'))
                    history.createIndex('type', 'type');
                if (!history.indexNames.contains('eventId'))
                    history.createIndex('eventId', 'eventId');
            }
            if (!db.objectStoreNames.contains('migrations'))
                db.createObjectStore('migrations', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('app_state'))
                db.createObjectStore('app_state', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('daily_prizes'))
                db.createObjectStore('daily_prizes', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('assessment_attempts')) {
                const assessments = db.createObjectStore('assessment_attempts', { keyPath: 'attemptId' });
                assessments.createIndex('assessedAt', 'assessedAt');
                assessments.createIndex('assessmentId', 'assessmentId');
            }
            else {
                const assessments = upgradeTransaction.objectStore('assessment_attempts');
                if (!assessments.indexNames.contains('assessedAt'))
                    assessments.createIndex('assessedAt', 'assessedAt');
                if (!assessments.indexNames.contains('assessmentId'))
                    assessments.createIndex('assessmentId', 'assessmentId');
            }
            if (!db.objectStoreNames.contains('skill_assessments')) {
                const skillAssessments = db.createObjectStore('skill_assessments', { keyPath: 'id' });
                skillAssessments.createIndex('at', 'at');
                skillAssessments.createIndex('questSkillEvidence', ['questId', 'skillId']);
            }
            else {
                const skillAssessments = upgradeTransaction.objectStore('skill_assessments');
                if (!skillAssessments.indexNames.contains('at'))
                    skillAssessments.createIndex('at', 'at');
                if (!skillAssessments.indexNames.contains('questSkillEvidence'))
                    skillAssessments.createIndex('questSkillEvidence', ['questId', 'skillId']);
            }
            // New stores are opt-in durable command targets. Existing localStorage Goals
            // are intentionally not copied here without the explicit migration approval.
            if (!db.objectStoreNames.contains('goal_curricula'))
                db.createObjectStore('goal_curricula', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('goal_evidence')) {
                const evidence = db.createObjectStore('goal_evidence', { keyPath: 'id' });
                evidence.createIndex('goalId', 'goalId');
                evidence.createIndex('questId', 'questId');
                evidence.createIndex('goalMilestoneQuest', ['goalId', 'milestoneId', 'questId'], { unique: true });
            }
            else {
                const evidence = upgradeTransaction.objectStore('goal_evidence');
                if (!evidence.indexNames.contains('goalId'))
                    evidence.createIndex('goalId', 'goalId');
                if (!evidence.indexNames.contains('questId'))
                    evidence.createIndex('questId', 'questId');
                if (!evidence.indexNames.contains('goalMilestoneQuest'))
                    evidence.createIndex('goalMilestoneQuest', ['goalId', 'milestoneId', 'questId'], { unique: true });
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            // If an onblocked error was already returned, close any late-opened connection.
            if (settled) {
                db.close();
                return;
            }
            settled = true;
            // Never keep a tab's connection open while another tab is attempting a schema upgrade.
            db.onversionchange = () => db.close();
            resolve(db);
        };
        request.onerror = () => rejectOnce(errorFrom(request.error, 'Could not open SYSTEM database'));
        request.onblocked = () => rejectOnce(new Error('SYSTEM database upgrade is blocked by another open tab'));
    });
}
/**
 * Resolve a persisted Quest by preferred canonical ID, then explicitly supplied
 * compatibility aliases. Reads each exact key in one readonly transaction and
 * returns the canonical candidate first when both formats exist.
 */
export async function findPersistedQuestByCandidates(ids) {
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 8) {
        throw new Error('Quest lookup requires between one and eight candidate IDs');
    }
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length !== ids.length)
        throw new Error('Quest lookup candidate IDs must be unique');
    for (const id of uniqueIds) {
        if (typeof id !== 'string' || !id.trim() || id !== id.trim() || id.length > 280) {
            throw new Error('Quest lookup contains an invalid candidate ID');
        }
    }
    const db = await openSystemDatabase();
    try {
        return await new Promise((resolve, reject) => {
            let failure;
            const values = new Map();
            const tx = db.transaction(['quests'], 'readonly');
            const fail = (value) => {
                failure ??= errorFrom(value, 'Could not resolve a persisted SYSTEM Quest');
                try {
                    tx.abort();
                }
                catch { /* A readonly transaction may already be inactive. */ }
            };
            tx.oncomplete = () => {
                if (failure) {
                    reject(failure);
                    return;
                }
                for (const id of uniqueIds) {
                    const value = values.get(id);
                    if (isRecord(value) && value.id === id) {
                        resolve(value);
                        return;
                    }
                }
                resolve(undefined);
            };
            tx.onerror = () => { failure ??= errorFrom(tx.error, 'Could not resolve a persisted SYSTEM Quest'); };
            tx.onabort = () => reject(failure ?? errorFrom(tx.error, 'Quest lookup transaction was aborted'));
            for (const id of uniqueIds) {
                const request = tx.objectStore('quests').get(id);
                request.onsuccess = () => { values.set(id, request.result); };
                request.onerror = () => fail(request.error ?? new Error(`Could not read Quest ${id}`));
            }
        });
    }
    finally {
        db.close();
    }
}
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function requireCurriculumId(value, label) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 200) {
        throw new Error(`${label} must be a non-empty trimmed ID of at most 200 characters`);
    }
    return value;
}
/** Create a typed curriculum record in IndexedDB without touching legacy localStorage. */
export async function createGoalCurriculumInDatabase(value) {
    const goal = validateGoalCurriculum(value);
    const db = await openSystemDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(['goal_curricula'], 'readwrite');
            const store = tx.objectStore('goal_curricula');
            let failure;
            const write = store.add(goal);
            write.onerror = () => {
                failure = errorFrom(write.error, `Could not create curriculum Goal ${goal.id}`);
                try {
                    tx.abort();
                }
                catch { /* Already inactive. */ }
            };
            tx.oncomplete = () => failure ? reject(failure) : resolve(goal);
            tx.onerror = () => { failure ??= errorFrom(tx.error, 'Curriculum Goal creation failed'); };
            tx.onabort = () => reject(failure ?? errorFrom(tx.error, 'Curriculum Goal creation was aborted'));
        });
    }
    finally {
        db.close();
    }
}
/** Read one validated typed curriculum; missing Goals return undefined. */
export async function getGoalCurriculumFromDatabase(goalIdValue) {
    const goalId = requireCurriculumId(goalIdValue, 'Goal ID');
    const db = await openSystemDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(['goal_curricula'], 'readonly');
            const request = tx.objectStore('goal_curricula').get(goalId);
            let value;
            request.onsuccess = () => { value = request.result; };
            request.onerror = () => { try {
                tx.abort();
            }
            catch { } };
            tx.oncomplete = () => {
                try {
                    resolve(value === undefined ? undefined : validateGoalCurriculum(value));
                }
                catch (error) {
                    reject(error);
                }
            };
            tx.onerror = () => reject(errorFrom(tx.error, 'Could not read curriculum Goal'));
            tx.onabort = () => reject(errorFrom(tx.error, 'Curriculum Goal read was aborted'));
        });
    }
    finally {
        db.close();
    }
}
/** Link an available persisted Quest to an existing unlocked curriculum milestone. */
export async function linkQuestToCurriculumInDatabase(questIdValue, goalIdValue, milestoneIdValue) {
    const questId = requireCurriculumId(questIdValue, 'Quest ID');
    const goalId = requireCurriculumId(goalIdValue, 'Goal ID');
    const milestoneId = requireCurriculumId(milestoneIdValue, 'Milestone ID');
    const db = await openSystemDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(['quests', 'goal_curricula'], 'readwrite');
            const quests = tx.objectStore('quests');
            const goals = tx.objectStore('goal_curricula');
            let questValue;
            let goalValue;
            let output;
            let failure;
            const fail = (reason) => {
                failure ??= errorFrom(reason, 'Could not link Quest to curriculum');
                try {
                    tx.abort();
                }
                catch { /* Already inactive. */ }
            };
            const questRequest = quests.get(questId);
            const goalRequest = goals.get(goalId);
            let reads = 2;
            const ready = () => {
                if (--reads !== 0 || failure)
                    return;
                try {
                    if (!isRecord(questValue) || questValue.id !== questId)
                        throw new Error(`Quest not found: ${questId}`);
                    if (questValue.status === 'completed')
                        throw new Error('Completed Quests cannot be newly linked to a Goal curriculum');
                    const goal = validateGoalCurriculum(goalValue);
                    if (goal.id !== goalId || goal.completed)
                        throw new Error('Goal curriculum is missing, invalid, or already completed');
                    if (!goal.milestones.some(milestone => milestone.id === milestoneId))
                        throw new Error(`Milestone not found: ${milestoneId}`);
                    const milestoneState = evaluateGoalCurriculum(goal).milestones.find(milestone => milestone.id === milestoneId);
                    if (!milestoneState?.unlocked)
                        throw new Error('Milestone is locked until its prerequisites are complete');
                    if (milestoneState.complete)
                        throw new Error('Milestone is already complete and cannot accept additional evidence');
                    const linked = questValue;
                    const linkedStat = linked.stat ?? linked.statId ?? null;
                    if (goal.stat !== null && linkedStat !== goal.stat)
                        throw new Error('Quest Stat does not match the Goal curriculum Stat');
                    if ((linked.goalId && linked.goalId !== goalId) || (linked.milestoneId && linked.milestoneId !== milestoneId)) {
                        throw new Error('Quest is already linked to a different Goal or Milestone');
                    }
                    output = { ...linked, goalId, milestoneId };
                    const write = quests.put(output);
                    write.onerror = () => fail(write.error ?? new Error(`Could not link Quest ${questId}`));
                }
                catch (error) {
                    fail(error);
                }
            };
            questRequest.onsuccess = () => { questValue = questRequest.result; ready(); };
            questRequest.onerror = () => fail(questRequest.error ?? new Error('Could not read Quest to link'));
            goalRequest.onsuccess = () => { goalValue = goalRequest.result; ready(); };
            goalRequest.onerror = () => fail(goalRequest.error ?? new Error('Could not read Goal curriculum to link'));
            tx.oncomplete = () => output ? resolve(output) : reject(failure ?? new Error('Quest curriculum link completed without a result'));
            tx.onerror = () => { failure ??= errorFrom(tx.error, 'Quest curriculum link failed'); };
            tx.onabort = () => reject(failure ?? errorFrom(tx.error, 'Quest curriculum link was aborted'));
        });
    }
    finally {
        db.close();
    }
}
function assertUniqueIds(values, label) {
    const seen = new Set();
    for (const value of values) {
        if (typeof value !== 'string' || !value.trim() || value !== value.trim() || seen.has(value)) {
            throw new Error(`${label} contains an invalid or duplicate ID`);
        }
        seen.add(value);
    }
}
function normalizeStoredEvent(value, label) {
    if (!isRecord(value))
        throw new Error(`${label} is invalid`);
    const event = value;
    if (typeof event.id !== 'string' || !event.id.trim() || event.id !== event.id.trim())
        throw new Error(`${label} has an invalid ID`);
    if (typeof event.questId !== 'string' || !event.questId.trim())
        throw new Error(`${label} has an invalid quest ID`);
    if (typeof event.amount !== 'number' || !Number.isFinite(event.amount) || event.amount < 0)
        throw new Error(`${label} has an invalid XP amount`);
    if (typeof event.createdAt !== 'string' || !Number.isFinite(Date.parse(event.createdAt)))
        throw new Error(`${label} has an invalid timestamp`);
    if (event.skillId !== undefined && (typeof event.skillId !== 'string' || !event.skillId.trim()))
        throw new Error(`${label} has an invalid skill ID`);
    return event;
}
function normalizeStoredPlayer(value) {
    if (!isRecord(value))
        throw new Error('Stored player progress is missing or invalid');
    const stored = value;
    if (stored.id !== SYSTEM_PLAYER_KEY)
        throw new Error('Stored player key is invalid');
    // Defaults allow records created during early foundation builds to be opened without destructive migration.
    const player = {
        xp: stored.xp,
        level: stored.level,
        coins: stored.coins,
        rank: stored.rank,
        skills: stored.skills ?? {},
        completedQuestIds: stored.completedQuestIds ?? [],
        xpEvents: stored.xpEvents ?? [],
        achievements: stored.achievements ?? [],
    };
    if (!Array.isArray(player.completedQuestIds) || !Array.isArray(player.xpEvents) || !Array.isArray(player.achievements)) {
        throw new Error('Stored player progression collections are invalid');
    }
    assertUniqueIds(player.completedQuestIds, 'Stored completed Quest IDs');
    assertUniqueIds(player.achievements, 'Stored achievement IDs');
    const eventIds = new Set();
    for (let index = 0; index < player.xpEvents.length; index += 1) {
        const event = normalizeStoredEvent(player.xpEvents[index], `Stored XP event ${index}`);
        if (eventIds.has(event.id))
            throw new Error(`Stored XP events contain duplicate ID: ${event.id}`);
        eventIds.add(event.id);
    }
    return player;
}
function eventsMatch(left, right) {
    return left.id === right.id
        && left.questId === right.questId
        && left.amount === right.amount
        && (left.skillId ?? undefined) === (right.skillId ?? undefined)
        && left.createdAt === right.createdAt;
}
/**
 * A complete progression command is one IndexedDB transaction. Player, Quest,
 * append-only XP events, skills, achievements, optional Stat progress, activity
 * history, app counters and a daily-prize claim either commit together or not at all.
 * Legacy localStorage remains authoritative until the app performs an explicit cutover.
 */
export async function completeQuestInDatabase(questId, rules, now = new Date().toISOString(), effects = {}) {
    if (typeof questId !== 'string' || !questId.trim() || questId !== questId.trim())
        throw new Error('Quest ID is required and must be trimmed');
    if (!Number.isFinite(Date.parse(now)))
        throw new Error('Completion timestamp is invalid');
    const statAward = effects.statAward;
    if (statAward) {
        if (!/^(entrepreneurship|global-skills|mathematics|computer|physics|unique-thinking)$/.test(statAward.statId)) {
            throw new Error('Stat award contains an unknown Stat ID');
        }
        if (!Number.isSafeInteger(statAward.xpAmount) || statAward.xpAmount <= 0 || statAward.xpAmount > 1_000_000_000_000) {
            throw new Error('Stat XP award must be a positive finite number within the supported limit');
        }
        if (typeof rules.xpForNextStatLevel !== 'function')
            throw new Error('Stat XP curve is required for an atomic Stat award');
    }
    const counterDeltas = effects.progressCounterDeltas ?? {};
    if (!isRecord(counterDeltas))
        throw new Error('Progress counter increments are invalid');
    const reservedCounters = new Set(['totalXpEarned', 'totalLevelsGained', 'totalStatXpEarned', 'totalStatLevelUps']);
    for (const [key, amount] of Object.entries(counterDeltas)) {
        if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(key) || reservedCounters.has(key))
            throw new Error(`Progress counter name is invalid or reserved: ${key}`);
        if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000_000)
            throw new Error(`Progress counter increment is invalid: ${key}`);
    }
    const dailyQuestStreakInput = effects.dailyQuestStreak;
    if (dailyQuestStreakInput) {
        const date = dailyQuestStreakInput.date;
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00.000Z`)) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
            throw new Error('Daily Quest streak date is invalid');
        }
        if (typeof dailyQuestStreakInput.sourceQuestId !== 'string' || !SYSTEM_CORE_DAILY_QUEST_IDS.includes(dailyQuestStreakInput.sourceQuestId)) {
            throw new Error('Daily Quest streak only applies to a core Daily Quest');
        }
        const canonical = getCanonicalDomainQuestId('daily-quest', dailyQuestStreakInput.sourceQuestId, date);
        const aliases = getLegacyDomainQuestIdAliases('daily-quest', dailyQuestStreakInput.sourceQuestId, date);
        if (questId !== canonical && !aliases.includes(questId))
            throw new Error('Daily Quest streak source does not match the completing Quest identity');
        if (statAward && statAward.xpAmount <= 0)
            throw new Error('Daily Quest streak Stat XP must be positive');
    }
    const curriculumEvidenceInput = effects.curriculumEvidence;
    if (curriculumEvidenceInput) {
        for (const [label, value] of [
            ['Goal ID', curriculumEvidenceInput.goalId],
            ['Milestone ID', curriculumEvidenceInput.milestoneId],
            ['Evidence ID', curriculumEvidenceInput.evidenceId],
        ]) {
            if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 200) {
                throw new Error(`Curriculum ${label} must be a non-empty trimmed ID of at most 200 characters`);
            }
        }
        const verification = curriculumEvidenceInput.skillVerification;
        if (verification !== undefined && verification !== null) {
            if (!verification || !['assessment', 'project-review', 'manual-check'].includes(verification.method)
                || typeof verification.verifiedAt !== 'string' || !Number.isFinite(Date.parse(verification.verifiedAt))
                || !Number.isFinite(verification.score) || verification.score < 80 || verification.score > 100) {
                throw new Error('Curriculum Skill verification must be valid and score at least 80/100');
            }
        }
    }
    const dailyPrizeInput = effects.dailyPrize;
    if (dailyPrizeInput && dailyQuestStreakInput && dailyPrizeInput.date !== dailyQuestStreakInput.date) {
        throw new Error('Daily Quest streak date and Daily Prize date must match');
    }
    if (dailyPrizeInput) {
        const date = dailyPrizeInput.date;
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (!Number.isFinite(Date.parse(`${date}T00:00:00.000Z`)) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date)) {
            throw new Error('Daily prize date is invalid');
        }
        if (dailyPrizeInput.id !== `daily-prize:${date}`)
            throw new Error('Daily prize ID must be canonical for its date');
        if (!Array.isArray(dailyPrizeInput.requiredQuestIds) || dailyPrizeInput.requiredQuestIds.length !== 6) {
            throw new Error('Daily prize requires the six core Daily Quest IDs for its date');
        }
        const requiredIds = new Set();
        const requiredSources = new Set();
        for (const requiredId of dailyPrizeInput.requiredQuestIds) {
            if (typeof requiredId !== 'string' || !requiredId.trim() || requiredId !== requiredId.trim() || requiredId.length > 280 || requiredIds.has(requiredId)) {
                throw new Error('Daily prize contains an invalid or duplicate required Quest ID');
            }
            const sourceId = SYSTEM_CORE_DAILY_QUEST_IDS.find(coreId => requiredId === `daily-quest:${coreId}:${date}` || requiredId === `daily:${date}:${coreId}`);
            if (!sourceId)
                throw new Error('Daily prize required Quest IDs must match the six canonical core Daily Quests for the same date');
            if (requiredSources.has(sourceId))
                throw new Error(`Daily prize contains two IDs for core Quest ${sourceId}`);
            requiredSources.add(sourceId);
            requiredIds.add(requiredId);
        }
        if (requiredSources.size !== 6)
            throw new Error('Daily prize gate must contain each of the six core Daily Quests exactly once');
        if (!requiredIds.has(questId))
            throw new Error('The completing Quest must be part of the six-Quest Daily prize gate');
        if (!['xp', 'coins', 'xp-coins', 'item', 'custom'].includes(dailyPrizeInput.type))
            throw new Error('Daily prize type is invalid');
        if (typeof dailyPrizeInput.title !== 'string' || !dailyPrizeInput.title.trim() || dailyPrizeInput.title.length > 140)
            throw new Error('Daily prize title is invalid');
        for (const [label, amount] of [['XP', dailyPrizeInput.xpReward], ['Coins', dailyPrizeInput.coinReward]]) {
            if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000_000)
                throw new Error(`Daily prize ${label} reward is invalid`);
        }
        if (dailyPrizeInput.type === 'xp' && dailyPrizeInput.coinReward !== 0)
            throw new Error('An XP-only daily prize cannot also award Coins');
        if (dailyPrizeInput.type === 'coins' && dailyPrizeInput.xpReward !== 0)
            throw new Error('A Coins-only daily prize cannot also award XP');
        if (dailyPrizeInput.type === 'item' && dailyPrizeInput.xpReward === 0 && dailyPrizeInput.coinReward === 0 &&
            (typeof dailyPrizeInput.itemId !== 'string' || !dailyPrizeInput.itemId.trim())) {
            throw new Error('An item daily prize requires an item ID');
        }
        if (dailyPrizeInput.claimedAt !== undefined && !Number.isFinite(Date.parse(dailyPrizeInput.claimedAt))) {
            throw new Error('Daily prize claim timestamp is invalid');
        }
        if (dailyPrizeInput.sourceQuestId !== undefined &&
            (typeof dailyPrizeInput.sourceQuestId !== 'string' || !dailyPrizeInput.sourceQuestId.trim() || dailyPrizeInput.sourceQuestId.length > 200)) {
            throw new Error('Daily prize source Quest ID is invalid');
        }
    }
    const activityInput = effects.activity;
    const canonicalBaseEventId = `quest:${questId}`;
    if (activityInput?.eventId !== undefined && (typeof activityInput.eventId !== 'string' || !activityInput.eventId.trim() || activityInput.eventId !== activityInput.eventId.trim())) {
        throw new Error('Activity event ID is invalid');
    }
    const activityEventId = typeof activityInput?.eventId === 'string' ? activityInput.eventId : canonicalBaseEventId;
    if (activityEventId.length > 280)
        throw new Error('Activity event ID exceeds the supported length');
    const activityAt = typeof activityInput?.at === 'string' ? activityInput.at : now;
    if (!Number.isFinite(Date.parse(activityAt)))
        throw new Error('Activity timestamp is invalid');
    const activityType = typeof activityInput?.type === 'string' && activityInput.type.trim()
        ? activityInput.type.trim().slice(0, 40) : 'quest-completion';
    const activityTitle = typeof activityInput?.title === 'string' && activityInput.title.trim()
        ? activityInput.title.trim().slice(0, 140) : '';
    if (activityInput?.id !== undefined && (typeof activityInput.id !== 'string' || !activityInput.id.trim() || activityInput.id.length > 320)) {
        throw new Error('Activity record ID is invalid');
    }
    const activityId = activityInput?.id || `activity:${activityEventId}`.slice(0, 320);
    const db = await openSystemDatabase();
    try {
        return await new Promise((resolve, reject) => {
            let failure;
            let output;
            const transactionStores = ['player', 'quests', 'xp_events', 'achievements', 'skills', 'stats', 'activity_history', 'app_state', 'daily_prizes', 'goal_curricula', 'goal_evidence'];
            const tx = db.transaction(transactionStores, 'readwrite');
            const playerStore = tx.objectStore('player');
            const questStore = tx.objectStore('quests');
            const eventStore = tx.objectStore('xp_events');
            const skillStore = tx.objectStore('skills');
            const statStore = tx.objectStore('stats');
            const activityStore = tx.objectStore('activity_history');
            const appStateStore = tx.objectStore('app_state');
            const dailyPrizeStore = tx.objectStore('daily_prizes');
            const curriculumGoalStore = tx.objectStore('goal_curricula');
            const curriculumEvidenceStore = tx.objectStore('goal_evidence');
            let playerValue;
            let questValue;
            let ledgerValue;
            let statValue;
            let activityValue;
            let countersValue;
            let dailyPrizeValue;
            let dailyPrizeLedgerValue;
            let dailyQuestStreakValue;
            let curriculumGoalValue;
            let curriculumEvidenceValue;
            let curriculumPairEvidenceValue;
            let nextCurriculumGoal;
            let nextCurriculumEvidence;
            let nextCurriculumEvaluation;
            let nextDailyQuestStreak;
            const requiredDailyQuestValues = new Map();
            const requiredDailyLedgerValues = new Map();
            // Set from the exact request list before handlers can fire.
            let readsRemaining = 0;
            const fail = (value) => {
                if (!failure)
                    failure = errorFrom(value, 'SYSTEM progression transaction failed');
                try {
                    tx.abort();
                }
                catch { /* It may already be inactive or aborted. */ }
            };
            tx.oncomplete = () => {
                if (failure)
                    reject(failure);
                else if (output)
                    resolve(output);
                else
                    reject(new Error('Progression transaction finished without a result'));
            };
            tx.onerror = () => { failure ??= errorFrom(tx.error, 'SYSTEM progression transaction failed'); };
            tx.onabort = () => reject(failure ?? errorFrom(tx.error, 'SYSTEM progression transaction was aborted'));
            const ready = () => {
                if (--readsRemaining !== 0 || failure)
                    return;
                try {
                    if (!isRecord(playerValue))
                        throw new Error('No SYSTEM player has been seeded into IndexedDB');
                    if (!isRecord(questValue))
                        throw new Error(`Quest not found: ${questId}`);
                    const player = normalizeStoredPlayer(playerValue);
                    const quest = questValue;
                    if (quest.id !== questId)
                        throw new Error('Stored Quest key does not match the requested Quest ID');
                    if (quest.awardedXP !== undefined && (!Number.isSafeInteger(quest.awardedXP) || quest.awardedXP < 0 || quest.awardedXP > 1_000_000_000_000)) {
                        throw new Error(`Stored awarded XP snapshot is invalid for Quest ${quest.id}`);
                    }
                    const expectedSkillId = quest.skillId ?? quest.skillRewards?.[0]?.skillId;
                    const playerEventRaw = player.xpEvents.find((event) => event.id === canonicalBaseEventId);
                    const playerEvent = playerEventRaw ? normalizeStoredEvent(playerEventRaw, `Player XP event ${canonicalBaseEventId}`) : undefined;
                    const ledgerEvent = ledgerValue === undefined ? undefined : normalizeStoredEvent(ledgerValue, `XP ledger event ${canonicalBaseEventId}`);
                    const playerMarksComplete = player.completedQuestIds.includes(quest.id);
                    const questMarksComplete = quest.status === 'completed';
                    const ledgerMarksComplete = ledgerEvent !== undefined;
                    const playerEventMarksComplete = playerEvent !== undefined;
                    const signals = [playerMarksComplete, questMarksComplete, ledgerMarksComplete, playerEventMarksComplete];
                    if (new Set(signals).size > 1) {
                        throw new Error(`Progression consistency conflict for quest ${quest.id}; no reward was applied`);
                    }
                    const questLink = quest;
                    const isCurriculumLinked = Boolean(questLink.milestoneId)
                        || (questLink.legacySourceType === 'custom-quest' && Boolean(questLink.goalId));
                    if (!questMarksComplete && isCurriculumLinked && !curriculumEvidenceInput) {
                        throw new Error('A Goal-linked Quest must commit its curriculum evidence in the same IndexedDB transaction');
                    }
                    if (questLink.milestoneId && !questLink.goalId) {
                        throw new Error('A linked curriculum Milestone is missing its parent Goal');
                    }
                    if (curriculumEvidenceInput) {
                        const linkedQuest = quest;
                        if (linkedQuest.goalId !== curriculumEvidenceInput.goalId || linkedQuest.milestoneId !== curriculumEvidenceInput.milestoneId) {
                            throw new Error('Curriculum Goal/Milestone does not match the persisted Quest link');
                        }
                        if (!isRecord(curriculumGoalValue) || curriculumGoalValue.id !== curriculumEvidenceInput.goalId) {
                            throw new Error(`Curriculum Goal is missing or has an invalid identity: ${curriculumEvidenceInput.goalId}`);
                        }
                        if (curriculumPairEvidenceValue !== undefined && isRecord(curriculumPairEvidenceValue)) {
                            const pair = curriculumPairEvidenceValue;
                            if (pair.goalId !== curriculumEvidenceInput.goalId || pair.milestoneId !== curriculumEvidenceInput.milestoneId || pair.questId !== quest.id) {
                                throw new Error('Curriculum evidence unique-identity index returned a conflicting record');
                            }
                        }
                        if (curriculumEvidenceValue !== undefined) {
                            if (!isRecord(curriculumEvidenceValue)
                                || curriculumEvidenceValue.goalId !== curriculumEvidenceInput.goalId
                                || curriculumEvidenceValue.milestoneId !== curriculumEvidenceInput.milestoneId
                                || curriculumEvidenceValue.questId !== quest.id) {
                                throw new Error(`Curriculum Evidence ID already belongs to another identity: ${curriculumEvidenceInput.evidenceId}`);
                            }
                        }
                        if (playerMarksComplete && questMarksComplete && ledgerMarksComplete && playerEventMarksComplete) {
                            const goalRecord = curriculumGoalValue;
                            const storedGoalEvidence = Array.isArray(goalRecord.evidence)
                                ? goalRecord.evidence.find(item => isRecord(item) && item.id === curriculumEvidenceInput.evidenceId) : undefined;
                            const durableEvidence = curriculumEvidenceValue;
                            if (!isRecord(storedGoalEvidence) || !isRecord(durableEvidence)
                                || storedGoalEvidence.questId !== quest.id || storedGoalEvidence.milestoneId !== curriculumEvidenceInput.milestoneId
                                || durableEvidence.id !== curriculumEvidenceInput.evidenceId
                                || durableEvidence.goalId !== curriculumEvidenceInput.goalId
                                || durableEvidence.questId !== storedGoalEvidence.questId
                                || durableEvidence.milestoneId !== storedGoalEvidence.milestoneId
                                || durableEvidence.title !== storedGoalEvidence.title
                                || durableEvidence.at !== storedGoalEvidence.at
                                || durableEvidence.stat !== storedGoalEvidence.stat
                                || durableEvidence.skillId !== storedGoalEvidence.skillId
                                || durableEvidence.passed !== storedGoalEvidence.passed
                                || JSON.stringify(durableEvidence.skillVerification ?? null) !== JSON.stringify(storedGoalEvidence.skillVerification ?? null)) {
                                throw new Error('Completed Quest is missing consistent atomic curriculum evidence; manual repair is required');
                            }
                            nextCurriculumGoal = goalRecord;
                            nextCurriculumEvidence = storedGoalEvidence;
                            nextCurriculumEvaluation = evaluateGoalCurriculum(goalRecord);
                        }
                        else {
                            if (curriculumEvidenceValue !== undefined || curriculumPairEvidenceValue !== undefined) {
                                throw new Error('Curriculum evidence already exists while the linked Quest is not completed');
                            }
                            const linkedQuest = quest;
                            const curriculumPlan = recordCurriculumEvidence(curriculumGoalValue, { id: quest.id, title: quest.title, completed: true, goalId: linkedQuest.goalId,
                                milestoneId: linkedQuest.milestoneId, stat: linkedQuest.stat ?? linkedQuest.statId ?? null,
                                skillId: quest.skillId ?? null }, curriculumEvidenceInput.evidenceId, now, curriculumEvidenceInput.skillVerification ?? null);
                            nextCurriculumGoal = curriculumPlan.goal;
                            nextCurriculumEvidence = curriculumPlan.goal.evidence.find(item => item.id === curriculumEvidenceInput.evidenceId);
                            nextCurriculumEvaluation = curriculumPlan.evaluation;
                        }
                    }
                    if (ledgerEvent && playerEvent && !eventsMatch(ledgerEvent, playerEvent)) {
                        throw new Error(`XP ledger conflict for quest ${quest.id}; no reward was applied`);
                    }
                    if (ledgerEvent && (ledgerEvent.questId !== quest.id || ledgerEvent.id !== canonicalBaseEventId)) {
                        throw new Error(`XP ledger identity conflict for quest ${quest.id}; no reward was applied`);
                    }
                    if (ledgerEvent && ledgerEvent.amount !== (quest.awardedXP ?? quest.xpReward) ||
                        ledgerEvent && (ledgerEvent.skillId ?? undefined) !== (expectedSkillId ?? undefined)) {
                        throw new Error(`Completed Quest reward does not match its XP ledger: ${quest.id}`);
                    }
                    if (playerMarksComplete && questMarksComplete && ledgerMarksComplete && playerEventMarksComplete) {
                        output = {
                            player: { ...playerValue, ...player, id: SYSTEM_PLAYER_KEY },
                            quest,
                            xpEvent: ledgerEvent,
                            xpEvents: player.xpEvents.filter(event => event.questId === quest.id),
                            achievements: [],
                            alreadyCompleted: true,
                            leveledUp: [],
                            newlyUnlockedAchievements: [],
                            ...(isRecord(countersValue) && isRecord(countersValue.counters) ? { progressCounters: { ...countersValue.counters } } : {}),
                            ...(nextCurriculumGoal ? { curriculumGoal: nextCurriculumGoal } : {}),
                            ...(nextCurriculumEvidence ? { curriculumEvidence: nextCurriculumEvidence } : {}),
                            ...(nextCurriculumEvaluation ? { curriculumEvaluation: nextCurriculumEvaluation } : {}),
                            ...(curriculumEvidenceInput ? { curriculumRewardIssued: false } : {}),
                        };
                        return;
                    }
                    if (activityValue !== undefined)
                        throw new Error(`Activity history already contains this event identity: ${activityEventId}`);
                    if (dailyPrizeInput && dailyPrizeValue !== undefined)
                        throw new Error(`Daily prize has already been claimed: ${dailyPrizeInput.id}`);
                    const baseXP = quest.xpReward;
                    const baseCoins = quest.coinReward ?? 0;
                    let resolvedStreak;
                    let streakMultiplier = 1;
                    if (dailyQuestStreakInput) {
                        if (statAward && statAward.xpAmount !== baseXP) {
                            throw new Error('Daily Quest Stat XP must equal the stored base Quest XP before streak scaling');
                        }
                        const transition = calculateDailyQuestStreak(dailyQuestStreakValue, dailyQuestStreakInput.date, now);
                        resolvedStreak = transition.state;
                        streakMultiplier = transition.multiplier;
                    }
                    const effectiveQuestXP = dailyQuestStreakInput ? Math.round(baseXP * streakMultiplier) : baseXP;
                    const streakBonusXP = effectiveQuestXP - baseXP;
                    if (!Number.isSafeInteger(effectiveQuestXP) || effectiveQuestXP < baseXP || effectiveQuestXP > 1_000_000_000_000) {
                        throw new Error('Daily Quest streak-adjusted XP is outside the supported range');
                    }
                    if (resolvedStreak)
                        nextDailyQuestStreak = resolvedStreak;
                    if (dailyPrizeInput) {
                        const playerPrizeEventRaw = player.xpEvents.find(event => event.id === dailyPrizeInput.id);
                        if (playerPrizeEventRaw)
                            throw new Error(`Player XP history already contains daily-prize identity ${dailyPrizeInput.id}`);
                        if (dailyPrizeInput.xpReward > 0 && dailyPrizeLedgerValue !== undefined) {
                            throw new Error(`Daily prize XP ledger already contains this claim: ${dailyPrizeInput.id}`);
                        }
                        if (dailyPrizeInput.xpReward === 0 && dailyPrizeLedgerValue !== undefined) {
                            throw new Error(`Unexpected XP ledger record exists for a non-XP daily prize: ${dailyPrizeInput.id}`);
                        }
                        // The prize is only legal on the transaction that completes the last
                        // of the six core Daily Quests. Other Quest status records are read in
                        // this same transaction, so a stale UI cannot unlock it early.
                        for (const requiredId of dailyPrizeInput.requiredQuestIds) {
                            const required = requiredId === quest.id ? quest : requiredDailyQuestValues.get(requiredId);
                            if (!isRecord(required) || required.id !== requiredId) {
                                throw new Error(`Daily prize gate Quest is missing: ${requiredId}`);
                            }
                            if (requiredId !== quest.id) {
                                const requiredQuest = required;
                                const requiredEventId = `quest:${requiredId}`;
                                const embeddedRaw = player.xpEvents.find(event => event.id === requiredEventId);
                                const embedded = embeddedRaw ? normalizeStoredEvent(embeddedRaw, `Player XP event ${requiredEventId}`) : undefined;
                                const ledgerRaw = requiredDailyLedgerValues.get(requiredId);
                                const ledger = ledgerRaw === undefined ? undefined : normalizeStoredEvent(ledgerRaw, `XP ledger event ${requiredEventId}`);
                                const signals = [requiredQuest.status === 'completed', player.completedQuestIds.includes(requiredId), embedded !== undefined, ledger !== undefined];
                                if (new Set(signals).size > 1) {
                                    throw new Error(`Daily prize gate consistency conflict for Quest ${requiredId}`);
                                }
                                if (!signals.every(Boolean)) {
                                    throw new Error('Daily prize is locked until all six core Daily Quests are completed');
                                }
                                const expectedRequiredSkill = requiredQuest.skillId ?? requiredQuest.skillRewards?.[0]?.skillId;
                                if (!ledger || ledger.id !== requiredEventId || ledger.questId !== requiredId || ledger.amount !== (requiredQuest.awardedXP ?? requiredQuest.xpReward) ||
                                    (ledger.skillId ?? undefined) !== (expectedRequiredSkill ?? undefined) || !embedded || !eventsMatch(ledger, embedded)) {
                                    throw new Error(`Daily prize gate XP ledger conflict for Quest ${requiredId}`);
                                }
                            }
                        }
                    }
                    let updatedStat;
                    let statLevelsGained = 0;
                    const effectiveStatAward = statAward
                        ? { ...statAward, xpAmount: dailyQuestStreakInput ? effectiveQuestXP : statAward.xpAmount }
                        : undefined;
                    if (effectiveStatAward) {
                        if (!isRecord(statValue))
                            throw new Error(`Stat progress was not seeded: ${effectiveStatAward.statId}`);
                        const stat = statValue;
                        if (stat.id !== `stat:${effectiveStatAward.statId}` || stat.statId !== effectiveStatAward.statId ||
                            typeof stat.name !== 'string' || !stat.name.trim() || !Number.isSafeInteger(stat.level) || stat.level < 1 ||
                            !Number.isFinite(stat.xp) || stat.xp < 0 || !Number.isFinite(stat.xpRequired) || stat.xpRequired <= 0) {
                            throw new Error(`Stored Stat progress is invalid: ${effectiveStatAward.statId}`);
                        }
                        const transition = advanceXPTrack({ level: stat.level, xp: stat.xp, xpRequired: stat.xpRequired }, effectiveStatAward.xpAmount, rules.xpForNextStatLevel, 1_000_000);
                        statLevelsGained = transition.levelsGained;
                        updatedStat = { ...stat, level: transition.level, xp: transition.xp, xpRequired: transition.xpRequired };
                    }
                    const prizeXP = dailyPrizeInput?.xpReward ?? 0;
                    const prizeCoins = dailyPrizeInput?.coinReward ?? 0;
                    const extraSkillRewards = quest.skillRewards
                        ? quest.skillRewards.map(reward => ({ ...reward, xpReward: dailyQuestStreakInput ? Math.round(reward.xpReward * streakMultiplier) : reward.xpReward }))
                        : (quest.skillId ? [{ skillId: quest.skillId, xpReward: effectiveQuestXP }] : []);
                    // Daily-prize XP/Coins contribute to the same Player transition but are
                    // recorded as a separate event and never inflate Stat/Skill XP.
                    const transitionQuest = {
                        ...quest,
                        xpReward: effectiveQuestXP + prizeXP,
                        coinReward: baseCoins + prizeCoins,
                        skillRewards: extraSkillRewards,
                    };
                    const result = completeQuest(player, transitionQuest, rules, now);
                    const baseEvent = {
                        id: canonicalBaseEventId,
                        questId: quest.id,
                        amount: effectiveQuestXP,
                        ...(expectedSkillId ? { skillId: expectedSkillId } : {}),
                        createdAt: now,
                    };
                    const prizeEvent = prizeXP > 0 && dailyPrizeInput
                        ? { id: dailyPrizeInput.id, questId: quest.id, amount: prizeXP, createdAt: now }
                        : undefined;
                    const resultEvents = result.player.xpEvents.filter(event => event.id !== canonicalBaseEventId && event.id !== dailyPrizeInput?.id);
                    resultEvents.push(baseEvent);
                    if (prizeEvent)
                        resultEvents.push(prizeEvent);
                    const playerWithSeparatedEvents = { ...result.player, xpEvents: resultEvents };
                    const persistedPlayer = {
                        ...playerValue,
                        ...playerWithSeparatedEvents,
                        id: SYSTEM_PLAYER_KEY,
                    };
                    const persistedQuest = { ...quest, ...result.quest, xpReward: baseXP, coinReward: baseCoins, awardedXP: effectiveQuestXP };
                    const achievements = result.newlyUnlockedAchievements.map((id) => ({ id, unlockedAt: now, sourceQuestId: quest.id }));
                    const totalAwardXP = effectiveQuestXP + prizeXP;
                    const totalAwardCoins = baseCoins + prizeCoins;
                    const countersRaw = countersValue === undefined ? { id: 'progress-counters', counters: {} } : countersValue;
                    if (!isRecord(countersRaw) || countersRaw.id !== 'progress-counters' || !isRecord(countersRaw.counters)) {
                        throw new Error('Stored progress counters are invalid');
                    }
                    const nextCounters = {};
                    for (const [key, value] of Object.entries(countersRaw.counters)) {
                        if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(key) || typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) {
                            throw new Error(`Stored progress counter is invalid: ${key}`);
                        }
                        nextCounters[key] = value;
                    }
                    const computedDeltas = {
                        totalXpEarned: Math.floor(totalAwardXP),
                        totalLevelsGained: result.leveledUp.length,
                        ...(effectiveStatAward ? { totalStatXpEarned: effectiveStatAward.xpAmount, totalStatLevelUps: statLevelsGained } : {}),
                        ...counterDeltas,
                    };
                    for (const [key, increment] of Object.entries(computedDeltas)) {
                        if (!Number.isSafeInteger(increment) || increment < 0 || increment > 1_000_000_000_000)
                            throw new Error(`Computed progress counter increment is invalid: ${key}`);
                        nextCounters[key] = Math.min(1_000_000_000_000, (nextCounters[key] ?? 0) + increment);
                    }
                    const completedActivity = {
                        id: activityId,
                        eventId: activityEventId,
                        at: activityAt,
                        type: activityType,
                        title: activityTitle || quest.title,
                        stat: activityInput?.stat ?? activityInput?.statId ?? statAward?.statId ?? null,
                        skillId: activityInput?.skillId ?? expectedSkillId ?? null,
                        goalId: activityInput?.goalId ?? null,
                        questId: activityInput?.questId ?? quest.id,
                        xp: totalAwardXP,
                        coins: totalAwardCoins,
                        baseXP,
                        streakBonusXP,
                        ...(dailyQuestStreakInput ? { streakMultiplier, streakDays: resolvedStreak?.streak ?? 0 } : {}),
                        bonusXP: prizeXP,
                        baseCoins,
                        bonusCoins: prizeCoins,
                    };
                    if (typeof activityInput?.learningMode === 'string' && ['practice', 'recall', 'explain', 'review', 'project', 'assessment', 'validation'].includes(activityInput.learningMode)) {
                        completedActivity.learningMode = activityInput.learningMode;
                        completedActivity.learningModeSource = ['explicit', 'planned', 'inferred-from-label'].includes(String(activityInput.learningModeSource))
                            ? activityInput.learningModeSource : 'explicit';
                    }
                    if (typeof activityInput?.evidenceType === 'string' && activityInput.evidenceType.length <= 40)
                        completedActivity.evidenceType = activityInput.evidenceType;
                    if (typeof activityInput?.durationMinutes === 'number' && Number.isFinite(activityInput.durationMinutes) && activityInput.durationMinutes > 0) {
                        completedActivity.durationMinutes = Math.min(1440, Math.round(activityInput.durationMinutes));
                    }
                    if (typeof activityInput?.score === 'number' && Number.isFinite(activityInput.score)) {
                        completedActivity.score = Math.max(0, Math.min(100, activityInput.score));
                    }
                    const prizeRecord = dailyPrizeInput ? {
                        ...dailyPrizeInput,
                        id: dailyPrizeInput.id,
                        date: dailyPrizeInput.date,
                        type: dailyPrizeInput.type,
                        title: dailyPrizeInput.title.trim().slice(0, 140),
                        xpReward: prizeXP,
                        coinReward: prizeCoins,
                        claimedAt: dailyPrizeInput.claimedAt || now,
                        sourceQuestId: dailyPrizeInput.sourceQuestId || quest.id,
                    } : undefined;
                    if (!result.alreadyCompleted) {
                        playerStore.put(persistedPlayer);
                        questStore.put(persistedQuest);
                        const baseWrite = eventStore.add(baseEvent);
                        baseWrite.onerror = () => fail(baseWrite.error ?? new Error(`Could not append XP event ${canonicalBaseEventId}`));
                        if (prizeEvent) {
                            const bonusWrite = eventStore.add(prizeEvent);
                            bonusWrite.onerror = () => fail(bonusWrite.error ?? new Error(`Could not append daily-prize XP event ${prizeEvent.id}`));
                        }
                        for (const skill of Object.values(persistedPlayer.skills)) {
                            const skillWrite = skillStore.put(skill);
                            skillWrite.onerror = () => fail(skillWrite.error ?? new Error(`Could not persist skill ${skill.id}`));
                        }
                        for (const achievement of achievements) {
                            const achievementWrite = tx.objectStore('achievements').put(achievement);
                            achievementWrite.onerror = () => fail(achievementWrite.error ?? new Error(`Could not persist achievement ${achievement.id}`));
                        }
                        if (updatedStat) {
                            const statWrite = statStore.put(updatedStat);
                            statWrite.onerror = () => fail(statWrite.error ?? new Error(`Could not persist Stat ${updatedStat.statId}`));
                        }
                        const historyWrite = activityStore.add(completedActivity);
                        historyWrite.onerror = () => fail(historyWrite.error ?? new Error(`Could not append activity ${activityId}`));
                        appStateStore.put({ ...countersRaw, id: 'progress-counters', counters: nextCounters, updatedAt: now });
                        if (nextDailyQuestStreak)
                            appStateStore.put(nextDailyQuestStreak);
                        if (prizeRecord) {
                            const prizeWrite = dailyPrizeStore.add(prizeRecord);
                            prizeWrite.onerror = () => fail(prizeWrite.error ?? new Error(`Could not claim daily prize ${prizeRecord.id}`));
                        }
                        if (curriculumEvidenceInput && nextCurriculumGoal && nextCurriculumEvidence) {
                            const goalWrite = curriculumGoalStore.put({ ...nextCurriculumGoal, updatedAt: now });
                            goalWrite.onerror = () => fail(goalWrite.error ?? new Error(`Could not persist curriculum Goal ${nextCurriculumGoal.id}`));
                            const evidenceWrite = curriculumEvidenceStore.add({ ...nextCurriculumEvidence, goalId: nextCurriculumGoal.id });
                            evidenceWrite.onerror = () => fail(evidenceWrite.error ?? new Error(`Could not append curriculum evidence ${nextCurriculumEvidence.id}`));
                        }
                    }
                    output = {
                        player: persistedPlayer,
                        quest: persistedQuest,
                        xpEvent: baseEvent,
                        xpEvents: [baseEvent, ...(prizeEvent ? [prizeEvent] : [])],
                        achievements,
                        activity: completedActivity,
                        ...(updatedStat ? { stat: updatedStat } : {}),
                        ...(prizeRecord ? { dailyPrize: prizeRecord } : {}),
                        progressCounters: nextCounters,
                        ...(nextDailyQuestStreak ? { dailyQuestStreak: nextDailyQuestStreak } : {}),
                        ...(nextCurriculumGoal ? { curriculumGoal: nextCurriculumGoal } : {}),
                        ...(nextCurriculumEvidence ? { curriculumEvidence: nextCurriculumEvidence } : {}),
                        ...(nextCurriculumEvaluation ? { curriculumEvaluation: nextCurriculumEvaluation } : {}),
                        ...(curriculumEvidenceInput ? { curriculumRewardIssued: false } : {}),
                        alreadyCompleted: result.alreadyCompleted,
                        leveledUp: result.leveledUp,
                        newlyUnlockedAchievements: result.newlyUnlockedAchievements,
                    };
                }
                catch (error) {
                    fail(error);
                }
            };
            try {
                const requests = [
                    [playerStore.get(SYSTEM_PLAYER_KEY), value => { playerValue = value; }, 'Could not read SYSTEM player'],
                    [questStore.get(questId), value => { questValue = value; }, 'Could not read SYSTEM Quest'],
                    [eventStore.get(canonicalBaseEventId), value => { ledgerValue = value; }, 'Could not read SYSTEM XP ledger'],
                    [activityStore.index('eventId').get(activityEventId), value => { activityValue = value; }, 'Could not inspect activity identity'],
                    [appStateStore.get('progress-counters'), value => { countersValue = value; }, 'Could not read progress counters'],
                ];
                if (statAward)
                    requests.push([statStore.get(`stat:${statAward.statId}`), value => { statValue = value; }, 'Could not read Stat progress']);
                if (dailyQuestStreakInput)
                    requests.push([appStateStore.get('daily-quest-streak'), value => { dailyQuestStreakValue = value; }, 'Could not read Daily Quest streak state']);
                if (dailyPrizeInput) {
                    requests.push([dailyPrizeStore.get(dailyPrizeInput.id), value => { dailyPrizeValue = value; }, 'Could not read daily-prize claim']);
                    // Always inspect this identity, even for coin/item prizes. A stale XP event
                    // under the canonical prize ID is a data-integrity conflict, not something to ignore.
                    requests.push([eventStore.get(dailyPrizeInput.id), value => { dailyPrizeLedgerValue = value; }, 'Could not inspect daily-prize XP ledger']);
                    for (const requiredId of dailyPrizeInput.requiredQuestIds) {
                        if (requiredId === questId)
                            continue; // The target Quest is already part of the read set.
                        requests.push([questStore.get(requiredId), value => { requiredDailyQuestValues.set(requiredId, value); }, `Could not inspect Daily Quest gate ${requiredId}`]);
                        requests.push([eventStore.get(`quest:${requiredId}`), value => { requiredDailyLedgerValues.set(requiredId, value); }, `Could not inspect Daily Quest XP ledger ${requiredId}`]);
                    }
                }
                if (curriculumEvidenceInput) {
                    requests.push([curriculumGoalStore.get(curriculumEvidenceInput.goalId), value => { curriculumGoalValue = value; }, 'Could not read curriculum Goal']);
                    requests.push([curriculumEvidenceStore.get(curriculumEvidenceInput.evidenceId), value => { curriculumEvidenceValue = value; }, 'Could not read curriculum evidence identity']);
                    requests.push([curriculumEvidenceStore.index('goalMilestoneQuest').get([curriculumEvidenceInput.goalId, curriculumEvidenceInput.milestoneId, questId]), value => { curriculumPairEvidenceValue = value; }, 'Could not inspect duplicate Goal/Milestone/Quest evidence']);
                }
                // Count is based on the actual request list, so adding optional effects
                // cannot accidentally let the read phase commit prematurely.
                readsRemaining = requests.length;
                for (const [request, assign, label] of requests) {
                    request.onsuccess = () => { assign(request.result); ready(); };
                    request.onerror = () => fail(request.error ?? new Error(label));
                }
            }
            catch (error) {
                fail(error);
            }
        });
    }
    finally {
        db.close();
    }
}
function validateAssessmentAttempt(value) {
    if (!value || typeof value.attemptId !== 'string' || !value.attemptId.trim() || value.attemptId.length > 200)
        throw new Error('Invalid assessment attempt ID');
    if (typeof value.assessmentId !== 'string' || !value.assessmentId.trim() || value.assessmentId.length > 200)
        throw new Error('Invalid assessment ID');
    if (!Number.isFinite(value.score) || value.score < 0 || value.score > 100 || !Number.isInteger(value.correct) || !Number.isInteger(value.total) || value.total < 1 || value.correct < 0 || value.correct > value.total)
        throw new Error('Invalid assessment result');
    if (typeof value.passed !== 'boolean' || value.rewardIssued !== false || !Array.isArray(value.verifiedSkillIds) || !Array.isArray(value.weakSkillIds) || !Array.isArray(value.recommendations))
        throw new Error('Invalid assessment result payload');
}
export async function saveSkillAssessmentAttempt(value) {
    validateAssessmentAttempt(value);
    const db = await openSystemDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(['assessment_attempts'], 'readwrite');
            const store = tx.objectStore('assessment_attempts');
            let duplicate = false;
            const get = store.get(value.attemptId);
            get.onsuccess = () => {
                if (get.result) {
                    duplicate = true;
                    return;
                }
                store.add({ ...value, verifiedSkillIds: [...value.verifiedSkillIds], weakSkillIds: [...value.weakSkillIds], recommendations: [...value.recommendations], answers: value.answers ? value.answers.map(a => ({ ...a })) : [] });
            };
            get.onerror = () => { try {
                tx.abort();
            }
            catch { } };
            tx.oncomplete = () => resolve({ saved: !duplicate, duplicate });
            tx.onerror = () => reject(errorFrom(tx.error, 'Could not save skill assessment attempt'));
            tx.onabort = () => reject(errorFrom(tx.error, 'Skill assessment save was aborted'));
        });
    }
    finally {
        db.close();
    }
}
export async function listSkillAssessmentAttempts(limit = 50) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500)
        throw new Error('Assessment history limit must be 1-500');
    const db = await openSystemDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(['assessment_attempts'], 'readonly');
            const request = tx.objectStore('assessment_attempts').index('assessedAt').openCursor(null, 'prev');
            const items = [];
            request.onsuccess = () => { const cursor = request.result; if (cursor && items.length < limit) {
                items.push(cursor.value);
                cursor.continue();
            } };
            tx.oncomplete = () => resolve(items);
            tx.onerror = () => reject(errorFrom(tx.error, 'Could not read skill assessment history'));
            tx.onabort = () => reject(errorFrom(tx.error, 'Reading skill assessment history was aborted'));
        });
    }
    finally {
        db.close();
    }
}
function validateSkillMasteryRecord(value) {
    if (!value || typeof value.id !== 'string' || !value.id.trim() || value.id.length > 200 || typeof value.at !== 'string' || !Number.isFinite(Date.parse(value.at)))
        throw new Error('Invalid skill mastery record identity');
    if (!['entrepreneurship', 'global-skills', 'mathematics', 'computer', 'physics', 'unique-thinking'].includes(value.stat))
        throw new Error('Invalid skill mastery stat');
    if (!['practice', 'test', 'project'].includes(value.type) || !Number.isInteger(value.score) || value.score < 0 || value.score > 100 || typeof value.evidence !== 'boolean' || typeof value.note !== 'string' || value.note.length > 500)
        throw new Error('Invalid skill mastery record payload');
    if (value.skillId !== undefined && (typeof value.skillId !== 'string' || value.skillId.length > 120))
        throw new Error('Invalid skill ID');
    if (value.skillTitle !== undefined && (typeof value.skillTitle !== 'string' || value.skillTitle.length > 180))
        throw new Error('Invalid skill title');
    if (value.questId !== undefined && (typeof value.questId !== 'string' || value.questId.length > 160))
        throw new Error('Invalid quest ID');
}
export async function saveSkillMasteryRecord(value) {
    validateSkillMasteryRecord(value);
    const db = await openSystemDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(['skill_assessments'], 'readwrite');
            const store = tx.objectStore('skill_assessments');
            let duplicate = false;
            const get = store.get(value.id);
            get.onsuccess = () => {
                if (get.result) {
                    duplicate = true;
                    return;
                }
                if (value.evidence && value.skillId && value.questId) {
                    const indexRequest = store.index('questSkillEvidence').get([value.questId, value.skillId]);
                    indexRequest.onsuccess = () => {
                        const existing = indexRequest.result;
                        if (existing?.evidence) {
                            duplicate = true;
                            return;
                        }
                        store.add({ ...value });
                    };
                    indexRequest.onerror = () => { try {
                        tx.abort();
                    }
                    catch { } };
                }
                else
                    store.add({ ...value });
            };
            get.onerror = () => { try {
                tx.abort();
            }
            catch { } };
            tx.oncomplete = () => resolve({ saved: !duplicate, duplicate });
            tx.onerror = () => reject(errorFrom(tx.error, 'Could not save skill mastery record'));
            tx.onabort = () => reject(errorFrom(tx.error, 'Skill mastery save was aborted'));
        });
    }
    finally {
        db.close();
    }
}
export async function listSkillMasteryRecords(limit = 300) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
        throw new Error('Skill mastery history limit must be 1-1000');
    const db = await openSystemDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(['skill_assessments'], 'readonly');
            const request = tx.objectStore('skill_assessments').index('at').openCursor(null, 'prev');
            const items = [];
            request.onsuccess = () => { const cursor = request.result; if (cursor && items.length < limit) {
                items.push(cursor.value);
                cursor.continue();
            } };
            tx.oncomplete = () => resolve(items);
            tx.onerror = () => reject(errorFrom(tx.error, 'Could not read skill mastery history'));
            tx.onabort = () => reject(errorFrom(tx.error, 'Reading skill mastery history was aborted'));
        });
    }
    finally {
        db.close();
    }
}
