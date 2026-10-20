'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
let failures = 0;
function check(condition, message) {
  if (condition) console.log(`PASS ${message}`);
  else { failures++; console.error(`FAIL ${message}`); }
}
const builder = fs.readFileSync(path.join(ROOT, 'scripts/build-css.js'), 'utf8');
const tokensPath = path.join(ROOT, 'css/foundation/design-tokens.css');
const tokens = fs.readFileSync(tokensPath, 'utf8');
const bundle = fs.readFileSync(path.join(ROOT, 'css/system.css'), 'utf8');
check(builder.includes("'css/foundation/design-tokens.css'"), 'Semantic design tokens are included in the official CSS build pipeline.');
check(!builder.includes("css = css.replace(/\\s*!important\\b/gi, '')"), 'The build no longer silently strips !important declarations.');
check(builder.includes('resolve the cascade conflict explicitly'), 'Unexpected !important declarations fail with an actionable error.');
for (const token of ['--sys-surface-canvas', '--sys-content-primary', '--sys-accent', '--sys-state-success', '--sys-radius-md', '--sys-space-3', '--sys-font-body', '--sys-motion-standard', '--sys-focus-ring']) {
  check(tokens.includes(token), `Semantic token ${token} is defined.`);
  check(bundle.includes(token), `Semantic token ${token} is present in the generated bundle.`);
}
check(tokens.includes('@media (prefers-reduced-motion: reduce)'), 'Motion tokens respect reduced-motion preference.');
check(!/!important\b/i.test(bundle), 'The generated stylesheet contains no !important declarations.');
const requiredSources = [...builder.matchAll(/'((?:css)\/[^']+\.css)'/g)].map(m => m[1]);
const missing = [...new Set(requiredSources)].filter(source => !fs.existsSync(path.join(ROOT, source)));
check(missing.length === 0, `Every explicitly listed CSS source exists${missing.length ? `: ${missing.join(', ')}` : '.'}`);
if (failures) process.exitCode = 1;
else console.log('Design-system contract checks passed.');
