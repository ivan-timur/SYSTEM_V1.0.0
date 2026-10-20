'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/features/ai-quest-parser.js'), 'utf8');
const window = {};
const sandbox = { window, String, Array, Set, Object, Math, RegExp };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'js/features/ai-quest-parser.js', timeout: 5000 });

const parser = window.SYSTEMAIQuestParser;
assert.ok(parser, 'AI quest parser public API must initialize.');
assert.ok(Object.isFrozen(parser), 'AI quest parser public API must be immutable.');
assert.equal(typeof parser.parseAIQuestText, 'function');
assert.equal(typeof parser.inferQuestStat, 'function');
assert.equal(typeof parser.stripAIQuestFormatting, 'function');
assert.equal(sandbox.parseAIQuestText, undefined, 'Parser internals must not leak into global scope.');

let checks = 6;
function equal(actual, expected, message) { const comparable = Array.isArray(actual) ? Array.from(actual) : actual; assert.deepEqual(comparable, expected, message); checks++; }
function check(condition, message) { assert.ok(condition, message); checks++; }

// Empty and malformed-ish input are handled without throwing.
equal(parser.parseAIQuestText(''), [], 'Empty string produces no missions.');
equal(parser.parseAIQuestText(' \n \t '), [], 'Whitespace-only input produces no missions.');
equal(parser.parseAIQuestText(null), [], 'Null input produces no missions.');

// Numbered missions, markdown, wrapped descriptions, and introductory prose.
const numberedInput = 'Here are your daily missions:\n1. **Study algebra**\nSolve two equations and explain each step.\n2) Practice ' + '`Python`' + '\nBuild a tiny command-line tool.';
equal(parser.parseAIQuestText(numberedInput), [
  'Study algebra Solve two equations and explain each step.',
  'Practice Python Build a tiny command-line tool.'
], 'Numbered missions retain wrapped descriptions and strip simple markdown.');

// Persian and Arabic-Indic digits are normalized before numbered-list detection.
equal(parser.parseAIQuestText('۱. تمرین ریاضی\n۲) تمرین زبان انگلیسی'), [
  'تمرین ریاضی', 'تمرین زبان انگلیسی'
], 'Persian digits are normalized.');
equal(parser.parseAIQuestText('١. تمرین فیزیک\n٢. برنامه‌نویسی پایتون'), [
  'تمرین فیزیک', 'برنامه‌نویسی پایتون'
], 'Arabic-Indic digits are normalized.');

// Bullets plus a wrapped line.
equal(parser.parseAIQuestText('Daily Quest:\n- Read one page\nand summarize it.\n• Solve one equation\n- Speak English for five minutes'), [
  'Read one page and summarize it.',
  'Solve one equation',
  'Speak English for five minutes'
], 'Bulleted missions preserve continuation lines and ignore metadata headings.');

// Unnumbered fallback mode, case-insensitive deduplication, and formatting cleanup.
equal(parser.parseAIQuestText('Study Python\nstudy python\n> **Review notes**\n`Read a chapter`'), [
  'Study Python', 'Review notes', 'Read a chapter'
], 'Unnumbered lines are retained, formatting is removed, and duplicates are removed ignoring case.');
equal(parser.parseAIQuestText('1. Plan\n2. Plan\n3. Review'), ['Plan', 'Review'], 'Duplicate numbered missions are removed case-insensitively.');
equal(parser.parseAIQuestText('```text\n1. Check lists\n2. Test parsing\n```'), ['Check lists', 'Test parsing'], 'Fenced code wrappers are removed.');

// Boundaries prevent empty/too-short and oversized mission titles from leaking through.
equal(parser.parseAIQuestText('1. x\n2. ok\n3. ' + 'a'.repeat(501)), ['ok'], 'Mission length must be within 2..500 characters.');

// Stat inference remains bilingual and uses the current six Stat identifiers.
equal(parser.inferQuestStat('Solve algebra equations'), 'mathematics', 'English mathematics keywords map to mathematics.');
equal(parser.inferQuestStat('تمرین هندسه و ریاضیات'), 'mathematics', 'Persian mathematics keywords map to mathematics.');
equal(parser.inferQuestStat('Study physics and energy'), 'physics', 'Physics keywords map to physics.');
equal(parser.inferQuestStat('تمرین فیزیک و نیرو'), 'physics', 'Dari/Persian physics keywords map to physics.');
equal(parser.inferQuestStat('Write a Python algorithm'), 'computer', 'Programming keywords map to computer.');
equal(parser.inferQuestStat('تمرین برنامه‌نویسی پایتون'), 'computer', 'Persian programming keywords map to computer.');
equal(parser.inferQuestStat('Practice English vocabulary'), 'global-skills', 'Language keywords map to global-skills.');
equal(parser.inferQuestStat('تمرین زبان انگلیسی'), 'global-skills', 'Persian language keywords map to global-skills.');
equal(parser.inferQuestStat('Validate a startup idea'), 'entrepreneurship', 'Business keywords map to entrepreneurship.');
equal(parser.inferQuestStat('بازاریابی و فروش'), 'entrepreneurship', 'Persian business keywords map to entrepreneurship.');
equal(parser.inferQuestStat('Research patterns and first principles'), 'unique-thinking', 'Critical-thinking keywords map to unique-thinking.');
equal(parser.inferQuestStat('تمرین تفکر انتقادی و تحلیل'), 'unique-thinking', 'Persian thinking keywords map to unique-thinking.');
equal(parser.inferQuestStat('Tidy the desk'), null, 'Unknown task topics do not get a fabricated Stat.');
equal(parser.inferQuestStat(null), null, 'Null topic returns no Stat.');
equal(parser.stripAIQuestFormatting('> **Hello** `world` __today__ ###'), 'Hello world today', 'Formatting cleanup is stable.');

// Runtime integration must load the parser before the legacy controller and use its API.
const appSource = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const legacySource = fs.readFileSync(path.join(ROOT, 'js/legacy/app-controller.js'), 'utf8');
check(appSource.indexOf('./features/ai-quest-parser.js') < appSource.indexOf('./legacy/app-controller.js'), 'Parser must load before the controller.');
check(legacySource.includes('window.SYSTEMAIQuestParser.parseAIQuestText('), 'Legacy fallback parsing must use the extracted API.');
check(legacySource.includes('window.SYSTEMAIQuestParser.inferQuestStat('), 'Legacy Stat inference must use the extracted API.');
check(!legacySource.includes('function parseAIQuestText('), 'Parser implementation must no longer live in the legacy controller.');
check(!legacySource.includes('function inferQuestStat('), 'Stat inference implementation must no longer live in the legacy controller.');

console.log(`SYSTEM AI quest parser tests passed: ${checks} checks.`);
