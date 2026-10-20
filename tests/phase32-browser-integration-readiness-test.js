#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const runner = read('tests/run-indexeddb-browser-test.js');
const browserTest = read('tests/browser/indexeddb-transaction-test.js');
const browserPage = read('tests/browser/indexeddb-transaction-test.html');
const releaseReport = read('docs/PHASE32_BROWSER_INTEGRATION_READINESS_FA.md');
const checks = [];
function check(condition, message) { assert.ok(condition, message); checks.push(message); }

check(pkg.scripts['test:browser-idb'] === 'npm run build:ts && node tests/run-indexeddb-browser-test.js', 'real-browser IndexedDB command builds typed modules before running the browser test');
check(runner.includes('URLBlocklist') && runner.includes('blockedNavigationError'), 'runner detects managed browser URL policy and reports a blocked test without bypassing policy');
check(runner.includes('No IndexedDB result was produced'), 'blocked browser navigation is reported as no result, not as a pass');
check(browserPage.includes('data-test-status="running"') && browserPage.includes('indexeddb-transaction-test.js'), 'browser test page exposes a machine-readable status and loads the integration test');
check(browserTest.includes("body.dataset.testStatus = 'passed'") && browserTest.includes("body.dataset.testStatus = 'failed'"), 'browser test distinguishes explicit pass and failure outcomes');
check(browserTest.includes('close()') && browserTest.includes('openSystemDatabase()'), 'integration test exercises database close/reopen durability');
check(browserTest.includes('alreadyCompleted') && browserTest.includes('rollback') && browserTest.includes('migration'), 'integration test covers idempotency, rollback and legacy migration');
check(browserTest.includes('transaction') && browserTest.includes('curriculumEvidence'), 'integration test covers transactional progression and linked curriculum evidence');
check(pkg.scripts['test:static'].includes('phase32-browser-integration-readiness-test.js'), 'phase 32 contract test is part of the static regression suite');
check(releaseReport.includes('ERR_BLOCKED_BY_ADMINISTRATOR') && releaseReport.includes('دور زده نشد'), 'report records the observed managed-policy limitation and safe handling');

console.log(`Phase 32 browser integration readiness: PASS (${checks.length} source-contract checks)`);
for (const item of checks) console.log(` - ${item}`);
console.log('This is a source-contract audit; it does not claim the blocked browser integration test passed.');
