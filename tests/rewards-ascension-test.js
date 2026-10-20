'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }

const extension = read('js/features/rewards-ascension.js');
const rewardsPlus = read('js/features/rewards-plus.js');
const appEntry = read('js/app.js');
const builtCSS = read('css/system.css');
const serviceWorker = read('sw.js');
const packageJSON = JSON.parse(read('package.json'));

// Release wiring and bundled assets.
check(appEntry.includes('"./features/rewards-ascension.js"'), 'Reward Ascension must be loaded by the app entry point.');
check(appEntry.indexOf('"./features/rewards-plus.js"') < appEntry.indexOf('"./features/rewards-ascension.js"'), 'Reward Ascension must load after the stable rewards engine.');
check(builtCSS.includes('Source: css/features/rewards-ascension.css'), 'The final Rewards refinement must be included in the runtime stylesheet.');
check(builtCSS.lastIndexOf('Source: css/features/rewards-ascension.css') > builtCSS.lastIndexOf('Source: css/refinements/apex-style.css'), 'Reward Ascension styles must be last to take visual precedence.');
check(serviceWorker.includes('js/features/rewards-ascension.js') && serviceWorker.includes('css/features/rewards-ascension.css'), 'Offline cache must include all new Rewards assets.');
check(packageJSON.version === read('VERSION').trim(), 'Package version must match VERSION.');

// Reward routes, stable rewards, and transaction-safe actions.
for (const title of ['Quest Champion', 'Quest Legend', 'Two-Month Flame', 'Century Flame', 'Level Thirty', 'Level Fifty', 'Level Hundred', 'Boss Conqueror', 'Boss Myth', 'Guild Master', 'Core Apex', 'Six Pillars']) {
    check(rewardsPlus.includes(`"${title}"`), `Expanded permanent achievement missing: ${title}`);
}
check(rewardsPlus.includes('A("level-hundred", "Level Hundred"'), 'Level 100 must be a progress-aware achievement.');
check(rewardsPlus.includes('A("quest-legend", "Quest Legend"'), '500 daily quests must be a progress-aware achievement.');
check(rewardsPlus.includes('A("streak-100", "Century Flame"'), '100-day streak must be a progress-aware achievement.');
check(rewardsPlus.includes('definition.category !== "daily" && definition.category !== "mission"'), 'Permanent collection must not count resettable rewards as permanent unlocks.');
check(rewardsPlus.includes('Number(dailyLoginReady)'), 'Collectable daily-login rewards must be included in the ready counter.');
check(extension.includes('const FAVORITES_KEY = "system_v2_reward_favorites"'), 'Favourites must use a stable persistent key.');
check(extension.includes('option.value = "saved"'), 'Favourites status filter must be wired.');
check(extension.includes('URL.createObjectURL(blob)'), 'History export must create a downloadable CSV.');
check(extension.includes('function csvCell(value)'), 'CSV export must quote/escape cells.');
check(extension.includes('!isTrustedNumber && /^[\\s\\u0000-\\u001f]*[=+@\\-]/.test(text)'), 'CSV export must guard against formula injection.');
check(extension.includes('RARE PROTECTION') && extension.includes('LEGENDARY PROTECTION'), 'Mystery vault pity meters must be accessible.');
check(extension.includes('data-ra-route'), 'Milestone route actions must link to reward details.');
const rewardsPlusSource = rewardsPlus;
check(rewardsPlusSource.includes('const CATS = [[\"daily\", \"mission\"], [\"achievement\"], [\"special\"]];'), 'Mission tab must group daily and mission rewards while achievement and special tabs stay distinct.');
check(rewardsPlusSource.includes('CATS[index]?.includes(definition.category)'), 'Tab badges must count only rewards belonging to each visible category.');
check(rewardsPlusSource.includes('categories.includes(definition.category)'), 'Reward filtering must route by the active tab category group.');
check(/@media \(max-width: 520px\)/.test(builtCSS), 'Rewards runtime CSS must include a phone layout.');
check(builtCSS.includes('@media (prefers-reduced-motion: reduce)'), 'Rewards transitions must respect reduced-motion preference.');
check(!/!important\b/i.test(builtCSS), 'Built CSS must not use !important declarations.');

// Bootstrap the extension against a tiny, deterministic DOM facade to catch runtime wiring errors.
function fakeElement() {
    return {
        isConnected: true, className: '', dataset: {}, style: {}, hidden: false, textContent: '', innerHTML: '',
        setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, click() {},
        after(node) { node.isConnected = true; this.afterNode = node; },
        querySelector() { return null; }, querySelectorAll() { return []; },
        get options() { return []; }
    };
}
const page = fakeElement();
const hub = fakeElement();
const grid = fakeElement();
page.querySelector = selector => selector === '.rp-hub' ? hub : selector === '#reward-card-grid' ? grid : null;
const document = {
    getElementById: id => id === 'rewards-page' ? page : null,
    createElement: () => fakeElement()
};
const testDefinitions = {
    'First Mission': { id: 'achievement-first-mission', category: 'achievement', description: 'Complete your first Daily Quest.' },
    Explorer: { id: 'explorer', category: 'achievement', description: 'Reach Level 2.' },
    'Three-Day Streak': { id: 'achievement-streak-3', category: 'achievement', description: 'Reach a 3-day login streak.' }
};
const context = {
    document,
    window: {},
    rewardDefinitions: testDefinitions,
    rewardState: { claimed: [] },
    systemState: { player: { level: 1, xp: 25, xpRequired: 100, coins: 0 } },
    systemProgress: { totalDailyQuestsCompleted: 0 },
    dailyLoginState: { currentStreak: 0, bestStreak: 0 },
    readLocalJSON: (_key, fallback) => fallback,
    writeLocalJSON: () => true,
    canClaimReward: () => false,
    notifySystem() {},
    console
};
context.window = context;
context.window.updateRewardCards = function () {};
vm.createContext(context);
vm.runInContext(extension, context, { filename: 'rewards-ascension.js' });
check(typeof context.updateRewardCards === 'function', 'The enhanced reward updater must be registered.');
check(Boolean(hub.afterNode && hub.afterNode.className === 'ra-ascension'), 'Reward Route panel must attach after the reward hub.');
check(hub.afterNode.innerHTML.includes('Your Reward Route'), 'Reward Route must render its heading.');
check(hub.afterNode.innerHTML.includes('Explorer'), 'Reward Route must show the next level milestone.');
check(hub.afterNode.innerHTML.includes('First Mission'), 'Reward Route must show the next quest milestone.');
check(hub.afterNode.innerHTML.includes('Three-Day Streak'), 'Reward Route must show the next login streak milestone.');

console.log(`SYSTEM Rewards Ascension tests passed: ${checks} checks.`);
