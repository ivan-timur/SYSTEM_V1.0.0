/*
 * Authoritative runtime progression arithmetic for SYSTEM.
 * This file is compiled to js/generated/progression-math.js and loaded before
 * the compatibility adapter and the legacy controller. Do not edit the output.
 */
type SYSTEMRuntimeRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
type SYSTEMRuntimeXPTrack = { level: number; xp: number; xpRequired: number };
type SYSTEMRuntimeXPTransition = SYSTEMRuntimeXPTrack & { levelsGained: number };
type SYSTEMRuntimeMathAPI = {
  readonly numericCap: number;
  readonly rankThresholds: ReadonlyArray<readonly [SYSTEMRuntimeRank, number]>;
  getPlayerXPRequired(level: number): number;
  getStatXPRequired(level: number): number;
  getSkillXPRequired(level: number): number;
  getRankForLevel(level: number): SYSTEMRuntimeRank;
  advanceXPTrack(
    current: SYSTEMRuntimeXPTrack,
    amount: number,
    requiredForNextLevel: (level: number) => number,
    fallbackRequirement: number,
    maxLevel?: number
  ): SYSTEMRuntimeXPTransition;
};
type SYSTEMRuntimeMathHost = { SYSTEMProgressionMath?: SYSTEMRuntimeMathAPI };

(function exposeSYSTEMProgressionMath(root: SYSTEMRuntimeMathHost): void {
  'use strict';

  const NUMERIC_CAP = 1_000_000_000_000;
  const MAX_LEVEL = 1_000_000;
  const RANK_THRESHOLDS: ReadonlyArray<readonly [SYSTEMRuntimeRank, number]> = Object.freeze([
    Object.freeze(['E', 1] as const),
    Object.freeze(['D', 6] as const),
    Object.freeze(['C', 11] as const),
    Object.freeze(['B', 21] as const),
    Object.freeze(['A', 36] as const),
    Object.freeze(['S', 51] as const)
  ]);

  function positiveLevel(value: number): number {
    return Math.max(1, Math.floor(Number(value) || 1));
  }

  function getPlayerXPRequired(level: number): number {
    const lv = positiveLevel(level);
    return Math.min(NUMERIC_CAP, Math.round((800 + 200 * lv + 2 * lv * lv) / 10) * 10);
  }

  function getStatXPRequired(level: number): number {
    const step = Math.max(0, Math.floor(Number(level) || 1) - 1);
    return Math.min(NUMERIC_CAP, 100 + 25 * step + step * step);
  }

  function getSkillXPRequired(level: number): number {
    const step = positiveLevel(level) - 1;
    return Math.min(NUMERIC_CAP, Math.round(80 + 20 * step + 6 * step * step));
  }

  function getRankForLevel(level: number): SYSTEMRuntimeRank {
    let rank: SYSTEMRuntimeRank = 'E';
    RANK_THRESHOLDS.forEach(([name, minimum]) => {
      if (level >= minimum) rank = name;
    });
    return rank;
  }

  /**
   * Pure transition for Player and Stat XP tracks. It mirrors the established
   * live curve and returns a new record; persistence, history and UI remain in
   * the caller so existing transaction/rollback behavior is preserved.
   */
  function advanceXPTrack(
    current: SYSTEMRuntimeXPTrack,
    amount: number,
    requiredForNextLevel: (level: number) => number,
    fallbackRequirement: number,
    maxLevel = MAX_LEVEL
  ): SYSTEMRuntimeXPTransition {
    if (!current || typeof current !== 'object') throw new Error('XP track is required');
    if (typeof requiredForNextLevel !== 'function') throw new Error('XP threshold function is required');
    const xpAmount = Math.floor(Number(amount));
    if (!Number.isFinite(xpAmount) || xpAmount <= 0) throw new Error('XP award must be a positive finite number');

    const safeMaxLevel = Math.max(1, Math.floor(Number(maxLevel) || MAX_LEVEL));
    let level = Math.min(safeMaxLevel, positiveLevel(current.level));
    let xp = Math.min(NUMERIC_CAP, Math.max(0, Number(current.xp) || 0) + Math.min(xpAmount, NUMERIC_CAP));
    let xpRequired = Math.max(1, Math.min(NUMERIC_CAP, Number(current.xpRequired) || fallbackRequirement));
    if (!Number.isFinite(xpRequired)) throw new Error('Current XP threshold must be finite');

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
})(typeof window !== 'undefined' ? window as unknown as SYSTEMRuntimeMathHost : globalThis as unknown as SYSTEMRuntimeMathHost);
