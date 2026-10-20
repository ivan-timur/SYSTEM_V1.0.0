import assert from 'node:assert/strict';
import {
  SYSTEM_ACHIEVEMENT_RULES,
  getAchievementRuleIds,
  isAchievementEligible,
  isValidAchievementSnapshot,
} from '../../dist/ts/core/achievements.js';

const base = {
  playerLevel: 1,
  totalDailyQuestsCompleted: 0,
  bestDailyStreak: 0,
  totalBossQuestsCompleted: 0,
  maxStatLevel: 1,
  totalCustomQuestsCompleted: 0,
};

assert.equal(SYSTEM_ACHIEVEMENT_RULES.length, 8, 'all current dynamic achievement criteria are held by the TypeScript domain');
assert.equal(new Set(getAchievementRuleIds()).size, 8, 'persisted achievement IDs must be unique');
assert.equal(isValidAchievementSnapshot(base), true);
assert.equal(isAchievementEligible('achievement-first-mission', base), false);
assert.equal(isAchievementEligible('achievement-first-mission', { ...base, totalDailyQuestsCompleted: 1 }), true);
assert.equal(isAchievementEligible('achievement-quest-adept', { ...base, totalDailyQuestsCompleted: 9 }), false);
assert.equal(isAchievementEligible('achievement-quest-adept', { ...base, totalDailyQuestsCompleted: 10 }), true);
assert.equal(isAchievementEligible('achievement-streak-3', { ...base, bestDailyStreak: 2 }), false);
assert.equal(isAchievementEligible('achievement-streak-3', { ...base, bestDailyStreak: 3 }), true);
assert.equal(isAchievementEligible('achievement-streak-7', { ...base, bestDailyStreak: 7 }), true);
assert.equal(isAchievementEligible('achievement-boss-slayer', { ...base, totalBossQuestsCompleted: 1 }), true);
assert.equal(isAchievementEligible('achievement-skill-seeker', { ...base, maxStatLevel: 2 }), true);
assert.equal(isAchievementEligible('achievement-level-five', { ...base, playerLevel: 4 }), false);
assert.equal(isAchievementEligible('achievement-level-five', { ...base, playerLevel: 5 }), true);
assert.equal(isAchievementEligible('achievement-quest-architect', { ...base, totalCustomQuestsCompleted: 1 }), true);
assert.equal(isAchievementEligible('unrecognized-achievement', base), false, 'unknown IDs must fail closed');
assert.equal(isAchievementEligible('achievement-first-mission', { ...base, totalDailyQuestsCompleted: -1 }), false);
assert.equal(isAchievementEligible('achievement-first-mission', { ...base, totalDailyQuestsCompleted: 1.5 }), false);
assert.equal(isAchievementEligible('achievement-first-mission', null), false);
assert.equal(isAchievementEligible('achievement-first-mission', { ...base, bestDailyStreak: Number.NaN }), false);
assert.equal(isValidAchievementSnapshot([]), false);
console.log('TypeScript achievement regression tests passed (8 stable rules, thresholds, validation, and fail-closed behavior).');
