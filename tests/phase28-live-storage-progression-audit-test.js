#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const entry = read('js/app.js');
const controller = read('js/legacy/app-controller.js');
const progression = read('src/core/progression.ts');
const rewardCommand = read('src/core/reward-command.ts');
const idempotency = read('js/core/progression-idempotency.js');
const durableBridge = read('js/app.js');
const migration = read('src/storage/legacy-migration.ts');
const storage = read('js/core/storage.js');
const pkg = JSON.parse(read('package.json'));

// Live ownership is intentionally not switched in this phase.
assert(/localStorage\.getItem\(SYSTEM_SAVE_KEY\)/.test(controller), 'Legacy controller must still explicitly load its established save format.');
assert(/localStorage\.setItem\(\s*SYSTEM_SAVE_KEY/.test(controller), 'Legacy controller must still persist through its established save path.');
assert(/legacyStorageRemainsAuthoritative:\s*true/.test(durableBridge), 'Durable bridge must declare localStorage as authoritative until approved cutover.');
assert(/automaticMigration:\s*false/.test(durableBridge), 'Automatic migration must remain disabled.');
assert(/dualWrite:\s*false/.test(durableBridge), 'Uncontrolled dual-write must remain disabled.');
assert(/options\?\.confirmed !== true/.test(durableBridge), 'Durable progression writes must require explicit confirmation.');
assert(/previewLegacyLocalStorageMigration/.test(entry) && /migrateLegacyLocalStorageToIndexedDB/.test(entry), 'Explicit preview/migrate APIs must remain available.');
assert(/warningsAcknowledged/.test(migration), 'Migration must retain explicit warning acknowledgement.');
assert(!/storage\.removeItem\(|storage\.setItem\(|storage\.clear\(/.test(migration), 'Migration preview/import module must not destructively mutate legacy storage through the passed storage adapter.');

// TypeScript owns the canonical progression and reward identity contracts.
assert(/export function completeQuest\(/.test(progression), 'TypeScript progression core must own Quest completion.');
assert(/player\.completedQuestIds\.includes\(quest\.id\)/.test(progression), 'Canonical Quest completion must block an already-completed Quest.');
assert(/eventIds\.has\(event\.id\)/.test(progression), 'Progression validation must reject duplicate XP event IDs.');
assert(/prepareProgressionReward|prepareRewardCommand|idempotencyKey/.test(rewardCommand), 'Typed reward command must own canonical reward preparation/identity.');
assert(/SYSTEMTypeScriptProgression/.test(idempotency), 'Legacy idempotency adapter must delegate canonical identity to TypeScript when available.');
assert(/applyTypeScriptQuestPlayerReward/.test(controller) && /prepareRewardCommand/.test(controller), 'Live reward pipeline must route reward preparation and Player progression through TypeScript.');
assert(/SYSTEMProgressionIdempotency/.test(controller) && /idempotency\.commit\(localStorage, eventId/.test(controller), 'Live required Quest reward types must use the local idempotency ledger.');
assert(/runSystemTransaction/.test(controller), 'Legacy side effects must remain under the transaction/rollback wrapper.');
assert(/CURRENT_BACKUP_VERSION/.test(storage), 'Existing local backup validation/restore helpers must remain present.');
assert(pkg.scripts['test:static'].includes('phase28-live-storage-progression-audit-test.js'), 'Phase 28 audit must be wired into test:static.');

if (failures.length) {
  console.error(`Phase 28 live storage/progression audit: FAIL (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Phase 28 live storage/progression audit: PASS');
console.log('Verified legacy storage ownership, opt-in IndexedDB, TypeScript progression authority, idempotency and rollback guardrails.');
