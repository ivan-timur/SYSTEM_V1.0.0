/* SYSTEM — stable reward identities and local idempotency ledger.
 * This is a synchronous local guard, not a server-grade distributed lock.
 * The transaction wrapper snapshots all system_v2_* values and restores this key
 * when any later progression/history write fails.
 */
(function attachSYSTEMProgressionIdempotency(global) {
    'use strict';

    const STORAGE_KEY = 'system_v2_progression_event_ids';
    const MAX_ENTRIES = 5000;
    const MAX_ID_LENGTH = 280;
    const DAILY_RETENTION_DAYS = 180;
    const REQUIRED_TYPES = new Set([
        'daily-quest', 'ai-daily-quest', 'custom-quest', 'boss-quest',
        'goal', 'goal-evidence-completion'
    ]);
    const DAILY_TYPES = new Set(['daily-quest', 'ai-daily-quest']);

    function cleanId(value, label) {
        if (typeof value !== 'string' || !value.trim() || value.length > 200 || value !== value.trim()) {
            throw new Error(`${label} must be a non-empty, trimmed string of at most 200 characters`);
        }
        return value;
    }

    function isRequiredType(type) {
        return typeof type === 'string' && REQUIRED_TYPES.has(type);
    }

    function createKey(reward, dateStamp) {
        if (!reward || typeof reward !== 'object' || Array.isArray(reward)) throw new Error('Reward identity input must be an object');
        // In the live app, TypeScript owns the canonical identity contract. Keep
        // the local implementation below as a compatibility fallback for tests
        // and isolated legacy contexts where the TS module is not loaded.
        const progression = global.SYSTEMTypeScriptProgression;
        if (progression && typeof progression.getRewardIdentity === 'function') {
            const identity = progression.getRewardIdentity(reward, dateStamp);
            return identity && typeof identity.idempotencyKey === 'string' ? identity.idempotencyKey : null;
        }
        const type = cleanId(reward.type, 'Reward type');
        if (!isRequiredType(type)) return null;

        let namespace = type;
        let identity;
        if (type === 'goal' || type === 'goal-evidence-completion') {
            // Both Goal completion routes share one identity: switching the route must
            // never make a completed Goal eligible for a second payout.
            namespace = 'goal';
            identity = cleanId(reward.goalId, 'Goal ID');
        } else {
            identity = cleanId(reward.questId, 'Quest ID');
        }

        let key = `v1|${namespace}|${identity}`;
        if (DAILY_TYPES.has(type)) {
            if (typeof dateStamp !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStamp)) {
                throw new Error('A valid local date is required for a repeatable Daily Quest reward');
            }
            const [year, month, day] = dateStamp.split('-').map(Number);
            const validDate = new Date(Date.UTC(year, month - 1, day));
            if (validDate.getUTCFullYear() !== year || validDate.getUTCMonth() !== month - 1 || validDate.getUTCDate() !== day) {
                throw new Error('Daily reward date is not a real calendar date');
            }
            key += `|${dateStamp}`;
        }
        if (key.length > MAX_ID_LENGTH) throw new Error('Reward identity is too long to store safely');
        return key;
    }

    function readEntries(storage) {
        if (!storage || typeof storage.getItem !== 'function') return { ok: false, entries: [], reason: 'Storage is unavailable' };
        let raw;
        try { raw = storage.getItem(STORAGE_KEY); }
        catch (error) { return { ok: false, entries: [], reason: `Ledger could not be read: ${String(error && error.message || error)}` }; }
        if (raw === null || raw === '') return { ok: true, entries: [] };
        let parsed;
        try { parsed = JSON.parse(raw); }
        catch (_) { return { ok: false, entries: [], reason: 'Reward idempotency ledger is malformed JSON' }; }
        if (!Array.isArray(parsed) || parsed.length > MAX_ENTRIES) {
            return { ok: false, entries: [], reason: 'Reward idempotency ledger has an invalid shape or size' };
        }
        const seen = new Set();
        for (const id of parsed) {
            if (typeof id !== 'string' || !id || id.length > MAX_ID_LENGTH || seen.has(id)) {
                return { ok: false, entries: [], reason: 'Reward idempotency ledger contains an invalid or duplicate ID' };
            }
            seen.add(id);
        }
        return { ok: true, entries: parsed };
    }

    function isValidDateStamp(dateStamp) {
        if (typeof dateStamp !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStamp)) return false;
        const [year, month, day] = dateStamp.split('-').map(Number);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
    }

    function dailyDateFromKey(id) {
        if (!(id.startsWith('v1|daily-quest|') || id.startsWith('v1|ai-daily-quest|'))) return null;
        const date = id.slice(id.lastIndexOf('|') + 1);
        return isValidDateStamp(date) ? date : null;
    }

    function compactEntries(entries, referenceDate) {
        const ref = isValidDateStamp(referenceDate) ? referenceDate : new Date().toISOString().slice(0, 10);
        const [year, month, day] = ref.split('-').map(Number);
        const cutoffTime = Date.UTC(year, month - 1, day) - DAILY_RETENTION_DAYS * 86400000;
        const cutoff = new Date(cutoffTime).toISOString().slice(0, 10);
        return entries.filter(id => {
            const eventDate = dailyDateFromKey(id);
            // One-time Quest/Goal IDs are permanent. Only old repeatable Daily records
            // are compacted; current/recent/future-dated entries remain untouched.
            return eventDate === null || eventDate >= cutoff;
        });
    }

    function inspect(storage, id, referenceDate) {
        if (typeof id !== 'string' || !id || id.length > MAX_ID_LENGTH) return { status: 'invalid', reason: 'Reward event ID is invalid' };
        const ledger = readEntries(storage);
        if (!ledger.ok) return { status: 'invalid', reason: ledger.reason };
        const entries = compactEntries(ledger.entries, referenceDate);
        if (entries.includes(id)) return { status: 'duplicate', reason: 'This reward has already been committed' };
        if (entries.length >= MAX_ENTRIES) return { status: 'full', reason: 'Reward idempotency ledger reached its safety capacity' };
        return { status: 'new', count: entries.length, compacted: ledger.entries.length - entries.length };
    }

    function commit(storage, id, referenceDate) {
        if (typeof id !== 'string' || !id || id.length > MAX_ID_LENGTH) {
            return { status: 'invalid', reason: 'Reward event ID is invalid' };
        }
        const ledger = readEntries(storage);
        if (!ledger.ok) return { status: 'invalid', reason: ledger.reason };
        const entries = compactEntries(ledger.entries, referenceDate);
        if (entries.includes(id)) return { status: 'duplicate', reason: 'This reward has already been committed' };
        if (entries.length >= MAX_ENTRIES) return { status: 'full', reason: 'Reward idempotency ledger reached its safety capacity' };
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify([...entries, id]));
            // Verify the write instead of assuming localStorage accepted it.
            const verify = readEntries(storage);
            if (!verify.ok || !verify.entries.includes(id)) {
                return { status: 'invalid', reason: 'Reward ID could not be verified after saving' };
            }
            return { status: 'committed', count: verify.entries.length };
        } catch (error) {
            return { status: 'invalid', reason: `Reward ID could not be saved: ${String(error && error.message || error)}` };
        }
    }

    global.SYSTEMProgressionIdempotency = Object.freeze({
        storageKey: STORAGE_KEY,
        maxEntries: MAX_ENTRIES,
        maxIdLength: MAX_ID_LENGTH,
        dailyRetentionDays: DAILY_RETENTION_DAYS,
        isRequiredType,
        createKey,
        inspect,
        commit
    });
})(typeof window !== 'undefined' ? window : globalThis);
