'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/legacy/app-controller.js'), 'utf8');

function extractFunction(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = source.indexOf(`\nfunction ${nextName}(`, start);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return source.slice(start, end);
}

const systemState = { player: { level: 2, xp: 10 }, stable: true };
const systemProgress = { totalQuests: 4, totalXP: 80 };
const context = {
  window: {},
  localStorage: {},
  console: { warn() {} },
  systemState,
  systemProgress,
  systemProgressHistory: [],
  completedQuests: {},
  aiDailyQuests: [],
  rewardState: {},
  dailyLoginState: {},
  Object, Array, Number, JSON,
};
vm.createContext(context);
vm.runInContext(
  `${extractFunction('cloneSystemValue', 'captureSystemTransactionSnapshot')}\n${extractFunction('restoreSystemTransactionSnapshot', 'runSystemTransaction')}`,
  context,
  { filename: 'transaction-rollback-contract.js', timeout: 5000 },
);

const snapshot = {
  persisted: null,
  state: { player: { level: 2, xp: 10 }, stable: true },
  memory: { progress: { totalQuests: 4, totalXP: 80 } },
};
systemState.transientFromFailedOperation = { granted: true };
systemState.player.level = 99;
systemProgress.transientCounter = 1;
systemProgress.totalQuests = 999;
const restored = context.restoreSystemTransactionSnapshot(snapshot);
assert.equal(restored, true, 'Rollback should succeed when there is no persisted namespace to restore');
assert.equal(Object.hasOwn(systemState, 'transientFromFailedOperation'), false, 'Rollback must remove new state keys introduced by a failed operation');
assert.deepEqual(systemState.player, { level: 2, xp: 10 }, 'Rollback must restore nested player state');
assert.equal(systemState.stable, true, 'Rollback must retain existing state fields');
assert.equal(Object.hasOwn(systemProgress, 'transientCounter'), false, 'Rollback must remove new progress counters introduced by a failed operation');
assert.equal(systemProgress.totalQuests, 4, 'Rollback must restore the prior value of an existing counter');
console.log('Transaction rollback contract passed: newly introduced state fields/counters are removed and prior values restored.');
