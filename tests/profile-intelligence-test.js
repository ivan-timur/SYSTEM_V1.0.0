'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const version = read('VERSION').trim();
const html = read('index.html');
const profileJS = read('js/features/personal-profile-settings.js');
const legacy = read('js/legacy/app-controller.js');
const checks = [];
function check(condition, message) { assert.ok(condition, message); checks.push(message); }
check(/^\d+\.\d+\.\d+$/.test(version), 'release version uses semantic versioning');
check(html.includes('id="profile-ai-consent"'), 'explicit profile-sharing consent control exists');
check(html.includes('PRIVATE BY DEFAULT'), 'UI discloses private-by-default state');
check(html.includes('data-profile-scope="boundaries"'), 'boundaries have their own independent scope');
check(html.includes('data-profile-scope="progress"'), 'progress snapshot has its own independent scope');
check(html.includes('data-profile-scope="responseStyle"') && html.includes('data-profile-scope="autonomy"'), 'response style and AI autonomy can personalize requests');
check(html.includes('id="profile-insight-history"'), 'saved profile insight history has a view in the UI');
check(profileJS.includes('button.dataset.insightId=entry.id'), 'older insight analyses can be revisited safely');
check(profileJS.includes('if (!currentPrefs.consent) return'), 'context builder blocks all profile sharing unless consent is enabled');
check(profileJS.includes("context.length > 6500"), 'AI context size is capped');
check(profileJS.includes("local brief built on this device only") || profileJS.includes('Local brief built on this device only'), 'local-only brief is clearly marked');
check(profileJS.includes("data.aiPreferences"), 'profile exports and restores AI privacy preferences');
check(profileJS.includes('data.insights'), 'profile exports and restores insight review state');
check(profileJS.includes('textContent=value'), 'AI insight lists use safe text rendering');
check(legacy.includes('window.SystemPersonalization?.getAIContext?.()'), 'both AI providers can receive scoped personalization context');
check(legacy.includes('SYSTEM GROQ CONNECTION OK'), 'Groq connection test remains identifiable for privacy bypass');
check(!/Gemini|gemini|generativelanguage\.googleapis\.com/.test(legacy), 'Gemini API code must be absent from the active AI core');
check(legacy.includes('window.getSystemPersonalProgressSnapshot = buildSystemProgressSnapshot'), 'profile receives a read-only live progress snapshot');
check(legacy.includes('untrusted data'), 'profile context is explicitly treated as data, not instructions');
check(!/addPlayerXP\(|addSystemCoins\(|completeQuest\(/.test(profileJS), 'profile intelligence has no XP, coin or quest mutation calls');

// Runtime-test the profile-context builder with a tiny DOM shim, without network access.
function fakeElement(id) {
  return { id, value: '', textContent: '', checked: false, disabled: false, hidden: false, dataset: {}, style: {},
    addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; },
    appendChild() {}, replaceChildren() {}, setAttribute() {}, insertAdjacentElement() {}, focus() {},
    scrollIntoView() {}, remove() {}, click() {} };
}
const ids = new Map();
const element = id => { if (!ids.has(id)) ids.set(id, fakeElement(id)); return ids.get(id); };
const fieldNames = ['northStar','currentFocus','identity','interests','goals','strengths','learning','lifestyle','motivation','visual','patterns','rules','evidence','boundaries','autonomy','responseStyle'];
const form = element('personal-profile-form');
form.elements = Object.fromEntries(fieldNames.map(name => [name, fakeElement(name)]));
form.querySelectorAll = () => [];
const scopeNames = ['northStar','currentFocus','identity','interests','goals','strengths','learning','lifestyle','motivation','visual','rules','evidence','boundaries','responseStyle','autonomy','progress'];
const scopeBoxes = scopeNames.map(name => { const box=fakeElement('scope-'+name); box.dataset.profileScope=name; return box; });
const local = new Map();
const document = {
  getElementById(id) { return id === 'personal-profile-form' ? form : element(id); },
  querySelectorAll(selector) { return selector === '[data-profile-scope]' ? scopeBoxes : []; },
  createElement(tag) { return fakeElement(tag); }
};
const window = { addEventListener() {}, matchMedia() { return { matches: true }; }, confirm() { return true; } };
const context = { window, document, localStorage: { getItem:k=>local.get(k)||null, setItem:(k,v)=>local.set(k,v), removeItem:k=>local.delete(k) },
  console, Date, JSON, Math, Object, Array, String, Number, Boolean, Blob: function(){}, URL: {createObjectURL(){return '';},revokeObjectURL(){}},
  setTimeout: () => 1, clearTimeout() {}, Error };
vm.runInNewContext(profileJS, context, { filename: 'personal-profile-settings.js' });
const api = window.SystemPersonalization;
check(Boolean(api && typeof api.getAIContext === 'function'), 'personalization API is installed');
form.elements.goals.value = 'Become a capable software developer';
form.elements.interests.value = 'Mathematics and programming';
form.elements.boundaries.value = 'PRIVATE BOUNDARY SECRET';
assert.equal(api.getAIContext(), '', 'context is empty while consent is off');
element('profile-ai-consent').checked = true;
scopeBoxes.find(box=>box.dataset.profileScope==='goals').checked = true;
scopeBoxes.find(box=>box.dataset.profileScope==='interests').checked = true;
scopeBoxes.find(box=>box.dataset.profileScope==='boundaries').checked = false;
let data = api.getAIContext();
assert.match(data, /Become a capable software developer/, 'selected goal enters the prompt context');
assert.match(data, /Mathematics and programming/, 'selected interest enters the prompt context');
assert.doesNotMatch(data, /PRIVATE BOUNDARY SECRET/, 'unselected boundary never enters the prompt context');
checks.push('runtime context respects selected fields and excludes unselected boundaries');
for (const box of scopeBoxes) box.checked = true;
for (const key of fieldNames) if (form.elements[key] && key !== 'autonomy' && key !== 'responseStyle') form.elements[key].value = (key + ' ').repeat(1200);
data = api.getAIContext();
check(data.length <= 6600, 'runtime context obeys total size cap');
console.log(`SYSTEM Profile Intelligence tests passed: ${checks.length} checks.`);
