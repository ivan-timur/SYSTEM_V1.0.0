'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const runtimeSource = fs.readFileSync(path.join(ROOT, 'js/generated/progression-math.js'), 'utf8');
const source = fs.readFileSync(path.join(ROOT, 'js/core/progression-math.js'), 'utf8');
const window = {};
const sandbox = { window, globalThis: {}, Number, Math, Object, String };
vm.createContext(sandbox);
vm.runInContext(runtimeSource, sandbox, { filename: 'js/generated/progression-math.js', timeout: 5000 });
vm.runInContext(source, sandbox, { filename: 'js/core/progression-math.js', timeout: 5000 });
const math = window.SYSTEMProgressionMath;
assert.ok(math, 'Progression math module must expose its compatibility API.');
let checks = 1;
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks++; }
function check(condition, message) { assert.ok(condition, message); checks++; }

equal(math.getPlayerXPRequired(1), 1000, 'Player level-one XP requirement must preserve the established curve.');
equal(math.getPlayerXPRequired(50), 15800, 'Level-50 player requirement must preserve the established reachable curve.');
equal(math.getStatXPRequired(1), 100, 'Stat level-one XP requirement must be 100.');
equal(math.getSkillXPRequired(1), 80, 'Skill level-one XP requirement must be 80.');
equal(math.getRankForLevel(0), 'E', 'Rank below level one must fall back to E.');
equal(math.getRankForLevel(6), 'D', 'Rank D begins at level 6.');
equal(math.getRankForLevel(11), 'C', 'Rank C begins at level 11.');
equal(math.getRankForLevel(21), 'B', 'Rank B begins at level 21.');
equal(math.getRankForLevel(36), 'A', 'Rank A begins at level 36.');
equal(math.getRankForLevel(51), 'S', 'Rank S begins at level 51.');
equal(math.getRankForLevel('51'), 'S', 'Numeric strings are handled compatibly by rank lookup.');
equal(math.getPlayerXPRequired(-10), math.getPlayerXPRequired(1), 'Invalid lower player levels normalize to level one.');
equal(math.getStatXPRequired(-10), 100, 'Invalid lower Stat levels normalize to the baseline.');
equal(math.getSkillXPRequired(-10), 80, 'Invalid lower Skill levels normalize to the baseline.');
check(math.numericCap === 1_000_000_000_000, 'Module cap must stay aligned with persisted progression limits.');
check(Object.isFrozen(math), 'Shared math API should be immutable.');
check(Object.isFrozen(math.rankThresholds) && math.rankThresholds.every(Object.isFrozen), 'Rank threshold data should be immutable.');
check(typeof math.advanceXPTrack === 'function', 'TypeScript runtime must expose XP transition logic.');
const playerTransition = math.advanceXPTrack({ level: 1, xp: 990, xpRequired: 1000 }, 25, math.getPlayerXPRequired, 1000);
equal(playerTransition.level, 2, 'TypeScript XP transition should process a Player level-up.');
equal(playerTransition.xp, 15, 'TypeScript XP transition must preserve XP overflow.');
equal(playerTransition.xpRequired, math.getPlayerXPRequired(2), 'TypeScript XP transition must update the next threshold.');
equal(playerTransition.levelsGained, 1, 'TypeScript XP transition must report level-up count.');
const statTransition = math.advanceXPTrack({ level: 1, xp: 95, xpRequired: 100 }, 15, math.getStatXPRequired, 100);
equal(statTransition.level, 2, 'TypeScript XP transition should work for Stat tracks.');
equal(statTransition.xp, 10, 'Stat XP transition should preserve overflow.');
const immutableInput = { level: 1, xp: 95, xpRequired: 100 };
math.advanceXPTrack(immutableInput, 15, math.getStatXPRequired, 100);
equal(immutableInput.xp, 95, 'Pure XP transition must not mutate input records.');
assert.throws(() => math.advanceXPTrack({ level: 1, xp: 0, xpRequired: 100 }, -2, math.getStatXPRequired, 100), /positive finite number/);
checks += 1;
assert.throws(() => math.advanceXPTrack({ level: 1, xp: 100, xpRequired: 100 }, 5, () => 0, 100), /Invalid XP threshold/);
checks += 1;

for (let level = 1; level < 500; level++) {
  check(math.getPlayerXPRequired(level + 1) >= math.getPlayerXPRequired(level), 'Player XP curve must be monotonic.');
  check(math.getStatXPRequired(level + 1) >= math.getStatXPRequired(level), 'Stat XP curve must be monotonic.');
  check(math.getSkillXPRequired(level + 1) >= math.getSkillXPRequired(level), 'Skill XP curve must be monotonic.');
}
check(Number.isFinite(math.getPlayerXPRequired(Number.MAX_SAFE_INTEGER)), 'Player requirement must stay finite for huge inputs.');
check(Number.isFinite(math.getStatXPRequired(Number.MAX_SAFE_INTEGER)), 'Stat requirement must stay finite for huge inputs.');
check(Number.isFinite(math.getSkillXPRequired(Number.MAX_SAFE_INTEGER)), 'Skill requirement must stay finite for huge inputs.');
check(math.getPlayerXPRequired(Number.MAX_SAFE_INTEGER) <= math.numericCap, 'Player requirement must respect the cap.');
check(math.getStatXPRequired(Number.MAX_SAFE_INTEGER) <= math.numericCap, 'Stat requirement must respect the cap.');
check(math.getSkillXPRequired(Number.MAX_SAFE_INTEGER) <= math.numericCap, 'Skill requirement must respect the cap.');

console.log(`SYSTEM progression-math tests passed: ${checks} checks.`);
