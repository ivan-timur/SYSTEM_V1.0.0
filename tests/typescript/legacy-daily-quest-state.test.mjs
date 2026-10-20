import assert from 'node:assert/strict';
import {
  createLegacyDailyQuestStorageEntries,
  normalizeLegacyDailyQuestState,
} from '../../dist/ts/storage/legacy-daily-quest-state.js';

const today = '2026-10-18';
const current = normalizeLegacyDailyQuestState(today, JSON.stringify({
  study: true,
  coding: false,
  unknownFutureQuest: true,
  invalidText: 'true',
  invalidNumber: 1,
  tooLong: 'ignored',
}), today);
assert.deepEqual(current.completed, { study: true, coding: false, unknownFutureQuest: true });
assert.equal(current.dayChanged, false);
assert.equal(current.hadStoredPayload, true);

const emptyDate = normalizeLegacyDailyQuestState('', JSON.stringify({ study: true }), today);
assert.deepEqual(emptyDate.completed, { study: true }, 'an empty uninitialized date retains compatible legacy state');

const newDay = normalizeLegacyDailyQuestState('2026-10-17', JSON.stringify({ study: true }), today);
assert.deepEqual(newDay.completed, {}, 'a different non-empty local date resets daily completions');
assert.equal(newDay.dayChanged, true);

const nullPayload = normalizeLegacyDailyQuestState(null, null, today);
assert.deepEqual(nullPayload.completed, {});
assert.equal(nullPayload.hadStoredPayload, false);

const nonObjectPayload = normalizeLegacyDailyQuestState(today, JSON.stringify(['study']), today);
assert.deepEqual(nonObjectPayload.completed, {}, 'arrays are not valid daily completion objects');

assert.throws(() => normalizeLegacyDailyQuestState(today, '{broken', today), /JSON|position|property/i,
  'malformed JSON must reach the existing controller error boundary');
assert.throws(() => normalizeLegacyDailyQuestState('2026-10-17', '{broken', today), /JSON|position|property/i,
  'stale malformed payload must not be silently overwritten during date rollover');
assert.throws(() => normalizeLegacyDailyQuestState(today, '{}', '2026-02-30'), /date is invalid/);
assert.throws(() => normalizeLegacyDailyQuestState(3, '{}', today), /date has an invalid type/);
assert.throws(() => normalizeLegacyDailyQuestState(today, {}, today), /payload has an invalid type/);

const entries = createLegacyDailyQuestStorageEntries({
  study: true,
  coding: false,
  invalid: 1,
  empty: null,
  unknownFutureQuest: true,
}, today, 'system_v2_quests', 'system_v2_quest_date');
assert.deepEqual(JSON.parse(entries.system_v2_quests), {
  study: true,
  coding: false,
  unknownFutureQuest: true,
});
assert.equal(entries.system_v2_quest_date, today);

assert.throws(() => createLegacyDailyQuestStorageEntries({}, '2026-02-30', 'save', 'date'), /date is invalid/);
assert.throws(() => createLegacyDailyQuestStorageEntries({}, today, '', 'date'), /storage key/);
assert.throws(() => createLegacyDailyQuestStorageEntries({}, today, 'same', 'same'), /must differ/);
assert.deepEqual(JSON.parse(createLegacyDailyQuestStorageEntries([], today, 'save', 'date').save), {},
  'non-object in-memory state fails closed to an empty completion map');

console.log('TypeScript legacy Daily Quest state tests passed: same-day normalization, day rollover, malformed input, forward-compatible IDs, typed storage entries, and key/date guards.');
