'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }

const version = read('VERSION').trim();
const packageJSON = JSON.parse(read('package.json'));
const app = read('js/legacy/app-controller.js');
const palettes = read('css/themes/palettes.css');
const themeCSS = read('css/themes/obsidian-couture.css');
const rewardCSS = read('css/refinements/rewards-beauty.css');
const citadelCSS = read('css/refinements/rewards-citadel.css');
const build = read('scripts/build-css.js');
const bundle = read('css/system.css');
const sw = read('sw.js');

check(/^\d+\.\d+\.\d+$/.test(version), 'release version uses semantic versioning.');
check(packageJSON.version === version, 'Package version must match the canonical release version.');
check(/"id":\s*"couture"/.test(app), 'Obsidian Couture must be registered as a theme.');
check(/"name":\s*"Obsidian Couture"/.test(app), 'Theme registry should expose the intended theme label.');
check(app.includes('localStorage.setItem("system_v2_theme", entry.id)'), 'Theme selection must use the existing persistent preference key.');
for (const id of ['cosmic', 'royal', 'aurora', 'abyss', 'ice', 'crimson', 'emerald', 'solar', 'sakura']) {
  check(app.includes(`"id": "${id}"`), `Existing theme ${id} must remain in the registry.`);
}
check(palettes.includes(':not([data-system-theme="couture"])'), 'New theme must not receive the legacy hue-blend overlay.');
check(themeCSS.includes('html[data-system-theme="couture"]'), 'New palette rules must be scoped to the optional theme.');
check(themeCSS.includes('#e6c77d') && themeCSS.includes('#5da9ff'), 'Couture should combine champagne reward accents with sapphire light.');
check(themeCSS.includes('@media (max-width: 760px)'), 'Theme should include a responsive mobile refinement.');
check(themeCSS.includes('@media (prefers-reduced-motion: reduce)'), 'Theme should respect reduced-motion preferences.');
check(rewardCSS.includes('#system-app #rewards-page .selected-reward'), 'Reward detail panel should receive a dedicated visual refinement.');
check(rewardCSS.includes('@media (max-width: 420px)'), 'Reward cards should adapt to narrow phones.');
check(citadelCSS.includes('.rp-r-legendary') && citadelCSS.includes('.rp-r-epic') && citadelCSS.includes('.rp-r-rare'), 'Reward rarity tiers have distinct collectible styling.');
check(citadelCSS.includes('@media (prefers-reduced-motion: reduce)'), 'Reward visual upgrade respects reduced-motion preferences.');
check(build.includes('css/refinements/rewards-beauty.css') && build.includes('css/themes/obsidian-couture.css') && build.includes('css/refinements/apex-finish.css') && build.includes('css/refinements/atelier-pro.css') && build.includes('css/refinements/rewards-citadel.css'), 'All premium design layers must be included in the build.');
check(bundle.includes('Source: css/refinements/rewards-beauty.css'), 'Runtime stylesheet must contain shared Rewards polish.');
check(bundle.includes('Source: css/themes/obsidian-couture.css'), 'Runtime stylesheet must contain the theme rules.');
check(bundle.includes('Source: css/refinements/apex-finish.css'), 'Runtime stylesheet must contain the Apex Finish layer.');
check(bundle.includes('Source: css/refinements/atelier-pro.css') && bundle.includes('Source: css/refinements/rewards-citadel.css'), 'Runtime stylesheet must contain the Atelier Pro design layer.');
check(sw.includes('css/themes/obsidian-couture.css') && sw.includes('css/refinements/rewards-beauty.css') && sw.includes('css/refinements/apex-finish.css') && sw.includes('css/refinements/atelier-pro.css') && sw.includes('css/refinements/rewards-citadel.css'), 'Offline cache must include the latest design layers.');
check(!/!important\b/i.test(bundle), 'Generated runtime CSS must not contain !important.');
check(read('index.html').includes('data-system-theme="cosmic"'), 'Fresh installs should retain the original Cosmic theme default.');

console.log(`SYSTEM Obsidian Couture checks passed: ${checks} checks.`);
