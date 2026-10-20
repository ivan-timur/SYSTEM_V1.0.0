'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const controller = read('js/legacy/app-controller.js');
const css = read('css/refinements/theme-engine-advanced.css');
const builder = read('scripts/build-css.js');
const expected = ['cosmic','aether','couture','royal','aurora','abyss','ice','crimson','emerald','solar','sakura'];
for (const id of expected) {
  assert.ok(controller.includes(`"id": "${id}"`), `missing registered theme ${id}`);
}
assert.match(controller, /new CustomEvent\("system:themechange"/,
  'theme changes should expose a decoupled event for optional features');
assert.match(controller, /root\.dataset\.systemThemeName = entry\.name/,
  'active theme name should be reflected accessibly in the document state');
assert.match(controller, /aria-label="\$\{escapeHTML\(t\.name\)\} theme:/,
  'theme picker choices need descriptive accessible names');
assert.match(controller, /--theme-swatch-start:/,
  'each picker swatch must preserve its own palette independent of active theme');
assert.match(css, /\.system-theme-options > button\.is-selected/,
  'selected theme must have a distinct active state');
assert.match(css, /prefers-reduced-motion:\s*reduce/,
  'theme picker must honor reduced motion');
assert.match(css, /max-width:\s*620px/,
  'theme picker must retain mobile layout support');
assert.ok(builder.includes('css/refinements/theme-engine-advanced.css'),
  'advanced theme engine stylesheet must be included in CSS build');
const bundle = read('css/system.css');
assert.ok(bundle.includes('Phase 36 — Advanced Theme Engine polish'),
  'generated CSS bundle must contain the advanced theme engine layer');
console.log('PASS advanced theme engine: 11 theme identities, change event, accessible picker, independent swatches, selected state, responsive and reduced-motion contracts.');
