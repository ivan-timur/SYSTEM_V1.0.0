# SYSTEM v6.0.0 — Skill Command Center + Deep Intelligence Engine

SYSTEM is a local-first personal-development dashboard that turns learning, habits and long-term goals into a lightweight RPG progression loop. The main areas are Status, Quest, Rewards, AI and Settings. Version 5.10 upgrades the six-branch Skill Tree into a searchable command center with per-branch unlock progress, status filters, compact responsive cards, and separate English/Afghan Dari labels for all 120 skills. It preserves the existing save data and carries forward the eligibility-aware Rewards hub, AI workspace, themes, backup tools, and offline build pipeline.

## Run the app

Open `index.html` in a modern browser. If local-file restrictions apply, run a static server from the project root:

```bash
python -m http.server 8000
```

Then visit `http://127.0.0.1:8000`. Most features are browser-local and do not require a backend. Live AI requests need a Groq API key supplied by the user in the tab; do not put an API key in project files or a ZIP shared with others.

## Version and architecture

- `VERSION` is the release source of truth. `npm run build` syncs it into the ES-module version source, legacy runtime, `package.json` and web manifest before generating the service worker; the current release is `5.10.0`.
- `js/app.js` is the ES-module entry point and loads compatibility scripts in a deterministic sequence while features are gradually extracted.
- `js/modules/storage.js` creates a real module boundary around the storage service, and `js/modules/ai-workspace-navigation.js` owns accessible AI-tab navigation. Inert JavaScript and unused route-page placeholder files were removed instead of pretending the code was already modular.
- `js/app-legacy.js` still contains most domain logic; this is an incremental migration, not a complete rewrite of the application.
- `css/system.css` is the single active runtime stylesheet. The Rewards-specific styling in `css/rewards-elite.css` is a page-scoped source fragment compiled into the same bundle. Original stylesheet fragments stay as maintainable source inputs. The build places them in one ordered `system` cascade layer, normalizes asset URLs and removes `!important` declarations from the emitted runtime bundle.
- The service worker precaches every same-origin file under `assets/`, `css/`, `data/` and `js/`, plus the app shell and itself. Unused standalone route placeholder pages were removed because the current app is a single-page dashboard. A missing shell resource causes installation to fail rather than being silently skipped.
- The Secure Proxy UI and client request code are absent because this distribution does not include a matching `backend/` implementation. Only the client-side Groq connection flow is presented.

## Build and tests

Requires Node.js 20 or later for the project scripts.

```bash
npm install
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

`npm run build` synchronizes release metadata and regenerates `css/system.css` and `sw.js`. `npm test` runs the build, then smoke/unit, storage/snapshot, version/precache, CSS and security audits. Playwright cases cover Status/Quest on narrow mobile viewports in RTL mode, Skill Tree search and language switching, Rewards search/status filters, keyboard-accessible tabs, Collect All history, mobile overflow, and CSP boot compatibility.

## Security and privacy notes

- A same-origin Content Security Policy blocks inline scripts and objects, and the previous inline image-error handler was moved into a module event listener. Inline styles remain enabled for legacy progress-fill attributes until those are migrated to CSS classes/custom properties.
- The application uses `innerHTML` for several trusted templates; user-provided text in the app's template renderers is escaped before interpolation. Keep untrusted input out of template strings and add tests for any new render path.
- Client-side API keys are not a secure secret against a person or code controlling the browser. For a public deployment, implement a backend with authentication, access controls, usage limits, TLS and server-side provider credentials before exposing AI features broadly.
- Local progress and chat history remain browser-local. The app has no user accounts, server database or cross-device sync.
- Storage rollback is best-effort and is not a crash-atomic database transaction. Export backups regularly.

## Existing functionality

The repository retains backup validation and restore, storage health checks, cross-tab change warnings, progress/quest transactions, daily login rewards, the Royal Sovereign theme, built-in theme selection, the Grok workspace add-on, study notes, crystal/title rewards, activity summaries, a focus timer, and accessibility-conscious AI workspace tabs. The skill catalogue includes 120 guided skills, a per-branch unlocked-progress meter, search, status filters, and dynamic English/Dari display. Rewards includes an explicit quest gate for the Focus Bonus, a daily Quest Trio, claim-all (including the daily login claim), persistent reward history, category tabs with keyboard navigation, status/search/sort filters, rarity and progress indicators, and a pity-protected Mystery Vault with visible base odds. Live Groq service/quotas and final rendered appearance still require checks in the user's target browser. The static test suite passes in this package; Playwright E2E depends on installing the project development dependencies and a usable browser runtime.
