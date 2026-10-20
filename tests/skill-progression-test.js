'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/core/skill-curriculum.js'), 'utf8');
const appEntry = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const appLegacy = fs.readFileSync(path.join(ROOT, 'js/legacy/app-controller.js'), 'utf8');
const skillCss = fs.readFileSync(path.join(ROOT, 'css/pages/skills.css'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'js/core/skill-curriculum.js' });
const curriculum = sandbox.window.SYSTEMSkillCurriculum;
const expectedStats = ['entrepreneurship', 'global-skills', 'mathematics', 'computer', 'physics', 'unique-thinking'];
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }

check(Boolean(curriculum), 'The detailed skill curriculum should be exposed to the app.');
check(appEntry.indexOf('./core/skill-curriculum.js') < appEntry.indexOf('./legacy/app-controller.js'), 'The catalogue must load before the legacy Status controller.');
check(appLegacy.includes('function getSkillXPRequired(level)'), 'Skill levels need their own XP curve.');
check(appLegacy.includes('normalizeSavedSkillProgress(data.skillProgress)'), 'Skill progression should be validated and restored from saved data.');
check(appLegacy.includes('schemaVersion: 3'), 'Save data should use the skill-progress schema version.');
check(appLegacy.includes('function applyProgressionReward(reward = {})'), 'Every XP-bearing mission should use the central progression pipeline.');
const ledgerStart = appLegacy.indexOf('function recordSystemEvent(event = {}) {');
const ledgerEnd = appLegacy.indexOf('/* Read-only activity ledger API');
check(ledgerStart >= 0 && ledgerEnd > ledgerStart && !appLegacy.slice(ledgerStart, ledgerEnd).includes('awardSkillProgressFromActivity('), 'Activity logging must not secretly mutate skill progression.');
check(appLegacy.includes('function getAvailableSkillPath(path, nodeIndex)'), 'Skill XP application must validate declared prerequisites.');
check(appLegacy.includes('const path = getAvailableSkillPath(candidatePath, nodeIndex);'), 'Skill progression must pass through the prerequisite guard.');
check(appLegacy.includes('if (!scored.length) return [];') && appLegacy.includes('do not guess'), 'Generic or ambiguous activities must not be assigned to arbitrary least-practised skills.');
check(appLegacy.includes('An explicitly selected skill is authoritative'), 'An invalid explicit skill ID must fail closed instead of triggering title-based reassignment.');
check(appLegacy.includes('if (overlap >= 2)'), 'A single shared word must not be enough to assign XP to a skill.');
check(appLegacy.includes('best.score - runnerUp.score < 25'), 'Ambiguous title matches must not silently choose one curriculum node.');

// Exercise the real title-to-skill matcher with a small synthetic curriculum.
const matcherSource = appLegacy.slice(
    appLegacy.indexOf('function normalizeSkillSearchText(value) {'),
    appLegacy.indexOf('function getAvailableSkillPath(path, nodeIndex) {')
);
const matcherNodes = new Map([
    ['mathematics-root', { id: 'mathematics-root', statName: 'mathematics', path: ['mathematics-root'], fa: 'ریاضی', en: 'Mathematics', root: {} }],
    ['math-algebra-i', { id: 'math-algebra-i', path: ['mathematics-root', 'math-algebra-i'], fa: 'جبر یک', en: 'Algebra I' }],
    ['math-linear-equations', { id: 'math-linear-equations', path: ['mathematics-root', 'math-algebra-i', 'math-linear-equations'], fa: 'معادلات خطی', en: 'Linear Equations' }],
    ['computer-root', { id: 'computer-root', statName: 'computer', path: ['computer-root'], fa: 'کمپیوتر', en: 'Computer', root: {} }],
    ['computer-logic', { id: 'computer-logic', path: ['computer-root', 'computer-logic'], fa: 'منطق برنامه نویسی', en: 'Programming Logic' }]
]);
const matcherSandbox = { buildSkillNodeIndex: () => matcherNodes };
vm.createContext(matcherSandbox);
vm.runInContext(matcherSource, matcherSandbox);
check(matcherSandbox.getActivitySkillPath('mathematics', 'Practice Algebra I', null).at(-1) === 'math-algebra-i', 'A clear exact skill phrase should map to the matching skill.');
check(matcherSandbox.getActivitySkillPath('mathematics', 'work on functions', null).length === 0, 'A generic activity with no curriculum match must not receive a guessed skill.');
check(matcherSandbox.getActivitySkillPath('mathematics', 'Practice Algebra I', 'computer-logic').length === 0, 'An explicit skill ID from another stat must not be reassigned by title matching.');
check(matcherSandbox.getActivitySkillPath('mathematics', 'Practice Algebra I', 'missing-skill-id').length === 0, 'An unknown explicit skill ID must fail closed.');
check(skillCss.includes('.skill-subnode-card') && skillCss.includes('.skill-node-progress-track'), 'Nested curriculum and individual XP bars should have dedicated styling.');

const ids = new Set();
const allNodes = [];
for (const stat of expectedStats) {
    check(Boolean(curriculum[stat]), `The ${stat} curriculum should exist.`);
    const branches = Object.keys(curriculum[stat]).map(Number).sort((a, b) => a - b);
    check(branches.length === 20 && branches.every((value, index) => value === index + 1), `${stat} should contain all 20 main skill branches.`);
    for (let branch = 1; branch <= 20; branch++) {
        const nodes = curriculum[stat][branch];
        const flattenedBranch = sandbox.window.SYSTEMSkillCurriculumTools.flatten(nodes);
        check(Array.isArray(nodes) && flattenedBranch.length >= 3, `${stat} branch ${branch} should contain detailed subskills.`);
        for (const node of flattenedBranch) {
            check(!ids.has(node.id), `Curriculum node ID should be globally unique: ${node.id}`);
            ids.add(node.id);
            allNodes.push(node);
            check(Boolean(node.fa && node.en), `Node ${node.id} needs Persian and English labels.`);
        }
    }
}
const knownIds = new Set(allNodes.map(node => node.id));
for (const node of allNodes) {
    for (const requirement of node.requires || []) {
        check(knownIds.has(requirement.id), `Prerequisite ${requirement.id} for ${node.id} must exist.`);
        check(Number(requirement.level) >= 1, `Prerequisite for ${node.id} needs a valid level.`);
    }
}
const algebraBranch = curriculum.mathematics[2];
const algebraIds = sandbox.window.SYSTEMSkillCurriculumTools.flatten(algebraBranch).map(node => node.id);
check(algebraIds.includes('math-algebra-i'), 'Mathematics should include Algebra I.');
check(algebraIds.includes('math-algebra-ii'), 'Mathematics should include Algebra II.');
check(algebraIds.includes('math-a1-linear-equations'), 'Algebra I should break down into specific topics.');
check(algebraIds.includes('math-a2-quadratics'), 'Algebra II should break down into specific topics.');
check(allNodes.length >= 400, 'The curriculum should cover hundreds of individual learning topics.');

console.log(`SYSTEM skill progression tests passed: ${checks} checks across ${allNodes.length} curriculum nodes.`);
