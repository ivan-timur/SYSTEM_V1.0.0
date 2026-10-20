#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const android = path.join(root, 'android');
const apk = path.join(android, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
  });
  if (result.error) {
    console.error(`BUILD BLOCKED: cannot start ${command}: ${result.error.message}`);
    process.exit(result.error.code === 'ENOENT' ? 127 : 1);
  }
  if (result.status !== 0) {
    console.error(`BUILD FAILED: ${command} exited with status ${result.status}`);
    process.exit(result.status || 1);
  }
}

console.log('SYSTEM Android debug build — version ' + fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim());
run(process.execPath, [path.join(root, 'scripts', 'android-build-preflight.js'), '--strict']);
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'prepare:android']);
const gradle = process.platform === 'win32' ? 'gradle.bat' : 'gradle';
run(gradle, ['--no-daemon', 'assembleDebug'], { cwd: android });
if (!fs.existsSync(apk) || fs.statSync(apk).size === 0) {
  console.error(`BUILD FAILED: expected APK artifact was not created at ${path.relative(root, apk)}`);
  process.exit(2);
}
console.log(`BUILD SUCCESS: ${path.relative(root, apk)} (${fs.statSync(apk).size} bytes)`);
