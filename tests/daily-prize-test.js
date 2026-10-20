'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/legacy/app-controller.js'), 'utf8');
const start = source.indexOf('const SYSTEM_PERFECT_DAY_KEY = "system_v2_perfect_day";');
const end = source.indexOf('\nfunction setupQuests()', start);
assert.ok(start >= 0 && end > start, 'Daily Prize implementation must be present as one testable section.');
const implementation = source.slice(start, end);
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks++; }

function fakeElement() {
  const classNames = new Set();
  return {
    textContent: '', hidden: false, dataset: {}, offsetWidth: 300,
    classList: {
      add: (...names) => names.forEach(name => classNames.add(name)),
      remove: (...names) => names.forEach(name => classNames.delete(name)),
      toggle: (name, force) => { if (force) classNames.add(name); else classNames.delete(name); return classNames.has(name); },
      contains: name => classNames.has(name)
    }
  };
}

function harness({ random = 0, initialStore = {}, allComplete = true, language = 'en' } = {}) {
  const store = { ...initialStore };
  const awarded = { xp: 0, coins: 0, celebrations: [] };
  const quests = Array.from({ length: 6 }, (_, index) => ({ id: `q${index + 1}` }));
  const completed = Object.fromEntries(quests.map(q => [q.id, allComplete]));
  const ids = ['daily-prize-card', 'daily-prize-kicker', 'daily-prize-state', 'daily-prize-title', 'daily-prize-description', 'daily-prize-progress', 'daily-prize-symbol', 'daily-prize-value', 'daily-prize-reveal', 'daily-prize-rarity', 'daily-prize-name', 'daily-prize-details'];
  const elements = Object.fromEntries(ids.map(id => [id, fakeElement()]));
  const deterministicMath = Object.create(Math);
  deterministicMath.random = () => random;
  const context = {
    Math: deterministicMath,
    SYSTEM_NUMERIC_CAP: 1_000_000_000,
    questDefinitions: quests,
    completedQuests: completed,
    systemCelebrationQueue: awarded.celebrations,
    document: { body: { dataset: { systemLanguage: language } }, getElementById: id => elements[id] || null },
    getLocalDateStamp: () => '2026-10-15',
    readLocalJSON: (key, fallback) => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : fallback,
    writeLocalJSON: (key, value) => (store[key] = value, true),
    addPlayerXP: amount => (awarded.xp += amount, true),
    addSystemCoins: amount => (awarded.coins += amount, true),
    runSystemTransaction: (_label, action) => action() === true,
    console,
    Date
  };
  vm.createContext(context);
  vm.runInContext(implementation, context, { filename: 'daily-prize-section.js' });
  return { context, store, awarded, quests, completed, elements };
}

const basic = harness({ random: 0, allComplete: false });
const pool = vm.runInContext('DAILY_PRIZE_POOL', basic.context);
equal(pool.reduce((sum, prize) => sum + prize.weight, 0), 100, 'Prize probabilities must sum to 100.');
check(pool.every(prize => prize.xp >= 160 && prize.coins >= 50), 'Every random prize must beat the former fixed +150 XP / +50 Coins bonus.');
equal(basic.context.rollDailyPrize().id, 'stardust-cache', 'The low end of the deterministic roll must return a valid defined prize.');
basic.context.renderDailyPrizeCard();
equal(basic.elements['daily-prize-card'].dataset.state, 'locked', 'The card must start locked while Daily Quests remain unfinished.');
equal(basic.elements['daily-prize-progress'].textContent, '0 / 6 missions completed', 'The prize card must display current quest progress.');

const incomplete = harness({ random: 0, allComplete: false });
check(incomplete.context.grantDailyPrize(), 'Incomplete daily quests should not create an error or block the transaction.');
check(!incomplete.store.system_v2_daily_prize, 'The prize must remain locked before all six core daily quests are complete.');
equal(incomplete.awarded.xp, 0, 'Incomplete quests must not award bonus XP.');
equal(incomplete.awarded.coins, 0, 'Incomplete quests must not award bonus Coins.');

const completed = harness({ random: 0 });
check(completed.context.grantDailyPrize(), 'Completing all daily quests must grant a prize.');
const prize = completed.store.system_v2_daily_prize;
check(prize && prize.claimed === true && prize.date === '2026-10-15', 'The exact prize must be persisted with a local-day stamp.');
equal(completed.awarded.xp, prize.xp, 'Player XP must equal the saved random prize XP.');
equal(completed.awarded.coins, prize.coins, 'Player Coins must equal the saved random prize Coins.');
equal(completed.awarded.celebrations.length, 1, 'The successful mystery prize must queue exactly one reveal notice.');
check(completed.awarded.celebrations[0].includes(prize.nameEn), 'The reveal notice must identify the prize that was actually saved.');
completed.context.renderDailyPrizeCard(true);
equal(completed.elements['daily-prize-card'].dataset.state, 'claimed', 'The UI must switch to claimed after awarding the saved prize.');
equal(completed.elements['daily-prize-reveal'].hidden, false, 'The random reward details must be revealed.');
equal(completed.elements['daily-prize-name'].textContent, prize.nameEn, 'The card must show the selected prize name.');
equal(completed.elements['daily-prize-details'].textContent, `+${prize.xp} XP  ·  +${prize.coins} Coins`, 'The card must show the exact saved payout.');
check(completed.context.grantDailyPrize(), 'A repeated grant request must be idempotent.');
equal(completed.awarded.xp, prize.xp, 'A repeated grant must not duplicate XP.');
equal(completed.awarded.coins, prize.coins, 'A repeated grant must not duplicate Coins.');

const legacy = harness({ initialStore: { system_v2_perfect_day: { date: '2026-10-15' } } });
check(legacy.context.grantDailyPrize(), 'Legacy Perfect Day state must not break completion.');
check(!legacy.store.system_v2_daily_prize, 'An earlier-version bonus must not trigger a duplicate mystery payout on the same day.');
equal(legacy.awarded.xp, 0, 'Legacy migration must not award duplicate XP.');
equal(legacy.awarded.coins, 0, 'Legacy migration must not award duplicate Coins.');

const dari = harness({ random: 0, language: 'fa' });
check(dari.context.grantDailyPrize(), 'Dari locale should not affect prize claiming.');
dari.context.renderDailyPrizeCard();
equal(dari.elements['daily-prize-title'].textContent, 'جایزه روز شما', 'The Daily Prize title must be localized to Dari.');
check(dari.elements['daily-prize-details'].textContent.endsWith('سکه'), 'The Dari payout must localize Coins.');

const entry = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const questCss = fs.readFileSync(path.join(ROOT, 'css/pages/quest.css'), 'utf8');
const runtimeCss = fs.readFileSync(path.join(ROOT, 'css/system.css'), 'utf8');
check(entry.includes('id="daily-prize-card"') && entry.includes('id="daily-prize-reveal"'), 'Quest page must contain the persistent Daily Prize reveal card.');
check(questCss.includes('.daily-prize-card.is-claimed') && questCss.includes('@media (prefers-reduced-motion: reduce)'), 'The reveal must have claimed styling and respect reduced-motion preference.');
check(runtimeCss.includes('Source: css/pages/quest.css') && runtimeCss.includes('.daily-prize-card.is-claimed'), 'The Daily Prize styles must be present in the runtime CSS bundle.');
check(source.includes('if (!grantDailyPrize()) return false;'), 'The random prize must be part of the core Daily Quest completion transaction.');
console.log(`SYSTEM Daily Prize tests passed: ${checks} checks.`);
