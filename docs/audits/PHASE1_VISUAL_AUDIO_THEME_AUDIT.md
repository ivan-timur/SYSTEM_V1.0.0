# SYSTEM V1 — Phase 1: Deep Visual, Audio & Theme Audit

**Input baseline:** `SYSTEM_V1.0.0_PHASE33_ANDROID_BUILD_ENVIRONMENT_GATE.zip`  
**Audit phase:** 1 — Visual Design Audit  
**Scope:** source structure, CSS build pipeline, theme registry, visual-effects accessibility contracts, generated audio/haptics implementation, local asset references, and selected automated regression checks.

## 1. Executive result

**Status: AUDIT COMPLETE — IMPLEMENTATION CHANGES DEFERRED TO PHASE 2.**

The project has a substantial visual and experience layer already. This phase intentionally records evidence and risks before changing visual behavior, so later refactoring can preserve the current appearance and progression logic.

### Verified facts

- 68 CSS files exist in the project, including generated `css/system.css`.
- The CSS builder consumes 67 unique source stylesheets; every configured source exists.
- The CSS build completed successfully and generated a bundle with zero `!important` declarations.
- The 11 existing theme IDs are present in the theme registry: `aether`, `couture`, `royal`, `cosmic`, `aurora`, `abyss`, `ice`, `crimson`, `emerald`, `solar`, and `sakura`.
- The visual-effects implementation includes a reduced-motion stylesheet.
- The sound engine synthesizes ten named sound events through Web Audio; it does not currently require separate audio files for these events.
- Haptic patterns use `navigator.vibrate()` and therefore depend on browser/WebView/device support.
- A scan of local CSS `url(...)` references found no missing referenced files.
- Seven focused automated checks passed (details below).

## 2. Findings by priority

### P0 — CSS build silently removes `!important`

**Evidence:** `scripts/build-css.js` applies `css.replace(/\s*!important\b/gi, '')` to every source stylesheet before bundling.

**Risk:** the build does not merely check for `!important`; it deletes declarations. If a source declaration relies on it, the runtime cascade can differ from the source stylesheet, potentially changing mobile layout, focus behavior, accessibility overrides, or theme-specific corrections without a build failure.

**Recommendation:** Phase 2 should remove the destructive rewrite. First run a source audit to understand any existing declarations; if the project policy is to avoid `!important`, make the build fail with a clear error instead of silently rewriting CSS. Add a test proving the builder preserves declarations or explicitly rejects them.

**Severity:** High (pipeline correctness); current source scan found zero `!important` declarations, so no present source declaration was observed to be removed in this baseline.

### P1 — High selector overlap / cascade complexity

**Evidence:** source scan found 283 selectors represented in more than three CSS files. Examples include `:root` (20 files), `.reward-card` (19), `.quest-card` (18), and `#system-app` (13). The generated bundle is assembled from 67 stylesheets in a deliberate sequence.

**Risk:** repeated selectors are not automatically defects, but the combination of repeated base selectors, page styles, theme skins, and late refinement sheets makes the final computed style dependent on order and specificity. This increases regression risk and makes a single visual change hard to reason about.

**Recommendation:** create one canonical component rule per shared component, move values to design tokens, and keep theme files focused on theme tokens/explicit variants rather than redefining broad component geometry. Preserve a documented, tested build order until consolidation is complete.

**Severity:** High maintainability risk; runtime visual defects require browser-level confirmation.

### P1 — Theme identity is centralized, but complete coverage is not yet proven

**Evidence:** `SYSTEM_THEMES` in `js/legacy/app-controller.js` defines 11 themes and `applySystemTheme()` writes `data-system-theme` on the document element. CSS theme sources are bundled through `scripts/build-css.js`.

**Risk:** a valid theme ID and successful attribute update do not prove every component, image, state, modal, hover, focus state, and mobile layout uses compatible tokens. Global image tinting/blend rules can also alter content that should retain its semantic colors.

**Recommendation:** Phase 3 should build a theme coverage matrix across all five primary pages, shared modals, controls, focus/disabled/hover states, and narrow viewports. Replace broad global tinting with semantic tokens or targeted image treatment where visual inspection shows a problem.

**Severity:** High visual consistency risk; no claim is made that every theme currently fails.

### P1 — Audio engine has correctness and accessibility hardening opportunities

**Evidence:** `js/features/experience.js` creates an `AudioContext`, resumes it when suspended, sets a master gain, synthesizes ten named sounds, and calls `navigator.vibrate()` for configured events.

**Risks to validate/fix:**

1. `ctx.resume()` is not awaited and rejected resumes are not explicitly handled.
2. The engine has no central queue/priority policy, so multiple milestone sounds can overlap when several events happen close together.
3. The `input` handler updates the stored volume, but `master.gain` is applied when `audio()` runs; a live volume change may not update an already-created context until the next playback call.
4. `prefs` is exposed as a mutable object (`window.SYSTEMSound = { play, prefs }`), allowing external code to bypass validation and persistence.
5. Haptic behavior depends on platform support and user/device settings; static presence is not proof of native Android behavior.

**Recommendation:** Phase 4 should encapsulate preferences, apply gain changes immediately, await/resiliently handle context resume, add sound priority/throttling, and test user gesture, background/foreground, mute, and volume behavior in Android WebView.

**Severity:** Medium-high; runtime conditions must be reproduced before calling these confirmed user-visible bugs.

### P1 — Reminder lifecycle wording needs a clear platform contract

**Evidence:** the web reminder uses `setInterval`/`setTimeout`; the source comment says reminders run while SYSTEM is open or installed. A separate Android-native reminder path is conditionally exposed when the native bridge is present.

**Risk:** browser timers are not a reliable background scheduling mechanism when the app is closed or suspended. The native Android path is the appropriate mechanism for reminders that must survive closure; web notifications also depend on permission and browser support.

**Recommendation:** distinguish clearly between in-app reminders and scheduled native Android notifications in Settings and documentation. Test permission denial, scheduling, cancellation, time changes, and reboot behavior on Android.

**Severity:** Medium-high for user expectation and reliability.

### P1 — Asset format differs from the established project preference

**Evidence:** current page backgrounds and main icons are WebP; rank assets include SVG and WebP. The established project requirement is to use PNG for graphics, including page backgrounds.

**Risk:** this is a specification mismatch, not necessarily a technical defect. WebP can be smaller and efficient, but if PNG is a firm project requirement, the asset pipeline and references are not aligned with that requirement.

**Recommendation:** before converting assets, confirm whether PNG is still a hard requirement. If yes, convert from original/high-quality sources, update references and Android packaging, and compare visual quality/transparency. Do not blindly convert already-compressed WebP back to PNG because that cannot recover lost detail and may increase file size.

**Severity:** Medium (requirements compliance).

### P2 — Theme and sound preferences need stricter schema validation

**Evidence:** experience preferences are read from localStorage and merged with defaults; volume and reminder hour are clamped, but the full preference object is not validated as a schema. Theme persistence is separate.

**Risk:** malformed or old values may cause inconsistent behavior, and separate storage keys can complicate migrations and backup/restore expectations.

**Recommendation:** define validated preference schemas, version them, apply safe defaults, and test corrupted/old storage. Keep theme and experience settings independently owned unless a documented settings contract requires a unified settings store.

**Severity:** Medium.

### P2 — Reduced-motion support exists, but coverage needs verification

**Evidence:** `css/refinements/reduced-motion-override.css` disables transitions and animations for a defined set of cards, buttons, navigation, and theme controls.

**Risk:** the selector list may not include every animated element, including generated effects, pseudo-elements, progress animations, or page-level transitions.

**Recommendation:** expand the reduced-motion audit to all animated selectors and JavaScript-driven effects. Ensure the setting reduces nonessential motion without hiding essential state changes.

**Severity:** Medium; coverage needs browser testing.

### P2 — Language consistency in experience settings

**Evidence:** `index.html` starts with `lang="en"`; some labels and explanatory strings in the experience settings are hard-coded in English, while selected reminder messages have Persian alternatives.

**Risk:** when the application is switched to Persian, some audio/notification settings may remain English unless separately localized.

**Recommendation:** route all labels, descriptions, permission states, and accessibility text through the app's localization mechanism. Verify correct `lang` and `dir` values in both languages.

**Severity:** Medium for bilingual polish.

## 3. CSS architecture observations

- `scripts/build-css.js` has an explicit source list. This is reproducible and makes source ordering visible, but it is a manual list that can drift when new CSS files are added.
- The build wraps the output in `@layer system`. This is a useful containment mechanism only if all relevant styles are intentionally placed into compatible layers; future unlayered styles can outrank layered author rules and surprise maintainers.
- The current CSS source set is clean of `!important`, but the build's stripping behavior should still be corrected because it is destructive by design.
- No missing local CSS `url(...)` references were found by the static scan. This does not cover JavaScript-generated URLs, HTML image paths, network failures, or Android packaging.
- A static selector-count scan is a risk indicator, not a CSS parser or proof of conflicting declarations. The next phase should use computed-style/browser checks on representative viewports.

## 4. Audio and haptics inventory

Defined sound events: `click`, `nav`, `open`, `notify`, `quest`, `reward`, `streak`, `levelup`, `rank`, and `error`.

Defined haptic patterns exist for interaction and milestone events. The current implementation is synthesized Web Audio rather than a bank of external audio files.

Recommended runtime scenarios:

1. First sound after page load and after a user gesture.
2. Rapid navigation and repeated button taps.
3. Several quests completed in quick succession.
4. Level-up and rank-up occurring near another notification.
5. Volume changed while the audio context is already active.
6. Sound disabled, haptics independently enabled, and vice versa.
7. App backgrounded/restored, device muted, WebView recreated, and audio context suspended.
8. Unsupported or denied vibration and notification permissions.

## 5. Theme coverage matrix required for the next phase

For each of the 11 themes, validate:

- Status: level, XP, rank, stats, progress indicators.
- Quest: active/completed/disabled quest cards and action controls.
- Rewards: category filters, reward cards, costs, claim states, selected reward.
- AI: composer, responses, tool controls, empty/loading/error states.
- Settings: inputs, toggles, theme picker, dialogs, sound controls.
- Shared UI: sidebar, top bar, toast, modal, dropdown, focus ring, disabled state.
- Viewports: narrow Android phone, larger phone, tablet/desktop.
- States: default, hover (where applicable), active, focus-visible, disabled, error, success.
- Readability: text/background contrast and visible focus indicators.

A theme should not be marked fully validated until browser-rendered evidence is collected for representative pages and viewport sizes.

## 6. Automated checks executed

The following focused tests passed on this baseline:

- `tests/theme-atelier-test.js`
- `tests/theme-atelier-signature-test.js`
- `tests/obsidian-couture-test.js` — 31 checks
- `tests/visual-effects-contract-test.js`
- `tests/phase24-visual-performance-test.js`
- `tests/ui-layout-test.js` — 29 checks
- `tests/status-refinement-test.js` — 7 checks
- `node scripts/build-css.js` — 67 source stylesheets, zero runtime `!important` declarations

These are focused automated/static contract checks. They are **not** a full application test suite, screenshot comparison, accessibility audit, or real-device Android/WebView validation. Dependencies were not installed in this environment, so the full npm test and Playwright browser suite were not run.

## 7. Phase 1 exit criteria

- [x] Map the current visual, theme, sound, and haptics implementation.
- [x] Verify configured CSS sources exist and build the CSS bundle.
- [x] Scan local CSS asset references.
- [x] Run focused theme, layout, and visual-effects contract tests.
- [x] Record prioritized risks and a Phase 2 direction.
- [ ] Capture browser screenshots across themes and viewports.
- [ ] Test sound, haptics, and reminders on physical Android/WebView.
- [ ] Run the complete npm and Playwright suites in an environment with dependencies installed.

## 8. Recommended next action

Proceed to **Phase 2 — Unified Design System**, beginning with the CSS build's destructive `!important` removal behavior, then establish canonical design tokens and shared component ownership. Do not rewrite the audio engine or mass-convert assets in Phase 2; those belong to their dedicated phases after baseline behavior is preserved.
