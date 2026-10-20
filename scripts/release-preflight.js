'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => {
  console.error(`FAIL release preflight: ${message}`);
  process.exitCode = 1;
};
const pass = (message) => console.log(`PASS release preflight: ${message}`);

const version = read('VERSION').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`VERSION must be strict semver; got "${version}"`);

const pkg = JSON.parse(read('package.json'));
if (pkg.version !== version) fail(`package.json version ${pkg.version} does not match VERSION ${version}`);
else pass(`package.json version matches ${version}`);

const gradle = read('android/app/build.gradle');
if (!gradle.includes(`versionName '${version}'`)) fail(`Android versionName does not match ${version}`);
else pass(`Android versionName matches ${version}`);

const manifest = JSON.parse(read('manifest.webmanifest'));
if (manifest.version !== version) fail(`manifest.webmanifest version ${manifest.version} does not match ${version}`);
else pass(`web manifest version matches ${version}`);

const changelog = read('CHANGELOG.md');
if (!new RegExp(`^##\\s+${version.replaceAll('.', '\\.')}(?:\\s|—|-)`, 'm').test(changelog)) {
  fail(`CHANGELOG.md has no heading for ${version}`);
} else pass(`changelog contains a ${version} entry`);

for (const rel of ['index.html', 'sw.js', 'VERSION', 'manifest.webmanifest']) {
  const source = path.join(root, rel);
  const bundled = path.join(root, 'android/app/src/main/assets/www', rel);
  if (!fs.existsSync(bundled)) {
    fail(`Android web bundle is missing ${rel}; run npm run prepare:android`);
    continue;
  }
  if (!fs.readFileSync(source).equals(fs.readFileSync(bundled))) fail(`Android bundled ${rel} differs from root ${rel}; run npm run prepare:android`);
  else pass(`Android bundled ${rel} is synchronized`);
}

for (const rel of ['release.keystore', 'android/release.keystore', 'android/app/release.jks', '.env']) {
  if (fs.existsSync(path.join(root, rel))) fail(`potential secret-bearing file is present in project: ${rel}`);
}
if (process.exitCode !== 1) pass('no known local signing-key or .env files found');

if (process.exitCode === 1) console.error('Release preflight failed. Do not publish this build until all failures are resolved.');
else console.log(`Release preflight passed for SYSTEM ${version}. This does not replace an actual APK build, device testing, or signing verification.`);
