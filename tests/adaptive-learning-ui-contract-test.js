'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js/features/adaptive-learning-ui.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cssBuild = fs.readFileSync(path.join(root, 'scripts/build-css.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/refinements/adaptive-learning-path.css'), 'utf8');
const checks = [
  [app.includes('recommendAdaptiveLearningPath'), 'The adaptive planner is imported into the live application entry.'],
  [app.includes('evaluateLearningCycle') && app.includes('SYSTEMLearningCycle'), 'The joined learning-cycle domain is published for the live app.'],
  [app.includes('SYSTEMAdaptiveLearning') && app.includes('./features/adaptive-learning-ui.js'), 'The UI bridge is registered and loaded after legacy goal/quest modules.'],
  [ui.includes('system_v2_goals') && ui.includes('system_v2_custom_quests') && ui.includes('system_v2_skill_assessments'), 'The bridge reads real saved goal, quest and assessment records.'],
  [ui.includes('SYSTEMGoalProgress?.evaluateLegacyCurriculum') && ui.includes('toLegacyCurriculum'), 'Active-goal milestone progress is projected through the curriculum evaluator.'],
  [ui.includes('SYSTEMLearningCycle.evaluate') && ui.includes('cycle.learningPlan'), 'Live quest recommendations run through the joined goal-to-quest learning cycle.'],
  [ui.includes('linksBySkill') && ui.includes('milestoneId: link && typeof link.milestoneId') && ui.includes('goalId: link && typeof link.goalId'), 'Skill-to-goal links are supplied only from explicit quest links.'],
  [ui.includes('SYSTEMSkillMastery?.skillSummary'), 'Skill verification uses the mastery readiness contract, not XP or clicks.'],
  [ui.includes('reward issued: no') && ui.includes('rewardIssued'), 'Recommendations remain explicitly separate from rewards.'],
  [ui.includes('data-quest-id') && ui.includes('scrollIntoView'), 'Recommendation action navigates to an existing quest card.'],
  [ui.includes('replaceChildren') && !ui.includes('results.innerHTML'), 'Recommendation content is built with DOM text nodes, not injected HTML.'],
  [cssBuild.includes('css/refinements/adaptive-learning-path.css'), 'Adaptive panel styles are included in the generated CSS.'],
  [css.includes('@media (max-width: 600px)') && css.includes('prefers-reduced-motion'), 'Adaptive panel supports small screens and reduced-motion preferences.'],
  [html.includes('id="quest-page"'), 'Quest page mount point exists.']
];
for (const [ok, message] of checks) assert.ok(ok, message);
console.log(`Adaptive learning UI contract tests passed: ${checks.length} checks.`);
