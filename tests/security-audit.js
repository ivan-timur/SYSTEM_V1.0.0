'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
let checks = 0;
function check(condition, message) {
  checks++;
  if (!condition) throw new Error(`Security audit failed: ${message}`);
}
function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full, predicate, out);
    else if (item.isFile() && predicate(full)) out.push(full);
  }
  return out;
}
const htmlFiles = walk(ROOT, file => file.endsWith('.html') && !file.includes(`${path.sep}node_modules${path.sep}`));
const allHtml = htmlFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const policyMatch = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
check(Boolean(policyMatch), 'Main document must define Content-Security-Policy.');
const policy = policyMatch[1].replace(/&amp;/g, '&');
for (const directive of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-src 'none'"]) {
  check(policy.includes(directive), `CSP must include ${directive}.`);
}
check(!/script-src[^;]*unsafe-inline/i.test(policy), 'CSP must not allow inline scripts.');
check(!/script-src[^;]*unsafe-eval/i.test(policy), 'CSP must not allow eval.');
check(/connect-src[^;]*https:\/\/api\.groq\.com/.test(policy), 'CSP must permit the explicitly used Groq endpoint.');
check(!/generativelanguage\.googleapis\.com/i.test(allHtml), 'No active HTML document should reference the removed Gemini API.');
check(!/generativelanguage\.googleapis\.com/i.test(policy), 'CSP must not permit the removed Gemini endpoint.');
check(!/(?:^|\s)on(?:click|error|load|change|input|submit|mouseover|mouseout)\s*=/i.test(allHtml), 'HTML must not use inline event-handler attributes.');
const inlineScriptBlocks = [...allHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  .filter(match => !/\bsrc\s*=/i.test(match[1]) && match[2].trim());
check(inlineScriptBlocks.length === 0, 'HTML must not contain executable inline script blocks.');
check(/<script\s+type="module"\s+src="js\/app\.js"\s*>\s*<\/script>/i.test(html), 'Main app must enter through an ES module.');
const scannedJsFiles = walk(ROOT, file => /\.js$/.test(file)
  && !file.split(path.sep).includes('node_modules')
  && !file.split(path.sep).includes('.git'));
check(!/\beval\s*\(|\bnew\s+Function\s*\(|document\.write\s*\(/.test(
  scannedJsFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n')
), 'No dynamic-code execution sinks should be present.');

const legacy = fs.readFileSync(path.join(ROOT, 'js/legacy/app-controller.js'), 'utf8');
const grok = fs.readFileSync(path.join(ROOT, 'js/features/grok-suite.js'), 'utf8');
const rewards = fs.readFileSync(path.join(ROOT, 'js/features/rewards-plus.js'), 'utf8');
const experience = fs.readFileSync(path.join(ROOT, 'js/features/experience.js'), 'utf8');
const translations = fs.readFileSync(path.join(ROOT, 'js/features/i18n.js'), 'utf8');
check(/function escapeHTML\s*\(/.test(legacy), 'Legacy UI must retain the central HTML escaping helper.');
check(/trustedMarkup[\s\S]{0,300}escapeHTML/.test(legacy), 'Modal insertion must document its trusted-template contract.');
check(/const role=m&&m\.role==='user'\?'user':'assistant'/.test(grok), 'Persisted chat roles must be whitelisted before becoming a CSS class.');
check(/<p>\$\{esc\(m&&m\.content\)\}<\/p>/.test(grok), 'Persisted chat content must be escaped before HTML insertion.');
check(/\$\{esc\(n\.title\)\}/.test(grok) && /\$\{esc\(n\.body\)\}/.test(grok), 'Persisted note content must be escaped.');
check(/\$\{esc\(e\.title\|\|e\.type\|\|'Activity'\)\}/.test(grok), 'Activity titles from local storage must be escaped.');
check(/const esc\s*=/.test(rewards) && /esc\(e\.title\)/.test(rewards), 'Reward-history titles must be escaped.');
check(/xp: Math\.max\(0, Math\.min\(10000, Math\.floor\(Number\(entry\.xp\)/.test(rewards) && /coins: Math\.max\(-1000, Math\.min\(10000, Math\.floor\(Number\(entry\.coins\)/.test(rewards), 'Reward-history numbers must be normalized before HTML insertion.');
check(/opens: boundedInt\(raw\.opens/.test(rewards) && /sinceRare: boundedInt\(raw\.sinceRare/.test(rewards), 'Mystery-vault counters must be normalized before HTML insertion.');
check(/prefs\.volume = Math\.min\(1, Math\.max\(0, Number\(prefs\.volume\) \|\| 0\)\)/.test(experience), 'Persisted volume must be numerically normalized before template interpolation.');
check(/button\.innerHTML='</.test(translations), 'Language-toggle HTML insertion must remain a fixed, non-user-controlled template.');
check(!/\$\{m\.role\}/.test(grok), 'Raw persisted message role must not be interpolated into markup.');

const sourceSheets = fs.readFileSync(path.join(ROOT, 'scripts/build-css.js'), 'utf8');
const runtimeCss = fs.readFileSync(path.join(ROOT, 'css/system.css'), 'utf8');
check((html.match(/<link\s+rel="stylesheet"/g) || []).length === 1, 'Exactly one active stylesheet should be linked by the main document.');
check(/@layer system\s*\{/.test(runtimeCss), 'Consolidated CSS must be contained in the single `system` cascade layer.');
check(!/@layer\s+system-[\w-]+\s*\{/.test(runtimeCss), 'Runtime CSS must not create separate per-file cascade layers.');
check(!/!important\b/i.test(runtimeCss), 'The emitted CSS bundle must not contain !important.');
const cssFiles = walk(path.join(ROOT, 'css'), file => file.endsWith('.css'));
check(!cssFiles.some(file => /!important\b/i.test(fs.readFileSync(file, 'utf8'))), 'All CSS source fragments and the runtime bundle must be free of !important.');
check((sourceSheets.match(/'css\//g) || []).length >= 30, 'The build must include the full ordered CSS source list.');

const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim().split(/\s+/)[0];
const appModule = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const versionModule = fs.readFileSync(path.join(ROOT, 'js/modules/version.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
const appLegacyVersion = legacy.match(/const SYSTEM_APP_VERSION\s*=\s*"([^"]+)"/);
check(Boolean(appLegacyVersion) && appLegacyVersion[1] === version, 'Legacy app version must match VERSION.');
check(versionModule.includes(`"${version}"`) && appModule.includes('APP_VERSION') && appModule.startsWith(`/** SYSTEM release ${version}.`), 'ES-module version source and app.js release annotation must match VERSION.');
check(fs.existsSync(path.join(ROOT, 'scripts/sync-version.js')), 'A build-time version synchronizer must exist.');
check(sw.includes(`const APP_VERSION = "${version}"`) && sw.includes('const CACHE_NAME = `system-v${APP_VERSION}`;'), 'Service-worker version and cache key must be versioned from VERSION.');
check(manifest.version === version && packageJson.version === version, 'Web manifest and package versions must match VERSION.');
check(changelog.includes(`## ${version}`), 'Changelog must have a top-level section for the current version.');
const shellMatch = sw.match(/const SHELL = (\[[\s\S]*?\]);\n/);
check(Boolean(shellMatch), 'Service worker must define a static shell precache list.');
const shell = JSON.parse(shellMatch[1]);
const missing = shell.filter(rel => rel !== './' && !fs.existsSync(path.join(ROOT, rel)));
check(missing.length === 0, `Every precache entry must exist. Missing: ${missing.join(', ')}`);
for (const mustCache of ['index.html', 'css/system.css', 'js/app.js', 'js/legacy/app-controller.js', 'js/modules/version.js', 'js/modules/storage.js', 'js/modules/security.js', 'js/modules/ai-workspace-navigation.js', 'js/generated/progression-math.js', 'js/core/progression-math.js', 'dist/ts/core/progression.js', 'dist/ts/core/activity-ledger.js', 'sw.js']) {
  check(shell.includes(mustCache), `Precache must include ${mustCache}.`);
}
check(!/system-v5\.7\.0/.test(sw), 'Old service-worker cache version must not be retained.');
check(!fs.existsSync(path.join(ROOT, 'pages')), 'Unused placeholder route pages should be removed.');
check(!/system-proxy-|systemProxy|secure proxy|proxy endpoint|proxy selection/i.test(html + legacy), 'Removed proxy UI and logic must not return in active files.');
const jsFiles = walk(path.join(ROOT, 'js'), file => file.endsWith('.js'));
check(!jsFiles.some(file => fs.readFileSync(file, 'utf8').includes('SYSTEM module placeholder:')), 'No inert JS placeholder modules may remain.');
check(fs.existsSync(path.join(ROOT, 'tests/playwright/status-quest.spec.js')), 'Playwright Status/Quest test suite must be present.');
const playwrightConfig = fs.readFileSync(path.join(ROOT, 'playwright.config.js'), 'utf8');
check(playwrightConfig.includes("name: 'mobile-chromium'") && playwrightConfig.includes("devices['Pixel 7']"), 'Playwright must define real mobile device emulation.');
check(packageJson.scripts['test:e2e:mobile'].includes('--project=mobile-chromium'), 'Mobile test command must target the mobile-emulation project.');
console.log(`SYSTEM security/build audit passed: ${checks} checks; ${htmlFiles.length} HTML document(s); ${shell.length} precache entries.`);
