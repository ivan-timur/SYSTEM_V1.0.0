'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const check = (condition, message) => assert.ok(condition, message);
const checks = [];
const verify = (condition, message) => { check(condition, message); checks.push(message); };

const controller = read('js/legacy/app-controller.js');
const packageJson = JSON.parse(read('package.json'));
const mobile = read('tests/playwright/mobile-navigation-stability.spec.js');
const transaction = read('src/storage/indexeddb.ts');
const updater = read('js/modules/android-native.js');
const release = read('scripts/release-preflight.js');
const dailyHandler = controller.slice(controller.indexOf('const committed = runSystemTransaction("Daily Quest"'), controller.indexOf('console.log(`Quest completed:'));
const titleDeclaration = controller.lastIndexOf('const activityTitle =', controller.indexOf('const committed = runSystemTransaction("Daily Quest"'));

verify(titleDeclaration >= 0, 'daily quest title is captured in the click-handler scope before transaction callback');
verify(/if \(!committed\) return;[\s\S]*emitSystemVisualEvent\("system-quest-completed"/.test(dailyHandler), 'quest feedback is emitted only after the transaction reports success');
verify(/applyProgressionReward\(\{ type: "daily-quest"[\s\S]*questId: quest\.id/.test(dailyHandler), 'daily quest completion uses the progression reward adapter with stable quest identity');
verify(/recordSystemProgress\("totalDailyQuestsCompleted", 1\)/.test(dailyHandler), 'daily quest progress counter remains coupled to successful completion');
verify(/grantDailyPrize\(\)/.test(dailyHandler), 'daily prize grant remains part of the transactional completion path');
verify(/db\.transaction\(transactionStores, 'readwrite'\)/.test(transaction), 'durable progression keeps its explicit read-write transaction boundary');
verify(/alreadyCompleted/.test(transaction) && /new Set\(signals\)\.size > 1/.test(transaction), 'durable progression guards duplicate completion and partial transaction markers');
verify(/five navigation targets and icons remain anchored/.test(mobile) && /narrow 360px viewport/.test(mobile), 'mobile navigation geometry and narrow viewport interaction are covered by Playwright contracts');
verify(/system-language-change/.test(updater), 'native updater remains connected to runtime language changes');
verify(/Android bundled \$\{rel\} differs/.test(release), 'release preflight rejects unsynchronized Android web assets');
verify(Object.hasOwn(packageJson.scripts, 'test:phase6') && /phase6-ux-mobile-release-gate-test\.js/.test(packageJson.scripts['test:static']), 'Phase 6 gate is available standalone and included in static regressions');
verify(/physical-device run or APK build is claimed/.test(read('CHANGELOG.md')), 'release notes explicitly avoid claiming device or APK validation');

console.log(`Phase 6 UX/mobile/release gate passed: ${checks.length} checks.`);
for (const message of checks) console.log(` - ${message}`);
