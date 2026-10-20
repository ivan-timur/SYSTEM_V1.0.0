'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/core/intelligence-engine.js'), 'utf8');
const FIXED_NOW = '2026-10-16T12:00:00.000Z';
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks++; }

class MemoryStorage {
  constructor(initial = {}) { this.map = new Map(Object.entries(initial)); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
}
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [FIXED_NOW])); }
  static now() { return new Date(FIXED_NOW).getTime(); }
}
function createEngine({ language = 'en', history = [], state = null } = {}) {
  const localStorage = new MemoryStorage({ system_v2_progress_history: JSON.stringify(history) });
  const fakeDocument = {
    readyState: 'complete', body: { dataset: { systemLanguage: language } },
    getElementById() { return null; }, querySelector() { return null; },
    addEventListener() {}, createElement() { return null; }
  };
  const browserWindow = { localStorage };
  const sandbox = {
    window: browserWindow, document: fakeDocument, localStorage, Date: FixedDate,
    systemState: state || { player: { level: 4, xp: 120, rank: 'D' }, stats: {} },
    console: { log() {}, info() {}, warn() {}, error() {} }, setTimeout() { return 1; }, clearTimeout() {},
    Math, JSON, Number, String, Object, Array, Map, Set, RegExp, Error
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'js/core/intelligence-engine.js', timeout: 10000 });
  return { api: browserWindow.SYSTEMIntelligence, localStorage, browserWindow, sandbox };
}

const empty = createEngine();
check(Boolean(empty.api), 'engine must expose a public browser API');
equal(empty.api.version, '8.0.0', 'version reports the deeper intelligence engine');
const baseline = empty.api.analyze();
equal(baseline.momentum, 0, 'no recorded activity yields zero momentum');
equal(baseline.dataConfidence, 20, 'no history is reported as low-confidence baseline data');
equal(baseline.trend, 'no-baseline', 'no history does not fabricate an activity trend');
check(baseline.insights.some(item => /not enough recent activity/i.test(item.en)), 'baseline insights disclose missing activity history');
check(baseline.strengths[0].includes('evidence is unavailable'), 'baseline strength does not pretend current level proves recent activity');

const timedHistory = [
  { at: '2026-10-16T09:00:00.000Z', type: 'quest', title: 'Today math task', stat: 'mathematics', xp: 20 },
  { at: '2026-10-10T09:00:00.000Z', type: 'quest', title: 'Six days ago', stat: 'computer', xp: 30 },
  { at: '2026-10-09T09:00:00.000Z', type: 'quest', title: 'Previous window', stat: 'physics', xp: 40 },
  { at: '2026-09-16T09:00:00.000Z', type: 'quest', title: 'Outside 30 day window', stat: 'physics', xp: 40 },
  { at: '2026-10-17T09:00:00.000Z', type: 'quest', title: 'Future-dated event', stat: 'physics', xp: 40 },
  { at: 'not-a-date', type: 'quest', title: 'Invalid timestamp', stat: 'physics', xp: 40 }
];
const dated = createEngine({ history: timedHistory });
const snapshot = dated.api.getSnapshot();
equal(snapshot.history.last7, 2, 'seven-day window includes today and the prior six calendar days');
equal(snapshot.history.previous7, 1, 'previous comparison window covers days 7–13 ago');
equal(snapshot.history.last30, 3, 'thirty-day window excludes entries aged 30 days and all future entries');
equal(snapshot.history.byStat7.mathematics, 1, 'recent counts are grouped by allowed stat');
equal(snapshot.history.byStat7.physics, 0, 'future and stale records cannot inflate current branch activity');
equal(snapshot.history.trend, 'up', 'trend compares current seven days against the previous seven');
check(!snapshot.history.recentTitles.includes('Future-dated event'), 'future-dated titles do not pollute duplicate avoidance');

const provided = {
  generatedForDate: '2026-10-16',
  player: { level: 8, xpIntoLevel: 320, xpRequired: 1000, rank: 'C', coins: 50 },
  stats: [
    { id: 'mathematics', name: 'Mathematics', level: 4, xpIntoLevel: 40, xpRequired: 100 },
    { id: 'computer', name: 'Computer', level: 3, xpIntoLevel: 20, xpRequired: 100 }
  ],
  todayQuests: { activeTitles: [{ title: 'Build a Python function with 3 tests' }] },
  recentSevenDayHistory: {
    recordsAvailable: 1,
    recentEntries: [{ date: '2026-10-15', type: 'quest', title: 'Recorded yesterday', stat: 'mathematics', xp: 25 }]
  }
};
const adaptive = empty.api.buildDeepLocalPlan(4, 'Algebra first, then Python, keep tasks under 45 minutes', provided);
equal(adaptive.missions.length, 4, 'local planner produces requested number of missions');
check(adaptive.missions.some(item => item.stat === 'mathematics'), 'keyword matching prioritizes mathematics for algebra focus');
check(adaptive.missions.some(item => item.stat === 'computer'), 'keyword matching recognizes Python as computer/programming');
check(adaptive.missions.every(item => item.estimatedMinutes <= 45), 'requested time ceiling is respected across the plan');
check(adaptive.missions.every(item => item.source === 'LOCAL'), 'local planner labels its mission source honestly');
check(adaptive.missions.every(item => item.completionEvidence && item.description.length > 20), 'missions include measurable steps and completion evidence');
check(adaptive.missions.every(item => item.title !== 'Build a Python function with 3 tests'), 'planner excludes an active quest title');
check(adaptive.analysis.source === 'SYSTEM Intelligence Engine 1.0.0', 'plan reports the new engine version');
check(/No recent events|recorded event/i.test(adaptive.analysis.summary), 'summary describes the actual evidence window');

const uniqueness = empty.api.buildDeepLocalPlan(6, '', { stats: provided.stats, todayQuests: { activeTitles: [] } });
const titles = uniqueness.missions.map(item => item.title.toLowerCase());
equal(new Set(titles).size, titles.length, 'six-task plan contains no duplicate mission titles');
check(new Set(uniqueness.missions.map(item => item.stat)).size >= 4, 'round-robin planner spreads tasks across skill branches');

const reviewEngine = createEngine({ history: [
  { at: '2026-10-06T09:00:00.000Z', type: 'quest', title: 'Solve quadratic equations', stat: 'mathematics', xp: 25 },
  { at: '2026-10-15T09:00:00.000Z', type: 'quest', title: 'Build a tiny Python function', stat: 'computer', xp: 30 }
] });
const reviewAnalysis = reviewEngine.api.analyze();
equal(reviewAnalysis.learningSignals.reviewDueCount, 1, 'spaced-review opportunities use branch-specific history aged 3–90 days');
check(reviewAnalysis.learningSignals.reviewDue[0].stat === 'mathematics', 'review planning chooses the branch with an older recorded topic');
const reviewPlan = reviewEngine.api.buildDeepLocalPlan(3, 'algebra under 30 minutes', { stats: provided.stats, todayQuests: { activeTitles: [] } });
check(reviewPlan.missions.some(item => item.learningMode === 'review' && /Spaced review/.test(item.title)), 'local plan includes a spaced retrieval review when the branch has an eligible prior topic');
check(reviewPlan.missions.every(item => item.description.includes('Success check:') && item.reflectionPrompt), 'adaptive missions include an observable success check and a reflection prompt');
check(reviewPlan.missions.every(item => item.estimatedMinutes <= 30), 'review and other adaptive missions respect a parsed time cap');

const explicitOutcomeEngine = createEngine({ history: [
  { at: '2026-10-15T10:00:00.000Z', type: 'quest', title: 'Weekly knowledge quiz', stat: 'mathematics', xp: 30 }
] });
const outcomeSnapshot = {
  stats: provided.stats,
  recentSevenDayHistory: { recordsAvailable: 1, recentEntries: [
    { at: '2026-10-15T10:30:00.000Z', date: '2026-10-15', type: 'quest', title: 'Weekly knowledge quiz', stat: 'mathematics', xp: 30, learningMode: 'assessment', durationMinutes: 15, score: 82, passed: true }
  ] }
};
const outcomeAnalysis = explicitOutcomeEngine.api.analyze(outcomeSnapshot);
equal(outcomeAnalysis.learningSignals.explicitOutcomeCount30, 1, 'duplicate ledger and snapshot entries merge explicit outcome metadata without double counting');
equal(outcomeAnalysis.learningSignals.scoredOutcomeCount30, 1, 'explicit numeric assessment score is counted separately');
equal(outcomeAnalysis.learningSignals.measuredMinutes30, 15, 'explicit duration metadata is aggregated as recorded time');
check(outcomeAnalysis.learningSignals.recognizedModes.includes('assessment'), 'explicit assessment method is retained when activity rows merge');
check(outcomeAnalysis.learningSignals.note.includes('prove mastery'), 'learning signal note warns that explicit signals are not equivalent to mastery');

const arabicDigitPlan = dariPlanForArabicDigits();
function dariPlanForArabicDigits() {
  const engine = createEngine({ language: 'fa' });
  return engine.api.buildDeepLocalPlan(2, 'الجبر زیر ٣٠ دقیقه', { stats: provided.stats });
}
check(arabicDigitPlan.missions.every(item => item.estimatedMinutes <= 30), 'Arabic-Indic digits in focus notes are converted before time parsing');

const legacyState = { player: { level: 9, xp: 250, rank: 'B' }, stats: { mathematics: { level: 7, xp: 75, xpRequired: 100 } } };
const stateEngine = createEngine({ state: legacyState });
const current = stateEngine.api.getSnapshot();
equal(current.player.level, 9, 'legacy live player state remains readable');
equal(current.stats.mathematics.level, 7, 'legacy object-shaped stat state remains readable');
check(current.stats.physics && current.stats.physics.level >= 1, 'missing legacy stats get safe defaults');

const dari = createEngine({ language: 'fa' });
const faPlan = dari.api.buildDeepLocalPlan(2, 'الجبر و پایتون زیر ۳۰ دقیقه', { stats: provided.stats });
check(faPlan.missions.some(item => /الجبر|معادله|ریاضی/.test(item.title)), 'Dari/Persian focus cues map algebra to mathematics missions');
check(faPlan.missions.every(item => item.estimatedMinutes <= 30), 'Persian-digit/time cues respect the stated time limit');
check(faPlan.analysis.evidenceNote.includes('تسلط') && faPlan.analysis.evidenceNote.includes('کالیبره‌شده'), 'localized analysis distinguishes activity from mastery and labels the metric as heuristic');

const before = JSON.stringify({ player: legacyState.player, stats: legacyState.stats });
stateEngine.api.analyze();
equal(JSON.stringify({ player: legacyState.player, stats: legacyState.stats }), before, 'analysis does not mutate player progression or skill data');
check(!Object.keys(stateEngine.browserWindow).some(key => /apiKey|token|fetch/i.test(key)), 'intelligence engine does not introduce network credentials or fetch integration');

console.log(`SYSTEM Intelligence Engine tests passed: ${checks} checks.`);

const appEntry = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const legacySource = fs.readFileSync(path.join(ROOT, 'js/legacy/app-controller.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const aiCss = fs.readFileSync(path.join(ROOT, 'css/pages/ai.css'), 'utf8');
const questCss = fs.readFileSync(path.join(ROOT, 'css/pages/quest.css'), 'utf8');
check(appEntry.indexOf('./core/intelligence-engine.js') < appEntry.indexOf('./legacy/app-controller.js'), 'intelligence engine loads before legacy integration');
check(legacySource.includes('buildDeepLocalPlan(requestedCount, customFocus, snapshot)'), 'adaptive plan passes the actual progress snapshot into local analysis');
check(legacySource.includes('localIntelligence: localSignals ?'), 'provider mission prompt receives a small transparent local-analysis summary');
check(['ai-intel-momentum', 'ai-intel-consistency', 'ai-intel-trend', 'ai-intel-confidence', 'ai-intel-review', 'ai-intel-learning-modes', 'ai-intel-outcomes'].every(id => html.includes(`id="${id}"`)), 'AI analysis panel exposes all seven local intelligence indicators');
check(aiCss.includes('.ai-intelligence-metrics') && aiCss.includes('@media (max-width: 700px)'), 'intelligence metrics have responsive mobile styling');
check(legacySource.includes('function updateSystemEventEvidence') && legacySource.includes('function openLearningEvidenceModal'), 'completed AI quests can record optional, explicit learning outcomes');
check(legacySource.includes('learningModeSource: quest.learningModeSource') && legacySource.includes('detail?.successCriterion'), 'planned learning metadata survives approval and reaches the activity ledger');
check(questCss.includes('.ai-quest-evidence-button') && questCss.includes('.system-learning-evidence-form') && questCss.includes('@media (max-width: 480px)'), 'evidence controls have dedicated responsive styling');
console.log('SYSTEM Intelligence Engine integration checks passed.');
