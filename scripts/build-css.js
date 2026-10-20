#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const SOURCES = [
  'css/foundation/bilingual.css', 'css/foundation/variables.css', 'css/foundation/design-tokens.css', 'css/foundation/reset.css', 'css/foundation/layout.css', 'css/foundation/components.css',
  'css/foundation/animations.css', 'css/features/apex-evolution.css', 'css/pages/skills.css', 'css/pages/quest.css', 'css/pages/rewards.css',
  'css/pages/ai.css', 'css/pages/settings.css', 'css/features/personal-profile-settings.css', 'css/features/system-update.css', 'css/foundation/style.css', 'css/foundation/responsive.css',
  'css/pages/status-reference.css', 'css/themes/aurora.css', 'css/refinements/polish.css', 'css/refinements/crystal.css',
  'css/themes/palettes.css', 'css/features/experience.css', 'css/features/rewards-plus.css', 'css/features/royal.css',
  'css/features/grok-suite.css', 'css/refinements/mobile.css', 'css/refinements/refinement.css', 'css/refinements/beauty-foundation.css',
  'css/refinements/beauty-refinement.css', 'css/refinements/beauty-signature.css', 'css/refinements/precision-foundation.css', 'css/refinements/precision-refinement.css',
  'css/pages/status.css', 'css/themes/theme-picker.css', 'css/themes/royal.css', 'css/refinements/rewards-elite.css',
  'css/refinements/apex-style.css',
  'css/refinements/mobile-premium.css',
  'css/refinements/layout-organization.css',
  'css/refinements/status-declutter.css',
  'css/refinements/skill-review-refinement.css',
  'css/refinements/skill-mastery-refinement.css',
  'css/refinements/smart-roadmap-layout.css',
  'css/refinements/smart-roadmap-refinement.css',
  'css/features/rewards-ascension.css',
  'css/refinements/rewards-couture.css',
  'css/refinements/rewards-beauty.css',
  'css/themes/obsidian-couture.css', 'css/themes/theme-forge.css', 'css/refinements/apex-finish.css', 'css/refinements/atelier-nocturne.css', 'css/refinements/atelier-pro.css',
  'css/refinements/rewards-citadel.css', 'css/features/goal-progress.css', 'css/refinements/command-deck.css',
  'css/refinements/beauty-apex.css', 'css/themes/aether-luxe.css', 'css/features/rebirth-core.css', 'css/refinements/theme-atelier-foundation.css', 'css/refinements/theme-atelier-signature.css', 'css/refinements/theme-engine-advanced.css',
  'css/refinements/status-refinement.css', 'css/refinements/rewards-miniature.css', 'css/refinements/reduced-motion-override.css', 'css/features/visual-effects.css', 'css/refinements/adaptive-learning-path.css', 'css/refinements/phase24-performance.css', 'css/refinements/mobile-nav-integrity.css'
];
const uniqueSources = [...new Set(SOURCES)];
const rewriteUrls = (css, sourcePath) => css.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (whole, quote, rawValue) => {
  const raw = String(rawValue || '').trim();
  if (!raw || /^(?:data:|https?:|\/\/|#|blob:|var\()/i.test(raw)) return whole;
  const base = raw.split(/[?#]/, 1)[0];
  const appPath = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), base));
  if (appPath === '..' || appPath.startsWith('../')) return whole;
  const suffix = raw.slice(base.length);
  const rewritten = `../${appPath}${suffix}`;
  return `url(${quote || '"'}${rewritten}${quote || '"'})`;
});
let output = '/* Generated runtime CSS bundle. Edit source fragments, then run: npm run build:css */\n';
output += '@layer system;\n\n@layer system {\n';
for (const source of uniqueSources) {
  const abs = path.join(ROOT, source);
  if (!fs.existsSync(abs)) throw new Error(`Missing CSS source file: ${source}`);
  let css = fs.readFileSync(abs, 'utf8');
  css = rewriteUrls(css, source);
  if (/!important\b/i.test(css)) {
    throw new Error(`Source stylesheet contains !important; resolve the cascade conflict explicitly instead of stripping it: ${source}`);
  }
  output += `\n/* Source: ${source} */\n${css}\n`;
}
output += '\n} /* end layer: system */\n';
fs.writeFileSync(path.join(ROOT, 'css/system.css'), output);
const importantCount = (output.match(/!important\b/gi) || []).length;
if (importantCount !== 0) throw new Error(`Generated CSS unexpectedly contains ${importantCount} !important declarations.`);
console.log(`Built css/system.css from ${uniqueSources.length} source sheets; source declarations are preserved and no !important declarations were needed.`);
