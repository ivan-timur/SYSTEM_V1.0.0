'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const source = read('css/refinements/theme-atelier-signature.css');
const builder = read('scripts/build-css.js');
const registry = read('js/legacy/app-controller.js');
const bundle = read('css/system.css');
for (const id of ['cosmic','aether','couture','royal','aurora','abyss','ice','crimson','emerald','solar','sakura']) {
  assert.ok(registry.includes(`"id": "${id}"`), `existing theme ${id} must remain registered`);
}
assert.ok(builder.includes("'css/refinements/theme-atelier-foundation.css', 'css/refinements/theme-atelier-signature.css', 'css/refinements/theme-engine-advanced.css',\n  'css/refinements/status-refinement.css', 'css/refinements/rewards-miniature.css', 'css/refinements/reduced-motion-override.css'"), 'theme, status, and reward layers must precede the final reduced-motion safeguards');
assert.ok(bundle.includes('ATELIER SIGNATURE: refined material'), 'built CSS bundle should include the theme signature layer');
assert.match(source, /:focus-visible/, 'keyboard focus should be visible');
assert.match(source, /prefers-reduced-motion:\s*reduce/, 'reduced-motion support must be preserved');
assert.match(source, /hover:\s*hover.*pointer:\s*fine/s, 'lift effects should be limited to hover-capable devices');
assert.doesNotMatch(source, /!important\s*;/, 'new layer must avoid important overrides');
console.log('PASS theme atelier signature: all 11 theme IDs retained; signature layer, focus visibility, reduced-motion, and touch restraint verified.');
