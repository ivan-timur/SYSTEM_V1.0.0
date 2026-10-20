'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/core/smart-roadmap.js'), 'utf8');
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks++; }
class MemoryStorage {
  constructor() { this.map = new Map(); this.fail = false; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { if (this.fail) throw new Error('quota'); this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}
function createApi(storage = new MemoryStorage()) {
  const listeners = {};
  class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } }
  const window = {
    localStorage: storage,
    CustomEvent,
    addEventListener(type, callback) { (listeners[type] ||= []).push(callback); },
    dispatchEvent(event) { for (const callback of listeners[event.type] || []) callback(event); return true; }
  };
  const context = { window, Date, JSON, Object, Array, Number, String, Math, Set, Map };
  vm.createContext(context); vm.runInContext(source, context);
  return { api: window.SYSTEMSmartRoadmap, storage, listeners, window };
}
const { api, storage, listeners, window } = createApi();
check(!!api, 'Roadmap API attaches to window.');
equal(api.add({ title: '   ', stat: 'computer' }).error, 'invalid-title', 'Empty title is rejected.');
equal(api.add({ title: 'Bad branch', stat: 'not-a-stat' }).error, 'invalid-stat', 'Unknown branch is rejected.');
equal(api.add({ title: 'Bad priority', stat: 'computer', priority: 'urgent' }).error, 'invalid-priority', 'Unknown priority is rejected.');
equal(api.add({ title: 'Bad date', stat: 'computer', dueDate: 'tomorrow' }).error, 'invalid-date', 'Malformed date is rejected.');
equal(api.add({ title: 'Impossible date', stat: 'computer', dueDate: '2026-02-30' }).error, 'invalid-date', 'Impossible calendar dates are rejected.');
const first = api.add({ title: 'Learn Python', stat: 'computer', priority: 'high', dueDate: '2099-01-01', note: '<script>x</script>' });
check(first.ok, 'Valid milestone is saved.');
check(api.add({ title: 'Practise algebra', stat: 'mathematics', priority: 'normal' }).ok, 'Second milestone is saved.');
equal(api.summary().total, 2, 'Summary counts milestones.');
equal(api.summary().percent, 0, 'New milestones are initially incomplete.');
check(api.setStatus(first.item.id, 'doing').ok, 'Milestone can enter in-progress state.');
check(api.setStatus(first.item.id, 'done').ok, 'Milestone can be completed.');
equal(api.summary().done, 1, 'Completed milestone is counted.');
equal(api.summary().percent, 50, 'Completion percentage is rounded correctly.');
equal(api.setStatus(first.item.id, 'unknown').error, 'invalid-status', 'Invalid status is rejected.');
const list = api.list();
check(list[0].priority === 'normal' || list[0].status === 'done', 'Milestones are returned in prioritized order with unfinished tasks first.');
const updated = api.update(first.item.id, { title: 'Learn Python well', note: 'Build a practical project', stat: 'computer', priority: 'high', dueDate: '2099-01-01' });
check(updated.ok, 'A milestone can be edited.');
equal(api.list().find(item => item.id === first.item.id).title, 'Learn Python well', 'The edited title is persisted.');
equal(api.list().find(item => item.id === first.item.id).status, 'done', 'Editing content preserves completion status.');
equal(api.update('missing-id', { title: 'nope' }).error, 'not-found', 'Editing a missing milestone is rejected.');
equal(api.update(first.item.id, { title: 'bad date', stat: 'computer', priority: 'high', dueDate: '2025-13-01' }).error, 'invalid-date', 'Editing cannot write impossible dates.');
const exported = JSON.parse(api.exportJSON());
equal(exported.formatVersion, 1, 'Export format remains versioned and backward compatible.');
equal(exported.milestones.length, 2, 'Export includes roadmap items.');
check(first.item.note.includes('<script>'), 'Untrusted note text is preserved as data; UI must escape before rendering.');
const sameBackup = api.importJSON(JSON.stringify(exported), { mode: 'merge' });
check(sameBackup.ok, 'A valid exported backup can be imported.');
equal(sameBackup.imported, 0, 'Merging the same backup is idempotent.');
equal(sameBackup.skipped, 2, 'Identical imported milestones are skipped, not duplicated.');
equal(api.importJSON('{bad json').error, 'invalid-json', 'Malformed JSON is rejected.');
equal(api.importJSON(JSON.stringify({ app: 'OTHER', formatVersion: 1, milestones: [] })).error, 'invalid-backup', 'Non-SYSTEM backup is rejected.');
const invalidDateBackup = JSON.parse(api.exportJSON());
invalidDateBackup.milestones[0].dueDate = '2026-02-31';
equal(api.importJSON(JSON.stringify(invalidDateBackup)).error, 'invalid-item', 'Imported impossible dates are rejected atomically.');
const addedItem = { ...exported.milestones[0], id: 'imported-milestone-1', title: 'Imported maths project', stat: 'mathematics', status: 'todo', dueDate: '', completedAt: '', createdAt: new Date().toISOString() };
const extraBackup = JSON.stringify({ app: 'SYSTEM', formatVersion: 1, exportedAt: new Date().toISOString(), milestones: [addedItem] });
const mergeResult = api.importJSON(extraBackup, { mode: 'merge' });
check(mergeResult.ok, 'Valid backup can merge new milestones.');
equal(mergeResult.imported, 1, 'Merge reports the number of newly imported milestones.');
equal(api.summary().total, 3, 'Merged milestones are added without overwriting existing data.');
equal(api.importJSON(extraBackup, { mode: 'unknown' }).error, 'invalid-mode', 'Unknown import mode is rejected.');
equal(api.importJSON('x'.repeat(512 * 1024 + 1)).error, 'backup-too-large', 'Oversized JSON input is rejected before parsing.');
const beforeReplace = api.summary().total;
const replaceBackup = JSON.stringify({ app: 'SYSTEM', formatVersion: 1, milestones: [addedItem] });
const replaceResult = api.importJSON(replaceBackup, { mode: 'replace' });
check(replaceResult.ok, 'Confirmed replace mode is supported by the data API.');
equal(api.summary().total, 1, 'Replace mode replaces the roadmap atomically.');
// Restore a multiple-item fixture for subsequent persistence checks.
check(api.importJSON(JSON.stringify(exported), { mode: 'replace' }).ok, 'A complete backup can replace the current roadmap.');
equal(api.summary().total, beforeReplace - 1, 'Restoring a backup returns the stored roadmap to its exported size.');
storage.fail = true;
equal(api.add({ title: 'Should fail', stat: 'physics' }).error, 'storage-unavailable', 'Storage errors are reported.');
equal(api.summary().total, 2, 'Failed writes roll back memory.');
equal(api.importJSON(extraBackup).error, 'storage-unavailable', 'Failed backup import rolls back memory.');
equal(api.summary().total, 2, 'Failed import preserves existing in-memory data.');
storage.fail = false;
check(api.remove(first.item.id).ok, 'Milestone can be removed.');
equal(api.remove(first.item.id).error, 'not-found', 'Missing milestone removal is rejected.');
check((listeners.storage || []).length === 1, 'Cross-tab storage listener is installed.');
let externalAnnounced = false;
window.addEventListener('system-roadmap-updated', event => { if (event.detail && event.detail.external === true) externalAnnounced = true; });
storage.setItem('system_v2_smart_roadmap', JSON.stringify([]));
for (const callback of listeners.storage || []) callback({ key: 'system_v2_smart_roadmap' });
equal(api.summary().total, 0, 'Cross-tab storage changes refresh the roadmap data.');
check(externalAnnounced, 'Cross-tab refresh emits an explicit external-update signal.');

// Deadline intelligence: overdue and due-today work rises above ordinary tasks.
const deadlineApi = createApi().api;
const day = offset => { const date = new Date(); date.setDate(date.getDate() + offset); return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); };
const futureTask = deadlineApi.add({ title: 'Future task', stat: 'computer', priority: 'high', dueDate: day(4) });
const todayTask = deadlineApi.add({ title: 'Due today', stat: 'physics', priority: 'low', dueDate: day(0) });
const overdueTask = deadlineApi.add({ title: 'Overdue task', stat: 'mathematics', priority: 'low', dueDate: day(-2) });
check(futureTask.ok && todayTask.ok && overdueTask.ok, 'Deadline fixtures are saved.');
const deadlineOrder = deadlineApi.list().map(item => item.title);
equal(deadlineOrder[0], 'Overdue task', 'Overdue tasks rank ahead of due-today and future work.');
equal(deadlineOrder[1], 'Due today', 'Due-today tasks rank ahead of ordinary future work.');
const deadlineSummary = deadlineApi.summary();
equal(deadlineSummary.overdue, 1, 'Deadline summary counts overdue tasks.');
equal(deadlineSummary.dueToday, 1, 'Deadline summary counts tasks due today.');
equal(deadlineSummary.dueSoon, 2, 'Deadline summary counts tasks due within seven days, including today.');
equal(deadlineSummary.nextDeadline, day(0), 'Next deadline identifies the nearest non-past open deadline.');

// Capacity test: no successful add may silently drop older milestones.
const capStorage = new MemoryStorage();
const capApi = createApi(capStorage).api;
let firstCapId = '';
for (let i = 0; i < 200; i++) {
  const result = capApi.add({ title: `Milestone ${i + 1}`, stat: 'computer' });
  if (!result.ok) throw new Error(`Capacity setup failed at ${i + 1}: ${result.error}`);
  if (i === 0) firstCapId = result.item.id;
}
equal(capApi.summary().total, 200, 'The planner permits at most 200 milestones.');
equal(capApi.add({ title: 'Over capacity', stat: 'physics' }).error, 'limit-reached', 'Adding past the limit reports capacity rather than truncating.');
equal(capApi.summary().total, 200, 'Capacity failure preserves all 200 existing milestones.');
check(capApi.list().some(item => item.id === firstCapId), 'The oldest milestone is not silently discarded at capacity.');
const overflowImport = JSON.stringify({ app: 'SYSTEM', formatVersion: 1, milestones: [{ id: 'overflow-import', title: 'Overflow import', note: '', stat: 'physics', priority: 'normal', dueDate: '', status: 'todo', createdAt: new Date().toISOString(), completedAt: '' }] });
equal(capApi.importJSON(overflowImport, { mode: 'merge' }).error, 'limit-reached', 'Import merge refuses to exceed capacity.');
equal(capApi.summary().total, 200, 'Capacity-limited merge preserves the full current roadmap.');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'js/features/status-more.js'), 'utf8');
check(html.includes('data-status-tool="smart-roadmap"'), 'Roadmap is discoverable from Status More.');
check(fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8').includes('./core/smart-roadmap.js'), 'Roadmap module loads before UI.');
check(ui.includes('data-roadmap-search') && ui.includes('data-roadmap-filter-status') && ui.includes('data-roadmap-filter-stat'), 'The UI exposes search and roadmap filters.');
check(ui.includes('data-roadmap-edit') && ui.includes('data-roadmap-cancel-edit'), 'The UI exposes edit and cancel controls.');
check(ui.includes('data-roadmap-import-file') && ui.includes('data-roadmap-import-mode'), 'The UI exposes JSON import with explicit merge/replace modes.');
check(ui.includes('escapeLedgerText(searchable)') && ui.includes('escapeLedgerText(item.title)'), 'User-controlled roadmap text is escaped before HTML insertion.');
check(fs.existsSync(path.join(ROOT, 'css/refinements/smart-roadmap-refinement.css')), 'The responsive Roadmap styles exist.');
check(fs.readFileSync(path.join(ROOT, 'scripts/build-css.js'), 'utf8').includes('css/refinements/smart-roadmap-refinement.css'), 'The new Roadmap styles are included in the CSS build.');
const weeklyReview = api.weeklyReview();
check(weeklyReview && weeklyReview.periodDays === 7, 'Weekly review reports a rolling seven-day period.');
check(Number.isInteger(weeklyReview.createdCount) && weeklyReview.createdCount >= 0, 'Weekly review counts recently created milestones.');
check(Number.isInteger(weeklyReview.completedCount) && weeklyReview.completedCount >= 0, 'Weekly review counts recently completed milestones.');
check(Number.isInteger(weeklyReview.overdueOpenCount) && weeklyReview.overdueOpenCount >= 0, 'Weekly review counts currently overdue open milestones.');
check(weeklyReview.completedByStat && Number.isInteger(weeklyReview.completedByStat.computer), 'Weekly review breaks down completions by skill branch.');
const insights = api.insights();
check(insights && typeof insights === 'object', 'Insights API returns a diagnostic summary.');
check(Number.isInteger(insights.openCount) && insights.openCount >= 0, 'Insights reports a non-negative open count.');
check(insights.byStat.computer && Number.isInteger(insights.byStat.computer.completionPercent), 'Insights reports per-skill completion rates.');
check(insights.openByPriority.high >= 0 && insights.openByPriority.normal >= 0 && insights.openByPriority.low >= 0, 'Insights reports open work by priority.');
check(Number.isInteger(insights.completionPercent) && insights.completionPercent >= 0 && insights.completionPercent <= 100, 'Insights reports bounded overall completion percentage.');
check(['low', 'medium', 'high'].includes(insights.pressureBand), 'Insights classifies workload pressure into a known band.');
check(Number.isInteger(insights.pressureScore) && insights.pressureScore >= 0 && insights.pressureScore <= 100, 'Insights pressure score is clamped to 0–100.');
check(['resolve-overdue', 'finish-today', 'review-stalled', 'high-priority', 'start-small', 'plan-next', 'create-first'].includes(insights.recommendation), 'Insights returns an explainable next-step recommendation.');
check(Number.isInteger(insights.dueTodayCount) && Number.isInteger(insights.dueSoonCount), 'Insights reports today and near-term deadlines separately.');
console.log(`Smart roadmap tests passed: ${checks} checks.`);
