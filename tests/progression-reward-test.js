"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/legacy/app-controller.js'), 'utf8');
const idempotencySource = fs.readFileSync(path.join(ROOT, 'js/core/progression-idempotency.js'), 'utf8');
class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const testWindow = {};
vm.runInNewContext(idempotencySource, { window: testWindow, console }, { filename: 'progression-idempotency.js' });
const localStorage = new MemoryStorage();
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks++; }
const fnStart = source.indexOf('function applyTypeScriptQuestPlayerReward(reward, safeXP, coins, title) {');
const fnEnd = source.indexOf('\n\n/* =========================================================\n   17. START SYSTEM', fnStart);
check(fnStart >= 0 && fnEnd > fnStart && source.includes('function applyProgressionReward(reward = {}) {'), 'TypeScript-backed central progression reward functions must exist in the app.');
const functionSource = source.slice(fnStart, fnEnd);
const events = [];
const sandbox = {
  SYSTEM_NUMERIC_CAP: 1_000_000_000_000,
  systemState: { player: { level: 1, xp: 0, xpRequired: 1000, coins: 2, rank: 'E' }, stats: { mathematics: {}, computer: {}, physics: {}, 'global-skills': {}, entrepreneurship: {}, 'unique-thinking': {} } },
  window: { SYSTEMTypeScriptProgression: { completeQuest(player, quest, rules, now) { events.push(['player', quest.xpReward]); events.push(['coins', quest.coinReward ?? 0]); const level = player.level; const xp = player.xp + quest.xpReward; const coins = player.coins + (quest.coinReward ?? 0); return { player: { ...player, xp, level, coins, rank: rules.rankForLevel(level) }, quest: { ...quest, status: 'completed', completedAt: now }, leveledUp: [], newlyUnlockedAchievements: [], alreadyCompleted: false }; } } },
  getPlayerXPRequired: level => level === 1 ? 1000 : 1250,
  getRankForLevel: level => level >= 5 ? 'A' : 'E',
  getLocalDateStamp: () => '2026-10-18',
  recordSystemProgress: (field, amount) => (events.push(['progress', field, amount]), true),
  systemCelebrationQueue: [], systemTransactionBusy: true, flushSystemCelebrations() {},
  updatePlayerDisplay() {}, updateRankDisplay() {}, saveSystem: () => true,
  document: { querySelectorAll: () => [] },
  addPlayerXP: xp => (events.push(['player', xp]), true),
  addStatXP: (stat, xp) => (events.push(['stat', stat, xp]), true),
  awardSkillProgressFromActivity: (stat, title, xp, id) => (events.push(['skill', stat, title, xp, id]), true),
  addSystemCoins: coins => (events.push(['coins', coins]), true),
  recordSystemEvent: item => (events.push(['history', item]), true),
  resolveCreditedSkillId: (stat, title, preferred) => {
    events.push(['resolve', stat, title, preferred || null]);
    return preferred || (stat === 'mathematics' && /algebra/i.test(title) ? 'math-algebra-i' : null);
  },
  console
};
sandbox.window.SYSTEMProgressionIdempotency = testWindow.SYSTEMProgressionIdempotency;
sandbox.localStorage = localStorage;
vm.createContext(sandbox);
vm.runInContext(functionSource, sandbox, { filename: 'applyProgressionReward' });

check(sandbox.applyProgressionReward({ type: 'custom-quest', questId: 'custom-quest-1', title: 'Algebra I practice', stat: 'mathematics', xp: 50, coins: 10 }), 'A valid branch-specific activity should succeed.');
check(events.some(e => e[0] === 'player' && e[1] === 50), 'Player XP must be awarded.');
check(events.some(e => e[0] === 'stat' && e[1] === 'mathematics' && e[2] === 50), 'The selected Stat must receive the same activity XP as Player XP.');
check(events.some(e => e[0] === 'skill' && e[1] === 'mathematics' && e[3] === 50 && e[4] === 'math-algebra-i'), 'A confidently resolved Skill must receive its skill progression award.');
check(events.some(e => e[0] === 'history' && e[1].stat === 'mathematics' && e[1].skillId === 'math-algebra-i'), 'The same branch and credited Skill must be written to the activity ledger.');
check(events.some(e => e[0] === 'coins' && e[1] === 10), 'The reward transaction must also process Coins.');
equal(events.filter(e => e[0] === 'player').length, 1, 'Player XP must be awarded exactly once.');
equal(events.filter(e => e[0] === 'stat').length, 1, 'Stat XP must be awarded exactly once.');
equal(events.filter(e => e[0] === 'skill').length, 1, 'Skill XP must be awarded exactly once.');
check(events.some(e => e[0] === 'history' && e[1].eventId === 'v1|custom-quest|custom-quest-1'), 'Reward history must include the stable event ID');
events.length = 0;
check(!sandbox.applyProgressionReward({ type: 'custom-quest', questId: 'custom-quest-1', title: 'Algebra I practice', stat: 'mathematics', xp: 50, coins: 10 }), 'Replaying a committed Custom Quest reward must be rejected');
equal(events.length, 0, 'Replay rejection must happen before any progression side effect');
const savedRecordSystemEvent = sandbox.recordSystemEvent;
sandbox.recordSystemEvent = () => false;
events.length = 0;
const failedWriteId = sandbox.window.SYSTEMProgressionIdempotency.createKey({ type: 'custom-quest', questId: 'custom-quest-failed-history' });
check(!sandbox.applyProgressionReward({ type: 'custom-quest', questId: 'custom-quest-failed-history', title: 'History failure', stat: 'mathematics', xp: 5, coins: 0 }), 'Failed history write must abort the reward operation');
equal(sandbox.window.SYSTEMProgressionIdempotency.inspect(localStorage, failedWriteId).status, 'new', 'A failed history write must not leave a committed idempotency marker');
sandbox.recordSystemEvent = savedRecordSystemEvent;

events.length = 0;
check(sandbox.applyProgressionReward({ type: 'goal', goalId: 'goal-1', title: 'Organize my week', stat: null, xp: 50, coins: 10 }), 'A general reward should succeed.');
check(events.some(e => e[0] === 'player' && e[1] === 50), 'A general reward must still advance Player XP.');
check(!events.some(e => e[0] === 'stat' || e[0] === 'skill' || e[0] === 'resolve'), 'A general reward must not secretly guess a Stat or Skill.');
check(events.some(e => e[0] === 'history' && e[1].stat === null && e[1].skillId === null), 'General rewards must be logged as general.');

events.length = 0;
check(!sandbox.applyProgressionReward({ title: 'Bad stat', stat: 'unknown-branch', xp: 10, coins: 1 }), 'Unknown Stat IDs must be rejected.');
check(!events.length, 'Invalid Stat data must be rejected before any reward mutation.');
check(!sandbox.applyProgressionReward({ title: 'Skill without Stat', skillId: 'math-algebra-i', xp: 10 }), 'A Skill may not be awarded without its parent Stat.');
check(!sandbox.applyProgressionReward({ title: 'Bad XP', stat: 'mathematics', xp: -1 }), 'Invalid XP rewards must be rejected.');

const typedCompletionPlans = fs.readFileSync(path.join(ROOT, 'src/features/quest-completion-plan.ts'), 'utf8');
for (const type of ['daily-quest', 'ai-daily-quest', 'goal', 'boss-quest', 'custom-quest']) {
  const legacyRoute = source.includes(`type: "${type}"`) && source.includes('applyProgressionReward({');
  const typedPlanRoute = ['boss-quest', 'custom-quest'].includes(type)
    && typedCompletionPlans.includes(`type: '${type}'`)
    && source.includes('applyProgressionReward(plan.reward)');
  check(legacyRoute || typedPlanRoute, `${type} must be routed through the central progression pipeline or its typed completion plan.`);
}
check(source.includes('<select name="stat" required>'), 'Goals and Custom Quests must let users choose their progress branch explicitly.');
console.log(`Central progression reward tests passed: ${checks} checks.`);
