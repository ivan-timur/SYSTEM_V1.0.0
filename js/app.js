/** SYSTEM release 1.0.0. Runtime version value is imported from modules/version.js. */
/** SYSTEM ES-module entry point. Legacy scripts are loaded serially until their remaining features are migrated. */
import { APP_VERSION } from "./modules/version.js";
import { completeQuest as completeQuestWithTypeScript } from "../dist/ts/core/progression.js";
import { isAchievementEligible as isAchievementEligibleWithTypeScript } from "../dist/ts/core/achievements.js";
import {
    appendActivityRecord,
    countActivitiesByStat,
    createActivityRecord,
    createDefaultProgressCounters,
    listActivities,
    normalizeActivityHistory,
    normalizeProgressCounters,
    proposeProgressCounterIncrement,
    selectActivitiesInRange,
    summarizeActivities,
    updateActivityEvidence,
} from "../dist/ts/core/activity-ledger.js";
import { getProgressionRewardIdentity, prepareProgressionReward } from "../dist/ts/core/reward-command.js";
import { previewLegacyLocalStorageMigration, createLegacyMigrationApproval, migrateLegacyLocalStorageToIndexedDB, getLegacyMigrationDatabaseStatus } from "../dist/ts/storage/legacy-migration.js";
import { inspectSystemDatabase } from "../dist/ts/storage/database-health.js";
import { normalizeLegacyDailyQuestState, createLegacyDailyQuestStorageEntries } from "../dist/ts/storage/legacy-daily-quest-state.js";
import { normalizeLegacyCustomQuests, createCustomQuestRecord, canCompleteCustomQuest, getBossQuestDefinitions, getBossQuestStatus } from "../dist/ts/features/quest-command.js";
import { planCustomQuestCompletion, planBossQuestClaim, planGoalEvidenceDecision } from "../dist/ts/features/quest-completion-plan.js";
import { evaluateGoalCurriculum, validateGoalCurriculum } from "../dist/ts/features/goal-curriculum.js";
import { recommendAdaptiveLearningPath } from "../dist/ts/features/adaptive-learning-path.js";
import { evaluateLearningCycle, createCompletedQuestEvidence } from "../dist/ts/features/learning-cycle.js";
import { SYSTEMStorage } from "./modules/storage.js";
import { inspectDurableStorageCapabilities, estimateDurableStorage, requestPersistentStorage, queryPersistentStorage } from "./modules/durable-storage-gate.js";
import {
    completeQuestInDatabase as completeDurableQuestInDatabase,
    createGoalCurriculumInDatabase,
    getGoalCurriculumFromDatabase,
    linkQuestToCurriculumInDatabase,
    saveSkillMasteryRecord,
    listSkillMasteryRecords,
} from "../dist/ts/storage/indexeddb.js";
import { installCspCompatibility } from "./modules/security.js";
import { initAIWorkspaceNavigation } from "./modules/ai-workspace-navigation.js";
import { initAndroidNative } from "./modules/android-native.js";
import { initVisualEffects } from "./modules/visual-effects.js";

window.SYSTEM_APP_VERSION = APP_VERSION;
window.SYSTEMTypeScriptAchievements = Object.freeze({
    isEligible: isAchievementEligibleWithTypeScript,
});
window.SYSTEMTypeScriptActivityLedger = Object.freeze({
    appendActivityRecord,
    countActivitiesByStat,
    createActivityRecord,
    createDefaultProgressCounters,
    listActivities,
    normalizeActivityHistory,
    normalizeProgressCounters,
    proposeProgressCounterIncrement,
    selectActivitiesInRange,
    summarizeActivities,
    updateActivityEvidence,
});
window.SYSTEMTypeScriptProgression = Object.freeze({
    completeQuest: completeQuestWithTypeScript,
    getRewardIdentity: getProgressionRewardIdentity,
    prepareRewardCommand: prepareProgressionReward,
});
// Explicit opt-in data migration tools. They are never auto-run and never delete legacy localStorage.
window.SYSTEMProgressionMigration = Object.freeze({
    preview: () => previewLegacyLocalStorageMigration(window.localStorage),
    approve: (preview, options) => createLegacyMigrationApproval(preview, options),
    migrate: (approval) => migrateLegacyLocalStorageToIndexedDB(window.localStorage, approval),
    status: () => getLegacyMigrationDatabaseStatus(),
});
// Read-only IndexedDB diagnostics. This API never mutates or repairs user data.
window.SYSTEMStorageDiagnostics = Object.freeze({ inspectIndexedDB: () => inspectSystemDatabase() });
window.SYSTEMStorage = SYSTEMStorage;
// Phase 11: storage diagnostics are read-only; persistence is requested only
// through an explicit call and never triggers data migration or deletion.
window.SYSTEMDurableStorage = Object.freeze({
    inspect: inspectDurableStorageCapabilities,
    estimate: estimateDurableStorage,
    requestPersistence: requestPersistentStorage,
    persistenceStatus: queryPersistentStorage,
});
window.SYSTEMDurableSkillAssessments = Object.freeze({ save: saveSkillMasteryRecord, list: listSkillMasteryRecords });
// Opt-in v7 transactional progression API. The legacy UI remains on localStorage
// until a separate approved migration/cutover is performed; these methods never
// does not copy, overwrite, or silently migrate existing saves.
window.SYSTEMDurableCurriculumProgression = Object.freeze({
    createGoal: createGoalCurriculumInDatabase,
    getGoal: getGoalCurriculumFromDatabase,
    linkQuest: linkQuestToCurriculumInDatabase,
    completeQuest: completeDurableQuestInDatabase,
});
// Phase 12 — explicit durable-progression bridge. This is intentionally opt-in:
// the legacy UI remains authoritative until a separately tested cutover is approved.
// Requiring a confirmation object prevents accidental writes from diagnostic callers.
window.SYSTEMDurableProgressionBridge = Object.freeze({
    inspect: async () => {
        const capabilities = inspectDurableStorageCapabilities();
        let database = { available: false, error: null };
        if (capabilities.indexedDBAvailable) {
            try {
                const result = await inspectSystemDatabase();
                database = { available: true, result };
            } catch (error) {
                database = { available: false, error: error instanceof Error ? error.message : String(error) };
            }
        }
        return Object.freeze({
            phase: 12,
            mode: "opt-in",
            legacyStorageRemainsAuthoritative: true,
            automaticMigration: false,
            dualWrite: false,
            capabilities,
            database,
        });
    },
    completeQuest: async (questId, rules, now, effects, options = {}) => {
        if (options?.confirmed !== true) {
            throw new Error("Durable progression writes require explicit confirmation: { confirmed: true }.");
        }
        if (typeof questId !== "string" || !questId.trim() || questId !== questId.trim()) {
            throw new Error("A valid Quest ID is required before durable progression can run.");
        }
        if (!rules || typeof rules.xpForNextLevel !== "function") {
            throw new Error("Valid TypeScript progression rules are required for durable progression.");
        }
        return completeDurableQuestInDatabase(questId, rules, now, effects);
    },
});
window.SYSTEMTypeScriptQuestState = Object.freeze({
    normalizeLegacyDailyQuestState,
    createLegacyDailyQuestStorageEntries,
});
window.SYSTEMGoalCurriculum = Object.freeze({
    validate: validateGoalCurriculum,
    evaluate: evaluateGoalCurriculum,
});
window.SYSTEMAdaptiveLearning = Object.freeze({ recommend: recommendAdaptiveLearningPath });
// One decision surface for the live app: curriculum + assessments + quests are
// evaluated together. This pure API cannot write storage or award rewards.
window.SYSTEMLearningCycle = Object.freeze({
    evaluate: evaluateLearningCycle,
    createCompletedQuestEvidence,
});
window.SYSTEMTypeScriptQuestDomain = Object.freeze({
    normalizeLegacyCustomQuests,
    createCustomQuestRecord,
    canCompleteCustomQuest,
    getBossQuestDefinitions,
    getBossQuestStatus,
    planCustomQuestCompletion,
    planBossQuestClaim,
    planGoalEvidenceDecision,
});
installCspCompatibility();

function loadClassicScript(relativePath) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL(relativePath, import.meta.url).href;
        script.async = false;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`SYSTEM could not load ${relativePath}`));
        document.head.appendChild(script);
    });
}

const legacyScripts = [
    "./generated/progression-math.js", // Compiled TypeScript: authoritative runtime XP/rank arithmetic
    "./core/progression-math.js", // Compatibility guard before the legacy controller
    "./core/progression-idempotency.js", // Stable reward IDs and replay protection before progression actions
    "./core/intelligence-engine.js",   // Deep intelligence first so legacy can use it
    "./core/skill-review.js",          // Local self-assessment API before the Status tool UI
    "./core/skill-mastery.js",        // Evidence-aware assessments before the Status tool UI
    "./core/smart-roadmap.js",        // Persistent milestone planner before the Status tool UI
    "./core/goal-progress.js",        // Evidence-aware Goal/Quest linkage before the legacy actions
    "./features/i18n.js",
    "./features/ai-quest-parser.js", // Pure parser, independently tested before AI quest UI loads
    "./core/skill-curriculum.js", // Detailed bilingual curriculum before Status renders the tree
    "./legacy/app-controller.js",
    "./features/adaptive-learning-ui.js", // Real read-only bridge from stored goals, assessments, and quests to adaptive recommendations
    "./features/experience.js",
    "./features/rewards-plus.js",
    "./features/rewards-ascension.js", // Favorites, milestone route, pity meters and reward export
    "./features/royal.js",
    "./features/grok-suite.js",
    "./features/auto-snapshots.js",
    "./features/quest-ascension.js",
    "./features/status-more.js"
];

window.SYSTEM_APP_BOOT_STATE = "starting";
let failedScript = "";
try {
    for (const path of legacyScripts) {
        failedScript = path;
        await loadClassicScript(path);
    }
    initAndroidNative();
    initAIWorkspaceNavigation();
    initVisualEffects();
    document.documentElement.dataset.systemAppVersion = APP_VERSION;
    document.documentElement.dataset.systemBootState = "ready";
    window.SYSTEM_APP_BOOT_STATE = "ready";
    window.dispatchEvent(new CustomEvent("system-app-ready", { detail: { version: APP_VERSION } }));
} catch (error) {
    document.documentElement.dataset.systemBootState = "error";
    window.SYSTEM_APP_BOOT_STATE = "error";
    window.SYSTEM_APP_BOOT_ERROR = { script: failedScript, message: String(error?.message || error).slice(0, 300) };
    console.error("SYSTEM failed to initialize a required module:", failedScript, error);

    // A failed script used to leave a partially initialized UI with no user-facing clue.
    // Use textContent only; error messages are not treated as trusted HTML.
    const alert = document.createElement("aside");
    alert.className = "system-boot-error";
    alert.setAttribute("role", "alert");
    alert.setAttribute("aria-live", "assertive");
    const heading = document.createElement("strong");
    heading.textContent = "SYSTEM could not finish starting";
    const detail = document.createElement("p");
    detail.textContent = `Required module unavailable: ${failedScript}. Check the connection/local server, then reload the page.`;
    alert.append(heading, detail);
    document.body?.prepend(alert);
    window.dispatchEvent(new CustomEvent("system-app-error", { detail: { version: APP_VERSION, script: failedScript } }));
}
