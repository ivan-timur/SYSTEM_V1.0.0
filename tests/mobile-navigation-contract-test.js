'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'css/foundation/responsive.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const mobileStart = css.indexOf('/* On phones, use a persistent five-item navigation dock. */');
assert.notEqual(mobileStart, -1, 'mobile navigation block must exist');
const mobileCss = css.slice(mobileStart);
assert.match(mobileCss, /#system-app\s+\.sidebar\s*\{[^}]*bottom:\s*0[^}]*left:\s*0[^}]*right:\s*0[^}]*width:\s*100%/, 'mobile nav container must stay anchored to the viewport');
assert.match(mobileCss, /#system-app\s+\.sidebar-nav\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/, 'mobile navigation must retain five equal columns');
assert.match(mobileCss, /#system-app\s+\.nav-item\s*\{[^}]*min-width:\s*0[^}]*min-height:\s*56px/, 'nav items must shrink safely and retain a 56px minimum height');
assert.match(mobileCss, /#system-app\s+\.nav-item\s+img[^}]*width:\s*23px[^}]*height:\s*23px/, 'nav icons must have stable dimensions');
assert.match(mobileCss, /#system-app\s+\.main-content\s*\{[^}]*padding:[^}]*calc\(100px\s*\+\s*env\(safe-area-inset-bottom\)\)/, 'content must leave room for the fixed navigation and device safe area');
for (const page of ['status', 'quest', 'rewards', 'ai', 'settings']) {
  assert.match(html, new RegExp(`class="nav-item[^\"]*" data-page="${page}"`), `navigation item for ${page} must exist`);
}
assert.match(packageJson.scripts['test:static'], /mobile-navigation-contract-test\.js/, 'mobile navigation contract must run in the static suite');
console.log('Mobile navigation contract tests passed (5 destinations, fixed dock, equal columns, icon sizing, safe-area spacing).');
