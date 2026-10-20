/**
 * Typed Quest rules used by the legacy UI during staged migration.
 *
 * This module is intentionally pure: no DOM, storage writes, reward mutation,
 * or browser globals. The old controller remains an adapter until each storage
 * path has a tested transactional replacement.
 */
import { SYSTEM_STAT_IDS } from '../core/reward-command.js';
import { SYSTEM_BOSS_QUESTS } from '../data/quest-catalog.js';
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function cleanId(value, label) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 200) {
        throw new Error(`${label} must be a non-empty trimmed string of at most 200 characters`);
    }
    return value;
}
function boundedInteger(value, fallback, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return fallback;
    return Math.max(min, Math.min(max, Math.floor(numeric)));
}
/**
 * Normalize the existing localStorage Custom Quest array without changing its
 * storage key or dropping forward-compatible properties on valid legacy records.
 */
export function normalizeLegacyCustomQuests(value, validStatIds = SYSTEM_STAT_IDS) {
    if (!Array.isArray(value))
        return [];
    const seenIds = new Set();
    const normalized = [];
    for (const item of value) {
        if (!isRecord(item)
            || typeof item.id !== 'string' || !item.id.trim() || item.id !== item.id.trim() || item.id.length > 200
            || typeof item.title !== 'string' || !item.title.trim() || seenIds.has(item.id))
            continue;
        seenIds.add(item.id);
        const stat = typeof item.stat === 'string' && validStatIds.includes(item.stat) ? item.stat : null;
        const goalId = typeof item.goalId === 'string' && item.goalId.trim() && item.goalId.length <= 200 ? item.goalId : null;
        const skillId = typeof item.skillId === 'string' && item.skillId.length <= 128 ? item.skillId : null;
        normalized.push({
            ...item,
            id: item.id,
            title: item.title.trim().slice(0, 80),
            description: typeof item.description === 'string' ? item.description.slice(0, 180) : '',
            stat,
            goalId,
            skillId,
            xp: boundedInteger(item.xp, 50, 5, 1000),
            coins: boundedInteger(item.coins, 10, 0, 500),
            completed: item.completed === true,
        });
    }
    return normalized.slice(-1000);
}
/** Validate one new Custom Quest before it is appended to the legacy save. */
export function createCustomQuestRecord(input, validStatIds = SYSTEM_STAT_IDS, activeGoalIds = []) {
    if (!isRecord(input))
        throw new Error('Custom Quest draft must be an object');
    const id = cleanId(input.id, 'Custom Quest ID');
    if (typeof input.title !== 'string' || !input.title.trim())
        throw new Error('Custom Quest title is required');
    const title = input.title.trim();
    if (title.length > 80)
        throw new Error('Custom Quest title must not exceed 80 characters');
    if (input.description !== undefined && typeof input.description !== 'string') {
        throw new Error('Custom Quest description must be text');
    }
    const description = String(input.description ?? '').trim();
    if (description.length > 180)
        throw new Error('Custom Quest description must not exceed 180 characters');
    const stat = input.stat === null || input.stat === undefined || input.stat === '' ? null : input.stat;
    if (stat !== null && (typeof stat !== 'string' || !validStatIds.includes(stat))) {
        throw new Error('Custom Quest Stat is not valid');
    }
    const goalId = input.goalId === null || input.goalId === undefined || input.goalId === ''
        ? null : cleanId(input.goalId, 'Custom Quest Goal ID');
    if (goalId && !activeGoalIds.includes(goalId))
        throw new Error('Custom Quest Goal is not active');
    const xp = Number(input.xp);
    const coins = Number(input.coins);
    if (!Number.isSafeInteger(xp) || xp < 5 || xp > 1000)
        throw new Error('Custom Quest XP must be an integer from 5 to 1000');
    if (!Number.isSafeInteger(coins) || coins < 0 || coins > 500)
        throw new Error('Custom Quest Coins must be an integer from 0 to 500');
    if (typeof input.createdAt !== 'string' || !Number.isFinite(Date.parse(input.createdAt))) {
        throw new Error('Custom Quest creation timestamp is invalid');
    }
    return {
        id, title, description, stat: stat, goalId,
        xp, coins, completed: false, createdAt: input.createdAt,
    };
}
/** Explicit completion guard shared by Custom Quest UI and future commands. */
export function canCompleteCustomQuest(value) {
    return isRecord(value)
        && typeof value.id === 'string' && value.id.trim() === value.id && value.id.length > 0 && value.id.length <= 200
        && typeof value.title === 'string' && Boolean(value.title.trim())
        && value.completed !== true;
}
function normalizedBossSnapshot(value) {
    const snapshot = isRecord(value) ? value : {};
    return {
        completedDailyQuestCount: boundedInteger(snapshot.completedDailyQuestCount, 0, 0, 1_000_000),
        playerLevel: boundedInteger(snapshot.playerLevel, 1, 1, 1_000_000),
        bestStatLevel: boundedInteger(snapshot.bestStatLevel, 1, 1, 1_000_000),
    };
}
/** Canonical, read-only Boss Quest definitions for the existing UI adapter. */
export function getBossQuestDefinitions() {
    return SYSTEM_BOSS_QUESTS.map(quest => ({ ...quest }));
}
/**
 * Evaluate one Boss Quest from a minimal progression snapshot. Unknown IDs fail
 * closed. Descriptive progress labels intentionally preserve the existing UI.
 */
export function getBossQuestStatus(id, input) {
    if (typeof id !== 'string' || !id.trim())
        return null;
    const quest = SYSTEM_BOSS_QUESTS.find(item => item.id === id);
    if (!quest)
        return null;
    const snapshot = normalizedBossSnapshot(input);
    let current;
    let progressLabel;
    switch (quest.condition) {
        case 'daily-quest-count':
            current = snapshot.completedDailyQuestCount;
            progressLabel = `${Math.min(current, quest.threshold)} / ${quest.threshold} Daily Quests`;
            break;
        case 'player-level':
            current = snapshot.playerLevel;
            progressLabel = `Level ${current} / ${quest.threshold}`;
            break;
        case 'best-stat-level':
            current = snapshot.bestStatLevel;
            progressLabel = `Best Stat Level: ${current} / ${quest.threshold}`;
            break;
    }
    return { id: quest.id, eligible: current >= quest.threshold, current, target: quest.threshold, progressLabel };
}
