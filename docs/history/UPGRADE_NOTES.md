# SYSTEM v5.8.0 — engineering hardening notes

## Changes in this release
- `VERSION` is canonical; the build synchronizes the app/module/package/manifest versions and generates the service-worker cache for `5.8.0`.
- `js/app.js` is an ES-module bootstrapping entry point; remaining compatibility scripts load sequentially while feature extraction proceeds.
- Storage has an ES-module boundary in `js/modules/storage.js`; AI workspace navigation is implemented in `js/modules/ai-workspace-navigation.js`.
- Inert placeholder JS files and 14 unused standalone route placeholder pages have been removed.
- The runtime uses one built stylesheet (`css/system.css`) inside one ordered `system` cascade layer and no `!important` declarations in the emitted bundle.
- `scripts/build-css.js` and `scripts/build-sw.js` regenerate the stylesheet and complete offline precache list (excluding deleted route placeholders).
- Secure Proxy UI and client code have been removed in this distribution because there is no matching `backend/` folder. The existing direct Groq client remains tab-local; its API key is not persisted by the UI.
- Playwright test source covers Status/Quest on narrow viewports with RTL, overflow and CSP startup checks.

## Important limits
- This is a gradual modular migration. `js/app-legacy.js` still owns most application/domain behavior; it was kept intact to avoid an unsafe wholesale rewrite of progression logic and saved-data contracts.
- The source stylesheet fragments now also have no `!important` declarations. The build concatenates them in their established order inside one `system` cascade layer and rechecks the emitted bundle. Visual confirmation remains important when modifying this cascade.
- Playwright browser tests require `npm install` and `npx playwright install chromium`. This environment's dependency installation timed out, so the browser tests have been added but were not executed here.
- Direct-browser AI requests are for personal use only; do not expose personal API keys in shared source archives.
