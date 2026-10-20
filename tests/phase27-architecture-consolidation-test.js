#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const doc = read('docs/PHASE27_ARCHITECTURE_CONSOLIDATION_FA.md');
const roadmap = read('docs/ARCHITECTURE_ROADMAP_FA.md');
const pkg = JSON.parse(read('package.json'));
const migration = read('src/storage/legacy-migration.ts');
const progression = read('src/core/progression.ts');
const entry = read('js/app.js');

for (const phrase of [
  'TypeScript مالک قواعد', 'localStorage', 'preview → approve → migrate',
  'SQLite', 'Kotlin', 'Canvas', 'FastAPI و Node.js', 'Rust/WASM',
  'ساخت APK', 'آزمون روی دستگاه'
]) assert(doc.includes(phrase), `Phase 27 decision document missing: ${phrase}`);
assert(roadmap.includes('مرجع عمومی رابط هنوز `localStorage` است'), 'Roadmap must not claim that IndexedDB is already the live UI source of truth.');
assert(/createLegacyMigrationApproval/.test(migration) && /validateLegacyMigrationApproval/.test(migration), 'Explicit migration approval API must remain present.');
assert(/completeQuest/.test(progression) && /advanceXPTrack/.test(progression), 'TypeScript progression core must retain the canonical quest/XP API.');
assert(entry.includes('SYSTEMTypeScriptProgression'), 'JavaScript entry must expose the typed progression domain.');
assert(exists('docs/PHASE26_RELEASE_ENGINEERING_FA.md'), 'Phase 26 release limitations must remain documented.');
assert(pkg.scripts['test:static'].includes('phase27-architecture-consolidation-test.js'), 'Phase 27 contract must be wired into test:static.');

if (failures.length) {
  console.error(`Phase 27 architecture consolidation: FAIL (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Phase 27 architecture consolidation: PASS');
console.log('Verified architecture decisions, storage cutover guardrails, typed progression ownership, and release honesty.');
