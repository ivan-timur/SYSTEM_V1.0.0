#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const issues = [];
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(ROOT, relative));
const check = (condition, message) => { if (!condition) issues.push(message); };

const version = read('VERSION').trim();
const packageJson = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('manifest.webmanifest'));
const entry = read('js/app.js');
const html = read('index.html');
const progression = read('src/core/progression.ts');
const achievements = read('src/core/achievements.ts');
const activityLedger = read('src/core/activity-ledger.ts');
const legacyDailyQuestState = read('src/storage/legacy-daily-quest-state.ts');
const questCommand = read('src/features/quest-command.ts');
const questCompletionPlan = read('src/features/quest-completion-plan.ts');
const rewardCommand = read('src/core/reward-command.ts');
const seedValidation = read('src/data/seed-validation.ts');
const idb = read('src/storage/indexeddb.ts');
const migration = read('src/storage/legacy-migration.ts');
const roadmap = read('docs/ARCHITECTURE_ROADMAP_FA.md');
const visualEffects = read('js/modules/visual-effects.js');

check(/^\d+\.\d+\.\d+$/.test(version), 'VERSION must be semantic x.y.z.');
check(packageJson.version === version, 'package.json version must equal VERSION; run the build sync first.');
check(manifest.version === version, 'manifest version must equal VERSION; run the build sync first.');
check(html.includes('type="module" src="js/app.js"'), 'index.html must load the JavaScript ES-module entry.');
check(entry.includes('initVisualEffects') && visualEffects.includes('createVisualEffectsController'), 'Canvas and milestone visual effects must be initialized through a dedicated visual-only module.');
check(visualEffects.includes('prefers-reduced-motion') && visualEffects.includes('MAX_DPR = 1.5') && visualEffects.includes('documentRef.hidden'), 'Canvas effects must respect reduced motion, bound pixel ratio, and pause when hidden.');
check(visualEffects.includes("SETTINGS_KEY = 'system_v3_visual_settings'") && visualEffects.includes('function configure('), 'Visual preference persistence must use its own narrow settings key and configuration API.');
check(read('js/legacy/app-controller.js').includes('system-level-up') && read('js/legacy/app-controller.js').includes('system-rank-up') && read('js/legacy/app-controller.js').includes('renderVisualEffectsSettingsModal'), 'Committed Level/Rank milestones and their Settings controls must be connected to the visual-effects module.');
check(read('js/features/rewards-plus.js').includes('system-achievement-unlocked'), 'Successful achievement claims must emit the milestone feedback event.');
check(html.includes('id="system-visual-effects-setting"'), 'Visual Effects controls must be reachable from the Settings page.');
check(read('scripts/build-css.js').includes('css/features/visual-effects.css'), 'Visual-effects styles must be sourced through the CSS build pipeline.');
check(entry.includes('../dist/ts/core/progression.js') && entry.includes('SYSTEMTypeScriptProgression'), 'Entry must expose the TypeScript progression domain.');
check(entry.includes('../dist/ts/core/achievements.js') && entry.includes('SYSTEMTypeScriptAchievements'), 'Entry must expose the TypeScript achievement eligibility domain.');
check(entry.includes('../dist/ts/core/activity-ledger.js') && entry.includes('SYSTEMTypeScriptActivityLedger'), 'Entry must expose the TypeScript activity-ledger domain before the legacy controller loads.');
check(/export type Rank\s*=/.test(progression) && /export function advanceXPTrack\(/.test(progression) && /export function completeQuest\(/.test(progression), 'TypeScript must own Rank, shared XP transitions, and Quest completion.');
check(/export interface ProgressionResult/.test(progression) && /newlyUnlockedAchievements/.test(progression), 'Quest domain result must retain achievement unlock outcomes.');
check(/export function isAchievementEligible\(/.test(achievements) && /SYSTEM_ACHIEVEMENT_RULES/.test(achievements), 'TypeScript achievement criteria must have a canonical, testable owner.');
check(/export function createActivityRecord\(/.test(activityLedger) && /export function updateActivityEvidence\(/.test(activityLedger) && /export function normalizeActivityHistory\(/.test(activityLedger), 'Activity record validation, evidence update, and backward-compatible history normalization must have a TypeScript owner.');
check(/export function normalizeProgressCounters\(/.test(activityLedger) && /export function proposeProgressCounterIncrement\(/.test(activityLedger) && /export function summarizeActivities\(/.test(activityLedger), 'Lifetime counter guards and read-only activity summaries must be centralized in TypeScript.');
const stableAchievements = [
  'achievement-first-mission', 'achievement-quest-adept', 'achievement-streak-3', 'achievement-streak-7',
  'achievement-boss-slayer', 'achievement-skill-seeker', 'achievement-level-five', 'achievement-quest-architect',
];
for (const id of stableAchievements) check(achievements.includes(`'${id}'`), `Missing TypeScript achievement criterion: ${id}.`);
check(!/if \(definition\.id === "achievement-(?:first-mission|quest-adept|streak-3|streak-7|boss-slayer|skill-seeker|level-five|quest-architect)"/.test(read('js/legacy/app-controller.js')), 'Dynamic achievement thresholds must not be duplicated in the legacy controller.');
const legacyController = read('js/legacy/app-controller.js');
const appModule = read('js/app.js');
check(entry.includes('../dist/ts/storage/legacy-daily-quest-state.js') && entry.includes('SYSTEMTypeScriptQuestState'), 'Entry must expose the typed legacy Daily Quest state boundary before the legacy controller loads.');
check(/export function normalizeLegacyDailyQuestState\(/.test(legacyDailyQuestState) && /export function createLegacyDailyQuestStorageEntries\(/.test(legacyDailyQuestState), 'Daily Quest payload parsing and storage-entry normalization must have a TypeScript owner.');
check(appModule.includes('../dist/ts/features/quest-command.js') && appModule.includes('SYSTEMTypeScriptQuestDomain'), 'The entry point must publish the typed Quest-command boundary before the legacy controller loads.');
check(appModule.includes('../dist/ts/features/quest-completion-plan.js') && appModule.includes('planCustomQuestCompletion') && appModule.includes('planBossQuestClaim') && appModule.includes('planGoalEvidenceDecision'), 'The entry point must expose typed completion-plan commands to the compatibility controller.');
check(/export function normalizeLegacyCustomQuests\(/.test(questCommand) && /export function createCustomQuestRecord\(/.test(questCommand) && /export function canCompleteCustomQuest\(/.test(questCommand), 'Custom Quest normalization, creation and completion guards must have a typed owner.');
check(/export function getBossQuestDefinitions\(/.test(questCommand) && /export function getBossQuestStatus\(/.test(questCommand), 'Boss Quest metadata and eligibility rules must have a typed owner.');
check(/export function planCustomQuestCompletion\(/.test(questCompletionPlan) && /export function planBossQuestClaim\(/.test(questCompletionPlan) && /export function planGoalEvidenceDecision\(/.test(questCompletionPlan), 'Custom/Boss completion and Goal evidence execution plans must have a typed owner.');
check(legacyController.includes('window.SYSTEMTypeScriptQuestState') && legacyController.includes('questState.normalizeLegacyDailyQuestState') && legacyController.includes('questState.createLegacyDailyQuestStorageEntries'), 'Legacy Daily Quest load/save must delegate payload rules to TypeScript.');
check(legacyController.includes('domain.normalizeLegacyCustomQuests') && legacyController.includes('questDomain.createCustomQuestRecord') && legacyController.includes('questDomain.planCustomQuestCompletion'), 'Legacy Custom Quest flows must delegate normalization, creation and completion planning rules to TypeScript.');
check(legacyController.includes('domain.getBossQuestDefinitions()') && legacyController.includes('domain.getBossQuestStatus(definition.id'), 'Legacy Boss Quest UI must delegate catalog and eligibility logic to TypeScript.');
check(legacyController.includes('questDomain.planBossQuestClaim') && legacyController.includes('questDomain.planCustomQuestCompletion') && legacyController.includes('questDomain.planGoalEvidenceDecision'), 'Legacy Custom/Boss Quest UI must execute typed completion plans instead of duplicating orchestration rules.');
check(!/const BOSS_QUESTS = \[/.test(legacyController), 'Boss Quest metadata must not be duplicated as an inline JavaScript catalogue.');
check(!/const parsed = storedData \? JSON\.parse\(storedData\) : \{\}/.test(legacyController), 'Legacy controller must not duplicate Daily Quest payload parsing rules.');
check(entry.includes('SYSTEMTypeScriptAchievements') && legacyController.includes('achievementDomain.isEligible(definition.id, snapshot)'), 'Legacy Rewards controller must delegate criteria to TypeScript.');
const activityRecordBody = (legacyController.match(/function recordSystemEvent\(event = \{\}\) \{([\s\S]*?)\n\}/) || [])[1] || '';
check(activityRecordBody.includes('SYSTEMActivityLedgerDomain.createActivityRecord') && activityRecordBody.includes('SYSTEMActivityLedgerDomain.appendActivityRecord'), 'Legacy activity recording must delegate its record rules and history bound to TypeScript.');
check(activityRecordBody.indexOf('localStorage.setItem(SYSTEM_PROGRESS_HISTORY_KEY') < activityRecordBody.indexOf('systemProgressHistory = nextHistory'), 'Activity memory must not update until its persistence write succeeds.');
check(legacyController.includes('SYSTEMActivityLedgerDomain.updateActivityEvidence') && legacyController.includes('SYSTEMActivityLedgerDomain.summarizeActivities'), 'Legacy activity evidence and summary functions must delegate to the TypeScript domain.');
const canClaimBody = (legacyController.match(/function canClaimReward\(definition\) \{([\s\S]*?)\n\}/) || [])[1] || '';
check(canClaimBody.indexOf('if (definition.dynamic === true)') >= 0 && canClaimBody.indexOf('if (definition.dynamic === true)') < canClaimBody.indexOf('systemState.player.level < definition.minLevel'), 'Dynamic achievement level thresholds must be evaluated by TypeScript, not a duplicate generic JS gate.');
check(rewardCommand.includes('prepareProgressionReward') && /export function prepareProgressionReward/.test(rewardCommand), 'Quest reward inputs/IDs must pass through the canonical TypeScript command contract.');
check(/export function validateQuestCatalog/.test(seedValidation) && /export function validateRewardCatalog/.test(seedValidation) && /export function validateDefaultPlayerSeed/.test(seedValidation), 'JSON seed data must pass a typed validation API before being used.')
check(idb.includes('SYSTEM_DB_VERSION') && idb.includes('completeQuestInDatabase'), 'IndexedDB must retain a versioned database and transactional quest API.');
check(migration.includes('createLegacyMigrationPlan') && migration.includes('migrateLegacyLocalStorageToIndexedDB'), 'IndexedDB migration must remain explicit and inspectable.');
check(migration.includes('createLegacyMigrationApproval') && migration.includes('validateLegacyMigrationApproval'), 'IndexedDB migration must require and validate an explicit preview-bound approval.');
check(migration.includes('stale because legacy localStorage changed') && migration.includes('warningsAcknowledged'), 'Migration must fail closed on stale legacy data and require warning acknowledgement.');
check(appModule.includes('approve: (preview, options)') && appModule.includes('migrate: (approval)'), 'Runtime migration namespace must expose preview → approve → migrate, never an unapproved migration shortcut.');
check(exists('tests/typescript/legacy-migration-approval.test.mjs'), 'Preview-bound migration approval regression tests must be present.');
check(read('docs/ARCHITECTURE.md').includes('Source-of-truth rules'), 'Engineering architecture notes must exist.');
for (const technology of ['JavaScript', 'TypeScript', 'HTML / CSS', 'JSON', 'IndexedDB', 'SQLite', 'Kotlin', 'Java', 'Canvas / WebGL', 'Python', 'FastAPI', 'Rust / WebAssembly', 'ICU MessageFormat']) {
  check(roadmap.includes(technology), `Roadmap must document the responsibility and adoption state for ${technology}.`);
}
check(read('scripts/sync-android-assets.js').includes("path.join(ROOT, 'dist', 'ts')"), 'Android asset sync must copy compiled TypeScript from the build output.');
check(exists('tests/typescript/achievements.test.mjs'), 'Achievement regression tests must be present.');
check(exists('tests/typescript/activity-ledger.test.mjs'), 'Activity-ledger domain regression tests must be present.');
check(exists('tests/typescript/legacy-daily-quest-state.test.mjs'), 'Typed Daily Quest state regression tests must be present.');
check(exists('tests/typescript/quest-command.test.mjs'), 'Typed Custom/Boss Quest regression tests must be present.');
check(exists('tests/typescript/quest-completion-plan.test.mjs'), 'Typed Custom/Boss and Goal evidence completion-plan regression tests must be present.');

if (issues.length) {
  console.error(`SYSTEM architecture guard failed (${issues.length} issue(s)):\n- ${issues.join('\n- ')}`);
  process.exit(1);
}
console.log(`SYSTEM architecture guard passed for v${version}: TypeScript domain ownership, milestone-feedback wiring, achievements, activity ledger, Quest state, data validation, and migration boundaries checked.`);
