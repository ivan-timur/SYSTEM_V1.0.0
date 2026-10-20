# Phase 12 — Explicit Durable Progression Bridge

## Purpose
Provide a named, opt-in bridge from the app runtime to the existing transactional TypeScript/IndexedDB progression API, without silently changing which store owns the live UI state.

## Runtime API

- `window.SYSTEMDurableProgressionBridge.inspect()` returns a diagnostic snapshot: phase, opt-in mode, storage capabilities, IndexedDB inspection result, and explicit statements that migration and dual-write are disabled.
- `window.SYSTEMDurableProgressionBridge.completeQuest(questId, rules, now, effects, { confirmed: true })` forwards a confirmed command to `completeQuestInDatabase`. Omitting confirmation rejects before any durable write.

## Safety invariants

1. `localStorage` remains authoritative for the existing UI.
2. App startup never triggers migration.
3. The bridge does not dual-write to both stores.
4. Quest completion remains governed by the existing TypeScript transactional implementation and its idempotency/rollback rules.
5. The inspection path is diagnostic and does not grant XP or alter progress.

## Not yet claimed

This phase does not complete production cutover, automatic sync, APK construction, or physical Android WebView validation. Before cutover, implement and test a user-reviewed migration, stable backup/restore, browser-level transaction tests, and an explicit rollback plan.
