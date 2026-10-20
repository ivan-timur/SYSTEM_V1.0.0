## 1.0.0 — Phase 6: UX, Mobile and Release Gate Integration
- Fixed a daily-quest completion handler scope error that could throw while building the post-commit success feedback after progress had already been saved.
- Added a cross-layer contract gate for transaction-before-feedback ordering, quest XP/level/reward wiring, mobile navigation coverage, Android bundle parity, and explicit release validation limits.
- Wired the Phase 6 contract into the static regression suite and exposed `npm run test:phase6` for focused checks.
- Validation scope is source/static contracts plus available Node tests; no physical-device run or APK build is claimed by this phase.

## 1.0.0 — Phase 31 Storage and Release Gates
- Added a source-contract gate for the real-browser IndexedDB runner, close/reopen and duplicate-completion coverage, Android asset synchronization, and version consistency.
- Wired the Phase 31 check into `npm run test:static` and added Persian validation-gate documentation.
- Kept storage cutover disabled; this phase does not claim a real-browser run, APK build, installation, or physical-device update validation.

## 1.0.0 — Phase 29 Progression Boundary Audit

## 1.0.0 — Phase 30 Atomic Progression Integration Audit
- Added a focused cross-layer source-contract audit for TypeScript progression ownership, canonical reward normalization, IndexedDB transaction store boundaries, coupled writes, and transaction failure handling.
- Kept the existing live localStorage save path authoritative; automatic migration and uncontrolled dual-write remain disabled.
- Wired the Phase 30 audit into `npm run test:static` and added Persian phase documentation.
- Validation scope: source-contract audit only; real-browser IndexedDB, full npm suite, Playwright, APK build, and physical-device update checks are not claimed.


- Added a focused contract audit for TypeScript reward normalization, idempotency-check ordering, rollback-aware legacy side effects, and storage-authority guardrails.
- Wired the audit into `test:static` and documented the remaining runtime validation gates in Persian.
- No live storage cutover, dual-write, automatic migration, APK build, or device-level validation was performed.

## 1.0.0 — Phase 27 Architecture Consolidation

- Added a documented architecture decision baseline for TypeScript domain ownership, storage migration safety, Android boundaries, conditional technologies, and honest release gates.
- Added a contract test for the Phase 27 decisions and wired it into the standard static regression suite.
- No storage cutover, runtime technology expansion, APK build, or device-level validation was performed by this documentation/governance phase.

## 1.0.0 — Phase 26 Release Engineering Preflight

- Added automated checks for canonical version agreement across package metadata, Android `versionName`, and the web manifest.
- Added Android bundle parity checks for the entry HTML, Service Worker, version file, and web manifest.
- Added a release preflight command and wired it into the debug APK GitHub Actions workflow before Android build steps.
- Documented remaining release gates: reproducible npm dependency lock, real APK build, signing, and device validation.

## 1.0.0 — Phase 15 Storage Durability Validation

- Added a real-browser IndexedDB close/reopen persistence probe covering XP, Level, Rank, and Quest identity.
- The probe waits for the write transaction to commit, closes the database connection, reopens it, verifies the persisted record, and removes only its isolated test record.
- Added a static contract test to ensure the real-browser test is wired into the documented runner and migration remains explicit and non-destructive.
- No production storage cutover was performed; localStorage remains authoritative for the existing UI until a separately approved and tested migration.
- Browser execution, full npm test suite, and device-level Android/WebView checks must be run in an environment with dependencies and browser binaries before claiming release readiness.

## 1.0.0 — Phase 14 Durable Storage Integrity
- Added a storage-integrity contract test for backup checksums, bounded backup size, required player save, rollback-aware restore, read-only IndexedDB diagnostics, and explicit migration safeguards.
- Wired the regression test into `npm run test:static` and added Persian phase documentation.
- Preserved localStorage as the active UI source of truth; no automatic migration, dual-write, destructive cleanup, cloud sync, or APK build was introduced.
- Validation: the complete `npm run test:static` suite was attempted; it exposed an existing CHANGELOG heading mismatch before the project-integrity check could pass. Targeted storage, Phase 12/13/14 contract tests and architecture guard passed.

## 1.0.0 — Phase 13 Architecture Governance
- Added an executable contract test for the final technology-responsibility map.
- Added the Phase 13 architecture governance report and wired its test into `test:static`.
- Preserved the Phase 12 opt-in durable progression bridge and the existing storage migration safety gates.
- Validation run: Phase 13 contract test and architecture guard passed. Full npm test was not run because dependencies are not installed in this environment.

## 1.0.0 — Deep Logic Phase 8: Adaptive Input Integrity

- Hardened the TypeScript adaptive-learning boundary with explicit skill-status, Goal/Milestone ID, review-interval, Quest-kind, skill-ID and prerequisite-list validation.
- Rejected duplicate skill IDs within a Quest and malformed optional identifiers before recommendations are generated.
- Added regression assertions for invalid runtime payloads while preserving deterministic, side-effect-free planning and the no-reward boundary.
- Validation: TypeScript suite, static regression suite, architecture guard, project doctor, CSS build and Service Worker build passed. The CSS output has zero `!important` declarations; the Service Worker precaches 149 resources; 148 files were synchronized to Android assets. Real-browser IndexedDB, Playwright UI, APK build and physical-device tests are not claimed.

## 1.0.0 — Deep Logic Phase 7: Goal Evidence Integrity & Atomic Quest Boundary

- Expanded approved legacy migration to create typed Goal curricula and an append-only Goal evidence ledger in the same IndexedDB migration transaction.
- Converted legacy Goal targets into sequential milestones and bound active linked Custom Quests to the next available milestone.
- Imported historical evidence only when it points to a Custom Quest that is actually imported as completed; missing or unfinished Quest references are skipped with warnings rather than promoted into proof.
- Kept rejected evidence from consuming milestone slots, and never upgrades historical records into Skill mastery verification.
- Hardened the durable Quest-completion command: a curriculum-linked Quest fails closed unless its Goal evidence is supplied in the same transaction. Quest, Player/Skill progress, XP ledger, Stat/counters/activity, Goal snapshot and append-only evidence commit together or the transaction aborts.
- Added migration integrity tests and browser integration coverage for typed Goal/evidence import, missing-evidence rejection, successful atomic completion and reload persistence.
- Validation: `npm run test:ts` and `npm run test:static` passed. `npm run test:browser-idb` was attempted, but managed Chromium policy blocks localhost (`ERR_BLOCKED_BY_ADMINISTRATOR`), so no real-browser IndexedDB result was produced. Live UI cutover, APK build and physical-device installation are not claimed.

## 1.0.0 — Deep Logic Phase 6: Migration UI & Cutover Safety Gate

- Added a user-facing, two-step localStorage → IndexedDB flow in Settings → Backup: review a read-only preview, explicitly confirm import, acknowledge warnings, then perform one atomic import.
- Added a read-only migration receipt API showing whether the snapshot was imported, the source fingerprint, completion time, import summary and warnings.
- Added a divergence check that compares the current legacy save fingerprint with the imported fingerprint; if the old save changed after import, the UI warns that the two stores may differ.
- Kept import disabled until a successful preview; stale previews, date rollover, warning acknowledgement failures and a non-empty destination remain fail-closed.
- The original localStorage save is never removed, and opening the panel never triggers migration automatically.
- Kept the production cutover gate closed: the live app still has reward routes outside the atomic IndexedDB boundary. This phase improves safe review/import and visibility, but does not claim that the whole application now uses IndexedDB.
- Added migration/cutover UI contract tests to the regression pipeline.
- Validation: `npm test` passed (TypeScript, static regression and architecture guard); Android release-readiness passed 42 checks; source syntax checks passed. Real-browser IndexedDB execution was attempted but the managed Chromium URL policy blocked the localhost test page, so it produced no IndexedDB result. Playwright UI, APK build and physical-device install were not performed.

## 1.0.0 — Deep Logic Phase 2 Integration

- Connected the typed `LearningCycle` engine to the live Quest recommendations panel instead of invoking the adaptive planner as a separate decision path when an active Goal exists.
- Added a reusable, read-only legacy Goal → curriculum definition adapter so the displayed milestones and learning-cycle decision use the same projection.
- Propagated goal/milestone context to assessed Skills only through explicit Quest links; stat or XP similarity is not used as proof of mastery.
- Tightened learning-cycle evidence creation: only completed, correctly linked Quests are eligible; verification methods and timestamps are validated, and mastery verification requires a score of at least 80/100.
- Hardened duplicate/invalid completed-Quest IDs and updated recommendation selection to fill available slots with ranked alternatives when only one skill is linked.
- Added TypeScript and runtime-wiring regression coverage; regenerated CSS, Service Worker precache, and Android web assets.
- Validation: `npm test`, project doctor, and architecture guard pass. Browser E2E and physical Android installation/update tests were not run in this environment.

## 1.0.0 — Clean V1 Baseline

- Restarted the public release version at 1.0.0 while preserving the prior development history below.
- Organized historical phase reports under `docs/releases/history/`.
- Standardized version metadata through the canonical `VERSION` file.
- Preserved application source, tests, Android wrapper, assets, and build scripts.

## 3.27.0 — Scroll-Stable Mobile Navigation

- Removed root overflow clipping that could interfere with fixed-position navigation during scroll.
- Strengthened mobile dock sizing and explicitly enforced a five-column grid for all navigation items.
- Added visibility, width, and image sizing safeguards for Rewards, AI, and Settings icons.
- Increased bottom content clearance for the persistent dock and Android safe-area inset.

## 3.26.0 — Phase 27: Mobile navigation width and visibility
- Fixed the mobile bottom navigation container to occupy the full viewport width.
- Forced all five navigation entries (Status, Quest, Rewards, AI, Settings) into an equal-width grid and kept their icons visible.
- Preserved Android safe-area padding.

## 3.24.0 — Phase 25 Android Release Readiness
- Added release-readiness contract checks for canonical version synchronization across web and bundled Android assets.
- Audited offline service-worker precache coverage and native WebView security, origin, and storage settings.
- Added a repeatable Android release checklist for clean install, in-place update, persistence, offline launch, and notification permissions.
- Rebuilt the Android asset bundle from the release sources; physical WebView/device install testing remains a required manual validation step.

## 3.23.0 — Phase 24 Visual Performance
- Adaptive low-power Canvas rendering, reduced particle/line/orbit work, and performance snapshots.
- Expanded reduced-motion and mobile visual-cost rules.
- Added Phase 24 performance contract test.

## 3.22.0 — Phase 23: End-to-End Validation

- Added Playwright end-to-end coverage for Settings, backup health checks, JSON backup export, and restore input constraints.
- Expanded the mobile E2E run to include Rewards and Settings/Backup flows.
- Added narrow-viewport navigation checks across core pages with horizontal-overflow assertions.
- Existing Status/Quest, Skill Tree, Rewards, and adaptive-roadmap E2E suites remain part of the Phase 23 release test command.
- Browser/device execution remains dependent on installing the declared Playwright package and Chromium browser.

## 3.21.0 — Phase 22 Adaptive Learning Cycle Integration
- Connected the typed adaptive learning planner to the live Quest page through a read-only UI bridge.
- Added recommendations based on saved goals, custom quest links, recorded skill assessments, review timing, completion state, and prerequisites.
- Added active-goal milestone progress projection and evidence counts using the existing goal curriculum evaluator.
- Recommendations navigate to the existing quest card and never award XP, coins, or skill verification.
- Added responsive panel styling, reduced-motion handling, and static integration contract tests.
- Limitation: browser-level end-to-end testing on a real browser/device remains a separate validation step.

## 3.20.0 — Phase 21: Data Integrity & Recovery Audit

- Added a focused regression suite for simulated restart persistence, backup/restore round-trips, namespace-scoped replacement, checksum-corruption rejection, and rollback after a failed write.
- Included the Phase 21 suite in the static regression pipeline.
- Documented the distinction between checksum-based accidental-corruption detection and cryptographic authenticity.
- Preserved explicit, preview-bound legacy migration and the existing source-data safety boundary.
- Recorded remaining validation limits: real-browser IndexedDB, abrupt shutdown, and physical Android-device testing require their respective runtime environments.

## 3.19.0 — Phase 20: Aether Final Integration

- Connected successful daily, AI-daily, custom, and boss quest commits to the visual milestone event bus; events fire only after the transaction commits.
- Connected skill level-ups to dedicated skill milestone feedback and made boss clears emit both boss-specific and general quest completion events.
- Added a short-window, identity-aware deduplication guard to prevent repeated milestone events from flooding the toast queue.
- Preserved the E–S rank calculation and existing XP/reward authority; visual events are presentation-only and never award progress.
- Rebuilt CSS, synchronized version metadata, refreshed the offline service-worker shell, and synchronized the Android web asset copy.

## 3.18.0 — Phase 19: Aether Master Experience

- Added a dedicated boss-challenge completion milestone with a restrained violet visual treatment.
- Refined rank feedback and cinematic page-entry polish while keeping transitions short and non-blocking.
- Added mobile-specific restraint and explicit reduced-motion handling for the new effects.
- Extended visual-effects contract coverage for the new event; all effects remain presentation-only and do not grant XP or alter quest state.

## 3.17.0 — Phase 18: Aether Evolution
- Added dedicated visual feedback for skill evolution and reward revelation events without changing reward/progression rules.
- Added bounded, deduplicated milestone scheduling so rapid event bursts do not flood the toast queue.
- Added evolution/reward-specific toast treatments and brief, non-blocking event accents.
- Preserved reduced-motion behavior, mobile restraint, and presentation-only boundaries.

## 3.16.0 — Phase 17: Aether Cinematic Engine
- Added restrained page-entry transitions and event-based visual feedback.
- Honored reduced-motion preferences and synced Android web assets.

## 3.15.0 — Phase 16: Adaptive Aether

- Added a low-cost animated energy core and orbiting nodes to the ambient Canvas layer.
- Adapted decorative frame pacing for mobile and lower-power devices.
- Limited pointer influence to recent desktop movement and reset it on window blur.
- Bounded milestone queue length through a named constant and refined skill milestone feedback.
- Preserved reduced-motion support and kept progression, quest, and reward rules untouched.

## 3.14.0 — Phase 15: Aether Motion

- Added three subtle orbital layers to the ambient Canvas field using lightweight ellipse strokes rather than costly blur effects.
- Reworked milestone bursts into eased dual rings with a fading center glint.
- Refined milestone arrival motion and glass treatment, with mobile-specific restraint.
- Preserved reduced-motion handling and kept all effects presentation-only; progression and rewards are unchanged.
- Added contract checks for the new orbital and milestone animation layers.

## 3.13.0 — Phase 13: Adaptive Learning Path

- Added a deterministic adaptive planner that ranks eligible quests using weak-skill scores, spaced-review due dates, active goal/milestone alignment, difficulty, and session length.
- Filters completed quests and blocks quests whose required prerequisite skills are not verified.
- Produces transparent recommendation reasons and diagnostics; planner is pure, reward-neutral, and does not mutate storage or claim mastery.
- Added TypeScript tests for prioritization, review due dates, prerequisite blocking, duplicate IDs, invalid input, and reward neutrality.
- The planner is available as a typed engine; automatic UI presentation and live app-state wiring are future integration work.

## 3.12.0 — Phase 12: Durable Mastery UI Integration

- Added IndexedDB v6 store `skill_assessments`, separate from scored quiz attempts.
- Connected the Mastery Tracker to durable IndexedDB writes and reads through a typed runtime bridge.
- Added one-way compatibility migration from legacy localStorage records without deleting the original recovery copy.
- Preserved duplicate-evidence protection and kept assessments independent from XP, coins, and rewards.
- The assessment history remains self-reported evidence; it is not presented as independent proof of mastery.

## 3.11.0 — Phase 11: Durable Assessment History

- Added IndexedDB `assessment_attempts` store with unique `attemptId` keys and indexes for assessment history.
- Added validated save/list APIs for assessment attempts; duplicate attempt IDs are rejected without overwriting history.
- Assessment records explicitly require `rewardIssued: false`; the persistence layer does not grant XP, coins, or rewards.
- IndexedDB schema version increased to 5; existing stores are retained during upgrade.

## 3.10.0 — Phase 10: Skill Assessment Engine

- Added a deterministic assessment evaluator with strict question, answer, choice, and ID validation.
- Computes an overall score and per-skill results; skills only qualify at the configured threshold (80% by default).
- Identifies weak skills and generates focused review/practice recommendations.
- Keeps assessment evaluation reward-neutral (`rewardIssued: false`) and storage-agnostic; it does not claim to persist verification or grant XP/coins.
- Added tests for scoring, skill-level evaluation, duplicate answers/questions, and reward neutrality.
- UI integration, persisted attempt history, browser E2E, APK build, and device validation are not claimed in this phase.

## 3.9.0 — Phase 9: Connected Learning Cycle

- Propagated the stable Skill ID from a completed Custom Quest into Goal evidence, preserving the link across the Quest → Evidence boundary.
- Legacy Goal curriculum projections now retain Skill IDs as references while explicitly leaving `skillVerification` empty: completion is not mastery.
- Preserved duplicate-evidence protection, existing transaction/reward authority, legacy save shapes, and no-reward behavior during evaluation/normalization.
- Added contract tests for Skill ID propagation, completion-versus-verification separation, and idempotent evidence.
- The legacy Goals model still uses sequential evidence targets; richer custom milestone/required-skill editing is not claimed in this phase.
- Browser E2E and APK/device validation are not claimed unless separately executed.

## 3.8.0 — Phase 8: Skill Tree & Quest Evidence Linking

- Replaced manually typed Skill ID/title in the mastery workflow with a selector sourced from the official skill curriculum; changing the Stat refreshes the skill choices.
- Added an optional related Quest ID to evidence records and assessment history.
- Prevented duplicate evidence records for the same Skill ID + Quest ID pair when evidence is marked present.
- Kept older assessment records valid and retained the reward-neutral design.
- Quest IDs are references only in this phase; they do not prove quest completion, and self-reported evidence is not independent certification.
- No Playwright E2E, APK build, or Android-device test is claimed.

## 3.7.0 — Phase 7: Per-Skill Evidence Workflow

- Extended the Skill Mastery Tracker to collect a stable Skill ID and display title for each assessment while retaining compatibility with legacy assessment records.
- Added per-skill summaries with transparent learning, evidence-recorded, and ready-for-review states.
- Kept readiness distinct from independent mastery certification; all assessment data remains self-reported and no verifier identity is authenticated.
- Updated the Status Command Deck mastery form and assessment history to show per-skill information.
- Added regression coverage for Skill ID validation, per-skill summaries, evidence state, export compatibility, and the UI contract.
- The assessment workflow remains reward-neutral and does not alter XP/Coin authority or the saved Goal transaction path.
- Does not claim browser E2E, Android APK build, or device testing.

## 3.6.0 — Phase 6: Explicit Skill Verification

- Distinguished Quest Skill assignment from demonstrated Skill mastery in the typed Goal Curriculum evaluator.
- Required an explicit Skill verification record (method, timestamp, score) and a score of at least 80/100 before a required Skill counts as verified.
- Validated verification method, timestamp, score bounds, and the associated Skill ID.
- Preserved legacy Goal compatibility; legacy evidence is not silently promoted to Skill mastery.
- Added regression tests for assignment-only evidence, threshold behavior, malformed verification records, and the non-rewarding/read-only evaluation contract.
- This phase adds a data/evaluation contract, not an assessment UI, reviewer identity verification, browser E2E, or an APK/device test.

## 3.5.0 — Phase 5: Progression Transaction Integration

- Connected the legacy evidence-based Goal completion path to the typed Goal Curriculum evaluator as a read-only consistency gate.
- A newly completed Goal must project to 100% with every generated milestone complete before the existing transaction planner authorizes the one-time Goal completion bonus.
- Preserved the existing transaction/reward authority, duplicate evidence guards, saved Goal format, and compatibility for older helper results where the optional evaluation field is absent.
- Added regression tests for successful curriculum agreement and fail-closed behavior when milestone completion disagrees with the Goal completion signal.
- This phase does not add custom milestone editing, change XP values, migrate storage, or claim browser E2E/APK/device validation.

## 3.4.0 — Phase 4: Goal & Roadmap Integration

- Connected existing saved Goals to the typed Goal Curriculum evaluator through a read-only compatibility bridge; existing saved records require no migration.
- Projects each legacy linked-Quest target into a sequential milestone path and maps unique existing evidence to that path while preserving legacy Stat behavior.
- Updated the Goals screen to show milestone completion and a collapsible milestone path, with a safe fallback if the evaluator is unavailable.
- Kept existing Goal completion transactions and XP/Coin reward authority unchanged; the projection itself performs no writes and issues no rewards.
- Added regression assertions for legacy-to-curriculum projection, milestone dependencies, Stat compatibility, and Goals UI wiring.
- Validation status is recorded in `UPGRADE_REPORT_V3.4.0_PHASE4_FA.md`; this release does not claim device/APK or full browser E2E validation.

## 3.3.0 — Phase 3: Goal Curriculum & Evidence Evaluation

- Added a strict, pure Goal → Milestone → Skill → Quest → Evidence evaluation contract.
- Validates stable IDs, milestone prerequisite references, prerequisite cycles, evidence timestamps, duplicate evidence, Stat assignments, and bounded evidence targets.
- Evaluates milestone unlocks in prerequisite order independent of input ordering.
- Distinguishes passed evidence from ordinary activity and requires explicitly evidenced Skill IDs where a milestone requires them.
- Exposes the evaluator through `window.SYSTEMGoalCurriculum` for controlled adapter adoption.
- Evaluation is read-only and never awards XP/Coins; existing transaction/reward pathways remain the only payout authority.
- Added TypeScript regression coverage for progression, invalid graphs, duplicate evidence, skill requirements, Stat mismatch, and idempotent completion readiness.

## 3.2.2 — Phase 2: Storage Integrity & Diagnostics

- Added a read-only IndexedDB health inspection API covering schema version, store counts, canonical player presence, Quest identities, XP ledger validity/references, and activity timestamps.
- Exposed diagnostics through `window.SYSTEMStorageDiagnostics.inspectIndexedDB()` without enabling automatic migration or destructive repair.
- Added a TypeScript contract test to prevent accidental database writes from the diagnostics layer.
- Kept legacy `localStorage` data intact and the existing explicit, preview-bound migration flow unchanged.
- Rebuilt TypeScript/runtime artifacts, CSS, and Service Worker precache manifest for release 3.2.2.
- Validation: `npm test` passed, including TypeScript, static regression, release-integrity, and architecture checks. Browser-driven IndexedDB execution and APK/device tests remain separate and are not claimed as completed.

## 3.2.1 — Progression Core Integrity Hardening

- Hardened the shared TypeScript progression boundary to reject malformed or duplicate completed-Quest IDs, Achievement IDs, and XP event identities before a new transition can award progress.
- Validated XP event amounts, timestamps, and optional Skill identity fields before progression calculations.
- Tightened Quest ID normalization at the domain boundary to prevent padded or oversized identifiers from bypassing canonical identity expectations.
- Added regression cases for corrupted identity collections and malformed XP events.
- Preserved the existing UI, storage keys, reward formulas, and migration behavior; this is a focused Phase 1 hardening release.
- Validation target: complete test suite and project doctor. Real-device APK and interactive browser tests remain separate verification steps.

## 3.2.0 — Milestone Celebrations & Visual Settings

- Added a compact, accessible milestone toast for real Level Up, Rank Ascended, and claimed Achievement events.
- Connected celebration events to committed progression transitions and successful achievement claims instead of decorative or simulated triggers.
- Added Settings → Visual Effects controls for ambient particles and milestone celebrations, persisted under a dedicated visual-preferences key.
- Improved reduced-motion handling: Canvas motion stops while informational milestone feedback remains available.
- Added contract coverage for milestone event wiring, settings controls, persistence boundaries, and the generated CSS pipeline.
- Validation target: complete test suite, project doctor, and Android web-asset synchronization. Browser visual/E2E tests and APK build must be reported separately if not run.

## 3.1.0 — Canvas Visual Atmosphere & Motion System

- Added a lightweight, decorative Canvas atmosphere with a small particle field and faint constellation connections; no external dependencies, network calls, or progression/storage access.
- Added event-triggered ring feedback for quest completion, level-up, and achievement-unlocked events when those events provide a target.
- Respects `prefers-reduced-motion`, pauses while the document is hidden, caps device pixel ratio and animation rate, and uses fewer particles on mobile.
- Added a focused CSS source fragment for subtle, non-layout-shifting micro-interactions and wired it into the generated CSS build.
- Added a visual-effects contract regression test and documented Canvas as a narrowly scoped, implemented enhancement—not a reason to adopt WebGL.
- Preserved existing storage keys, quest rules, page structure, and native Android code. This release updates web assets; it does not claim to build a new APK.

## 3.0.0 — Preview-Bound Storage Migration Gate

- Reworked the opt-in localStorage → IndexedDB migration API to require a migration preview and a separate explicit approval object before any target database is opened.
- Bound approvals to the exact legacy-source fingerprint and local calendar date; changed saves and date rollover invalidate the approval before IndexedDB writes begin.
- Required acknowledgement of migration warnings, alongside affirmative confirmation, before approval can be created.
- Exposed a small migration API in `js/app.js`: `preview()`, `approve(preview, options)`, and `migrate(approval)`. No migration runs during app startup, and old localStorage keys are never removed or rewritten.
- Added regression coverage for missing confirmation, unacknowledged warnings, stale source rejection, date rollover, future confirmation timestamps, and preservation of the legacy save.
- Updated the real-browser IndexedDB integration test to use the same preview → approve → migrate workflow, including idempotent replay and conflict refusal.
- IndexedDB remains opt-in and is not the live UI storage source. APK generation and successful real-browser execution must be confirmed separately; this release does not claim either from an asset build alone.

## 2.9.0 — Typed Quest Completion Plans and Goal Evidence Safety

- Extracted execution planning for Custom Quest completion, Boss Quest claims, and Goal evidence outcomes into the pure TypeScript module `src/features/quest-completion-plan.ts`.
- The legacy UI now asks TypeScript for an eligible Boss claim plan before changing storage, then uses the same plan for the canonical reward and lifetime counter.
- Custom Quest completion now validates the saved record and creates one typed plan containing the completion timestamp, canonical reward payload, lifetime counter field, and optional Goal evidence request.
- Goal evidence outcomes are interpreted by a typed fail-closed decision: invalid evidence aborts the surrounding rollback transaction; stale or mismatched optional links are detached; duplicate evidence never pays twice; only a newly completed, validated Goal yields the fixed +50 XP / +10 Coins reward.
- Preserved all existing localStorage keys and the legacy transaction/rollback adapter. IndexedDB is not activated for the live UI and no automatic data migration is performed.
- Added focused regression coverage for locked/unknown/already-claimed Boss Quests, malformed Custom Quest reward plans, Goal evidence duplicates/stale links, and Goal completion reward identity.
- Updated architecture guardrails to ensure the application entry point exposes the completion-plan API and the legacy controller uses it instead of duplicating execution rules.
- Browser E2E and live IndexedDB tests remain separate gates. Android Web assets can be synced, but an APK build is not claimed unless Gradle is executed and the resulting APK is checked.


## 2.8.0 — Typed Custom and Boss Quest Rules

- Moved the canonical Boss Quest metadata, eligibility thresholds and progress labels into the shared TypeScript Quest catalogue/domain; the legacy controller now renders typed results instead of carrying a duplicate inline Boss Quest catalogue.
- Extracted compatibility normalization for saved Custom Quests, preserving stable IDs and forward-compatible record fields while filtering malformed/duplicate entries and applying the established field bounds.
- Added a typed Custom Quest creation contract that checks IDs, title/description limits, Stat assignment, active Goal links, XP/Coins bounds and timestamps before the legacy storage adapter writes the record.
- Added an explicit fail-closed guard against repeating a Custom Quest completion, and added regression tests for historical saves, invalid input, duplicate identities, completion guards and Boss Quest eligibility.
- Preserved existing `localStorage` keys and user-save formats. This release does not activate IndexedDB for the live UI, migrate user data automatically, or claim an APK build.

## 2.7.0 — Typed Daily Quest State Boundary

- Extracted the legacy Daily Quest completion payload contract into `src/storage/legacy-daily-quest-state.ts`; date rollover, payload normalization, forward-compatible IDs, and storage-entry creation now have a typed, deterministic owner.
- Routed the existing controller's Daily Quest load/save path through the compiled TypeScript boundary while preserving the legacy `system_v2_quests` and `system_v2_quest_date` keys and the existing atomic localStorage adapter.
- Kept IndexedDB opt-in. This release does not silently migrate or delete existing browser data.
- Added focused regression tests for same-day loads, rollover, malformed JSON, invalid value filtering, unknown future Quest IDs, invalid dates/keys, and serialization.
- Confirmed the full unit/static/build suite passes. The real Chromium IndexedDB test remains blocked in this environment by managed `URLBlocklist: ["*"]`; no browser policy was modified and no false pass was reported.

## 2.6.0 — TypeScript Activity Ledger and Safe Persistence Adapter

- Extracted lifetime-counter normalization, validated activity records, evidence updates, bounded history management, range selection, and summaries into a pure TypeScript domain module.
- Connected the compatibility layer to the TypeScript rules while leaving localStorage keys, the old save format, reward transactions, and opt-in IndexedDB migration boundary unchanged.
- Made event/evidence persistence commit-first: a failed localStorage write no longer leaves an unsaved activity or self-reported evidence change in the current tab's in-memory history.
- Capped persisted lifetime counters consistently with live updates, preserved compatible historical metadata, limited the activity history to 300 records, and kept learning evidence read-only with respect to XP and Coins.
- Added TypeScript regression tests for malformed counters, numeric caps, event field validation, immutable evidence updates, history bounds, date windows, and summaries. Added architecture checks for the new domain boundary.
- Real-browser IndexedDB and Playwright execution remain CI-gated. This release does not activate IndexedDB as the live UI source of truth and does not claim that a local-browser policy-blocked test passed.

## 2.5.0 — Typed Achievement Rules and Architecture Guardrails

- Moved the eight dynamic achievement eligibility thresholds into a pure TypeScript domain module with validated snapshots and fail-closed handling for unknown IDs or malformed counters.
- Connected the existing Rewards controller to the TypeScript criteria through the ES-module entry point; reward-card UI, stable persisted IDs and claim storage stay in place for compatibility.
- Added regression tests for every current dynamic achievement threshold, bad snapshots, unknown achievement IDs and unique stable identifiers.
- Added a machine-checked architecture guard to `npm test`, `npm run doctor` and the dedicated `npm run architecture:check` command.
- Documented the final technology map and migration gates in Dari: the roles of JavaScript, TypeScript, HTML/CSS, JSON, IndexedDB, Android Java/Kotlin, optional backend/storage technology, and deliberately deferred Canvas/WebGL, Python, SQLite, ICU and Rust/WASM are explicit.
- Preserved the localStorage source of truth for the live UI; no IndexedDB cutover, database deletion, key rename or native-code rewrite is claimed in this release.

## 2.4.0 — Reliable Browser-Test Gate for IndexedDB

- Updated the real-browser IndexedDB integration runner to prefer the Playwright Chromium browser installed by CI, while retaining the dependency-free CDP path for local environments without Playwright.
- Added bounded Playwright navigation/result waits and page-error reporting; the runner still respects managed URL policies and never turns a blocked navigation into a passing test.
- Added read-only diagnostics for managed `URLBlocklist` policies so a policy-blocked test reports evidence and a precise environment limitation.
- Wired the native IndexedDB transaction test into both the quality CI workflow and the signed Android release workflow after Chromium installation, so the release gate actually runs the real transaction suite instead of only syntax/static contracts.
- Strengthened runner and release-pipeline contracts to ensure CI keeps this browser test enabled.
- Kept `localStorage` authoritative in the live UI until the real-browser transaction gate is observed passing; no production storage cutover is claimed in this version.

## 2.3.0 — Atomic Daily Quest Streak Engine

- Moved the consecutive-day streak calculation into a pure TypeScript domain module with a 50% cap and clock-rollback validation.
- Applied streak-scaled Player, Stat and Skill XP inside the same IndexedDB write transaction as the Quest completion; persisted an awarded-XP snapshot for safe replay checks while keeping the Quest's base reward unchanged.
- Persisted the streak state in `app_state` within the Quest transaction and preserved existing streak data through the explicit localStorage migration planner.
- Kept the live legacy UI on localStorage pending successful real-browser IndexedDB integration verification.

## 2.2.0 — Canonical Quest Identity and Daily Command Boundary

- Added one canonical TypeScript Quest-ID constructor and strict length validation. Reward commands and fresh legacy migration plans now use the same persisted IDs for Daily, AI Daily, Custom, Boss, Goal and Goal-evidence completion; oversized IDs are rejected rather than silently truncated into possible collisions.
- Moved the six core Daily Quest and Boss Quest definitions into a shared TypeScript catalogue so migration and application commands do not maintain separate built-in lists.
- Added `completeDailyQuestCommand()` as a DOM-independent TypeScript application service. It treats the persisted Quest as authoritative for XP/Coins/Skill rewards, resolves old Daily/AI Daily migration IDs only as compatibility aliases with matching provenance, records stable activity identity, and applies Stat/counter effects through the existing atomic IndexedDB transaction.
- Strengthened the same-transaction Daily Prize gate. A claim must reference each of the six core Daily Quests for the same date, include the Quest being completed, and validate each other Quest against its completion status, Player completion list, embedded XP event and durable XP ledger before the prize may commit. Conflicting/incomplete records fail closed.
- Added unit/contract coverage for canonical IDs, older migrated Daily Quest aliases, persisted reward authority, AI Daily separation, missing-gate behavior and fail-closed identity validation; expanded the real-browser test page to verify a fully consistent six-Quest gate and replay protection.
- The Daily application service remains staged and **is not connected to the legacy Quest buttons**. This avoids a premature storage cutover before the browser integration test passes. The existing localStorage path remains authoritative and all 11 themes and existing save keys are preserved.

## 2.1.0 — Browser Test Diagnostics and Cutover Safety

- Replaced the Chromium `--dump-dom` integration runner with a dependency-free Chrome DevTools Protocol (CDP) runner. This avoids relying on Chromium's shutdown behavior in minimal headless environments and exposes the actual test page status while it is running.
- Bound the debugging endpoint to `127.0.0.1`, use an isolated temporary profile, add bounded command/startup timeouts, and clean up temporary browser resources.
- Added explicit detection for organization-managed URL blocking so a blocked page is reported as an environment limitation, not misreported as a passed IndexedDB integration test.
- **No production Quest path was switched to IndexedDB in this release.** The live-cutover gate remains closed because this environment's managed Chromium policy blocks local HTTP and file URLs before the integration page can run. The old localStorage-based UI remains the authoritative source; migration continues to be explicit and non-destructive.
- Kept all existing progression logic, save keys, Android WebView assets, and 11 themes intact.

## 2.0.0 — Atomic Quest Side Effects

- Added IndexedDB schema v4 with `app_state` progress counters, `daily_prizes` claims and an `activity_history.eventId` lookup index.
- Extended the TypeScript Quest completion transaction so Player XP/Level/Coins, Quest state, XP ledger, Skills, Achievements, optional Stat XP, activity history, progress counters and a daily prize claim commit together.
- Added a shared TypeScript XP-track transition used for Player and Stat progression inside the domain/persistence layer.
- Daily prize XP/Coins are included in the same Player transition while the prize is recorded as a separate auditable XP event and unique daily claim.
- Legacy migration now imports progress counters into the dedicated app-state record atomically; localStorage remains untouched and migration remains opt-in.
- Added contract checks for schema, atomic side-effect stores, canonical daily prize identity, counter guards and failure-safe writes. The transaction now checks the prize XP-ledger identity for every prize type, including Coins-only and item rewards, so stale ledger collisions fail closed.
- The browser IndexedDB integration test was extended for full side-effect and daily-prize replay coverage; real-browser completion must be reported separately from static/unit-test results.

## 1.9.0 — Unified TypeScript Quest Reward Commands

- Added a pure TypeScript command contract for Daily, AI Daily, Custom, Boss, Goal and Goal-evidence rewards. It validates XP/Coins, Stat/Skill pairing, source identities, local-day stamps and numeric caps before any progression mutation.
- Made TypeScript construct the canonical reward event key and domain Quest ID. The live local idempotency adapter delegates identity generation to the TypeScript contract; its standalone fallback remains only for isolated legacy/test contexts.
- Routed the live `applyProgressionReward()` pipeline through the prepared TypeScript command before Player/Stat/Skill/history writes, preserving the existing transaction/rollback boundary and UI handlers.
- Added coverage for every reward type, daily rollover, shared Goal payout identity, malformed input, numeric clamping and runtime identity delegation.
- Deliberately did not switch the legacy UI to IndexedDB as the source of truth: transaction/browser cutover still requires a successful real-browser test and coordinated migration of Stats, Skills, counters, activity history and daily prize side effects. All 11 themes and prior save keys remain intact.

## 1.8.0 — Safe Legacy Data Migration Bridge

- Added an explicit migration planner for the existing `system_v2_*` localStorage save: Player XP/Level/Coins/Rank, six Stats, saved Skill progress, Daily/AI Daily/Custom/Boss/Goal records, recent activity history, and lifetime progression counters.
- Added schema version 3 stores for migrated Stats, activity history, and migration receipts. Existing IndexedDB rows are retained during the schema upgrade.
- Added read-only migration preview plus one-shot IndexedDB import in a single `readwrite` transaction. The import refuses to overwrite a non-empty destination and uses a source fingerprint to make repeat imports idempotent.
- Completed Quest IDs are namespaced by category/date; imported XP events mirror completed Quest records so the existing consistency guard can recognize old completions without paying them again. Actual historical XP from the available activity log is preserved where available.
- The legacy localStorage keys are not changed or removed. The migration API is opt-in and is not automatically executed at app startup. Live quest-button cutover remains staged until browser-level migration/transaction verification is available.
- Added tests for data mapping, namespacing, replay consistency, preservation, malformed input and migration boundary contracts. All 11 themes remain unchanged.

## 1.7.0 — Atomic IndexedDB Quest Transactions

- Upgraded the opt-in IndexedDB schema to version 2 and repairs missing XP ledger indexes without clearing existing records.
- Hardened the atomic Quest write path: validates all completion signals across the Player, Quest, player-embedded XP events, and durable XP ledger; inconsistent records fail closed.
- Changed the XP ledger write from overwrite (`put`) to append-only `add`, so a duplicate event ID cannot silently replace an earlier audit record.
- Ensured the transaction promise resolves only after `complete` and rejects after confirmed `abort`; added safe handling for blocked/late-opened connections and closes connections on `versionchange`.
- Removed the low-level unchecked `commitQuestCompletion` writer so the guarded domain transition is the only exported Quest-completion mutation path in this adapter.
- Added a real Chromium + native IndexedDB integration test for schema upgrade, simultaneous duplicate completion, atomic Player/Quest/Skill/Achievement/ledger writes, retry idempotency, invalid-rule rollback, and fail-closed inconsistent state.
- Kept migration opt-in: this release does not silently import or replace existing localStorage saves or switch legacy UI completion handlers to the separate database.

## 1.6.0 — Durable Reward Idempotency Guard

- Added a dedicated, dependency-free runtime module to create stable reward identities for Daily, AI Daily, Custom, Boss, and Goal completion flows.
- Added a persistent localStorage idempotency ledger with validation, duplicate detection, an explicit capacity ceiling, and fail-closed behavior for corrupted/full ledgers. One-time Quest/Goal IDs are retained; repeatable Daily IDs are kept for a 180-day replay window to bound storage use.
- Connected the central reward pipeline to check the ledger before XP/Coins/Stat/Skill/history side effects and to commit the event ID only after all progression/history writes succeed. The existing transaction snapshot can roll this key back if a later write fails.
- Added event IDs to the bounded activity history for auditability and included the ledger in backup validation/restore checks.
- Added the missing Boss Quest identity to its reward call, so a replay cannot mint the same Boss reward again.
- Kept legacy localStorage save shapes, all 11 themes, and the existing rollback boundary. This remains a synchronous local transaction: it is not crash-atomic across browser storage keys and does not claim a server-grade cross-device ledger.
- Added runtime tests for stable identity, Daily reset-by-date, duplicate rejection, malformed/full ledger fail-closed behavior, event history IDs, and reward-pipeline integration.

## 1.5.0 — TypeScript Runtime XP Engine

- Made `src/core/progression-math-runtime.ts` the source of truth for the live XP thresholds, rank thresholds, and Player/Stat XP transition calculation.
- Added a build-generated browser runtime at `js/generated/progression-math.js`; the legacy controller loads it before a small compatibility guard.
- Routed live quest rewards through TypeScript `completeQuest()` for Player XP, Level, Rank, and Coins; the six existing Quest interfaces continue to use the established transaction/rollback boundary.
- Routed non-quest XP rewards and Stat level-ups through the compiled TypeScript `advanceXPTrack()` transition.
- Kept Stat/Skill progression, activity history, and the legacy localStorage transaction adapter in place while their data stores are migrated separately.
- Preserved the established XP curves, six-rank progression, level cap, numeric cap, XP overflow, and saved-data format.
- Added a real-domain bridge test plus regression coverage for compiled runtime output, Player/Stat progression, overflow, immutability, rewards, and rejected inputs.
- The TS `completeQuest()` domain transition is now on the live Player reward path, but its XP event/idempotency ledger is not yet the durable source of truth; current duplicate checks remain in the existing Quest UI/state and transaction guard. The IndexedDB storage cutover remains staged.

## 1.4.0 — AI Quest Parser Extraction

- Extracted bilingual AI quest text normalization, list parsing, and Stat inference from the legacy controller into `js/features/ai-quest-parser.js`.
- Exposed only the frozen `window.SYSTEMAIQuestParser` API and kept the parser independent from UI, storage, and progression state.
- Added deterministic parser regression tests covering Persian/Arabic digits, numbered and bulleted missions, continuation lines, duplicates, markdown, empty input, length bounds, and six-Stat classification.
- No quest rewards, completion rules, storage schema, or theme behavior changed in this release.

## 1.3.0 — TypeScript Seed Contracts

- Added TypeScript runtime validators for quest, stat/skill, reward, and default-player JSON seed catalogs.
- Added tests that validate the actual bundled seed files and reject malformed fixtures, including duplicate IDs, invalid XP, and invalid levels.
- Preserved the existing JSON shapes and legacy runtime behavior; wiring seed data into runtime remains a separate migration step.

## 1.2.0 — Transactional TypeScript Progression

- Hardened the progression domain with strict checks for player state, rewards, timestamps, level thresholds, rank values, skill identifiers, and duplicate XP ledger entries.
- Added a guarded IndexedDB read-modify-write flow: player and quest are checked inside one readwrite transaction, then player state, quest completion, XP ledger, and new achievements are committed together.
- Added explicit duplicate-completion handling and tests for multiple level-ups, immutable input, malformed rules/data, and persistence transaction contracts.
- Preserved the legacy localStorage runtime and its save/backup schema. The new IndexedDB path is opt-in and is not silently wired into old quest buttons; data migration and user-interface cutover remain separate, test-gated steps.
- Added `tests/typescript/storage-contract.test.mjs` and expanded TypeScript regression coverage.

## 1.1.0 — TypeScript Progression Foundation

- Added a strict TypeScript domain transition for quest completion, XP, coins, skill XP, level-ups, rank and achievement checks.
- Added an IndexedDB schema and atomic transaction adapter for player, quests, XP events, achievements, seasons and skills.
- Added a focused TypeScript regression test. The new core is deliberately introduced alongside the legacy runtime; migration is staged to protect existing behavior and user data.

## 1.0.0 — Clean Foundation and Architecture Reset

- Established `VERSION` as the single source of the product version; synchronized web, PWA, npm, Android display version, and release metadata to `1.0.0`.
- Renamed version-stamped source fragments to feature-oriented names and grouped JavaScript/CSS by responsibility.
- Moved old release reports into `docs/history/releases/`; kept archive material separate from active developer documentation.
- Removed the duplicate `js/VERSION` marker and two redundant historical placeholder documents.
- Regenerated the CSS bundle, Service Worker precache, and Android web assets from their canonical sources.
- Preserved existing application IDs, local storage keys, theme IDs, progression logic, and backup formats to avoid damaging existing user data.
- Revalidated the static regression suite and project health checks after the structure changes.

## 9.7.0 — Atelier Signature / Advanced Visual Refinement

- Added a second, additive visual refinement layer for all existing themes without changing theme identifiers, selection behavior, page content, or progression logic.
- Refined panel material, top-edge glints, typography hierarchy, progress-track depth, theme-picker presentation, and palette-aware hover states.
- Added explicit theme-aware keyboard focus states and disabled-control affordance.
- Limited stronger lift motion to desktop hover-capable devices; reduced motion and touch-screen behavior remain restrained.
- Added the new CSS fragment to the deterministic CSS build pipeline.

## 9.6.0 — Theme Atelier / Visual Ascension

- Added a final additive visual-material layer for all eleven existing themes, preserving their IDs and selection behavior.
- Rebalanced atmospheric page lighting, glass surfaces, navigation states, focus rings, progress bars, buttons, and the theme chooser for stronger hierarchy.
- Removed the full-viewport hue-blend overlay that indiscriminately recolored artwork and foreground text; replaced it with controlled theme-specific accents.
- Preserved supplied page background artwork and added responsive and reduced-motion refinements.
- Added regression tests for theme registry coverage, CSS build order, palette isolation, and page-art preservation.

## 9.5.0 — Deep Adaptive Intelligence

- Extended local activity analysis with branch-specific history, spaced-review opportunities, observed learning-mode diversity, optional duration metadata, and explicit score/pass-fail outcomes.
- Added transparent mission scaffolding: learning technique, observable success check, reflection prompt, planned follow-up date, and reasoned difficulty moderation when branch history is sparse.
- Improved Persian and Arabic-Indic digit normalization for time limits and focus notes.
- Expanded the AI progress panel to seven indicators and clarified that data sufficiency is heuristic, learning modes may be inferred, and XP is not evidence of mastery.
- Kept analysis local-first and read-only with respect to progression; added optional learning evidence to the ledger without granting XP, coins, rank, or quest completion.
- Improved duplicate activity reconciliation so richer assessment metadata can be merged from snapshots without double-counting the activity.
- Strengthened automated regression coverage for the deeper intelligence features.
- Added an optional evidence recorder for completed AI missions; learners can record the method used, self-reported success/needs-review, numeric score, and minutes without changing progression rewards.
- Preserved planner metadata and full success-check descriptions through mission approval and local storage.

## 9.4.0 — Intelligence Upgrade

- Added local progress signals, adaptive mission selection, and evidence-aware analysis summaries.

## 1.1.0 — TypeScript progression foundation
- Added a strict TypeScript domain transition for quest completion, XP, coins, skill XP, level-ups, rank and achievement checks.
- Added an IndexedDB schema and atomic transaction adapter for player, quests, XP events, achievements, seasons and skills.
- Added a focused TypeScript regression test. The new core is deliberately introduced alongside the legacy runtime; migration is staged to protect existing behavior and user data.

## 1.1.0 — TypeScript progression foundation
- Added a strict TypeScript domain transition for quest completion, XP, coins, skill XP, level-ups, rank and achievement checks.
- Added an IndexedDB schema and atomic transaction adapter for player, quests, XP events, achievements, seasons and skills.
- Added a focused TypeScript regression test. The new core is deliberately introduced alongside the legacy runtime; migration is staged to protect existing behavior and user data.

## Phase 3 — Curriculum Command Boundary (2026-10-19)

- Added `src/features/curriculum-command.ts` with immutable commands to add a validated milestone, append evidence from a completed goal-linked quest, and inspect goal-completion eligibility.
- Every command validates the proposed curriculum before returning a snapshot; callers can persist the snapshot inside their existing transaction or discard it on failure.
- Added safeguards against editing completed goals, duplicate milestone IDs, unknown/cyclic prerequisites, duplicate quest evidence, and evidence from a different goal.
- Kept progression rewards outside the curriculum command boundary (`rewardIssued: false`); completion eligibility is read-only and cannot grant XP or Coins.
- Added 15 TypeScript command-level assertions and included them in `npm run test:ts`.
- Validation: `npm test` passed, including build, TypeScript tests, static regression/security checks, release-readiness checks, and architecture guard. Browser/device E2E was not run in this phase.

## 1.0.0 — Deep Logic Phase 4: Fail-Closed Quest Evidence

- Hardened the live Custom Quest completion transaction: a Goal-linked Quest now aborts and rolls back if the Goal evidence adapter is missing, rather than awarding XP/Coins while silently dropping its evidence.
- Tightened typed Goal-evidence planning so an unmatched evidence result aborts the parent transaction. Only explicit stale links are detached, and explicit duplicate/already-complete responses remain idempotent no-ops.
- Added regression assertions for unmatched evidence and the live transaction's fail-closed integration path.
- Validation: full `npm test` passed, including TypeScript, static regression/security, Android release-readiness (42 checks), and architecture guard. Browser E2E and physical Android install/update tests were not run.

## 1.0.0 — Deep Logic Phase 5: Atomic Curriculum Persistence

- Upgraded the optional IndexedDB schema to v7 with a typed `goal_curricula` store and an append-only `goal_evidence` ledger with a unique `(goalId, milestoneId, questId)` index.
- Added validated create/read/link operations for typed Goals and linked Quests; completed Quests cannot be newly linked and Stat mismatch is rejected.
- Extended `completeQuestInDatabase()` so Quest completion, Player/Skill progression, XP ledger, activity, Goal curriculum snapshot, and evidence record commit or abort in one native IndexedDB transaction.
- Evidence can only be recorded from a completed, correctly linked Quest. A retry requires the original durable evidence record and cannot append a second item or issue a separate Goal-completion reward.
- Added real-browser integration scenarios for successful evidence persistence, verified skill eligibility, duplicate replay, link mismatch, and rollback after invalid progression rules.
- Kept the legacy localStorage UI as the current source of truth; this new typed transaction API is exposed as an opt-in bridge and does not auto-migrate or dual-write user saves.

## Phase 11 — Durable Storage Gate

- Added browser storage capability diagnostics and quota estimation.
- Added explicit, best-effort persistent-storage request and status APIs.
- Exposed the APIs through `window.SYSTEMDurableStorage` without changing the legacy storage authority.
- Added a contract test and phase documentation.
- Safety boundary: no automatic migration, no legacy save deletion, and no claim that persistent storage is a backup.


## Phase 12 — Explicit Durable Progression Bridge

- Added `window.SYSTEMDurableProgressionBridge.inspect()` to report browser storage capability and IndexedDB health without changing player data.
- Added an explicit-confirmation wrapper for transactional TypeScript Quest completion; callers must pass `{ confirmed: true }`, a valid Quest ID, and progression rules.
- Preserved `localStorage` as the live UI's source of truth. The bridge performs no automatic migration, no dual writes, and no cutover.
- Added a static contract test to ensure these safety boundaries remain enforced.
- Validation in this phase is contract-level only; browser WebView, full test suite, and physical-device tests must be run separately before release.

## [1.0.0] — Phase 28 — Live Storage & Progression Audit
- Added a source-contract audit for live localStorage ownership, opt-in IndexedDB, TypeScript progression ownership, idempotency, and rollback guardrails.
- Documented active storage paths and remaining cutover risks in Persian.
- Kept legacy storage authoritative; no data migration, dual-write, or runtime behavior change was introduced.

## [1.0.0] — Phase 32 Browser Integration Readiness
- Added a source-contract test for the real-browser IndexedDB integration path and explicit blocked-navigation reporting.
- Documented the observed Chromium managed-policy restriction (`ERR_BLOCKED_BY_ADMINISTRATOR`); no browser result was misreported as a pass.
- Kept storage migration disabled pending successful browser, full-suite, and Android device validation.

## Phase 38 — Unified Progression Feedback Orchestration

- Fixed the audio feedback event target: progression CustomEvents are dispatched on `window`, so the experience layer now listens on `window` rather than `document`.
- Added the missing sound mapping for skill level-up events.
- Added a short success-notification arbitration window so a canonical committed domain event cancels its generic notification sound. Multiple same-turn events (e.g. Boss cleared + Quest completed + Level up) are collapsed into one highest-priority sound/haptic. Errors and ordinary notices remain immediate.
- Added a dedicated contract test and integrated it into the static test suite.
- Progression rules, reward amounts, transaction boundaries, storage, and the visual milestone queue remain unchanged.

## [1.0.0] — Phase 35 — Unified Design System Foundation
- Added semantic design tokens for theme-aware surfaces, content, accents, state colors, spacing, radii, typography, motion, and focus treatment.
- Integrated the token layer into the generated CSS pipeline without removing or replacing legacy tokens.
- Changed CSS bundling to fail with an actionable error if a source introduces `!important`, instead of silently stripping it.
- Added design-system contract checks to the static test suite and a standalone `test:design-system` command.
- Validation: CSS build and targeted visual/theme/layout/smoke tests passed. Full-suite, browser visual regression, and physical Android tests remain separate release gates.

## Phase 36 — Advanced Theme Engine
- Added a decoupled `system:themechange` document event with current and previous theme metadata, without changing progression or storage semantics.
- Exposed the active theme name on the root element and improved accessible names for theme choices.
- Refined theme picker swatches so each preview carries its own explicit palette, with a clearer active-theme state and responsive/reduced-motion rules.
- Added an automated contract test for all 11 theme identities and the theme-engine integration points.
- Validation scope: static contract checks and project test suite; browser screenshot comparison and physical Android device testing remain separate release checks.

## Phase 37 — Audio & Motion Feedback Integration
- Hardened the synthesized Web Audio lifecycle with gesture-based context unlocking, safe resume handling, smoothly updated master volume, and quieting while the document is hidden.
- Added a short per-sound cooldown to reduce duplicate feedback and prevented synthetic/untrusted clicks from triggering sound effects.
- Connected audio/haptic feedback to the existing quest, level, rank, achievement, reward, boss, and skill-evolution domain events without placing sound calls inside progression logic.
- Improved Sound & Alerts controls with immediate volume updates, a reliable forced test sequence, and Persian labels for core controls.
- Added a dedicated static contract test to the test suite.
- Validation scope: contract tests and full project test suite are run for this archive; physical device audio latency and native haptic behavior still require real Android validation.

## Phase 40 — Live Path & Storage Boundary Audit
- Added a static audit test that protects the explicit migration boundary between legacy `localStorage` and the opt-in IndexedDB progression APIs.
- Verified that migration preview, approval, and execution remain separate; no automatic cutover or data deletion was introduced.
- Added a Persian audit note documenting confirmed source-level facts and outstanding browser, APK, and device release gates.
- `package-lock.json` remains outstanding: offline generation could not resolve registry metadata, so no fabricated lockfile was added.
- Validation scope is static source-contract coverage only; this phase does not claim real-browser IndexedDB, APK, or physical-device success.

## Phase 41 — Atomic Progression Hardening
- Added a source-contract audit for the IndexedDB progression transaction boundary, readwrite mode, abort/commit settlement, duplicate replay detection, immutable awarded-XP consistency, activity idempotency, and daily-prize ledger identity.
- Guarded the staged migration boundary: the legacy live save remains available and automatic migration/dual-write remain disabled until browser and release gates are approved.
- Integrated the new audit into `test:static`.
- No live storage behavior, reward values, or migration state was changed.
- Validation scope: targeted source-contract audit only; full suite, real-browser IndexedDB, APK build, and physical-device validation remain separate gates.

## Phase 42 — Browser Runtime Integration Gate
- Attempted the real-browser IndexedDB suite using the repository runner and system Chromium; TypeScript build succeeded, but navigation to the local test page was blocked by managed Chromium policy (`URLBlocklist: ["*"]`, `ERR_BLOCKED_BY_ADMINISTRATOR`).
- Added a static gate audit to preserve browser scenarios and ensure policy restrictions are diagnosed rather than bypassed.
- Documented the actual outcome and the required rerun in an authorized browser/CI environment.
- No storage cutover, automatic migration, dual-write, or live progression behavior was changed.
- Validation scope: TypeScript build and source-contract gate only. Real-browser IndexedDB remains blocked/unverified; full suite, APK build, and physical-device validation remain outstanding.

## 1.0.0 — Phase 43 Android Build & APK Validation Gate
- Added a focused contract test covering strict Android environment preflight, the actual Gradle debug build task, non-empty APK artifact verification, CI toolchain pins, and release signature/checksum checks.
- Wired the Phase 43 contract into the static regression suite and documented the environment's actual build blockers.
- Validation result in this environment: JDK 21 is present, but Gradle CLI, Android SDK environment, `adb`, and `sdkmanager` are unavailable. The strict build gate correctly stopped; no APK was produced or claimed.
- Browser runtime validation remains blocked by the managed Chromium URL policy recorded in Phase 42. Storage migration remains opt-in; automatic migration and dual-write remain disabled.
