'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const runner = fs.readFileSync(path.join(__dirname, 'run-indexeddb-browser-test.js'), 'utf8');
const browserTestPath = path.join(__dirname, 'browser', 'indexeddb-transaction-test.js');
const browserTest = fs.readFileSync(browserTestPath, 'utf8');
const { execFileSync } = require('node:child_process');
execFileSync(process.execPath, ['--check', browserTestPath], { stdio: 'pipe' });
assert.match(runner, /require\('@playwright\/test'\)\.chromium/, 'CI must prefer the explicitly installed Playwright browser');
assert.match(runner, /page\.waitForFunction/, 'The Playwright path must wait for the live browser result, not process exit alone');
assert.match(runner, /remote-debugging-address=127\.0\.0\.1/, 'The dependency-free CDP fallback must be bound to loopback only');
assert.match(runner, /remote-allow-origins=\*/, 'The CDP fallback must explicitly permit the local Node CDP client');
assert.match(runner, /Runtime\.evaluate/, 'The CDP fallback must query the live browser test result');
assert.match(runner, /Page\.navigate/, 'The CDP fallback must explicitly request the local test page before polling it');
assert.match(browserTest, /const \[player, quests, events, skills, stats, history, migrations, streak(?:, curricula, goalEvidence)?\]/, 'Migration integration must read the imported Daily Quest streak record and may also read typed curriculum/evidence stores');
for (const token of ['dailyQuestStreak: { date:', 'awardedXP', 'streakRollbackRejected', 'streakDayTwo.activity.streakBonusXP', 'stored.streak.lastDate', 'createGoalCurriculumInDatabase', 'linkQuestToCurriculumInDatabase', 'curriculumEvidence: {', 'curriculumRollbackRejected', 'curriculumReplay', 'goal_evidence']) {
  assert.ok(browserTest.includes(token), `Real-browser IndexedDB integration must exercise ${token}`);
}
assert.match(runner, /document\.body\?\.dataset\?\.testStatus/, 'The runner must use the browser test status, not process exit alone');
assert.match(runner, /managed browser policy blocked/, 'Managed policy blocking must be distinguished from a test result');
assert.match(runner, /URLBlocklist/, 'The runner should report readable evidence of managed URL-blocking policy without changing it');
for (const workflowName of ['quality.yml', 'release-android.yml']) {
  const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', workflowName), 'utf8');
  assert.match(workflow, /playwright install --with-deps chromium/, `${workflowName} must install the browser runtime`);
  assert.match(workflow, /npm run test:browser-idb/, `${workflowName} must run the real IndexedDB browser integration test`);
}
assert.match(runner, /SYSTEM_BROWSER_TEST_TIMEOUT_MS/, 'The runner must enforce a bounded integration-test timeout');
assert.doesNotMatch(runner, /['"]--dump-dom['"]/, 'The runner must not pass Chromium --dump-dom or depend on its process exit');
console.log('Browser-runner + IndexedDB integration contract passed: Playwright-first CI route, loopback-only CDP fallback, syntax-checked browser test, streak award/replay/rollback coverage, atomic Goal/evidence/Skill curriculum integration, migration streak preservation, bounded timeouts, managed-policy diagnostics, and CI integration.');
