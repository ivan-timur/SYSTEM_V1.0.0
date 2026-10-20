# Phase 11 — Durable Storage Gate

## Scope

Phase 11 adds a conservative browser-storage capability gate. It does not switch the existing interface away from `localStorage`, does not auto-import legacy data, and does not clear or overwrite user saves.

## Runtime API

The app exposes `window.SYSTEMDurableStorage`:

- `inspect()` — reports whether IndexedDB, localStorage, storage estimation, and persistence APIs are available.
- `estimate()` — reads browser-reported storage usage and quota when supported.
- `persistenceStatus()` — checks whether the browser currently treats site storage as persistent.
- `requestPersistence()` — explicitly requests persistent storage. This is best-effort and may be denied by the browser.

## Safety boundaries

- A positive persistence response is not a backup and does not guarantee that storage can never be lost.
- All IndexedDB writes must still handle transaction aborts, quota errors, blocked upgrades, and version changes.
- Legacy migration remains a separate preview-and-confirm operation. This phase does not trigger it.
- The UI's existing storage authority remains unchanged until a later cutover phase has end-to-end browser tests and an explicit recovery path.

## Validation

Run `node tests/phase11-durable-storage-gate-test.mjs` for the static contract check. Run the full project test pipeline in an environment with the project's declared Node.js and development dependencies installed. Browser/WebView persistence behavior must be verified on actual target browsers before release.
