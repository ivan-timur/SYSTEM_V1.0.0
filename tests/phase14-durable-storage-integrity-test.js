'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const backup = read('js/core/storage.js');
const idb = read('src/storage/indexeddb.ts');
const health = read('src/storage/database-health.ts');
const migration = read('src/storage/legacy-migration.ts');
const gate = read('js/modules/durable-storage-gate.js');
const packageJson = JSON.parse(read('package.json'));
const bridge = read('docs/PHASE12_DURABLE_PROGRESSION_BRIDGE.md');

// Backup must be verifiable before it is applied, bounded in size, and rollback-aware.
assert.match(backup, /checksumForEntries\(entries\)/, 'export must calculate a checksum');
assert.match(backup, /checksumAlgorithm: 'fnv1a32'/, 'backup format must identify its checksum algorithm');
assert.match(backup, /integrity check failed/i, 'corrupt backup must fail validation');
assert.match(backup, /applyEntriesAtomically/, 'restore must use the rollback-aware apply path');
assert.match(backup, /rollbackOk/, 'restore must track rollback outcome after a write failure');
assert.match(backup, /main player save/i, 'restore must require the canonical player save');
assert.match(backup, /DEFAULT_MAX_BACKUP_BYTES/, 'backup export/import must enforce a size bound');

// IndexedDB diagnostics remain read-only and inspect a coherent readonly transaction.
assert.match(health, /readOnly: true/);
assert.match(health, /db\.transaction\(\[\.\.\.SYSTEM_STORES\], 'readonly'\)/);
assert.doesNotMatch(health, /objectStore\([^)]*\)\.(put|add|delete|clear)\(/, 'health inspection must never mutate user data');
assert.match(idb, /tx\.onabort/);
assert.match(idb, /tx\.oncomplete/);
assert.match(idb, /db\.onversionchange = \(\) => db\.close\(\)/);

// Migration is explicit, source-preserving, and must not dual-write or auto-cut over.
assert.match(migration, /confirmed/);
assert.match(migration, /warningsAcknowledged/);
assert.match(migration, /refuses to overwrite a non-empty target database/i);
assert.match(bridge, /remains authoritative for the existing UI/i);
assert.match(bridge, /does not dual-write/i);
assert.match(gate, /requestPersistentStorage/);
assert.doesNotMatch(gate, /localStorage\.clear\(|indexedDB\.deleteDatabase\(/, 'storage capability checks must never erase saves');
assert.match(packageJson.scripts['test:static'], /phase14-durable-storage-integrity-test\.js/,
  'Phase 14 regression test must run in the standard static suite');
console.log('Phase 14 durable-storage integrity contract passed: backup validation, checksum, bounded restore, rollback guard, read-only IndexedDB health, explicit migration and no automatic cutover.');
