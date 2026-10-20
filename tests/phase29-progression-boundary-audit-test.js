#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const controller = read('js/legacy/app-controller.js');
const progression = read('src/core/progression.ts');
const rewards = read('src/core/reward-command.ts');
const idempotency = read('js/core/progression-idempotency.js');
const app = read('js/app.js');
const pkg = JSON.parse(read('package.json'));
const changelog = read('CHANGELOG.md');

// The live UI remains on the established save format until a separately approved cutover.
assert(/localStorage\.getItem\(SYSTEM_SAVE_KEY\)/.test(controller), 'Legacy save read path must remain intact.');
assert(/localStorage\.setItem\(\s*SYSTEM_SAVE_KEY/.test(controller), 'Legacy save write path must remain intact.');
assert(/legacyStorageRemainsAuthoritative:\s*true/.test(app), 'The durable bridge must continue to declare the current authority.');
assert(/automaticMigration:\s*false/.test(app), 'Automatic migration must remain disabled.');
assert(/dualWrite:\s*false/.test(app), 'Uncontrolled dual-write must remain disabled.');

// Every required reward must be normalized and duplicate-checked before the first side effect.
const normalizeAt = controller.indexOf('command = tsProgression.prepareRewardCommand(');
const duplicateCheckAt = controller.indexOf('idempotency.inspect(localStorage, eventId, getLocalDateStamp())');
const transactionMutationAt = controller.indexOf('if (!applyTypeScriptQuestPlayerReward({', duplicateCheckAt);
assert(normalizeAt >= 0, 'Live reward path must normalize through the TypeScript command contract.');
assert(duplicateCheckAt > normalizeAt, 'Idempotency check must follow canonical command preparation.');
assert(transactionMutationAt > duplicateCheckAt, 'Player mutation must occur only after duplicate validation.');
assert(/SYSTEMProgressionIdempotency/.test(controller), 'Live controller must use the shared idempotency adapter.');
assert(/idempotency\.commit\(localStorage, eventId/.test(controller), 'Live controller must commit reward identity after successful side effects.');
assert(/runSystemTransaction/.test(controller), 'Legacy side effects must remain rollback-aware.');

// Canonical domain invariants are owned by TypeScript, not reimplemented in UI.
assert(/export function completeQuest\(/.test(progression), 'TypeScript must own the canonical Quest transition.');
assert(/player\.completedQuestIds\.includes\(quest\.id\)/.test(progression), 'Canonical transition must guard completed Quest identity.');
assert(/eventIds\.has\(event\.id\)/.test(progression), 'XP event IDs must be validated for duplicates.');
assert(/export function prepareProgressionReward\(/.test(rewards), 'TypeScript must own reward input normalization.');
assert(/getCanonicalDomainQuestId/.test(rewards) && /getProgressionRewardIdentity/.test(rewards), 'Canonical Quest and payout identity must be shared.');
assert(/verify the write instead of assuming localStorage accepted it/i.test(idempotency), 'Idempotency ledger writes must be read-back verified.');
assert(/if \(entries\.includes\(id\)\)/.test(idempotency), 'The idempotency adapter must reject already-committed IDs.');

assert(pkg.scripts['test:static'].includes('phase29-progression-boundary-audit-test.js'), 'Phase 29 audit must be wired into test:static.');
assert(changelog.includes('Phase 29 Progression Boundary Audit'), 'Phase 29 must be documented in CHANGELOG.');

if (failures.length) {
  console.error(`Phase 29 progression boundary audit: FAIL (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Phase 29 progression boundary audit: PASS');
console.log('Verified command normalization, duplicate-check ordering, TypeScript ownership, rollback guardrails and unchanged storage authority.');
