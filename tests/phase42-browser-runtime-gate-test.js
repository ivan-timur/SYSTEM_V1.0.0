#!/usr/bin/env node
'use strict';
// Phase 42: verifies that real-browser integration is wired as a release gate
// and that managed browser policy is reported rather than bypassed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const runner = read('tests/run-indexeddb-browser-test.js');
const page = read('tests/browser/indexeddb-transaction-test.html');
const browserTest = read('tests/browser/indexeddb-transaction-test.js');
const pkg = JSON.parse(read('package.json'));
const changelog = read('CHANGELOG.md');

assert.match(pkg.scripts['test:browser-idb'], /tests\/run-indexeddb-browser-test\.js/, 'real browser IndexedDB command must remain available');
assert.match(runner, /ERR_BLOCKED_BY_ADMINISTRATOR/, 'managed navigation restrictions must be reported clearly');
assert.match(runner, /URLBlocklist/, 'runner must diagnose managed URL policy');
assert.match(runner, /does not alter managed policy/, 'runner must explicitly refuse to bypass managed policy');
assert.match(page, /data-test-status="running"/, 'browser test page must expose a machine-readable running state');
for (const phrase of ['runLegacyMigrationIntegration', 'completeQuestInDatabase', 'alreadyCompleted', 'transactionDone']) {
  assert.ok(browserTest.includes(phrase), `browser integration must retain scenario: ${phrase}`);
}
assert.match(browserTest, /close and reopen|close and reopen/i, 'test must check persistence across database reopen');
assert.ok(pkg.scripts['test:static'].includes('phase42-browser-runtime-gate-test.js'), 'Phase 42 gate audit must run in static suite');
assert.ok(changelog.includes('Phase 42 — Browser Runtime Integration Gate'), 'Phase 42 must be documented');
console.log('Phase 42 browser runtime integration gate: PASS');
console.log('Verified real-browser runner, IndexedDB scenarios, persistence assertions, and policy-safe blocked-navigation diagnostics.');
console.log('This contract audit does not count as a successful real-browser run.');
