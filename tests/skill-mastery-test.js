'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/core/skill-mastery.js'), 'utf8');
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function equal(a, b, message) { assert.equal(a, b, message); checks++; }
class MemoryStorage {
  constructor() { this.map = new Map(); this.fail = false; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { if (this.fail) throw new Error('quota'); this.map.set(k, String(v)); }
}
const storage = new MemoryStorage();
const window = { localStorage: storage, SYSTEMSkillCurriculum: { computer: { 1: [{ id: 'python-basics', fa: 'مبانی پایتون', en: 'Python basics', children: [] }] } }, SYSTEMSkillCurriculumTools: { flatten(nodes, output = []) { (nodes || []).forEach(node => { output.push(node); this.flatten(node.children, output); }); return output; } } };
const context = { window, Date, JSON, Object, Array, Number, String, Math, Set };
vm.createContext(context); vm.runInContext(source, context);
const api = window.SYSTEMSkillMastery;
async function main() {
check(!!api, 'Mastery API should attach to window.');
equal((await api.record({ stat: 'unknown', type: 'test', score: 90 })).error, 'invalid-stat', 'Unknown skill branches must be rejected.');
equal((await api.record({ stat: 'computer', type: 'exam', score: 90 })).error, 'invalid-type', 'Unknown assessment types must be rejected.');
equal((await api.record({ stat: 'computer', type: 'test', score: 101 })).error, 'invalid-score', 'Scores above 100 must be rejected.');
equal((await api.record({ stat: 'computer', type: 'test', score: -1 })).error, 'invalid-score', 'Negative scores must be rejected.');
check((await api.record({ stat: 'computer', type: 'practice', score: 85 })).ok, 'Valid practice should save.');
check((await api.record({ stat: 'computer', skillId: 'python-basics', skillTitle: 'Python fundamentals', type: 'test', score: 88, evidence: true })).ok, 'Per-skill assessment with evidence should save.');
equal(api.skillSummary('python-basics').status, 'evidence-recorded', 'A single evidence-backed assessment should not certify mastery.');
equal(api.skillSummary('python-basics').title, 'Python fundamentals', 'Per-skill summary should preserve the display title.');
const catalog = api.catalog('computer');
equal(catalog.length, 1, 'Catalog should return official curriculum skills for a Stat.');
equal(catalog[0].id, 'python-basics', 'Catalog should preserve stable curriculum IDs.');
check((await api.record({ stat: 'computer', skillId: 'python-basics', skillTitle: 'Python basics', questId: 'quest-python-1', type: 'project', score: 91, evidence: true })).ok, 'Quest-linked evidence should save.');
equal((await api.record({ stat: 'computer', skillId: 'python-basics', skillTitle: 'Python basics', questId: 'quest-python-1', type: 'project', score: 95, evidence: true })).error, 'duplicate-quest-evidence', 'Duplicate evidence for a skill and quest must be blocked.');
equal((await api.record({ stat: 'computer', skillId: 'bad id', skillTitle: 'Bad ID', type: 'test', score: 90 })).error, 'invalid-skill', 'Unsafe skill identifiers should be rejected.');
check((await api.record({ stat: 'computer', type: 'project', score: 85, evidence: true, note: '<script>bad</script>' })).ok, 'Valid project evidence should save.');
check(api.summary().byStat.computer.ready, 'Two recent assessments averaging at least 80 with project evidence should produce a readiness candidate.');
check(!api.summary().byStat.mathematics.ready, 'No assessment data must not indicate readiness.');
equal(api.summary().readyCount, 1, 'Only qualifying skill should count as readiness candidate.');
const exported = JSON.parse(api.exportJSON());
equal(exported.formatVersion, 1, 'Export format version should be explicit.');
equal(exported.assessments.length, 4, 'Export should include assessment records.');
check(exported.assessments.some(item => item.note.includes('<script>')), 'API should preserve note text as data; UI must escape it when rendering.');
storage.fail = true;
const failed = await api.record({ stat: 'physics', type: 'test', score: 99, evidence: true });
equal(failed.error, 'storage-unavailable', 'Storage failure should be reported.');
equal(api.summary().total, 4, 'Failed writes must roll back in-memory state.');
storage.fail = false;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
check(html.includes('data-status-tool="skill-mastery"'), 'Mastery Tracker should be discoverable from Status More.');
const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
check(app.includes('./core/skill-mastery.js'), 'Mastery module should load before UI initialization.');
const ui = fs.readFileSync(path.join(ROOT, 'js/features/status-more.js'), 'utf8');
check(ui.includes('name=\"skillTitle\"') && ui.includes('name=\"skillId\"'), 'Mastery UI should collect exact skill title and stable ID.');
check(ui.includes('Ready for review') && ui.includes('not independently verified mastery'), 'UI must distinguish readiness from verified mastery.');
console.log(`Skill mastery tests passed: ${checks} checks.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
