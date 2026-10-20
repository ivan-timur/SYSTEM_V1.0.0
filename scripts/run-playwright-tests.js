#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

let packageEntry;
try {
  packageEntry = require.resolve('@playwright/test');
} catch {
  console.error('SYSTEM E2E tests need the local dev dependency @playwright/test.');
  console.error('Run `npm install` and then `npx playwright install chromium`, then retry `npm run test:e2e`.');
  process.exit(2);
}

const packageDir = path.dirname(packageEntry);
const candidates = [
  path.join(packageDir, 'cli.js'),
  path.join(path.dirname(packageDir), 'playwright', 'cli.js')
];
let cliPath = candidates.find(candidate => fs.existsSync(candidate));
if (!cliPath) {
  try {
    const playwrightEntry = require.resolve('playwright');
    const candidate = path.join(path.dirname(playwrightEntry), 'cli.js');
    if (fs.existsSync(candidate)) cliPath = candidate;
  } catch { /* handled below */ }
}
if (!cliPath) {
  console.error('The local Playwright package exists, but its CLI could not be located. Reinstall dependencies with `npm install`.');
  process.exit(2);
}

const result = spawnSync(process.execPath, [cliPath, 'test', ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) {
  console.error(`Could not start Playwright: ${result.error.message}`);
  process.exit(2);
}
process.exit(Number.isInteger(result.status) ? result.status : 1);
