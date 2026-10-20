#!/usr/bin/env node
'use strict';
/** Phase 10 integration gate: validate architecture boundaries and local module graph. */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const issues = [];
const warnings = [];
const check = (ok, message) => { if (!ok) issues.push(message); };
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(ROOT, file));
const version = read('VERSION').trim();
const pkg = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('manifest.webmanifest'));
const androidGradle = read('android/app/build.gradle');
const serviceWorker = read('sw.js');
const roadmap = read('docs/ARCHITECTURE_ROADMAP_FA.md');

// Required source-of-truth seams: prevent a future phase from silently bypassing them.
const requiredFiles = [
  'src/core/progression.ts', 'src/core/achievements.ts', 'src/core/activity-ledger.ts',
  'src/core/reward-command.ts', 'src/features/quest-command.ts',
  'src/features/quest-completion-plan.ts', 'src/data/seed-validation.ts',
  'src/storage/indexeddb.ts', 'src/storage/database-health.ts',
  'src/storage/legacy-migration.ts', 'js/app.js', 'js/legacy/app-controller.js',
  'scripts/build-css.js', 'scripts/build-sw.js', 'scripts/sync-android-assets.js',
  'tests/phase9-transactional-progression-contract-test.js',
  'tests/transaction-rollback-contract-test.js', 'tests/run-indexeddb-browser-test.js',
];
for (const file of requiredFiles) check(exists(file), `Required architecture file is missing: ${file}`);
check(pkg.version === version, 'package.json must be synchronized from VERSION (run npm run build).');
check(manifest.version === version, 'manifest.webmanifest version must match VERSION.');
check(androidGradle.includes(`versionName '${version}'`), 'Android versionName must match VERSION.');
check(serviceWorker.includes(`const APP_VERSION = "${version}"`), 'Service Worker APP_VERSION must match VERSION.');
check(read('docs/ARCHITECTURE.md').includes('Storage migration gate'), 'Storage migration safety gate must remain documented.');
check(read('docs/ARCHITECTURE.md').includes('Transaction rollback shape integrity'), 'In-memory transaction rollback invariant must remain documented.');
check(read('src/storage/legacy-migration.ts').includes('createLegacyMigrationApproval'), 'Legacy migration must remain preview/approval gated.');
check(read('src/storage/indexeddb.ts').includes('completeQuestInDatabase'), 'IndexedDB must expose the transactional progression command.');
check(read('js/app.js').includes('SYSTEMDurableCurriculumProgression'), 'Typed durable progression must remain behind its explicit runtime bridge.');

// Every npm script that points at a local JS file must point to a real file.
for (const [name, command] of Object.entries(pkg.scripts || {})) {
  const matches = [...command.matchAll(/(?:^|\s)(scripts|tests)\/([\w./-]+\.js)/g)];
  for (const match of matches) check(exists(`${match[1]}/${match[2]}`), `npm script "${name}" references missing file ${match[1]}/${match[2]}.`);
}

// Resolve relative imports across source and built runtime modules. TypeScript's
// .js specifiers are intentionally allowed to resolve to their .ts source files.
const scanRoots = ['src', 'js', 'scripts'];
const sourceFiles = [];
function walk(dir) {
  if (!exists(dir)) return;
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(relative);
    else if (/\.(?:js|mjs|ts)$/.test(entry.name)) sourceFiles.push(relative);
  }
}
for (const dir of scanRoots) walk(dir);
function resolveLocalImport(fromFile, specifier) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const candidates = [base];
  if (/\.js$/.test(base)) candidates.push(base.replace(/\.js$/, '.ts'));
  if (!path.posix.extname(base)) candidates.push(`${base}.js`, `${base}.ts`, `${base}.mjs`, `${base}/index.js`, `${base}/index.ts`);
  return candidates.some(candidate => exists(candidate));
}
for (const file of sourceFiles) {
  const content = read(file);
  const imports = [
    ...content.matchAll(/\bfrom\s*['"](\.[^'"]+)['"]/g),
    ...content.matchAll(/\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g),
    ...content.matchAll(/\bimport\s*['"](\.[^'"]+)['"]/g),
  ];
  for (const match of imports) {
    const specifier = match[1];
    check(resolveLocalImport(file, specifier), `Unresolved local import in ${file}: ${specifier}`);
  }
}

// Architecture decisions: defer expensive/duplicate technology until a tested need exists.
for (const technology of ['JavaScript', 'TypeScript', 'HTML / CSS', 'JSON', 'IndexedDB', 'SQLite', 'Kotlin', 'Java', 'Canvas / WebGL', 'Python', 'FastAPI', 'Rust / WebAssembly', 'ICU MessageFormat']) {
  check(roadmap.includes(technology), `Architecture roadmap does not describe ${technology}.`);
}
check(!/\b(?:sqlite3|better-sqlite3|sql.js|@sqlite\.org\/sqlite-wasm)\b/i.test(JSON.stringify(pkg.dependencies || {})), 'SQLite must not be added as a runtime dependency without an approved use case.');
check(!/\b(?:rustc|wasm-pack)\b/.test(JSON.stringify(pkg.scripts || {})), 'Rust/WebAssembly build steps must remain deferred until profiling justifies them.');
if (!exists('package-lock.json')) warnings.push('No package-lock.json is present; npm ci cannot provide a reproducible install from this archive.');

if (issues.length) {
  console.error(`SYSTEM Phase 10 architecture integration FAILED (${issues.length} issue(s)):\n- ${issues.join('\n- ')}`);
  if (warnings.length) console.warn(`Warnings:\n- ${warnings.join('\n- ')}`);
  process.exit(1);
}
console.log(`SYSTEM Phase 10 architecture integration PASSED for v${version}: ${sourceFiles.length} source modules scanned, required boundaries/version metadata/build targets checked.`);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
