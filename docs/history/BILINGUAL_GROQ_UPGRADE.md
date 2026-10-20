# SYSTEM v3.9 — bilingual + Groq integration notes

- The v3.9 folder structure, visuals, existing data, and app controller are retained.
- The source project already contains Groq UI/API logic in `index.html` and `js/app.js`; this upgrade keeps that integration intact.
- Added `js/i18n.js` and `css/bilingual.css` for an English/Persian language toggle. The selected language is saved in localStorage.
- The toggle is available at the top of the screen. English remains the default; choose «فارسی · FA» to switch.
- This is a browser-only app: a Groq API key entered in the app is not a secure server-side secret. Do not publish a ZIP containing a real key; for public deployment, use a server-side proxy and environment variable.
- Translation coverage includes common navigation, AI/Groq labels, settings and core stats. Any unlisted dynamic text may remain in English until its translation is added.
