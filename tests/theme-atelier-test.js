'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const source = read('css/refinements/theme-atelier-foundation.css');
const bundle = read('css/system.css');
const builder = read('scripts/build-css.js');
const legacy = read('js/legacy/app-controller.js');
const expected = ['cosmic','aether','couture','royal','aurora','abyss','ice','crimson','emerald','solar','sakura'];
for (const id of expected) {
  assert.ok(legacy.includes(`"id": "${id}"`), `theme registry missing ${id}`);
  assert.ok(source.includes(`html[data-system-theme="${id}"]`), `atelier palette missing ${id}`);
}
assert.ok(builder.includes("'css/refinements/theme-atelier-foundation.css', 'css/refinements/theme-atelier-signature.css', 'css/refinements/theme-engine-advanced.css',\n  'css/refinements/status-refinement.css', 'css/refinements/rewards-miniature.css', 'css/refinements/reduced-motion-override.css'"), 'atelier and advanced theme layers must precede status, reward, and reduced-motion safeguards');
assert.ok(bundle.includes('THEME ATELIER / HIGH-FINISH VISUAL PASS'), 'built CSS bundle missing the new theme layer');
assert.match(source, /html\[data-system-theme\]::after\s*\{\s*content:\s*none;\s*display:\s*none;/, 'old whole-page hue wash must be disabled');
assert.match(source, /prefers-reduced-motion:\s*reduce/, 'reduced-motion support missing');
assert.match(source, /max-width:\s*620px/, 'mobile breakpoints missing');
assert.doesNotMatch(source, /!important\s*;/, 'avoid important overrides in source styles');
for (const page of ['status','quest','rewards','ai','settings']) {
  assert.ok(source.includes(`var(--${page === 'status' ? 'status' : page}-background-image)`), `missing background-image preservation for ${page}`);
}
const variables = read('css/foundation/variables.css');
assert.match(variables, /--status-background-image:\s*url\("\.\.\/\.\.\/assets\/images\/backgrounds\/status-bg\.webp"\)/, 'status page should use its dedicated artwork');
assert.match(variables, /--system-background-image:\s*url\("\.\.\/\.\.\/assets\/images\/backgrounds\/status-bg\.webp"\)/, 'main app backdrop should use status artwork');
console.log('PASS theme atelier: all 11 theme identities preserved; page artwork, theme isolation, responsive, and reduced-motion rules verified.');
