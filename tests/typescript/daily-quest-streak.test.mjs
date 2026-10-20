import assert from 'node:assert/strict';
import { calculateDailyQuestStreak, dailyQuestStreakMultiplier } from '../../dist/ts/core/daily-quest-streak.js';

let checks = 0;
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks += 1; }
function ok(value, message) { assert.ok(value, message); checks += 1; }
function rejects(fn, pattern, message) { assert.throws(fn, pattern, message); checks += 1; }
const time = date => `${date}T12:00:00.000Z`;

const first = calculateDailyQuestStreak(undefined, '2026-10-16', time('2026-10-16'));
equal(first.state.streak, 1, 'the first activity day starts at Day 1');
equal(first.multiplier, 1, 'Day 1 has no bonus');
equal(first.advanced, true, 'first daily completion advances state');
const sameDay = calculateDailyQuestStreak(first.state, '2026-10-16', '2026-10-16T16:00:00.000Z');
equal(sameDay.state.streak, 1, 'additional quests on the same date do not increase the streak');
equal(sameDay.multiplier, 1, 'additional quests share the same date multiplier');
equal(sameDay.advanced, false, 'same-day completion does not advance streak days');
const next = calculateDailyQuestStreak(sameDay.state, '2026-10-17', time('2026-10-17'));
equal(next.state.streak, 2, 'the next consecutive day advances the streak');
equal(next.multiplier, 1.05, 'Day 2 grants a 5 percent bonus');
equal(next.state.bestStreak, 2, 'best streak increases with a new record');
const jumped = calculateDailyQuestStreak(next.state, '2026-10-20', time('2026-10-20'));
equal(jumped.state.streak, 1, 'a gap of missed days resets the active streak');
equal(jumped.state.bestStreak, 2, 'a broken streak does not erase the best record');
equal(jumped.multiplier, 1, 'a restarted streak receives no bonus');
const capState = { id: 'daily-quest-streak', lastDate: '2026-10-17', streak: 11, bestStreak: 11, updatedAt: time('2026-10-17') };
const capped = calculateDailyQuestStreak(capState, '2026-10-18', time('2026-10-18'));
equal(capped.state.streak, 12, 'streak count continues beyond the multiplier cap');
equal(capped.multiplier, 1.5, 'the streak multiplier caps at 1.5');
equal(dailyQuestStreakMultiplier(100), 1.5, 'multiplier remains capped for long streaks');
equal(dailyQuestStreakMultiplier(1), 1, 'Day 1 remains at the base multiplier');
const leap = calculateDailyQuestStreak({ id: 'daily-quest-streak', lastDate: '2024-02-28', streak: 3, bestStreak: 3, updatedAt: time('2024-02-28') }, '2024-02-29', time('2024-02-29'));
equal(leap.state.streak, 4, 'calendar-day logic handles leap days');
const newYear = calculateDailyQuestStreak({ id: 'daily-quest-streak', lastDate: '2026-12-31', streak: 2, bestStreak: 2, updatedAt: time('2026-12-31') }, '2027-01-01', time('2027-01-01'));
equal(newYear.state.streak, 3, 'calendar-day logic handles year boundaries');
rejects(() => calculateDailyQuestStreak(capState, '2026-10-16', time('2026-10-16')), /moved backward/, 'clock rollback must not reset or exploit the streak');
rejects(() => calculateDailyQuestStreak(undefined, '2026-02-30', time('2026-02-30')), /real local calendar date/, 'impossible dates are rejected');
rejects(() => calculateDailyQuestStreak({ ...capState, streak: -1 }, '2026-10-18', time('2026-10-18')), /streak streak is invalid/, 'corrupt persisted streaks fail closed');
rejects(() => calculateDailyQuestStreak({ ...capState, bestStreak: 1 }, '2026-10-18', time('2026-10-18')), /below the current streak/, 'impossible best/current state is rejected');
rejects(() => calculateDailyQuestStreak(capState, '2026-10-18', 'not-a-date'), /timestamp is invalid/, 'invalid event timestamps are rejected');
equal(capState.streak, 11, 'the transition never mutates its input record');

console.log(`Daily Quest streak domain tests passed: ${checks} checks covering consecutive days, same-day idempotence, resets, 50% cap, leap days, year boundaries and fail-closed corrupted state.`);
