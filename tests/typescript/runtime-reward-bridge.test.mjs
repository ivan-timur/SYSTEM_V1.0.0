import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { completeQuest } from '../../dist/ts/core/progression.js';
import { getProgressionRewardIdentity, prepareProgressionReward } from '../../dist/ts/core/reward-command.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(ROOT, 'js/legacy/app-controller.js'), 'utf8');
const start = source.indexOf('function applyTypeScriptQuestPlayerReward(reward, safeXP, coins, title) {');
const end = source.indexOf('\n\n/* =========================================================\n   17. START SYSTEM', start);
assert.ok(start >= 0 && end > start, 'TypeScript reward bridge and central reward pipeline must exist');
const snippet = source.slice(start, end);
const events = [];
class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const idempotencyWindow = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/core/progression-idempotency.js'), 'utf8'), { window: idempotencyWindow, console });
const localStorage = new MemoryStorage();
const seenDomainQuestIds = [];
const sandbox = {
  SYSTEM_NUMERIC_CAP: 1_000_000_000_000,
  window: { SYSTEMTypeScriptProgression: {
    completeQuest(player, quest, rules, now) { seenDomainQuestIds.push(quest.id); return completeQuest(player, quest, rules, now); },
    getRewardIdentity: getProgressionRewardIdentity,
    prepareRewardCommand: prepareProgressionReward,
  }, SYSTEMProgressionIdempotency: idempotencyWindow.SYSTEMProgressionIdempotency },
  localStorage,
  systemState: {
    player: { xp: 990, level: 1, xpRequired: 1000, coins: 2, rank: 'E' },
    stats: { mathematics: {}, computer: {}, physics: {}, 'global-skills': {}, entrepreneurship: {}, 'unique-thinking': {} }
  },
  systemCelebrationQueue: [],
  systemTransactionBusy: true,
  getLocalDateStamp: () => '2026-10-18',
  getPlayerXPRequired: level => level === 1 ? 1000 : level === 2 ? 1250 : 1500,
  getRankForLevel: level => level >= 5 ? 'A' : level >= 2 ? 'D' : 'E',
  recordSystemProgress: (field, amount) => (events.push(['progress', field, amount]), true),
  updatePlayerDisplay() { events.push(['display-player']); },
  updateRankDisplay() { events.push(['display-rank']); },
  saveSystem: () => (events.push(['save-player']), true),
  flushSystemCelebrations() { events.push(['celebrations']); },
  document: { querySelectorAll: () => [] },
  resolveCreditedSkillId: (stat, title, preferred) => preferred || (stat === 'mathematics' ? 'math-algebra-i' : null),
  addStatXP: (stat, xp) => (events.push(['stat', stat, xp]), true),
  awardSkillProgressFromActivity: (stat, title, xp, id) => (events.push(['skill', stat, title, xp, id]), true),
  recordSystemEvent: item => (events.push(['history', item]), true),
  console: { log() {}, info() {}, warn() {}, error(message, error) { throw error || new Error(String(message)); } }
};
vm.createContext(sandbox);
vm.runInContext(snippet, sandbox, { filename: 'legacy-quest-reward-bridge' });

const result = vm.runInContext(`applyProgressionReward({ type: 'custom-quest', questId: 'quest-algebra', title: 'Algebra practice', stat: 'mathematics', xp: 25, coins: 3 })`, sandbox);
assert.equal(result, true, 'A valid learning mission should commit through the real TypeScript domain engine');
assert.equal(sandbox.systemState.player.level, 2, 'Quest completion must apply a Player level-up through completeQuest()');
assert.equal(sandbox.systemState.player.xp, 15, 'Quest completion must carry surplus XP');
assert.equal(sandbox.systemState.player.xpRequired, 1250, 'Quest completion must persist the new level threshold');
assert.equal(sandbox.systemState.player.coins, 5, 'Quest completion must apply coins from the TypeScript result');
assert.ok(events.some(event => event[0] === 'stat' && event[1] === 'mathematics' && event[2] === 25), 'The established Stat XP side effect must remain active');
assert.ok(events.some(event => event[0] === 'skill' && event[4] === 'math-algebra-i'), 'The established skill-award adapter must remain active');
assert.ok(events.some(event => event[0] === 'history' && event[1].questId === 'quest-algebra'), 'The established activity history must remain active');
assert.ok(events.some(event => event[0] === 'history' && event[1].eventId === 'v1|custom-quest|quest-algebra'), 'The TypeScript reward command must provide the canonical idempotency event ID');
assert.ok(seenDomainQuestIds.includes('custom-quest:quest-algebra'), 'The domain transition must consume the canonical TypeScript Quest ID');
assert.ok(events.some(event => event[0] === 'progress' && event[1] === 'totalLevelsGained' && event[2] === 1), 'Level-up counters must remain active');
assert.ok(events.some(event => event[0] === 'save-player'), 'Player data must still be persisted by the legacy compatibility adapter');

const before = { ...sandbox.systemState.player };
const bad = vm.runInContext(`applyProgressionReward({ type: 'custom-quest', title: 'Bad stat', stat: 'missing', xp: 10, coins: 2 })`, sandbox);
assert.equal(bad, false, 'Invalid progression metadata must still be rejected');
assert.deepEqual({ ...sandbox.systemState.player }, before, 'Invalid rewards must not partially mutate player progression');

const routeFixtures = [
  { type: 'daily-quest', questId: 'bridge-daily', title: 'Daily revision', stat: 'mathematics', xp: 7, coins: 1, key: 'v1|daily-quest|bridge-daily|2026-10-18' },
  { type: 'ai-daily-quest', questId: 'bridge-ai-daily', title: 'AI recall mission', stat: 'global-skills', xp: 8, coins: 1, key: 'v1|ai-daily-quest|bridge-ai-daily|2026-10-18' },
  { type: 'custom-quest', questId: 'bridge-custom', title: 'Custom practice', stat: 'computer', xp: 9, coins: 2, key: 'v1|custom-quest|bridge-custom' },
  { type: 'boss-quest', questId: 'bridge-boss', title: 'Boss challenge', stat: 'physics', xp: 10, coins: 2, key: 'v1|boss-quest|bridge-boss' },
  { type: 'goal', goalId: 'bridge-goal', title: 'Finish a goal', stat: null, xp: 11, coins: 3, key: 'v1|goal|bridge-goal' },
  { type: 'goal-evidence-completion', questId: 'bridge-custom-evidence', goalId: 'bridge-goal-evidence', title: 'Evidence-based goal', stat: null, xp: 12, coins: 3, key: 'v1|goal|bridge-goal-evidence' },
];
for (const fixture of routeFixtures) {
  sandbox.rewardFixture = fixture;
  const routeResult = vm.runInContext('applyProgressionReward(rewardFixture)', sandbox);
  assert.equal(routeResult, true, `${fixture.type} must pass through the TypeScript command router`);
  assert.ok(events.some(event => event[0] === 'history' && event[1].eventId === fixture.key), `${fixture.type} history must contain the canonical TypeScript identity`);
}
for (const fixture of routeFixtures) {
  assert.ok(seenDomainQuestIds.some(id => id.startsWith(`${fixture.type === 'goal-evidence-completion' ? 'goal' : fixture.type}:`)), `${fixture.type} must use a canonical TypeScript domain Quest ID`);
}
console.log('TypeScript completeQuest live bridge tests passed: all six Quest/Goal reward routes, canonical IDs, XP, Level, Coins, Stat/Skill integration, history, and invalid-input guard.');
