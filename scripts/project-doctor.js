#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const issues = [];
const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
console.log(`SYSTEM project doctor — release ${version}`);
for (const file of ['index.html', 'css/system.css', 'js/app.js', 'js/modules/version.js', 'js/legacy/app-controller.js', 'js/core/goal-progress.js', 'sw.js', 'manifest.webmanifest']) {
  if (!fs.existsSync(path.join(ROOT, file))) issues.push(`Missing required file: ${file}`);
}
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  if (pkg.version !== version) issues.push(`package.json version (${pkg.version}) differs from VERSION (${version})`);
  if (manifest.version !== version) issues.push(`manifest version (${manifest.version}) differs from VERSION (${version})`);
} catch (error) { issues.push(`Could not parse release metadata: ${error.message}`); }
try { require.resolve('@playwright/test'); console.log('Playwright test dependency: installed'); }
catch { console.log('Playwright test dependency: not installed (static tests still work)'); }
if (issues.length) {
  console.error(`Project doctor found ${issues.length} issue(s):\n- ${issues.join('\n- ')}`);
  process.exit(1);
}
console.log('Required runtime files and release metadata look consistent.');
