#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const roadmap = read('docs/ARCHITECTURE_ROADMAP_FA.md');
const readme = read('docs/ARCHITECTURE.md');
const packageJson = JSON.parse(read('package.json'));
const tsConfig = JSON.parse(read('tsconfig.json'));
const entry = read('js/app.js');
const progression = read('src/core/progression.ts');
const idb = read('src/storage/indexeddb.ts');
const legacyMigration = read('src/storage/legacy-migration.ts');
const bridgeDoc = read('docs/PHASE12_DURABLE_PROGRESSION_BRIDGE.md');
const bridgeTest = read('tests/phase12-durable-progression-bridge-contract-test.js');

for (const tech of [
  'JavaScript', 'TypeScript', 'HTML / CSS', 'JSON', 'IndexedDB', 'SQLite',
  'Kotlin', 'Java', 'Canvas / WebGL', 'Python', 'FastAPI یا Node.js',
  'Rust / WebAssembly', 'Markdown / YAML / Shell', 'ICU MessageFormat'
]) {
  assert(roadmap.includes(tech), `Architecture roadmap is missing technology responsibility: ${tech}`);
}
assert(/منطق XP|منطق پیشرفت|TypeScript/.test(roadmap) && exists('src/core/progression.ts'), 'Roadmap and source tree must identify TypeScript progression ownership.');
assert(/localStorage/.test(roadmap) && /IndexedDB/.test(roadmap), 'Roadmap must clearly state the current and target storage ownership.');
assert(/SQLite/.test(roadmap) && /فقط/.test(roadmap), 'SQLite must remain conditional, not a default runtime dependency.');
assert(/Rust \/ WebAssembly/.test(roadmap), 'Roadmap must document Rust/WASM as evidence-gated.');
assert(/ICU MessageFormat/.test(roadmap), 'Roadmap must record the deferred localization migration.');
assert(/type="module" src="js\/app\.js"/.test(read('index.html')), 'JavaScript entry must remain an ES module.');
assert(/export/.test(progression), 'Progression core should expose a module API.');
assert(/indexedDB/.test(idb), 'IndexedDB adapter must use the browser IndexedDB API.');
assert(/preview|fingerprint|approve/i.test(legacyMigration), 'Legacy migration must retain an explicit review/approval flow.');
assert(/localStorage/.test(bridgeDoc) && /dual-write/i.test(bridgeDoc), 'Phase 12 bridge document must preserve storage ownership and no-dual-write guarantees.');
assert(bridgeTest.includes('confirmed') && bridgeTest.includes('completeDurableQuestInDatabase'), 'Phase 12 bridge contract test must exercise explicit confirmation.');
assert(packageJson.scripts['test:static'].includes('phase13-architecture-roadmap-contract-test.js'), 'Phase 13 architecture contract must run in the standard static test suite.');
assert(tsConfig.compilerOptions && tsConfig.compilerOptions.module, 'TypeScript module configuration must be explicit.');
assert(entry.length > 0, 'Runtime entry point must exist and be readable.');

if (failures.length) {
  console.error('Phase 13 architecture roadmap contract: FAIL');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Phase 13 architecture roadmap contract: PASS');
  console.log('Verified technology responsibilities, storage migration guardrails, module entry, and test-suite integration.');
}
