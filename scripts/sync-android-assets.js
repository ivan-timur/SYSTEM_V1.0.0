#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'www');
const FILES = ['index.html', 'VERSION', 'WEB_VERSION', 'manifest.webmanifest', 'sw.js'];
const DIRS = ['assets', 'css', 'js'];

for (const file of FILES) {
  if (!fs.existsSync(path.join(ROOT, file))) throw new Error(`Missing web app file: ${file}`);
}
fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });
for (const file of FILES) fs.copyFileSync(path.join(ROOT, file), path.join(DEST, file));
for (const dir of DIRS) {
  fs.cpSync(path.join(ROOT, dir), path.join(DEST, dir), { recursive: true });
}
const compiledTypeScript = path.join(ROOT, 'dist', 'ts');
if (!fs.existsSync(path.join(compiledTypeScript, 'core', 'progression.js'))) {
  throw new Error('Missing compiled TypeScript progression engine; run the build before syncing Android assets.');
}
fs.cpSync(compiledTypeScript, path.join(DEST, 'dist', 'ts'), { recursive: true });
const allFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else allFiles.push(full);
  }
}
walk(DEST);
console.log(`Copied SYSTEM web app into Android assets: ${allFiles.length} files, ${(allFiles.reduce((n, file) => n + fs.statSync(file).size, 0) / 1024 / 1024).toFixed(2)} MiB.`);
