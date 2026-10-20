/**
 * Typed compatibility boundary for the legacy Daily Quest completion keys.
 *
 * This module deliberately does not select IndexedDB or mutate browser storage.
 * It owns only the legacy payload contract so the controller can remain a thin
 * adapter while persisted keys and the user's current localStorage save remain
 * backward-compatible.
 */
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isValidDateStamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}
function validateKey(value, label) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 160) {
        throw new Error(`${label} must be a non-empty trimmed storage key of at most 160 characters`);
    }
}
/**
 * Decode the current legacy payload. Invalid JSON is surfaced to the existing
 * controller's error boundary instead of being silently treated as a new save.
 * Unknown-but-well-formed quest IDs are retained for forward compatibility.
 */
export function normalizeLegacyDailyQuestState(storedDate, storedData, today) {
    if (!isValidDateStamp(today))
        throw new Error('Current Daily Quest date is invalid');
    if (storedDate !== null && storedDate !== undefined && typeof storedDate !== 'string') {
        throw new Error('Stored Daily Quest date has an invalid type');
    }
    if (storedData !== null && storedData !== undefined && typeof storedData !== 'string') {
        throw new Error('Stored Daily Quest payload has an invalid type');
    }
    // Parse first, matching the legacy routine's error boundary even when the
    // stored date has rolled over. A corrupt payload must not be silently rewritten.
    const parsed = storedData ? JSON.parse(storedData) : {};
    // Match established behavior: an empty date is treated as an uninitialized key,
    // while any non-empty date different from today resets the repeatable daily set.
    const dayChanged = Boolean(storedDate && storedDate !== today);
    if (dayChanged) {
        return { completed: {}, dayChanged: true, hadStoredPayload: storedData !== null && storedData !== undefined };
    }
    if (!isRecord(parsed)) {
        return { completed: {}, dayChanged: false, hadStoredPayload: storedData !== null && storedData !== undefined };
    }
    const completed = Object.fromEntries(Object.entries(parsed).filter(([id, value]) => typeof id === 'string' && id.length <= 200 && typeof value === 'boolean'));
    return {
        completed,
        dayChanged: false,
        hadStoredPayload: storedData !== null && storedData !== undefined,
    };
}
/**
 * Create a pair of localStorage entries after filtering the state through the
 * same compatibility contract used on load. Storage I/O and rollback stay in
 * the existing adapter, which preserves the app's atomic-key-write behavior.
 */
export function createLegacyDailyQuestStorageEntries(completed, today, saveKey, dateKey) {
    if (!isValidDateStamp(today))
        throw new Error('Current Daily Quest date is invalid');
    validateKey(saveKey, 'Daily Quest save key');
    validateKey(dateKey, 'Daily Quest date key');
    if (saveKey === dateKey)
        throw new Error('Daily Quest payload and date keys must differ');
    const normalized = isRecord(completed)
        ? Object.fromEntries(Object.entries(completed).filter(([id, value]) => typeof id === 'string' && id.length <= 200 && typeof value === 'boolean'))
        : {};
    return {
        [saveKey]: JSON.stringify(normalized),
        [dateKey]: today,
    };
}
