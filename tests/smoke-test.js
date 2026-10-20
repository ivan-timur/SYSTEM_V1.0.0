'use strict';

async function main() {

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const appPath = path.join(ROOT, 'js', 'legacy', 'app-controller.js');
const appSource = fs.readFileSync(appPath, 'utf8');
const storageModulePath = path.join(ROOT, 'js', 'core', 'storage.js');
const storageModuleSource = fs.readFileSync(storageModulePath, 'utf8');
const skillReviewModulePath = path.join(ROOT, 'js', 'core', 'skill-review.js');
const skillReviewModuleSource = fs.readFileSync(skillReviewModulePath, 'utf8');
const skillCurriculumSource = fs.readFileSync(path.join(ROOT, 'js/core/skill-curriculum.js'), 'utf8');
const progressionMathRuntimeSource = fs.readFileSync(path.join(ROOT, 'js/generated/progression-math.js'), 'utf8');
const progressionMathSource = fs.readFileSync(path.join(ROOT, 'js/core/progression-math.js'), 'utf8');
const aiQuestParserSource = fs.readFileSync(path.join(ROOT, 'js/features/ai-quest-parser.js'), 'utf8');
const activityLedgerDomain = require(path.join(ROOT, 'dist/ts/core/activity-ledger.js'));
const questCommandDomain = require(path.join(ROOT, 'dist/ts/features/quest-command.js'));
let checks = 0;
function check(condition, message) {
    assert.ok(condition, message);
    checks++;
}
function equal(actual, expected, message) {
    assert.equal(actual, expected, message);
    checks++;
}

// 1) Parser/syntax, HTML ids, assets, and JSON files.
const jsFiles = [];
function walkJavaScript(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkJavaScript(full);
        else if (entry.isFile() && entry.name.endsWith('.js')) jsFiles.push(full);
    }
}
walkJavaScript(path.join(ROOT, 'js'));
for (const jsFile of jsFiles) {
    execFileSync(process.execPath, ['--check', jsFile], { stdio: 'pipe' });
    checks++;
}
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid\s*=\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
equal(duplicates.length, 0, `Duplicate HTML IDs: ${duplicates.join(', ')}`);
for (const match of html.matchAll(/(?:src|href)\s*=\s*['"]([^'"]+)['"]/g)) {
    const ref = match[1];
    if (/^(?:https?:|data:|#|mailto:|javascript:)/i.test(ref)) continue;
    const filePath = path.resolve(ROOT, ref.split(/[?#]/)[0]);
    check(filePath.startsWith(ROOT + path.sep) && fs.existsSync(filePath), `Missing or unsafe local asset reference: ${ref}`);
}
const cssFiles = [];
function walkCss(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkCss(full);
        else if (entry.isFile() && entry.name.endsWith('.css')) cssFiles.push(full);
    }
}
walkCss(path.join(ROOT, 'css'));
for (const cssFile of cssFiles) {
    const css = fs.readFileSync(cssFile, 'utf8');
    for (const match of css.matchAll(/url\(\s*(['\"]?)(.*?)\1\s*\)/gi)) {
        const ref = match[2].trim();
        if (!ref || /^(?:data:|https?:|#|var\()/i.test(ref)) continue;
        const filePath = path.resolve(path.dirname(cssFile), ref.split(/[?#]/)[0]);
        check(filePath.startsWith(ROOT + path.sep) && fs.existsSync(filePath), `Missing or unsafe CSS asset reference in ${path.relative(ROOT, cssFile)}: ${ref}`);
    }
}
const webpFiles = [];
function walkWebp(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkWebp(full);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.webp')) webpFiles.push(full);
    }
}
walkWebp(path.join(ROOT, 'assets'));
for (const webpFile of webpFiles) {
    const header = fs.readFileSync(webpFile).subarray(0, 12);
    check(header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP', `File has a .webp extension but invalid WebP signature: ${path.relative(ROOT, webpFile)}`);
}
let jsonFiles = 0;
function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith('.json')) {
            JSON.parse(fs.readFileSync(full, 'utf8'));
            jsonFiles++;
        }
    }
}
walk(ROOT);
check(jsonFiles >= 10, 'Expected the bundled default/reference JSON data to be present.');

// 2) Lightweight browser environment, allowing app.js helpers and progression logic to run in Node.
class MemoryStorage {
    constructor() { this.values = new Map(); this.failKeys = new Set(); }
    get length() { return this.values.size; }
    key(index) { return [...this.values.keys()][index] ?? null; }
    getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
    setItem(key, value) {
        const normalizedKey = String(key);
        if (this.failKeys.has(normalizedKey)) throw new Error(`Synthetic storage failure for ${normalizedKey}`);
        this.values.set(normalizedKey, String(value));
    }
    removeItem(key) { this.values.delete(String(key)); }
    clear() { this.values.clear(); }
}
const localStorage = new MemoryStorage();
const document = {
    documentElement: { dataset: {} },
    body: { appendChild() {}, removeChild() {} },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    addEventListener() {},
    createElement() {
        return {
            classList: { add() {}, remove() {}, toggle() {} },
            dataset: {}, style: {}, attributes: {},
            setAttribute() {}, appendChild() {}, remove() {},
            addEventListener() {}, querySelector() { return null; },
            querySelectorAll() { return []; },
            replaceChildren() {},
            click() {}
        };
    }
};
const quietConsole = { log() {}, info() {}, warn() {}, error() {} };
const browserWindow = {
    localStorage,
    SYSTEMTypeScriptActivityLedger: Object.freeze({ ...activityLedgerDomain }),
    SYSTEMTypeScriptQuestDomain: Object.freeze({
        normalizeLegacyCustomQuests: questCommandDomain.normalizeLegacyCustomQuests,
        createCustomQuestRecord: questCommandDomain.createCustomQuestRecord,
        canCompleteCustomQuest: questCommandDomain.canCompleteCustomQuest,
        getBossQuestDefinitions: questCommandDomain.getBossQuestDefinitions,
        getBossQuestStatus: questCommandDomain.getBossQuestStatus,
    }),
    setInterval() { return 1; }, setTimeout, clearTimeout,
    confirm() { return true; }, location: { reload() {} },
    addEventListener() {}
};
const sandbox = {
    console: quietConsole,
    document,
    localStorage,
    TextEncoder,
    navigator: { onLine: true, clipboard: null },
    window: browserWindow,
    setTimeout,
    clearTimeout,
    setInterval() { return 1; },
    clearInterval() {},
    AbortController,
    URL,
    Blob,
    Date,
    Math,
    JSON,
    Number,
    String,
    Object,
    Array,
    Set,
    Map,
    RegExp,
    Promise,
    Error,
    crypto: globalThis.crypto,
    fetch: async () => { throw new Error('Unexpected live API request in unit tests.'); }
};
vm.createContext(sandbox);
vm.runInContext(progressionMathRuntimeSource, sandbox, { filename: 'js/generated/progression-math.js', timeout: 10000 });
vm.runInContext(progressionMathSource, sandbox, { filename: 'js/core/progression-math.js', timeout: 10000 });
check(Boolean(browserWindow.SYSTEMProgressionMath), 'Shared progression-math API must initialize before legacy code.');
vm.runInContext(storageModuleSource, sandbox, { filename: 'js/core/storage.js', timeout: 10000 });
check(Boolean(browserWindow.SYSTEMStorage), 'SYSTEM storage integrity module should initialize before the app.');
vm.runInContext(skillCurriculumSource, sandbox, { filename: 'js/core/skill-curriculum.js', timeout: 10000 });
check(Boolean(browserWindow.SYSTEMSkillCurriculum), 'Detailed curriculum should initialize before the app controller.');
vm.runInContext(aiQuestParserSource, sandbox, { filename: 'js/features/ai-quest-parser.js', timeout: 10000 });
check(Boolean(browserWindow.SYSTEMAIQuestParser), 'AI quest parser API should initialize before the app controller.');
vm.runInContext(appSource, sandbox, { filename: 'js/legacy/app-controller.js', timeout: 10000 });
vm.runInContext(skillReviewModuleSource, sandbox, { filename: 'js/core/skill-review.js', timeout: 10000 });

// Skill Review: validation, persistence, summary, recommendation, and export.
check(Boolean(browserWindow.SYSTEMSkillReview), 'Skill Review API should be exposed.');
const skillReviewResult = vm.runInContext(`(() => {
    const api = window.SYSTEMSkillReview;
    const invalidStat = api.record({ stat: 'hacking', rating: 4 });
    const invalidRating = api.record({ stat: 'mathematics', rating: 8 });
    const first = api.record({ stat: 'mathematics', rating: 2, evidence: false, note: 'Need more algebra practice' });
    const second = api.record({ stat: 'computer', rating: 4, evidence: true, note: 'Built a small script' });
    const third = api.record({ stat: 'mathematics', rating: 3, evidence: true, note: 'Solved ten equations' });
    return { invalidStat, invalidRating, first, second, third, list: api.list(2), summary: api.summary(), recommendation: api.recommendation(), exported: JSON.parse(api.exportJSON()) };
})()`, sandbox);
check(!skillReviewResult.invalidStat.ok && skillReviewResult.invalidStat.error === 'invalid-stat', 'Skill Review must reject unknown branches.');
check(!skillReviewResult.invalidRating.ok && skillReviewResult.invalidRating.error === 'invalid-rating', 'Skill Review must reject ratings outside 1–5.');
check(skillReviewResult.first.ok && skillReviewResult.second.ok && skillReviewResult.third.ok, 'Valid skill reviews should be accepted.');
equal(skillReviewResult.list.length, 2, 'Skill Review list should respect requested limits.');
equal(skillReviewResult.list[0].rating, 3, 'Skill Review list should show newest reviews first.');
equal(skillReviewResult.summary.total, 3, 'Skill Review summary should count stored reviews.');
equal(skillReviewResult.summary.evidenceCount, 2, 'Skill Review summary should count evidence flags.');
equal(skillReviewResult.summary.byStat.mathematics.average, 2.5, 'Skill Review averages should be calculated accurately.');
equal(skillReviewResult.recommendation.stat, 'mathematics', 'Skill Review should recommend the lowest self-rated branch.');
equal(skillReviewResult.exported.formatVersion, 1, 'Skill Review export should include a format version.');
equal(skillReviewResult.exported.reviews.length, 3, 'Skill Review export should include retained reviews.');
check(!('xp' in skillReviewResult.first.review) && !('coins' in skillReviewResult.first.review), 'Self-reviews must not grant XP or coins.');

// Activity Ledger API: event persistence, safe summary, bounded history, and export.
check(Boolean(browserWindow.SYSTEMProgressLedger), 'Activity Ledger API should be exposed after app initialization.');
const ledgerResult = vm.runInContext(`(() => {
    const before = window.SYSTEMProgressLedger.list(300).length;
    const first = recordSystemEvent({ type: 'ledger-test', title: 'Ledger regression test', stat: 'mathematics', xp: 35, coins: 4 });
    const second = recordSystemEvent({ type: 'ledger-test', title: 'Ledger second event', stat: 'computer', xp: 15, coins: 2 });
    const list = window.SYSTEMProgressLedger.list(2);
    const summary = window.SYSTEMProgressLedger.summary(7);
    const exported = JSON.parse(window.SYSTEMProgressLedger.exportJSON());
    return { before, first, second, list, summary, exported };
})()`, sandbox);
check(ledgerResult.first && ledgerResult.second, 'Ledger should persist well-formed activity events.');
equal(ledgerResult.list.length, 2, 'Ledger list should return the requested bounded number of events.');
equal(ledgerResult.list[0].title, 'Ledger second event', 'Ledger should present newest activity first.');
equal(ledgerResult.summary.activities, 2, 'Seven-day summary should count recorded test events.');
equal(ledgerResult.summary.xp, 50, 'Seven-day summary should sum XP accurately.');
equal(ledgerResult.summary.coins, 6, 'Seven-day summary should sum Coins accurately.');
equal(ledgerResult.exported.formatVersion, 1, 'Ledger JSON export should include a format version.');
equal(ledgerResult.exported.activities.length, ledgerResult.before + 2, 'Ledger export should contain the full retained history.');

// Failed activity/evidence writes must not leave changes only in the current tab's memory.
const historyKey = 'system_v2_progress_history';
const beforeFailedActivity = browserWindow.SYSTEMProgressLedger.list(300).length;
localStorage.failKeys.add(historyKey);
const rejectedStorageWrite = vm.runInContext("recordSystemEvent({ type: 'ledger-test', title: 'Must not become a ghost row', stat: 'physics', xp: 99, coins: 9 })", sandbox);
localStorage.failKeys.delete(historyKey);
check(!rejectedStorageWrite, 'A failed activity storage write must report failure.');
equal(browserWindow.SYSTEMProgressLedger.list(300).length, beforeFailedActivity, 'A failed activity write must not update in-memory history.');

const evidenceQuestId = 'ledger-evidence-regression';
check(vm.runInContext("recordSystemEvent({ type: 'ai-daily-quest', title: 'Evidence transaction', questId: 'ledger-evidence-regression', stat: 'mathematics', xp: 20, coins: 0 })", sandbox), 'Evidence fixture activity must be saved.');
localStorage.failKeys.add(historyKey);
const rejectedEvidenceWrite = vm.runInContext("updateSystemEventEvidence({ id: 'ledger-evidence-regression', title: 'Evidence transaction' }, { score: 92, passed: true, durationMinutes: 8 })", sandbox);
localStorage.failKeys.delete(historyKey);
check(!rejectedEvidenceWrite, 'A failed evidence write must report failure.');
const untouchedEvidence = browserWindow.SYSTEMProgressLedger.list(1)[0];
check(!('score' in untouchedEvidence) && !('passed' in untouchedEvidence), 'A failed evidence write must not leave unsaved evidence in memory.');

// Per-stat skill progression must list only relevant skills and apply both level and rank gates.
const skillGateResults = vm.runInContext(`(() => {
    const oldLevel = systemState.stats["global-skills"].level;
    const oldRank = systemState.player.rank;
    systemState.stats["global-skills"].level = 1;
    systemState.player.rank = "E";
    const e1 = createSkillTree("global-skills");
    systemState.stats["global-skills"].level = 3;
    systemState.player.rank = "E";
    const e3 = createSkillTree("global-skills");
    systemState.player.rank = "D";
    const d3 = createSkillTree("global-skills");
    systemState.stats["global-skills"].level = oldLevel;
    systemState.player.rank = oldRank;
    return { e1, e3, d3 };
})()`, sandbox);
equal((skillGateResults.e1.match(/class="skill-node unlocked"/g) || []).length, 1,
    'At Global Skills LV.1 and Rank E only the first skill should be unlocked.');
equal((skillGateResults.e3.match(/class="skill-node unlocked"/g) || []).length, 2,
    'At Global Skills LV.3 and Rank E, rank-D skills should remain locked.');
equal((skillGateResults.d3.match(/class="skill-node unlocked"/g) || []).length, 3,
    'At Global Skills LV.3 and Rank D, the third skill should unlock.');
check(skillGateResults.e3.includes('Speaking Practice') && skillGateResults.e3.includes('Player rank D'),
    'Locked skills must show the correct skill and the rank requirement.');
check(!skillGateResults.e3.includes('Arithmetic &amp; Number Sense'),
    'A stat-specific tree must not include skills belonging to Mathematics.');
const skillTreeCoverage = vm.runInContext(`(() => ({
    branches: Object.keys(skillTrees).length,
    counts: Object.values(skillTrees).map(skills => skills.length),
    englishCounts: Object.values(skillTreeEnglish).map(skills => skills.length),
    total: Object.values(skillTrees).reduce((sum, skills) => sum + skills.length, 0)
}))()`, sandbox);
equal(skillTreeCoverage.branches, 6, 'All six skill branches must exist.');
equal(skillTreeCoverage.total, 120, 'The skill catalogue must contain 120 ordered skills.');
check(skillTreeCoverage.counts.every(count => count === 20), 'Each skill branch must contain twenty skills.');
check(skillTreeCoverage.englishCounts.every(count => count === 20), 'Every skill must have an English name and description.');
check(vm.runInContext('Object.values(skillTreeEnglish).flat().every(skill => Array.isArray(skill) && skill.length === 2 && skill.every(value => typeof value === \"string\" && value.length > 0))', sandbox), 'Every English skill entry must have a non-empty name and description.');
const priorBodyDataset = sandbox.document.body.dataset;
sandbox.document.body.dataset = { systemLanguage: 'fa' };
const dariSkillTree = vm.runInContext('createSkillTree("global-skills")', sandbox);
sandbox.document.body.dataset = priorBodyDataset;
check(dariSkillTree.includes('تمرین گفتار') && !dariSkillTree.includes('<h3>Speaking Practice</h3>'),
    'The Dari skill tree should render Dari labels while retaining English aliases for cross-language search.')
check(dariSkillTree.includes('data-skill-search') && dariSkillTree.includes('data-skill-filter="locked"'),
    'The skill tree should render search and status-filter controls.');
check(html.includes('assets/images/icons/status.webp') && html.includes('assets/images/icons/quest.webp')
    && html.includes('assets/images/icons/rewards.webp') && html.includes('assets/images/icons/ai.webp')
    && html.includes('assets/images/icons/settings.webp'),
    'Real image-based navigation icons must be preserved.');
check(!/SQUIRE/i.test(html + fs.readFileSync(path.join(ROOT, 'js/features/royal.js'), 'utf8')),
    'Rank label SQUIRE must not appear in the active interface markup or rank logic.');
check(!html.includes('🎁') && !html.includes('📚') && !html.includes('👑'),
    'Keyboard emoji icons must be removed from static interface markup.');
check(!html.includes('class="reward-card-icon') && !html.includes('class="selected-reward-icon'),
    'Rewards cards and the selected-reward panel must not include decorative reward icons.');
check(!appSource.includes('className = "reward-card-icon"') && !appSource.includes('panelIcon'),
    'Legacy reward rendering must not create or synchronize decorative reward icons.');
const rewardsPlusSourceForIcons = fs.readFileSync(path.join(ROOT, 'js/features/rewards-plus.js'), 'utf8');
check(!rewardsPlusSourceForIcons.includes('const ICONS =') && !rewardsPlusSourceForIcons.includes('reward-card-icon'),
    'Rewards decoration layer must not inject decorative reward icons.');
const ascensionSourceForIcons = fs.readFileSync(path.join(ROOT, 'js/features/rewards-ascension.js'), 'utf8');
check(!ascensionSourceForIcons.includes('ra-route-symbol'),
    'Reward milestone routes must not render decorative reward symbols.');

const parsed = vm.runInContext(`parseAdaptiveAIResponse(${JSON.stringify(JSON.stringify({
    analysis: { summary: 'Based on current levels', strengths: ['Consistent review'], focusAreas: [{ stat: 'mathematics', reason: 'Practice is limited.' }], nextStep: 'Review the preview.' },
    missions: [
        { title: ' 1. Solve five equations ', description: 'Show each step.', stat: 'mathematics', difficulty: 'hard', estimatedMinutes: 200, xp: 9999, coins: -1, reason: 'Practice' },
        { title: 'Solve five equations', description: 'Duplicate title.', stat: 'mathematics' },
        { title: 'Explain a Python loop', stat: 'computer', xp: 25, coins: 3 }
    ]
}))}, 4)`, sandbox);
equal(parsed.missions.length, 2, 'Adaptive parser should discard duplicate titles.');
equal(parsed.missions[0].title, 'Solve five equations', 'Numbering should be stripped from mission titles.');
equal(parsed.missions[0].estimatedMinutes, 90, 'Mission time should be capped at 90 minutes.');
equal(parsed.missions[0].xp, 100, 'Mission XP should be capped at 100.');
equal(parsed.missions[0].coins, 0, 'Mission Coins should not be negative.');
equal(parsed.missions[0].source, 'AI', 'Provider-suggested tasks should have an explicit AI source marker.');

const snapshot = {
    generatedForDate: '2026-10-13',
    player: { level: 1, xpIntoLevel: 500, xpRequired: 1000, rank: 'E', coins: 0 },
    stats: [
        { id: 'mathematics', name: 'Mathematics', level: 1, xpIntoLevel: 0, xpRequired: 100, levelProgressPercent: 0 },
        { id: 'physics', name: 'Physics', level: 1, xpIntoLevel: 0, xpRequired: 100, levelProgressPercent: 0 },
        { id: 'computer', name: 'Computer', level: 1, xpIntoLevel: 0, xpRequired: 100, levelProgressPercent: 0 },
        { id: 'global-skills', name: 'Global Skills', level: 1, xpIntoLevel: 0, xpRequired: 100, levelProgressPercent: 0 },
        { id: 'entrepreneurship', name: 'Entrepreneurship', level: 1, xpIntoLevel: 0, xpRequired: 100, levelProgressPercent: 0 },
        { id: 'unique-thinking', name: 'Unique Thinking', level: 1, xpIntoLevel: 0, xpRequired: 100, levelProgressPercent: 0 }
    ],
    todayQuests: { builtInTotal: 6, builtInCompleted: 1, aiTotal: 0, aiCompleted: 0, activeTitles: [] },
    lifetimeCounters: {},
    recentSevenDayHistory: { recordsAvailable: 0, completionsByStat: {}, recentEntries: [], note: 'No history yet' }
};
const localPlan = vm.runInContext(`buildLocalAdaptivePlan(6, 'Mathematics first', ${JSON.stringify(snapshot)})`, sandbox);
equal(localPlan.missions.length, 6, 'Local fallback should honor a six-mission request.');
check(localPlan.missions.every(mission => mission.source === 'LOCAL'), 'All local fallback missions must be labelled local.');
check(localPlan.analysis.summary.includes('قاعده‌محور'), 'Local fallback should clearly describe itself as rule-based, not AI.');
check(localPlan.missions.some(mission => mission.stat === 'mathematics'), 'Custom priority should influence local mission ordering.');

// Confirm progression retains expected levelling arithmetic and does not run away at the numeric cap.
vm.runInContext('addPlayerXP(600)', sandbox);
let playerAfterLevelUp = vm.runInContext('({ level: systemState.player.level, xp: systemState.player.xp, xpRequired: systemState.player.xpRequired })', sandbox);
equal(playerAfterLevelUp.level, 2, 'Player should level up when enough XP is earned.');
equal(playerAfterLevelUp.xp, 100, 'XP overflow should carry to the next level.');
equal(playerAfterLevelUp.xpRequired, 1210, 'Player next-level XP should follow the current XP curve.');
equal(vm.runInContext('getRankForLevel(51)', sandbox), 'S', 'Rank S must unlock at level 51.');
check(vm.runInContext('getPlayerXPRequired(50)', sandbox) < 30000, 'Level 50 requirement must stay reachable.');
vm.runInContext('systemState.player.level = 1; systemState.player.xp = 0; systemState.player.xpRequired = 1000000000000; addPlayerXP(1000000000000)', sandbox);
playerAfterLevelUp = vm.runInContext('({ level: systemState.player.level, xp: systemState.player.xp, xpRequired: systemState.player.xpRequired })', sandbox);
equal(playerAfterLevelUp.level, 2, 'A capped XP requirement should not create an infinite level-up loop.');
check(Number.isFinite(playerAfterLevelUp.xpRequired), 'XP requirement should remain finite at the numeric cap.');

// The shared transaction helper must restore both in-memory player state and persisted app data.
const transactionBaseline = vm.runInContext('({ coins: systemState.player.coins, save: localStorage.getItem("system_v2_save") })', sandbox);
const transactionResult = vm.runInContext(`runSystemTransaction("Test transaction", () => {
    systemState.player.coins = 987654;
    localStorage.setItem("system_v2_save", JSON.stringify({ player: { level: 999, xp: 1, xpRequired: 2, coins: 987654 } }));
    return false;
})`, sandbox);
equal(transactionResult, false, 'A failed operation should be reported as cancelled.');
equal(vm.runInContext('systemState.player.coins', sandbox), transactionBaseline.coins, 'Failed transaction should restore player memory.');
equal(localStorage.getItem('system_v2_save'), transactionBaseline.save, 'Failed transaction should restore persisted player state.');

// Critical implementation guards.
check(appSource.includes('if (!saveRewardState())'), 'Reward claims must stop if persistence fails.');
const releaseVersion = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
check(appSource.includes(`const SYSTEM_APP_VERSION = "${releaseVersion}"`), 'Legacy application version should match VERSION.');
check(html.includes('href="css/system.css"'), 'The app should load its single consolidated runtime stylesheet.');
check(fs.readFileSync(path.join(ROOT, 'css/system.css'), 'utf8').includes('Source: css/refinements/beauty-signature.css'), 'The consolidated runtime stylesheet should include the precision layer.');
check(html.includes('data-system-theme="cosmic"'), 'Fresh installs should default to Cosmic Blue.');
check(html.includes('data-status-tool="skill-review"'), 'Status tools should expose Skill Review.');
check(fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8').includes('./core/skill-review.js'), 'Skill Review API must load before Status tool UI.');
check(fs.readFileSync(path.join(ROOT, 'css/system.css'), 'utf8').includes('Source: css/refinements/skill-review-refinement.css'), 'Skill Review styles must be included in the runtime CSS bundle.');
const builtCss = fs.readFileSync(path.join(ROOT, 'css/system.css'), 'utf8');
check(builtCss.includes('Source: css/features/apex-evolution.css') && builtCss.includes('Source: css/features/rebirth-core.css'), 'Apex Evolution and Rebirth Core source sheets must be included in the runtime CSS bundle.');
check(builtCss.indexOf('Source: css/themes/theme-picker.css') < builtCss.lastIndexOf('Source: css/themes/royal.css')
    && builtCss.lastIndexOf('Source: css/themes/royal.css') < builtCss.lastIndexOf('Source: css/refinements/rewards-elite.css')
    && builtCss.lastIndexOf('Source: css/refinements/rewards-elite.css') < builtCss.lastIndexOf('Source: css/refinements/apex-style.css'),
    'Royal theme must follow the theme picker, and the final SYSTEM polish layer must compile last.');
check(builtCss.includes('Source: css/themes/royal.css'), 'Royal theme should be included in the bundled CSS.');
check(builtCss.includes('Source: css/refinements/rewards-elite.css'), 'The final Rewards design fragment must be included in the bundled CSS.');
check(appSource.includes('Each preset updates the interface palette, panels, controls, and accents.'), 'Theme modal must accurately describe what built-in themes change.');
check(!fs.readFileSync(path.join(ROOT, 'js/features/grok-suite.js'), 'utf8').includes("setProperty('--color-blue'"), 'Workspace accent themes must not overwrite the app-wide theme tokens.');
check(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes('"css/system.css"'), 'The consolidated active stylesheet must be precached for offline use.');
check(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes('"js/modules/ai-workspace-navigation.js"'), 'The real ES module must be precached for offline use.');
check(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes(`const APP_VERSION = "${releaseVersion}"`) && fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes('`system-v${APP_VERSION}`'), 'The service worker must use the canonical versioned cache.');
check(!fs.readFileSync(path.join(ROOT, 'js/features/royal.js'), 'utf8').includes('applySystemTheme("royal")'), 'The legacy royal shim must not override the default theme.');
check(appSource.includes('function runSystemTransaction(label, action)'), 'Rewarding actions should share the transactional rollback helper.');
check(appSource.includes('runSystemTransaction("Store purchase"'), 'Store purchases should use the shared rollback transaction.');
check(appSource.includes('chatRequestBusy'), 'Chat should guard concurrent submissions.');
check(appSource.includes('LOCAL SUPPLEMENT'), 'Adaptive mission supplementation should be disclosed.');
check(appSource.includes('file.size > 5 * 1024 * 1024'), 'Backup import should enforce a size ceiling.');
check(appSource.includes('validateBackup(imported)'), 'Backup restore should validate structure and integrity before applying data.');
check(appSource.includes('runSystemTransaction("Daily Quest"'), 'Daily quest completion should be transactional.');
check(!html.includes('ai-proxy-view') && !appSource.includes('system-proxy-'), 'Proxy UI and request code must be absent when no backend ships with this package.');
check(!/YOUR_API_KEY|sk-[A-Za-z0-9]{20,}/.test(appSource + html), 'No real/placeholder API secret should be embedded in active source.');

const moduleEntry = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const versionModule = fs.readFileSync(path.join(ROOT, 'js/modules/version.js'), 'utf8');
const bundleCss = fs.readFileSync(path.join(ROOT, 'css/system.css'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check(html.includes('Content-Security-Policy') && html.includes("script-src &#39;self&#39;" ) === false, 'A Content Security Policy should be present without inline-script allowances.');
check(/script-src 'self'/.test(html) && !/script-src[^;]*unsafe-inline/.test(html), 'CSP must not allow inline scripts.');
check(html.includes('<script type="module" src="js/app.js"></script>'), 'The application must start from an ES module.');
check(moduleEntry.includes('initAIWorkspaceNavigation') && moduleEntry.includes('await loadClassicScript'), 'The app entry must load real modules and compatibility scripts in sequence.');
check(versionModule.includes(`"${releaseVersion}"`) && fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').includes(releaseVersion), 'The canonical release version must be aligned.');
check(!/!important\b/i.test(bundleCss), 'The active consolidated stylesheet must not contain !important declarations.');
check(!/SYSTEM module placeholder:/.test([...walkAllJs()].map((file) => fs.readFileSync(file, 'utf8')).join('\n')), 'Inert JS placeholder modules must be removed.');
check(!/onerror\s*=/.test(html), 'Inline HTML event handlers must be removed for CSP compatibility.');
check(!/system-v5\.7\.0/.test(serviceWorker), 'Old service-worker cache keys must not remain in the active worker.');
check(serviceWorker.includes('await cache.addAll(SHELL)'), 'All required offline shell assets should be cached as a single fail-fast install step.');
function* walkAllJs() {
    const stack = [path.join(ROOT, 'js')];
    while (stack.length) {
        const dir = stack.pop();
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, item.name);
            if (item.isDirectory()) stack.push(full);
            else if (item.isFile() && item.name.endsWith('.js')) yield full;
        }
    }
}

async function testGroqRequestConstruction() {
    let lastRequest = null;
    sandbox.fetch = async (url, options) => {
        lastRequest = { url, options, body: JSON.parse(options.body) };
        return {
            ok: true,
            status: 200,
            async json() { return { choices: [{ message: { content: 'SYSTEM TEST OK' } }] }; }
        };
    };
    localStorage.setItem('system_v2_ai_chat_history', JSON.stringify([
        { type: 'ai', text: 'SYSTEM AI Core is ready.', at: '2026-10-13T00:00:00.000Z' },
        { type: 'user', text: 'Earlier question', at: '2026-10-13T00:01:00.000Z' },
        { type: 'ai', text: 'Earlier answer', at: '2026-10-13T00:02:00.000Z' }
    ]));
    vm.runInContext('systemGroqApiKey = "test-key-not-real"; systemGroqModel = "openai/gpt-oss-20b";', sandbox);
    const firstAnswer = await vm.runInContext('callGroq("Next question", true)', sandbox);
    equal(firstAnswer, 'SYSTEM TEST OK', 'Groq response text should be extracted.');
    equal(lastRequest.url, 'https://api.groq.com/openai/v1/chat/completions', 'Groq requests must use the official chat completions endpoint.');
    equal(lastRequest.options.headers.Authorization, 'Bearer test-key-not-real', 'Groq key must be sent as a bearer token.');
    equal(lastRequest.body.model, 'openai/gpt-oss-20b', 'Selected Groq model should be sent.');
    equal(lastRequest.body.messages[0].role, 'system', 'Groq requests should start with the system instruction.');
    check(lastRequest.body.messages.some(message => message.role === 'user' && message.content === 'Earlier question'), 'Earlier user history should be retained.');
    equal(lastRequest.body.messages[lastRequest.body.messages.length - 1].content, 'Next question', 'Current Groq prompt should be included once at the end.');

    await vm.runInContext('callGroq("JSON check", false, { jsonMode: true })', sandbox);
    equal(lastRequest.body.response_format.type, 'json_object', 'Groq JSON mode should request a JSON object response.');
}

// Themes: every registered theme must have a palette block (or be a built-in skin).
{
    const ids = [...fs.readFileSync(path.join(ROOT, 'js/legacy/app-controller.js'), 'utf8').matchAll(/"id":\s*"([a-z]+)"/g)].map(m => m[1]);
    const palettes = fs.readFileSync(path.join(ROOT, 'css/themes/palettes.css'), 'utf8');
    const dedicatedThemeSheets = ['aether-luxe.css', 'obsidian-couture.css']
        .map(file => fs.readFileSync(path.join(ROOT, 'css/themes', file), 'utf8')).join('\n');
    ['cosmic', 'aurora', 'royal'].forEach(id => check(ids.includes(id), `Built-in theme ${id} must be registered.`));
    ids.filter(id => !['cosmic', 'aurora', 'royal'].includes(id)).forEach(id => {
        const hasPalette = palettes.includes(`data-system-theme="${id}"`)
            || dedicatedThemeSheets.includes(`data-system-theme="${id}"`);
        check(hasPalette, `Theme ${id} must have a palette in palettes.css or its dedicated theme sheet.`);
    });
    console.log('Theme registry checks passed:', ids.length, 'themes');
}

// Rewards: daily/mission claims reset on a new day, permanent rewards stay claimed.
{
    const r = JSON.parse(vm.runInContext(`(() => { rewardState.claimed = ['video-reward','mission-completion','explorer']; rewardState.dailyDate = '2000-01-01'; pruneDailyRewardClaims(); return JSON.stringify(rewardState.claimed); })()`, sandbox));
    check(!r.includes('video-reward') && !r.includes('mission-completion'), 'Daily rewards must reset on a new day.');
    check(r.includes('explorer'), 'Permanent rewards must stay claimed.');
    const focusGate = vm.runInContext(`(() => {
        const target = rewardDefinitions["Focus Bonus"];
        const saved = { ...completedQuests };
        Object.keys(completedQuests).forEach(id => { completedQuests[id] = false; });
        const lockedBeforeQuest = !canClaimReward(target);
        const firstQuest = questDefinitions[0];
        if (firstQuest) completedQuests[firstQuest.id] = true;
        const unlockedAfterQuest = Boolean(firstQuest && canClaimReward(target));
        Object.keys(completedQuests).forEach(id => { delete completedQuests[id]; });
        Object.assign(completedQuests, saved);
        return { lockedBeforeQuest, unlockedAfterQuest, retainedLegacyId: target && target.id === "video-reward" };
    })()`, sandbox);
    check(focusGate.lockedBeforeQuest, 'The Focus Bonus must remain locked until a daily quest is completed.');
    check(focusGate.unlockedAfterQuest, 'The Focus Bonus should unlock after the player completes a daily quest.');
    check(focusGate.retainedLegacyId, 'The renamed Focus Bonus must preserve its legacy save ID.');
}

// Skill XP routing, level-up carry-over, and save persistence are tested in the same
// lightweight runtime used by the Status renderer, with the real curriculum loaded.
const skillXPResult = vm.runInContext(`(() => {
    awardSkillProgressFromActivity('mathematics', 'Algebra II quadratic equations practice', 100, null);
    awardSkillProgressFromActivity('mathematics', 'Algebra II quadratic equations practice', 100, null);
    const save = JSON.parse(localStorage.getItem('system_v2_save'));
    return { schemaVersion: save.schemaVersion, root: save.skillProgress['mathematics-02'], algebraII: save.skillProgress['math-algebra-ii'], quadratics: save.skillProgress['math-a2-quadratics'] };
})()`, sandbox);
equal(skillXPResult.schemaVersion, 3, 'Skill XP should use save schema version 3.');
equal(skillXPResult.root.totalXp, 100, 'The mathematics branch should receive activity XP.');
check(!skillXPResult.algebraII, 'A node with unmet prerequisites must not receive XP.');
check(!skillXPResult.quadratics, 'A descendant of a locked node must not receive XP.');
check(fs.readFileSync(path.join(ROOT, 'css/themes/royal.css'), 'utf8').includes('data-system-theme="royal"'), 'Royal theme stylesheet must define the royal theme.');

await testGroqRequestConstruction();
console.log(`SYSTEM smoke/unit tests passed: ${checks} checks, ${jsonFiles} JSON files validated.`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
