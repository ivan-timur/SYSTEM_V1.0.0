"use strict";
(function exposeSYSTEMProgressionMath(root) {
    'use strict';
    const NUMERIC_CAP = 1_000_000_000_000;
    const MAX_LEVEL = 1_000_000;
    const RANK_THRESHOLDS = Object.freeze([
        Object.freeze(['E', 1]),
        Object.freeze(['D', 6]),
        Object.freeze(['C', 11]),
        Object.freeze(['B', 21]),
        Object.freeze(['A', 36]),
        Object.freeze(['S', 51])
    ]);
    function positiveLevel(value) {
        return Math.max(1, Math.floor(Number(value) || 1));
    }
    function getPlayerXPRequired(level) {
        const lv = positiveLevel(level);
        return Math.min(NUMERIC_CAP, Math.round((800 + 200 * lv + 2 * lv * lv) / 10) * 10);
    }
    function getStatXPRequired(level) {
        const step = Math.max(0, Math.floor(Number(level) || 1) - 1);
        return Math.min(NUMERIC_CAP, 100 + 25 * step + step * step);
    }
    function getSkillXPRequired(level) {
        const step = positiveLevel(level) - 1;
        return Math.min(NUMERIC_CAP, Math.round(80 + 20 * step + 6 * step * step));
    }
    function getRankForLevel(level) {
        let rank = 'E';
        RANK_THRESHOLDS.forEach(([name, minimum]) => {
            if (level >= minimum)
                rank = name;
        });
        return rank;
    }
    /**
     * Pure transition for Player and Stat XP tracks. It mirrors the established
     * live curve and returns a new record; persistence, history and UI remain in
     * the caller so existing transaction/rollback behavior is preserved.
     */
    function advanceXPTrack(current, amount, requiredForNextLevel, fallbackRequirement, maxLevel = MAX_LEVEL) {
        if (!current || typeof current !== 'object')
            throw new Error('XP track is required');
        if (typeof requiredForNextLevel !== 'function')
            throw new Error('XP threshold function is required');
        const xpAmount = Math.floor(Number(amount));
        if (!Number.isFinite(xpAmount) || xpAmount <= 0)
            throw new Error('XP award must be a positive finite number');
        const safeMaxLevel = Math.max(1, Math.floor(Number(maxLevel) || MAX_LEVEL));
        let level = Math.min(safeMaxLevel, positiveLevel(current.level));
        let xp = Math.min(NUMERIC_CAP, Math.max(0, Number(current.xp) || 0) + Math.min(xpAmount, NUMERIC_CAP));
        let xpRequired = Math.max(1, Math.min(NUMERIC_CAP, Number(current.xpRequired) || fallbackRequirement));
        if (!Number.isFinite(xpRequired))
            throw new Error('Current XP threshold must be finite');
        let levelsGained = 0;
        while (xp >= xpRequired && level < safeMaxLevel) {
            xp -= xpRequired;
            level += 1;
            levelsGained += 1;
            const nextThreshold = Number(requiredForNextLevel(level));
            if (!Number.isFinite(nextThreshold) || nextThreshold <= 0) {
                throw new Error(`Invalid XP threshold for level ${level}`);
            }
            xpRequired = Math.max(1, Math.min(NUMERIC_CAP, nextThreshold));
        }
        return { level, xp, xpRequired, levelsGained };
    }
    root.SYSTEMProgressionMath = Object.freeze({
        numericCap: NUMERIC_CAP,
        rankThresholds: RANK_THRESHOLDS,
        getPlayerXPRequired,
        getStatXPRequired,
        getSkillXPRequired,
        getRankForLevel,
        advanceXPTrack
    });
})(typeof window !== 'undefined' ? window : globalThis);
