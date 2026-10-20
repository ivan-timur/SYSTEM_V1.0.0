import { getCanonicalDomainQuestId } from '../core/reward-command.js';
import { validateGoalCurriculum } from '../features/goal-curriculum.js';
import { SYSTEM_CORE_DAILY_QUESTS as DAILY_QUESTS, SYSTEM_BOSS_QUESTS as BOSS_QUESTS } from '../data/quest-catalog.js';
import { openSystemDatabase, SYSTEM_DB_NAME, SYSTEM_PLAYER_KEY, SYSTEM_STORES, } from './indexeddb.js';
export const LEGACY_MIGRATION_ID = 'legacy-localstorage-v1';
export const LEGACY_SOURCE_KEYS = Object.freeze({
    save: 'system_v2_save',
    dailyCompleted: 'system_v2_quests',
    dailyDate: 'system_v2_quest_date',
    aiDaily: 'system_v2_ai_daily_quests',
    customQuests: 'system_v2_custom_quests',
    goals: 'system_v2_goals',
    bossCompleted: 'system_v2_boss_completed',
    history: 'system_v2_progress_history',
    progress: 'system_v2_progress',
    questStreak: 'system_v2_quest_streak',
});
const STAT_IDS = ['entrepreneurship', 'global-skills', 'mathematics', 'computer', 'physics', 'unique-thinking'];
const RANKS = new Set(['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']);
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function validDateStamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function localDateStamp(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function asDate(value) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
        return undefined;
    return new Date(value).toISOString();
}
function integer(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < min)
        return fallback;
    return Math.floor(Math.min(max, parsed));
}
function safeId(value, max = 200) {
    return typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value;
}
function parseJson(raw, key, fallback) {
    if (raw === null || raw === '')
        return fallback;
    try {
        return JSON.parse(raw);
    }
    catch {
        throw new Error(`Legacy migration stopped: ${key} contains invalid JSON; the original save was not changed.`);
    }
}
function fingerprint(rawEntries) {
    // Stable non-cryptographic fingerprint for migration replay detection, not security/authentication.
    const input = JSON.stringify(rawEntries);
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}-${input.length}`;
}
function getRawSnapshot(storage) {
    if (!storage || typeof storage.getItem !== 'function')
        throw new Error('Legacy localStorage is unavailable; no migration was started.');
    const entries = Object.values(LEGACY_SOURCE_KEYS).map(key => [key, storage.getItem(key)]);
    return { values: Object.fromEntries(entries), entries };
}
function findHistory(history, types, sourceId, date, goalId) {
    const matches = history.filter(event => {
        if (!types.includes(String(event.type || '')))
            return false;
        if (goalId) {
            if (event.goalId !== goalId)
                return false;
        }
        else if (event.questId !== sourceId)
            return false;
        const at = asDate(event.at);
        return Boolean(at) && (!date || at.slice(0, 10) === date);
    });
    matches.sort((left, right) => (Date.parse(String(left.at)) || 0) - (Date.parse(String(right.at)) || 0));
    return matches[matches.length - 1];
}
function rewardFromHistory(event, fallbackXp, fallbackCoins) {
    const xp = event && Number.isFinite(Number(event.xp)) && Number(event.xp) >= 0
        ? integer(event.xp, fallbackXp, 0, 1_000_000_000_000) : fallbackXp;
    const coins = event && Number.isFinite(Number(event.coins)) && Number(event.coins) >= 0
        ? integer(event.coins, fallbackCoins, 0, 1_000_000_000_000) : fallbackCoins;
    const skillId = event && safeId(event.skillId, 128) ? event.skillId : undefined;
    const completedAt = event ? asDate(event.at) : undefined;
    return { xp, coins, skillId, completedAt };
}
function dailyQuestDateFromId(quest) {
    const parts = quest.id.split(':');
    // Current IDs share the runtime command's canonical identity. The legacy
    // branches are retained only for inspecting historical records produced by
    // older migration planners, never as the identity for a newly planned import.
    const date = parts[0] === 'daily-quest' || parts[0] === 'ai-daily-quest' ? parts[2]
        : parts[0] === 'daily' || parts[0] === 'ai-daily' ? parts[1]
            : undefined;
    return validDateStamp(date) ? date : undefined;
}
function makeQuest(sourceType, sourceId, id, title, xpReward, coinReward, completed, now, extra = {}) {
    return {
        id, title: title.trim().slice(0, 180), status: completed ? 'completed' : 'available',
        xpReward, coinReward, ...(extra.skillId ? { skillId: extra.skillId } : {}),
        ...(completed ? { completedAt: extra.completedAt || now } : {}),
        legacySourceType: sourceType, legacySourceId: sourceId,
        ...(extra.statId ? { statId: extra.statId } : {}),
        ...(extra.description ? { description: extra.description.slice(0, 1000) } : {}),
        ...(extra.goalId ? { goalId: extra.goalId } : {}),
    };
}
/** Build and validate a no-write migration plan from the current legacy storage snapshot. */
export function createLegacyMigrationPlan(storage, now = new Date()) {
    if (!Number.isFinite(now.getTime()))
        throw new Error('Migration timestamp is invalid.');
    const capturedAt = now.toISOString();
    const { values, entries } = getRawSnapshot(storage);
    const warnings = [];
    const sourceFingerprint = fingerprint(entries);
    const parsedSave = parseJson(values[LEGACY_SOURCE_KEYS.save], LEGACY_SOURCE_KEYS.save, null);
    if (!isRecord(parsedSave))
        throw new Error(`No valid ${LEGACY_SOURCE_KEYS.save} save was found; migration was not started.`);
    const rawPlayer = isRecord(parsedSave.player) ? parsedSave.player : parsedSave;
    const rawSkillProgress = isRecord(parsedSave.skillProgress) ? parsedSave.skillProgress : {};
    const level = integer(rawPlayer.level, 1, 1, 1_000_000);
    const xp = integer(rawPlayer.xp, 0, 0, 1_000_000_000_000);
    const coins = integer(rawPlayer.coins, 0, 0, 1_000_000_000_000);
    const rank = typeof rawPlayer.rank === 'string' && RANKS.has(rawPlayer.rank) ? rawPlayer.rank : 'E';
    if (rawPlayer.rank !== undefined && rank === 'E' && rawPlayer.rank !== 'E')
        warnings.push('Player rank was not recognized; the safe fallback rank E was imported.');
    for (const key of ['level', 'xp', 'coins']) {
        if (rawPlayer[key] !== undefined && (!Number.isFinite(Number(rawPlayer[key])) || Number(rawPlayer[key]) < 0)) {
            throw new Error(`Legacy player ${key} is invalid; migration was stopped to avoid importing corrupted progression.`);
        }
    }
    const currentDate = localDateStamp(now);
    const parsedQuestStreak = parseJson(values[LEGACY_SOURCE_KEYS.questStreak], LEGACY_SOURCE_KEYS.questStreak, null);
    let dailyQuestStreak;
    if (parsedQuestStreak !== null) {
        if (!isRecord(parsedQuestStreak))
            throw new Error('Legacy Daily Quest streak state has an invalid shape; migration was stopped.');
        const last = parsedQuestStreak.last;
        const streak = parsedQuestStreak.streak;
        if ((last !== null && !validDateStamp(last)) || !Number.isSafeInteger(streak) || Number(streak) < 0 || Number(streak) > 1_000_000_000 ||
            (last === null && Number(streak) !== 0) || (last !== null && Number(streak) < 1)) {
            throw new Error('Legacy Daily Quest streak values are invalid; migration was stopped to avoid silently resetting progression.');
        }
        dailyQuestStreak = {
            id: 'daily-quest-streak',
            lastDate: last,
            streak: Number(streak),
            bestStreak: Number(streak),
            updatedAt: capturedAt,
            importedFrom: LEGACY_SOURCE_KEYS.questStreak,
        };
    }
    const rawDailyDate = values[LEGACY_SOURCE_KEYS.dailyDate];
    const storedDailyDate = validDateStamp(rawDailyDate) ? rawDailyDate : currentDate;
    if (rawDailyDate !== null && !validDateStamp(rawDailyDate))
        warnings.push('The legacy Daily Quest date was invalid; the browser-local migration date was used for date-scoped quest IDs.');
    const completedRaw = parseJson(values[LEGACY_SOURCE_KEYS.dailyCompleted], LEGACY_SOURCE_KEYS.dailyCompleted, {});
    if (!isRecord(completedRaw))
        throw new Error('Legacy Daily Quest completion state has an invalid shape; migration was stopped.');
    const completedDaily = storedDailyDate === currentDate ? completedRaw : {};
    if (storedDailyDate !== currentDate && Object.values(completedRaw).some(value => value === true)) {
        warnings.push('Daily Quest completion flags belonged to another day; they were not treated as completed today. Historical records remain in the imported activity history.');
    }
    const rawAI = parseJson(values[LEGACY_SOURCE_KEYS.aiDaily], LEGACY_SOURCE_KEYS.aiDaily, null);
    let aiDate;
    let aiItems = [];
    if (rawAI !== null) {
        if (!isRecord(rawAI))
            throw new Error('Legacy AI Daily Quest data has an invalid shape; migration was stopped.');
        if (validDateStamp(rawAI.date))
            aiDate = rawAI.date;
        if (Array.isArray(rawAI.items)) {
            aiItems = rawAI.items.filter(isRecord);
            if (aiItems.length !== rawAI.items.length)
                warnings.push('Malformed AI Daily Quest entries were skipped.');
        }
        else
            warnings.push('AI Daily Quest items were not an array and were not imported.');
        if (aiItems.length > 30) {
            aiItems = aiItems.slice(0, 30);
            warnings.push('AI Daily Quest records were limited to the first 30 valid entries.');
        }
    }
    const rawCustom = parseJson(values[LEGACY_SOURCE_KEYS.customQuests], LEGACY_SOURCE_KEYS.customQuests, []);
    const rawGoals = parseJson(values[LEGACY_SOURCE_KEYS.goals], LEGACY_SOURCE_KEYS.goals, []);
    const rawBossCompleted = parseJson(values[LEGACY_SOURCE_KEYS.bossCompleted], LEGACY_SOURCE_KEYS.bossCompleted, []);
    const rawHistory = parseJson(values[LEGACY_SOURCE_KEYS.history], LEGACY_SOURCE_KEYS.history, []);
    const rawProgress = parseJson(values[LEGACY_SOURCE_KEYS.progress], LEGACY_SOURCE_KEYS.progress, {});
    if (!Array.isArray(rawCustom))
        throw new Error('Legacy Custom Quest list is not an array; migration was stopped.');
    if (!Array.isArray(rawGoals))
        throw new Error('Legacy Goal list is not an array; migration was stopped.');
    if (!Array.isArray(rawBossCompleted))
        throw new Error('Legacy Boss Quest completion list is not an array; migration was stopped.');
    if (!Array.isArray(rawHistory))
        throw new Error('Legacy activity history is not an array; migration was stopped.');
    if (!isRecord(rawProgress))
        throw new Error('Legacy progression counters have an invalid shape; migration was stopped.');
    const history = rawHistory.filter(isRecord);
    if (history.length !== rawHistory.length)
        warnings.push('Malformed legacy activity-history entries were skipped; valid records were retained.');
    const bossCompleted = new Set(rawBossCompleted.filter((id) => safeId(id)));
    if (bossCompleted.size !== rawBossCompleted.length)
        warnings.push('Invalid or duplicate Boss Quest completion IDs were ignored.');
    const quests = [];
    const usedIds = new Set();
    const addQuest = (quest) => {
        if (usedIds.has(quest.id))
            throw new Error(`Two legacy records resolve to the same migrated Quest ID: ${quest.id}`);
        usedIds.add(quest.id);
        quests.push(quest);
    };
    // Old Daily and AI Daily state shared a raw ID map. The history's type/date is the more
    // precise signal; ambiguous cross-catalog ID collisions are deliberately not guessed.
    const aiIds = new Set(aiItems.filter(item => safeId(item.id)).map(item => String(item.id)));
    for (const definition of DAILY_QUESTS) {
        const event = findHistory(history, ['daily-quest'], definition.id, storedDailyDate);
        const mappedComplete = completedDaily[definition.id] === true && !aiIds.has(definition.id);
        const completed = Boolean(event) || mappedComplete;
        if (completed && !event)
            warnings.push(`Daily Quest ${definition.id} was marked completed without a matching activity event; its configured reward was used only as migration metadata.`);
        const reward = rewardFromHistory(event, definition.xp, definition.coins);
        addQuest(makeQuest('daily-quest', definition.id, getCanonicalDomainQuestId('daily-quest', definition.id, storedDailyDate), definition.title, completed ? reward.xp : definition.xp, completed ? reward.coins : definition.coins, completed, capturedAt, { statId: definition.stat || undefined, skillId: reward.skillId, completedAt: reward.completedAt }));
    }
    for (const item of aiItems) {
        if (!safeId(item.id) || typeof item.title !== 'string' || !item.title.trim()) {
            warnings.push('An AI Daily Quest with an invalid ID/title was skipped.');
            continue;
        }
        const date = aiDate || currentDate;
        const id = String(item.id);
        const event = findHistory(history, ['ai-daily-quest'], id, date);
        const ambiguousDailyId = aiIds.has(id) && DAILY_QUESTS.some(item2 => item2.id === id);
        const completed = Boolean(event) || (date === currentDate && completedRaw[id] === true && !ambiguousDailyId);
        if (completed && !event)
            warnings.push(`AI Daily Quest ${id} was marked completed without a matching activity event; its configured reward was used only as migration metadata.`);
        const baseXP = integer(item.xp, 50, 0, 1_000_000_000_000);
        const baseCoins = integer(item.coins, 10, 0, 1_000_000_000_000);
        const reward = rewardFromHistory(event, baseXP, baseCoins);
        const stat = typeof item.stat === 'string' && STAT_IDS.includes(item.stat) ? item.stat : undefined;
        addQuest(makeQuest('ai-daily-quest', id, getCanonicalDomainQuestId('ai-daily-quest', id, date), String(item.title), completed ? reward.xp : baseXP, completed ? reward.coins : baseCoins, completed, capturedAt, { statId: stat, skillId: reward.skillId || (safeId(item.skillId, 128) ? item.skillId : undefined),
            description: typeof item.description === 'string' ? item.description : undefined, completedAt: reward.completedAt }));
    }
    for (const item of rawCustom) {
        if (!isRecord(item) || !safeId(item.id) || typeof item.title !== 'string' || !item.title.trim()) {
            warnings.push('A malformed Custom Quest was skipped.');
            continue;
        }
        const sourceId = String(item.id);
        const event = findHistory(history, ['custom-quest'], sourceId);
        const completed = item.completed === true || Boolean(event) || Boolean(asDate(item.completedAt));
        if (completed && !event)
            warnings.push(`Custom Quest ${sourceId} was already marked completed without a matching activity event; no new reward was applied during migration.`);
        const baseXP = integer(item.xp, 50, 0, 1_000_000_000_000);
        const baseCoins = integer(item.coins, 10, 0, 1_000_000_000_000);
        const reward = rewardFromHistory(event, baseXP, baseCoins);
        const stat = typeof item.stat === 'string' && STAT_IDS.includes(item.stat) ? item.stat : undefined;
        addQuest(makeQuest('custom-quest', sourceId, getCanonicalDomainQuestId('custom-quest', sourceId), String(item.title), completed ? reward.xp : baseXP, completed ? reward.coins : baseCoins, completed, capturedAt, { statId: stat, skillId: reward.skillId || (safeId(item.skillId, 128) ? item.skillId : undefined),
            description: typeof item.description === 'string' ? item.description : undefined,
            goalId: safeId(item.goalId) ? item.goalId : undefined,
            completedAt: reward.completedAt || asDate(item.completedAt) }));
    }
    const goalIds = new Set();
    for (const item of rawGoals) {
        if (!isRecord(item) || !safeId(item.id) || typeof item.title !== 'string' || !item.title.trim()) {
            warnings.push('A malformed Goal was skipped.');
            continue;
        }
        const sourceId = String(item.id);
        if (goalIds.has(sourceId)) {
            warnings.push(`Duplicate Goal ${sourceId} was skipped.`);
            continue;
        }
        goalIds.add(sourceId);
        const event = findHistory(history, ['goal', 'goal-evidence-completion'], sourceId, undefined, sourceId);
        const completed = item.completed === true || String(item.status || '').toLowerCase() === 'completed' || Boolean(asDate(item.completedAt)) || Boolean(event);
        const reward = rewardFromHistory(event, 50, 10);
        const stat = typeof item.stat === 'string' && STAT_IDS.includes(item.stat) ? item.stat : undefined;
        addQuest(makeQuest('goal', sourceId, `goal:${sourceId}`, String(item.title), completed ? reward.xp : 50, completed ? reward.coins : 10, completed, capturedAt, { statId: stat, skillId: reward.skillId || (safeId(item.skillId, 128) ? item.skillId : undefined),
            description: typeof item.description === 'string' ? item.description : undefined,
            goalId: sourceId, completedAt: reward.completedAt || asDate(item.completedAt) }));
        if (completed && !event)
            warnings.push(`Goal ${sourceId} appears completed but no matching activity event was found; migration recorded it as completed without applying a reward.`);
    }
    // Phase 7: convert the legacy Goal/evidence model to the typed curriculum
    // schema inside the same approved migration snapshot. Legacy evidence is proof
    // of Quest completion only; it never becomes verified Skill mastery.
    const goalCurricula = [];
    const goalEvidence = [];
    const curriculumByGoalId = new Map();
    const legacyEvidenceQuestId = (sourceQuestId) => {
        // Historical Goal evidence is accepted only when it points to a Custom
        // Quest that is itself imported as completed. Never manufacture a canonical
        // Quest identity for a missing or still-open Quest and treat it as evidence.
        const matchingQuest = quests.find(quest => quest.legacySourceType === 'custom-quest'
            && quest.status === 'completed'
            && (quest.legacySourceId === sourceQuestId || quest.id === sourceQuestId));
        return matchingQuest?.id;
    };
    const legacyGoalEntries = new Map();
    // Goal IDs have already been deduplicated above; only those valid Goals may
    // participate in the durable curriculum. Keep the import deterministic.
    for (const rawGoal of rawGoals) {
        if (!isRecord(rawGoal) || !safeId(rawGoal.id) || typeof rawGoal.title !== 'string' || !rawGoal.title.trim())
            continue;
        const goalId = String(rawGoal.id);
        if (legacyGoalEntries.has(goalId))
            continue;
        const stat = typeof rawGoal.stat === 'string' && STAT_IDS.includes(rawGoal.stat)
            ? rawGoal.stat : null;
        const targetCount = integer(rawGoal.targetCount, 3, 1, 20);
        const rawEvidence = Array.isArray(rawGoal.evidence) ? rawGoal.evidence.slice(0, 20) : [];
        const seenQuestIds = new Set();
        const normalizedEvidence = [];
        for (const item of rawEvidence) {
            if (!isRecord(item) || !safeId(item.questId) || typeof item.title !== 'string' || !item.title.trim())
                continue;
            const sourceQuestId = String(item.questId);
            if (seenQuestIds.has(sourceQuestId))
                continue;
            seenQuestIds.add(sourceQuestId);
            const rawEvidenceStat = typeof item.stat === 'string' && STAT_IDS.includes(item.stat)
                ? item.stat : null;
            const skillId = safeId(item.skillId, 200) ? item.skillId : null;
            normalizedEvidence.push({
                sourceQuestId,
                title: item.title.trim().slice(0, 180),
                at: asDate(item.at) || new Date(0).toISOString(),
                stat: stat || rawEvidenceStat,
                skillId,
            });
        }
        const explicitlyCompleted = rawGoal.completed === true || String(rawGoal.status || '').toLowerCase() === 'completed'
            || Boolean(asDate(rawGoal.completedAt));
        legacyGoalEntries.set(goalId, { stat, targetCount, evidence: normalizedEvidence, completed: explicitlyCompleted });
    }
    for (const [goalId, legacy] of legacyGoalEntries) {
        const milestones = Array.from({ length: legacy.targetCount }, (_, index) => ({
            id: `legacy-${goalId.slice(0, 150)}-${index + 1}`,
            title: `Linked quest ${index + 1}`,
            requiredEvidence: 1,
            requiredSkillIds: [],
            prerequisiteIds: index ? [`legacy-${goalId.slice(0, 150)}-${index}`] : [],
        }));
        const evidence = [];
        for (const item of legacy.evidence) {
            const questId = legacyEvidenceQuestId(item.sourceQuestId);
            if (!questId || questId.length > 200) {
                warnings.push(`Goal ${goalId} evidence for Quest ${item.sourceQuestId} could not be mapped to a completed durable Custom Quest and was skipped.`);
                continue;
            }
            if (evidence.length >= milestones.length) {
                warnings.push(`Goal ${goalId} contains more historical evidence than its imported milestone limit; excess evidence was skipped.`);
                continue;
            }
            const evidenceId = `legacy-${fingerprint([['goal', goalId], ['quest', item.sourceQuestId]]).replace(/[^a-zA-Z0-9:-]/g, '')}`;
            // Use the next accepted evidence slot, not the raw array index. If an old
            // evidence record is rejected, later valid proof must not land beyond an
            // uncompleted prerequisite and become unusable.
            const milestone = milestones[evidence.length];
            evidence.push({
                id: evidenceId.slice(0, 190), questId, milestoneId: milestone.id,
                title: item.title, at: item.at, stat: item.stat,
                skillId: item.skillId, skillVerification: null, passed: true,
            });
        }
        const curriculum = validateGoalCurriculum({
            id: goalId, title: String(rawGoals.find(value => isRecord(value) && value.id === goalId)?.title || goalId).trim().slice(0, 180),
            stat: legacy.stat, milestones, evidence, completed: legacy.completed || evidence.length >= legacy.targetCount,
        });
        curriculumByGoalId.set(goalId, curriculum);
        goalCurricula.push(curriculum);
        for (const item of evidence)
            goalEvidence.push({ ...item, goalId });
    }
    // Rebind eligible uncompleted Custom Quests to the next unused typed milestone.
    // Completed Quests only retain a link when their historical Goal evidence exists;
    // that prevents a legacy reward from being retroactively counted as proof.
    for (const quest of quests) {
        if (quest.legacySourceType !== 'custom-quest' || !quest.goalId)
            continue;
        const goal = curriculumByGoalId.get(quest.goalId);
        const legacyGoal = legacyGoalEntries.get(quest.goalId);
        if (!goal || !legacyGoal) {
            delete quest.goalId;
            warnings.push(`Custom Quest ${quest.legacySourceId} referenced a missing Goal and was detached during curriculum import.`);
            continue;
        }
        if (goal.stat !== null && (quest.statId ?? null) !== goal.stat) {
            delete quest.goalId;
            warnings.push(`Custom Quest ${quest.legacySourceId} used a different Stat from Goal ${goal.id} and was detached during curriculum import.`);
            continue;
        }
        const historicalEvidenceIndex = legacyGoal.evidence.findIndex(item => item.sourceQuestId === quest.legacySourceId);
        const matchingImportedEvidence = goal.evidence.find(item => item.questId === quest.id);
        if (quest.status === 'completed') {
            if (historicalEvidenceIndex >= 0 && matchingImportedEvidence)
                quest.milestoneId = matchingImportedEvidence.milestoneId;
            else {
                delete quest.goalId;
                warnings.push(`Completed Custom Quest ${quest.legacySourceId} had no matching Goal evidence and was detached to avoid inventing progress.`);
            }
            continue;
        }
        if (goal.completed) {
            delete quest.goalId;
            warnings.push(`Custom Quest ${quest.legacySourceId} was linked to already-completed Goal ${goal.id} and was detached.`);
            continue;
        }
        const occupied = new Set(goal.evidence.map(item => item.milestoneId));
        // Existing converted evidence occupies sequential milestones, and earlier
        // imported Custom Quests reserve their own future milestones.
        const nextMilestone = goal.milestones.find(milestone => !occupied.has(milestone.id)
            && !quests.some(other => other !== quest && other.legacySourceType === 'custom-quest'
                && other.goalId === goal.id && other.milestoneId === milestone.id));
        if (!nextMilestone) {
            delete quest.goalId;
            warnings.push(`Custom Quest ${quest.legacySourceId} had no free milestone in Goal ${goal.id} and was detached.`);
            continue;
        }
        quest.milestoneId = nextMilestone.id;
    }
    for (const definition of BOSS_QUESTS) {
        const event = findHistory(history, ['boss-quest'], definition.id);
        const completed = bossCompleted.has(definition.id) || Boolean(event);
        const reward = rewardFromHistory(event, definition.xp, definition.coins);
        addQuest(makeQuest('boss-quest', definition.id, getCanonicalDomainQuestId('boss-quest', definition.id), definition.title, completed ? reward.xp : definition.xp, completed ? reward.coins : definition.coins, completed, capturedAt, { completedAt: reward.completedAt }));
        if (completed && !event)
            warnings.push(`Boss Quest ${definition.id} was already claimed but its activity event was not found; it remains completed to prevent a second reward.`);
    }
    const completedQuests = quests.filter(quest => quest.status === 'completed');
    const xpEvents = completedQuests.map(quest => {
        const sourceEvent = findHistory(history, [quest.legacySourceType], quest.legacySourceId, quest.legacySourceType === 'daily-quest' || quest.legacySourceType === 'ai-daily-quest'
            ? dailyQuestDateFromId(quest) : undefined, quest.legacySourceType === 'goal' ? quest.legacySourceId : undefined);
        const createdAt = asDate(sourceEvent?.at) || asDate(quest.completedAt) || capturedAt;
        return {
            id: `quest:${quest.id}`, questId: quest.id, amount: quest.xpReward,
            ...(quest.skillId ? { skillId: quest.skillId } : {}), createdAt,
        };
    });
    const playerSkills = {};
    const skillRecords = [];
    for (const [id, value] of Object.entries(rawSkillProgress)) {
        if (!safeId(id, 128) || !isRecord(value)) {
            warnings.push('A malformed saved Skill Progress record was skipped.');
            continue;
        }
        const skillLevel = integer(value.level, 1, 1, 1_000_000);
        const skillXP = integer(value.xp, 0, 0, 1_000_000_000_000);
        const skill = {
            id, level: skillLevel, xp: skillXP,
            ...(Number.isFinite(Number(value.totalXp)) ? { totalXp: integer(value.totalXp, 0, 0, 1_000_000_000_000) } : {}),
            ...(Number.isFinite(Number(value.xpRequired)) && Number(value.xpRequired) > 0 ? { xpRequired: integer(value.xpRequired, 1, 1, 1_000_000_000_000) } : {}),
            ...(value.lastActivityAt === null || asDate(value.lastActivityAt) ? { lastActivityAt: value.lastActivityAt === null ? null : asDate(value.lastActivityAt) } : {}),
        };
        playerSkills[id] = {
            id, level: skillLevel, xp: skillXP,
            ...(skill.totalXp !== undefined ? { totalXp: skill.totalXp } : {}),
            ...(skill.xpRequired !== undefined ? { xpRequired: skill.xpRequired } : {}),
            ...(skill.lastActivityAt !== undefined ? { lastActivityAt: skill.lastActivityAt } : {}),
        };
        skillRecords.push(skill);
    }
    const player = {
        xp, level, coins, rank,
        skills: playerSkills,
        completedQuestIds: completedQuests.map(quest => quest.id),
        xpEvents,
        achievements: [], // The legacy build derives achievement eligibility from counters; it does not store a canonical unlocked-ID list.
    };
    const persistedPlayer = { ...player, id: SYSTEM_PLAYER_KEY };
    const stats = STAT_IDS.map(statId => {
        const raw = isRecord(parsedSave.stats) && isRecord(parsedSave.stats[statId]) ? parsedSave.stats[statId] : {};
        const defaults = { entrepreneurship: 'Entrepreneurship', 'global-skills': 'Global Skills', mathematics: 'Mathematics', computer: 'Computer', physics: 'Physics', 'unique-thinking': 'Unique Thinking' };
        return {
            id: `stat:${statId}`, statId,
            name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 100) : defaults[statId],
            level: integer(raw.level, 1, 1, 1_000_000),
            xp: integer(raw.xp, 0, 0, 1_000_000_000_000),
            xpRequired: integer(raw.xpRequired, 100, 1, 1_000_000_000_000),
        };
    });
    const activities = [];
    const seenActivityIds = new Set();
    history.forEach((event, index) => {
        const at = asDate(event.at);
        if (!at || typeof event.title !== 'string')
            return;
        let baseId = safeId(event.eventId, 280) ? `legacy-event:${event.eventId}` : `legacy-history:${at}:${index}`;
        baseId = baseId.slice(0, 280);
        let id = baseId;
        let suffix = 1;
        while (seenActivityIds.has(id))
            id = `${baseId.slice(0, 265)}:${suffix++}`;
        seenActivityIds.add(id);
        activities.push({ ...event, id, at, importedFrom: LEGACY_SOURCE_KEYS.history });
    });
    const progressCounters = {};
    for (const [key, value] of Object.entries(rawProgress)) {
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
            progressCounters[key] = integer(value, 0, 0, 1_000_000_000_000);
        else
            warnings.push(`Progress counter ${key} was invalid and was not imported.`);
    }
    return {
        migrationId: LEGACY_MIGRATION_ID,
        sourceFingerprint,
        capturedAt,
        currentDate,
        player: persistedPlayer,
        quests,
        xpEvents,
        skills: skillRecords,
        stats,
        activities,
        goalCurricula,
        goalEvidence,
        progressCounters,
        ...(dailyQuestStreak ? { dailyQuestStreak } : {}),
        summary: {
            questCount: quests.length, completedQuestCount: completedQuests.length,
            xpEventCount: xpEvents.length, skillCount: skillRecords.length,
            statCount: stats.length, activityCount: activities.length,
        },
        warnings: [...new Set(warnings)],
    };
}
function toPreview(plan) {
    return {
        migrationId: plan.migrationId,
        sourceFingerprint: plan.sourceFingerprint,
        capturedAt: plan.capturedAt,
        currentDate: plan.currentDate,
        summary: { ...plan.summary },
        warnings: [...plan.warnings],
        destination: `${SYSTEM_DB_NAME} (IndexedDB)`,
        destructive: false,
    };
}
/** Read-only preview; it touches no localStorage or IndexedDB data. */
export function previewLegacyLocalStorageMigration(storage, now = new Date()) {
    return toPreview(createLegacyMigrationPlan(storage, now));
}
function isValidFingerprint(value) {
    return typeof value === 'string' && /^fnv1a32-[0-9a-f]{8}-\d+$/.test(value);
}
/**
 * Create an approval only after the caller has shown the preview and received
 * an affirmative user action. If the preview has warnings, callers must also
 * explicitly acknowledge those warnings. The approval binds the action to the
 * exact source fingerprint and local calendar date that were reviewed.
 */
export function createLegacyMigrationApproval(preview, options, confirmedAt = new Date()) {
    if (!preview || preview.migrationId !== LEGACY_MIGRATION_ID || preview.destructive !== false
        || preview.destination !== `${SYSTEM_DB_NAME} (IndexedDB)`
        || !isValidFingerprint(preview.sourceFingerprint) || !validDateStamp(preview.currentDate)) {
        throw new Error('Migration preview is invalid; generate a new preview before confirming migration.');
    }
    if (!options || options.confirmed !== true) {
        throw new Error('Legacy migration requires explicit user confirmation after reviewing the preview.');
    }
    if (!Array.isArray(preview.warnings) || (preview.warnings.length > 0 && options.warningsAcknowledged !== true)) {
        throw new Error('Migration preview contains warnings; review and acknowledge them before continuing.');
    }
    if (!(confirmedAt instanceof Date) || !Number.isFinite(confirmedAt.getTime())) {
        throw new Error('Migration confirmation timestamp is invalid.');
    }
    if (localDateStamp(confirmedAt) !== preview.currentDate) {
        throw new Error('The migration preview belongs to another date. Generate a fresh preview before confirming.');
    }
    return {
        migrationId: LEGACY_MIGRATION_ID,
        sourceFingerprint: preview.sourceFingerprint,
        currentDate: preview.currentDate,
        confirmedAt: confirmedAt.toISOString(),
        confirmed: true,
        warningsAcknowledged: preview.warnings.length === 0 || options.warningsAcknowledged === true,
    };
}
/**
 * Rebuild the source plan and validate its approval immediately before opening
 * IndexedDB. Returns the fresh plan only when the reviewed snapshot still
 * matches and the local calendar date has not rolled over.
 */
export function validateLegacyMigrationApproval(storage, approval, now = new Date()) {
    if (!approval || approval.migrationId !== LEGACY_MIGRATION_ID || approval.confirmed !== true
        || !isValidFingerprint(approval.sourceFingerprint) || !validDateStamp(approval.currentDate)
        || typeof approval.confirmedAt !== 'string' || !Number.isFinite(Date.parse(approval.confirmedAt))) {
        throw new Error('Migration approval is invalid; review a fresh preview and confirm again.');
    }
    if (!Number.isFinite(now.getTime()))
        throw new Error('Migration timestamp is invalid.');
    const confirmedAt = new Date(approval.confirmedAt);
    if (confirmedAt.getTime() > now.getTime())
        throw new Error('Migration approval timestamp is in the future.');
    if (localDateStamp(confirmedAt) !== approval.currentDate || localDateStamp(now) !== approval.currentDate) {
        throw new Error('The migration preview date has changed. No data was written; generate a fresh preview and confirm again.');
    }
    const plan = createLegacyMigrationPlan(storage, now);
    if (plan.sourceFingerprint !== approval.sourceFingerprint) {
        throw new Error('The migration preview is stale because legacy localStorage changed. No data was written; generate a fresh preview and confirm again.');
    }
    if (plan.currentDate !== approval.currentDate) {
        throw new Error('The migration preview date no longer matches the current plan. No data was written; generate a fresh preview and confirm again.');
    }
    if (plan.warnings.length > 0 && approval.warningsAcknowledged !== true) {
        throw new Error('Migration warnings were not acknowledged. No data was written.');
    }
    return plan;
}
function errorFrom(value, fallback) {
    if (value instanceof Error)
        return value;
    if (typeof DOMException !== 'undefined' && value instanceof DOMException && value.message)
        return new Error(value.message);
    return new Error(fallback);
}
/** Read-only check for the explicit migration marker. This method never changes either store. */
export async function getLegacyMigrationDatabaseStatus() {
    const db = await openSystemDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(['migrations'], 'readonly');
            const request = tx.objectStore('migrations').get(LEGACY_MIGRATION_ID);
            let raw;
            let failure;
            request.onsuccess = () => { raw = request.result; };
            request.onerror = () => {
                failure = errorFrom(request.error, 'Could not inspect the legacy migration marker.');
                try {
                    tx.abort();
                }
                catch { /* transaction already inactive */ }
            };
            tx.onerror = () => { failure ??= errorFrom(tx.error, 'Could not inspect the legacy migration marker.'); };
            tx.onabort = () => reject(failure ?? errorFrom(tx.error, 'Migration status read was aborted.'));
            tx.oncomplete = () => {
                if (failure) {
                    reject(failure);
                    return;
                }
                if (!isRecord(raw) || raw.id !== LEGACY_MIGRATION_ID || typeof raw.sourceFingerprint !== 'string') {
                    resolve({ migrationId: LEGACY_MIGRATION_ID, status: 'not-migrated', warnings: [] });
                    return;
                }
                const summaryValue = isRecord(raw.summary) ? raw.summary : undefined;
                const summary = summaryValue ? {
                    questCount: integer(summaryValue.questCount, 0),
                    completedQuestCount: integer(summaryValue.completedQuestCount, 0),
                    xpEventCount: integer(summaryValue.xpEventCount, 0),
                    skillCount: integer(summaryValue.skillCount, 0),
                    statCount: integer(summaryValue.statCount, 0),
                    activityCount: integer(summaryValue.activityCount, 0),
                } : undefined;
                resolve({
                    migrationId: LEGACY_MIGRATION_ID,
                    status: 'migrated',
                    sourceFingerprint: raw.sourceFingerprint,
                    ...(typeof raw.completedAt === 'string' ? { completedAt: raw.completedAt } : {}),
                    ...(validDateStamp(raw.currentDate) ? { currentDate: raw.currentDate } : {}),
                    ...(summary ? { summary } : {}),
                    warnings: Array.isArray(raw.warnings) ? raw.warnings.filter((item) => typeof item === 'string') : [],
                });
            };
        });
    }
    finally {
        db.close();
    }
}
/**
 * Atomically import the legacy aggregate, Quest/status inventory, Stat/Skill data,
 * recent activity history and progress counters. It never clears localStorage.
 * A preview-bound explicit approval is mandatory. The target DB must be empty
 * unless this exact source fingerprint was imported.
 */
export async function migrateLegacyLocalStorageToIndexedDB(storage, approval, now = new Date()) {
    const plan = validateLegacyMigrationApproval(storage, approval, now);
    const preview = toPreview(plan);
    const db = await openSystemDatabase();
    try {
        return await new Promise((resolve, reject) => {
            let failure;
            let output;
            const stores = [...SYSTEM_STORES];
            const tx = db.transaction(stores, 'readwrite');
            const migrationStore = tx.objectStore('migrations');
            const migrationRead = migrationStore.get(LEGACY_MIGRATION_ID);
            const entityStoreNames = stores.filter(name => name !== 'migrations');
            const counts = {};
            let remaining = entityStoreNames.length + 1;
            let existingMigration;
            const fail = (value) => {
                if (!failure)
                    failure = errorFrom(value, 'Legacy progress migration failed');
                try {
                    tx.abort();
                }
                catch { /* The transaction may already be inactive. */ }
            };
            const ready = () => {
                remaining -= 1;
                if (remaining !== 0 || failure)
                    return;
                try {
                    const currentSourceFingerprint = fingerprint(getRawSnapshot(storage).entries);
                    if (currentSourceFingerprint !== plan.sourceFingerprint) {
                        throw new Error('Legacy localStorage changed while migration was being prepared. No data was written; run preview again and retry.');
                    }
                    if (isRecord(existingMigration)) {
                        if (existingMigration.sourceFingerprint !== plan.sourceFingerprint) {
                            throw new Error('SYSTEM already contains a legacy migration made from different source data. The database was not overwritten; export/backup before any reset.');
                        }
                        const previousSummary = isRecord(existingMigration.summary) ? existingMigration.summary : preview.summary;
                        const previousWarnings = Array.isArray(existingMigration.warnings)
                            ? existingMigration.warnings.filter((item) => typeof item === 'string') : preview.warnings;
                        output = {
                            ...preview,
                            capturedAt: typeof existingMigration.completedAt === 'string' ? existingMigration.completedAt : preview.capturedAt,
                            currentDate: validDateStamp(existingMigration.currentDate) ? existingMigration.currentDate : preview.currentDate,
                            summary: {
                                questCount: integer(previousSummary.questCount, preview.summary.questCount),
                                completedQuestCount: integer(previousSummary.completedQuestCount, preview.summary.completedQuestCount),
                                xpEventCount: integer(previousSummary.xpEventCount, preview.summary.xpEventCount),
                                skillCount: integer(previousSummary.skillCount, preview.summary.skillCount),
                                statCount: integer(previousSummary.statCount, preview.summary.statCount),
                                activityCount: integer(previousSummary.activityCount, preview.summary.activityCount),
                            },
                            warnings: previousWarnings,
                            status: 'already-migrated',
                        };
                        return;
                    }
                    const nonEmpty = Object.entries(counts).filter(([, count]) => Number(count) > 0);
                    if (nonEmpty.length > 0) {
                        throw new Error(`SYSTEM IndexedDB is not empty (${nonEmpty.map(([name]) => name).join(', ')}); migration refused to avoid overwriting existing data.`);
                    }
                    const playerStore = tx.objectStore('player');
                    const questStore = tx.objectStore('quests');
                    const xpStore = tx.objectStore('xp_events');
                    const skillStore = tx.objectStore('skills');
                    const statStore = tx.objectStore('stats');
                    const historyStore = tx.objectStore('activity_history');
                    playerStore.add(plan.player);
                    for (const quest of plan.quests)
                        questStore.add(quest);
                    for (const event of plan.xpEvents)
                        xpStore.add(event);
                    for (const skill of plan.skills)
                        skillStore.add(skill);
                    for (const stat of plan.stats)
                        statStore.add(stat);
                    for (const activity of plan.activities)
                        historyStore.add(activity);
                    const curriculumStore = tx.objectStore('goal_curricula');
                    const evidenceStore = tx.objectStore('goal_evidence');
                    for (const curriculum of plan.goalCurricula)
                        curriculumStore.add({ ...curriculum, importedFrom: LEGACY_MIGRATION_ID, updatedAt: now.toISOString() });
                    for (const evidence of plan.goalEvidence)
                        evidenceStore.add(evidence);
                    // Counters now have their own canonical record so later Quest transactions
                    // can increment them inside the same IndexedDB commit as progression.
                    tx.objectStore('app_state').add({
                        id: 'progress-counters',
                        counters: plan.progressCounters,
                        updatedAt: now.toISOString(),
                        importedFrom: LEGACY_MIGRATION_ID,
                    });
                    if (plan.dailyQuestStreak)
                        tx.objectStore('app_state').add(plan.dailyQuestStreak);
                    migrationStore.add({
                        id: LEGACY_MIGRATION_ID,
                        sourceFingerprint: plan.sourceFingerprint,
                        completedAt: now.toISOString(),
                        sourceKeys: Object.values(LEGACY_SOURCE_KEYS),
                        progressCounters: plan.progressCounters,
                        summary: plan.summary,
                        warnings: plan.warnings,
                        currentDate: plan.currentDate,
                    });
                    output = { ...preview, status: 'migrated' };
                }
                catch (error) {
                    fail(error);
                }
            };
            tx.oncomplete = () => output ? resolve(output) : reject(new Error('Migration transaction completed without a result'));
            tx.onerror = () => { failure ??= errorFrom(tx.error, 'Legacy progress migration failed'); };
            tx.onabort = () => reject(failure ?? errorFrom(tx.error, 'Legacy progress migration was aborted'));
            migrationRead.onsuccess = () => { existingMigration = migrationRead.result; ready(); };
            migrationRead.onerror = () => fail(migrationRead.error ?? new Error('Could not read migration marker'));
            for (const name of entityStoreNames) {
                const request = tx.objectStore(name).count();
                request.onsuccess = () => { counts[name] = request.result; ready(); };
                request.onerror = () => fail(request.error ?? new Error(`Could not inspect IndexedDB store ${name}`));
            }
        });
    }
    finally {
        db.close();
    }
}
