"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.match(app, /window\.SYSTEMDurableProgressionBridge = Object\.freeze\(\{/,
  "Phase 12 must expose a named durable progression bridge");
const bridge = app.slice(app.indexOf("window.SYSTEMDurableProgressionBridge ="), app.indexOf("window.SYSTEMTypeScriptQuestState ="));
assert.match(bridge, /legacyStorageRemainsAuthoritative: true/,
  "the legacy store must remain authoritative before approved cutover");
assert.match(bridge, /automaticMigration: false/,
  "the bridge must not migrate data during startup");
assert.match(bridge, /dualWrite: false/,
  "the bridge must not dual-write and create divergent state");
assert.match(bridge, /options\?\.confirmed !== true/,
  "durable writes must require explicit confirmation");
assert.match(bridge, /completeDurableQuestInDatabase\(questId, rules, now, effects\)/,
  "confirmed writes must reach the transactional TypeScript persistence layer");
assert.match(bridge, /inspectSystemDatabase\(\)/,
  "bridge diagnostics must inspect database health without writing progress");
assert.match(pkg.scripts["test:static"], /phase12-durable-progression-bridge-contract-test\.js/,
  "Phase 12 contract test must be part of static regression checks");
console.log("Phase 12 durable progression bridge contract tests passed.");
