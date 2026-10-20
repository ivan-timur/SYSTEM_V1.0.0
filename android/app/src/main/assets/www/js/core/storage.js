/* SYSTEM — storage integrity, backup validation and rollback helpers.
 * Browser-only, dependency-free utilities. The FNV-1a checksum detects accidental
 * corruption; it is NOT a cryptographic signature and does not make backups trusted.
 */
(function attachSystemStorage(global) {
    'use strict';

    const APP_NAME = 'SYSTEM';
    const CURRENT_BACKUP_VERSION = 2;
    const DEFAULT_MAX_BACKUP_BYTES = 5 * 1024 * 1024;
    const MAX_ENTRIES = 100;
    const APP_PREFIXES = ['system_v2_', 'SYSTEM_'];
    const STRING_KEYS = new Set([
        'system_v2_theme',
        'system_v2_quest_date',
        'system_v2_ai_workspace_view'
    ]);
    const VALID_STATS = new Set([
        'entrepreneurship', 'global-skills', 'mathematics',
        'computer', 'physics', 'unique-thinking'
    ]);

    function isAppKey(key) {
        return typeof key === 'string' && APP_PREFIXES.some(prefix => key.startsWith(prefix));
    }

    function byteLength(value) {
        const text = String(value);
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
        return text.length * 2;
    }

    function safeParse(value) {
        try { return { ok: true, value: JSON.parse(value) }; }
        catch (error) { return { ok: false, error }; }
    }

    function isValidDateOnly(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    }

    function isValidTimestamp(value) {
        if (typeof value !== 'string' || value.length > 80) return false;
        const match = value.match(/^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/);
        return Boolean(match && isValidDateOnly(match[1]) && Number.isFinite(Date.parse(value)));
    }

    function checksumForEntries(entries) {
        const canonical = JSON.stringify(Object.keys(entries).sort().map(key => [key, entries[key]]));
        let hash = 0x811c9dc5;
        for (let i = 0; i < canonical.length; i++) {
            hash ^= canonical.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash.toString(16).padStart(8, '0');
    }

    function getEntries(storage) {
        const result = {};
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (isAppKey(key)) result[key] = storage.getItem(key);
        }
        return Object.fromEntries(Object.keys(result).sort().map(key => [key, result[key]]));
    }

    function validateKnownValue(key, parsed) {
        const objectLike = value => value && typeof value === 'object' && !Array.isArray(value);
        const finiteRange = (value, min = 0, max = 1_000_000_000_000) =>
            typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
        const text = (value, maxLength = 1000) => typeof value === 'string' && value.length <= maxLength;
        const list = (value, maxLength = 1000) => Array.isArray(value) && value.length <= maxLength;

        if (key === 'system_v2_save') {
            if (!objectLike(parsed)) return 'player save must be an object';

            // A restorable save must contain real player progress, not merely `{}` or a
            // partial object that would silently reset missing values to defaults.
            // The flat shape is accepted only as a recognized pre-nested legacy save.
            const hasNestedPlayer = Object.prototype.hasOwnProperty.call(parsed, 'player');
            const player = hasNestedPlayer ? parsed.player : parsed;
            if (!objectLike(player)) return 'player field must be an object';
            for (const field of ['level', 'xp', 'coins']) {
                if (!Object.prototype.hasOwnProperty.call(player, field)) return `player.${field} is required`;
                if (!finiteRange(player[field], field === 'level' ? 1 : 0)) {
                    return `player.${field} is outside its valid numeric range`;
                }
            }
            if (player.xpRequired !== undefined && !finiteRange(player.xpRequired, 1)) {
                return 'player.xpRequired is outside its valid numeric range';
            }
            if (parsed.schemaVersion !== undefined && (!Number.isInteger(parsed.schemaVersion) || parsed.schemaVersion < 1 || parsed.schemaVersion > 3)) {
                return 'schemaVersion is unsupported';
            }
            if (parsed.updatedAt !== undefined && parsed.updatedAt !== '' && !isValidTimestamp(parsed.updatedAt)) {
                return 'updatedAt is not a valid timestamp';
            }

            if (hasNestedPlayer) {
                // Every current app save includes every Stat. Missing one would restore a
                // partial save and silently erase that branch's level/XP, so reject it.
                if (!objectLike(parsed.stats)) return 'stats field is required for nested player saves';
                for (const id of VALID_STATS) {
                    const stat = parsed.stats[id];
                    if (!objectLike(stat)) return `stats.${id} is required`;
                    for (const field of ['level', 'xp']) {
                        if (!Object.prototype.hasOwnProperty.call(stat, field)) return `stats.${id}.${field} is required`;
                        if (!finiteRange(stat[field], field === 'level' ? 1 : 0)) {
                            return `stats.${id}.${field} is outside its valid numeric range`;
                        }
                    }
                    if (stat.xpRequired !== undefined && !finiteRange(stat.xpRequired, 1)) {
                        return `stats.${id}.xpRequired is outside its valid numeric range`;
                    }
                }
            }
            if (parsed.stats !== undefined) {
                if (!objectLike(parsed.stats)) return 'stats field must be an object';
                for (const [id, stat] of Object.entries(parsed.stats)) {
                    if (!VALID_STATS.has(id) || !objectLike(stat)) return `invalid stat entry: ${id}`;
                    for (const field of ['level', 'xp', 'xpRequired']) {
                        if (stat[field] !== undefined && !finiteRange(stat[field], field === 'level' || field === 'xpRequired' ? 1 : 0)) {
                            return `stats.${id}.${field} is outside its valid numeric range`;
                        }
                    }
                }
            }
            if (parsed.skillProgress !== undefined) {
                if (!objectLike(parsed.skillProgress)) return 'skillProgress field must be an object';
                const entries = Object.entries(parsed.skillProgress);
                if (entries.length > 1000) return 'skillProgress contains too many entries';
                for (const [id, progress] of entries) {
                    if (!text(id, 128) || !objectLike(progress)) return `invalid skill progress entry: ${id}`;
                    for (const field of ['level', 'xp', 'xpRequired', 'totalXp']) {
                        if (progress[field] !== undefined && !finiteRange(progress[field], field === 'level' || field === 'xpRequired' ? 1 : 0)) {
                            return `skillProgress.${id}.${field} is outside its valid numeric range`;
                        }
                    }
                    if (progress.lastActivityAt !== undefined && progress.lastActivityAt !== null && !text(progress.lastActivityAt, 80)) {
                        return `skillProgress.${id}.lastActivityAt is invalid`;
                    }
                }
            }
        } else if (key === 'system_v2_progress') {
            if (!objectLike(parsed)) return 'progress ledger must be an object';
            if (Object.keys(parsed).length > 50) return 'progress ledger contains too many fields';
            if (Object.values(parsed).some(value => !finiteRange(value))) return 'progress ledger contains an invalid counter';
        } else if (key === 'system_v2_quests') {
            if (!objectLike(parsed)) return 'daily quest completion must be an object';
            if (Object.keys(parsed).length > 200 || Object.values(parsed).some(value => typeof value !== 'boolean')) return 'daily quest completion entries are invalid';
        } else if (key === 'system_v2_daily_prize') {
            const validRarities = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
            if (!objectLike(parsed) || !text(parsed.date, 10) || !isValidDateOnly(parsed.date)
                || !text(parsed.id, 80) || !text(parsed.nameEn, 100) || !text(parsed.nameFa, 120)
                || !validRarities.includes(parsed.rarity) || parsed.claimed !== true
                || !finiteRange(parsed.xp, 1, 10000) || !finiteRange(parsed.coins, 0, 10000)
                || !text(parsed.symbol, 12)) return 'daily prize record is invalid';
            if (parsed.claimedAt !== undefined && !text(parsed.claimedAt, 80)) return 'daily prize claim timestamp is invalid';
        } else if (key === 'system_v2_progress_history') {
            if (!list(parsed, 300)) return 'progress history must be an array with at most 300 events';
            if (parsed.some(item => !objectLike(item) || !text(item.at, 80) || !text(item.title, 140)
                || (item.eventId !== undefined && (!text(item.eventId, 280) || !item.eventId)))) return 'progress history contains an invalid event';
        } else if (key === 'system_v2_progression_event_ids') {
            // This is a durable duplicate-payout index. Refuse malformed or duplicate IDs
            // rather than restoring a ledger that could permit the same Quest to pay twice.
            if (!list(parsed, 5000)) return 'progression event ledger must contain at most 5000 IDs';
            const seenEventIds = new Set();
            if (parsed.some(id => {
                if (!text(id, 280) || !id || seenEventIds.has(id)) return true;
                seenEventIds.add(id);
                return false;
            })) return 'progression event ledger contains invalid or duplicate IDs';
        } else if (key === 'system_v2_ai_chat_history') {
            if (!list(parsed, 100)) return 'AI chat history must contain at most 100 messages';
            if (parsed.some(item => !objectLike(item) || !['ai', 'user'].includes(item.type) || !text(item.text, 25000))) return 'AI chat history contains an invalid message';
        } else if (key === 'system_v2_ai_daily_quests') {
            if (!objectLike(parsed) || !text(parsed.date, 20) || !list(parsed.items, 30)) return 'AI daily quest data is invalid';
            if (parsed.items.some(item => !objectLike(item) || !text(item.id, 200) || !text(item.title, 180))) return 'AI daily quest entry is invalid';
        } else if (key === 'system_v2_reward_state') {
            if (!objectLike(parsed) || !list(parsed.claimed, 1000) || parsed.claimed.some(id => !text(id, 200))) return 'reward state is invalid';
        } else if (key === 'system_v2_inventory') {
            // Current inventory instances use instanceId/itemId; older exports may
            // contain `id`. Accept both schemas so backups made by this app can round-trip.
            const seenIds = new Set();
            if (!list(parsed, 1000) || parsed.some(item => {
                if (!objectLike(item)) return true;
                const hasCurrentIdentity = text(item.instanceId, 200) && item.instanceId.trim()
                    && text(item.itemId, 200) && item.itemId.trim();
                const hasLegacyIdentity = text(item.id, 200) && item.id.trim();
                if (!hasCurrentIdentity && !hasLegacyIdentity) return true;
                // Match runtime compatibility behavior: a present string instanceId is primary.
                const identity = typeof item.instanceId === 'string' ? item.instanceId : item.id;
                if (typeof identity !== 'string' || !identity.trim() || identity !== identity.trim() || seenIds.has(identity)) return true;
                seenIds.add(identity);
                if (item.name !== undefined && !text(item.name, 200)) return true;
                if (item.description !== undefined && !text(item.description, 1000)) return true;
                if (item.category !== undefined && !text(item.category, 100)) return true;
                if (item.price !== undefined && !finiteRange(item.price, 0, 1000000)) return true;
                if (item.redeemed !== undefined && typeof item.redeemed !== 'boolean') return true;
                if (item.purchasedAt !== undefined && !text(item.purchasedAt, 80)) return true;
                if (item.redeemedAt !== undefined && !text(item.redeemedAt, 80)) return true;
                return false;
            })) return 'inventory is invalid';
        } else if (key === 'system_v2_store_items') {
            const seenIds = new Set();
            if (!list(parsed, 1000) || parsed.some(item => {
                if (!objectLike(item) || !text(item.id, 200) || !item.id.trim() || item.id !== item.id.trim() || !text(item.name, 200) || !item.name.trim() || seenIds.has(item.id)) return true;
                seenIds.add(item.id);
                return false;
            })) return 'store item list is invalid';
        } else if (key === 'system_v2_custom_quests') {
            const seenIds = new Set();
            if (!list(parsed, 1000) || parsed.some(item => {
                if (!objectLike(item) || !text(item.id, 200) || !item.id.trim() || item.id !== item.id.trim() || !text(item.title, 180) || !item.title.trim() || seenIds.has(item.id)) return true;
                seenIds.add(item.id);
                return false;
            })) return 'custom quest list is invalid';
        } else if (key === 'system_v2_boss_completed') {
            if (!list(parsed, 1000) || parsed.some(id => !text(id, 200) || !id.trim())) return 'completed Boss Quest list is invalid';
        } else if (key === 'system_v2_goals') {
            const seenGoalIds = new Set();
            if (!list(parsed, 1000) || parsed.some(goal => {
                if (!objectLike(goal) || !text(goal.id, 200) || !goal.id.trim() || goal.id !== goal.id.trim() || !text(goal.title, 100) || !goal.title.trim() || seenGoalIds.has(goal.id)) return true;
                seenGoalIds.add(goal.id);
                if (goal.stat !== undefined && goal.stat !== null && goal.stat !== '' && !VALID_STATS.has(goal.stat)) return true;
                if (goal.targetDate !== undefined && goal.targetDate !== '' && (!text(goal.targetDate, 10) || !isValidDateOnly(goal.targetDate))) return true;
                if (goal.targetCount !== undefined && (!Number.isInteger(goal.targetCount) || goal.targetCount < 1 || goal.targetCount > 20)) return true;
                if (goal.progressCount !== undefined && (!Number.isInteger(goal.progressCount) || goal.progressCount < 0 || goal.progressCount > (goal.targetCount || 20))) return true;
                if (goal.completed !== undefined && typeof goal.completed !== 'boolean') return true;
                if (goal.completionMode !== undefined && !['', 'evidence', 'manual'].includes(goal.completionMode)) return true;
                if (goal.createdAt !== undefined && goal.createdAt !== '' && !isValidTimestamp(goal.createdAt)) return true;
                if (goal.completedAt !== undefined && goal.completedAt !== '' && !isValidTimestamp(goal.completedAt)) return true;
                const targetCount = goal.targetCount || 3;
                const evidenceCount = Array.isArray(goal.evidence) ? goal.evidence.length : 0;
                const expectedProgress = Math.min(evidenceCount, targetCount);
                const progressCount = goal.progressCount === undefined ? expectedProgress : goal.progressCount;
                // Counter values are derived from evidence; they must never be able to
                // grant completion independently of the unique Quest IDs in the evidence list.
                if (goal.progressCount !== undefined && progressCount !== expectedProgress) return true;
                if (goal.completed === false && progressCount >= targetCount) return true;
                if (goal.completionMode === 'manual' && goal.completed !== true) return true;
                if (goal.completionMode === 'evidence' && (goal.completed !== true || progressCount < targetCount
                    || evidenceCount < targetCount)) return true;
                if (goal.evidence !== undefined) {
                    const seenQuestIds = new Set();
                    if (!list(goal.evidence, 20) || goal.evidence.some(item => {
                        if (!objectLike(item) || !text(item.questId, 200) || !item.questId.trim()
                            || !text(item.title, 180) || !item.title.trim() || seenQuestIds.has(item.questId)
                            || (item.stat !== null && item.stat !== undefined && !VALID_STATS.has(item.stat))
                            || (item.xp !== undefined && !finiteRange(item.xp, 0, 1000000))
                            || (item.at !== undefined && item.at !== '' && (!text(item.at, 80) || !isValidTimestamp(item.at)))) return true;
                        seenQuestIds.add(item.questId);
                        return false;
                    })) return true;
                }
                return false;
            })) return 'goals must be an array of valid goal records';
        }
        return null;
    }

    function createBackup(storage, options = {}) {
        const target = storage || global.localStorage;
        if (!target) throw new Error('Browser storage is not available.');
        const entries = getEntries(target);
        if (!Object.prototype.hasOwnProperty.call(entries, 'system_v2_save')) {
            throw new Error('A restorable backup requires the main player save. Create or load progress, then export again.');
        }
        const now = (options.now instanceof Date ? options.now : new Date()).toISOString();
        const meta = {
            app: APP_NAME,
            formatVersion: CURRENT_BACKUP_VERSION,
            exportedAt: now,
            storageKeys: Object.keys(entries).length,
            checksumAlgorithm: 'fnv1a32',
            checksum: checksumForEntries(entries),
            checksumPurpose: 'accidental-corruption-detection-only'
        };
        const data = { ...entries, __system_backup_meta: JSON.stringify(meta) };
        const serialized = JSON.stringify(data, null, 2);
        if (byteLength(serialized) > DEFAULT_MAX_BACKUP_BYTES) {
            throw new Error('The generated backup exceeds the 5 MB safety limit.');
        }
        // Never label a backup "verified" unless the same restore validator accepts
        // it. This catches malformed optional records before they enter auto-snapshots.
        validateBackup(data);
        return { data, serialized, meta };
    }

    function validateBackup(imported, options = {}) {
        const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : DEFAULT_MAX_BACKUP_BYTES;
        if (!imported || typeof imported !== 'object' || Array.isArray(imported)) throw new Error('Backup root must be a JSON object.');
        if (byteLength(JSON.stringify(imported)) > maxBytes) throw new Error('Backup exceeds the 5 MB safety limit.');
        if (typeof imported.__system_backup_meta !== 'string') throw new Error('This file does not look like a SYSTEM backup.');
        const metaParsed = safeParse(imported.__system_backup_meta);
        if (!metaParsed.ok || !metaParsed.value || typeof metaParsed.value !== 'object') throw new Error('Backup metadata is invalid.');
        const meta = metaParsed.value;
        if (meta.app !== APP_NAME || ![1, CURRENT_BACKUP_VERSION].includes(meta.formatVersion)) throw new Error('Unsupported backup format.');

        const entries = {};
        for (const [key, value] of Object.entries(imported)) {
            if (key === '__system_backup_meta') continue;
            if (!isAppKey(key)) throw new Error(`Unexpected backup key: ${key.slice(0, 80)}`);
            if (typeof value !== 'string') throw new Error(`Backup value for ${key} must be a string.`);
            if (byteLength(value) > 2 * 1024 * 1024) throw new Error(`Backup value for ${key} is too large.`);
            entries[key] = value;
        }
        const keys = Object.keys(entries);
        if (keys.length === 0) throw new Error('No SYSTEM data was found in this backup.');
        if (!Object.prototype.hasOwnProperty.call(entries, 'system_v2_save')) {
            throw new Error('Backup is missing the main player save. Restore was blocked to prevent losing current progress.');
        }
        if (keys.length > MAX_ENTRIES) throw new Error(`Backup contains more than ${MAX_ENTRIES} entries.`);
        if (Number.isFinite(meta.storageKeys) && meta.storageKeys !== keys.length) throw new Error('Backup entry count does not match its metadata.');

        for (const [key, raw] of Object.entries(entries)) {
            if (STRING_KEYS.has(key)) {
                if (raw.length > 200) throw new Error(`Text value for ${key} is too long.`);
                if (key === 'system_v2_quest_date' && raw && !isValidDateOnly(raw)) throw new Error('Daily quest date is not a valid calendar date.');
                continue;
            }
            const parsed = safeParse(raw);
            if (!parsed.ok) throw new Error(`Invalid JSON stored for ${key}. No data was changed.`);
            const issue = validateKnownValue(key, parsed.value);
            if (issue) throw new Error(`Invalid data for ${key}: ${issue}.`);
        }

        if (meta.formatVersion === CURRENT_BACKUP_VERSION) {
            if (meta.checksumAlgorithm !== 'fnv1a32' || typeof meta.checksum !== 'string') throw new Error('Backup integrity metadata is missing.');
            if (checksumForEntries(entries) !== meta.checksum) throw new Error('Backup integrity check failed. The file may have been changed or corrupted.');
        }
        return { meta, entries, entryCount: keys.length, byteCount: byteLength(JSON.stringify(imported)) };
    }

    function applyEntriesAtomically(entries, storage, options = {}) {
        const target = storage || global.localStorage;
        const fail = (error, rolledBack = false) => ({ ok: false, error, rolledBack });
        if (!target) return fail(new Error('Browser storage is not available.'));
        if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
            return fail(new Error('Storage entries must be a plain object.'));
        }

        // Validate the entire write set before touching storage. A malformed late entry
        // must not trigger a partial restore or delete the current namespace first.
        let pairs;
        try { pairs = Object.entries(entries); }
        catch (error) { return fail(error); }
        for (const [key, value] of pairs) {
            if (!isAppKey(key) || typeof value !== 'string') {
                return fail(new Error('Unsafe backup entry encountered before applying any changes.'));
            }
        }

        const replacePrefixes = options.replacePrefixes === true;
        // Namespace replacement may only target prefixes owned by this application.
        // Ignore arbitrary caller-provided prefixes so an option cannot erase unrelated
        // localStorage values belonging to another site feature.
        const requestedPrefixes = Array.isArray(options.prefixes) ? options.prefixes : APP_PREFIXES;
        const prefixes = requestedPrefixes.filter(prefix => typeof prefix === 'string' && APP_PREFIXES.includes(prefix));
        if (replacePrefixes && prefixes.length === 0) {
            return fail(new Error('No valid SYSTEM namespace prefix was supplied for replacement.'));
        }

        const old = new Map();
        const incomingKeys = new Set(pairs.map(([key]) => key));
        try {
            for (let i = 0; i < target.length; i++) {
                const key = target.key(i);
                if (key && prefixes.some(prefix => key.startsWith(prefix))) old.set(key, target.getItem(key));
            }
            for (const key of incomingKeys) old.set(key, target.getItem(key));
        } catch (error) {
            return fail(error);
        }

        try {
            if (replacePrefixes) {
                for (const key of old.keys()) {
                    if (prefixes.some(prefix => key.startsWith(prefix)) && !incomingKeys.has(key)) target.removeItem(key);
                }
            }
            for (const [key, value] of pairs) target.setItem(key, value);
            return { ok: true, entryCount: incomingKeys.size, rolledBack: false };
        } catch (error) {
            let rollbackOk = true;

            // Free space before rollback. Under quota pressure, restoring an old (larger)
            // value while newly imported values remain can fail and leave mixed progress.
            // Incoming keys have already been snapshotted in `old`, so they can all be
            // removed first and then restored to their original values safely.
            for (const key of incomingKeys) {
                try { target.removeItem(key); } catch (_) { rollbackOk = false; }
            }
            for (const [key, value] of old) {
                try { value === null ? target.removeItem(key) : target.setItem(key, value); }
                catch (_) { rollbackOk = false; }
            }
            // If rollback itself failed, make a best effort to remove keys that were not
            // present before the operation; never leave newly introduced imported keys.
            for (const key of incomingKeys) {
                if (old.get(key) === null) {
                    try { target.removeItem(key); } catch (_) { rollbackOk = false; }
                }
            }
            return fail(error, rollbackOk);
        }
    }

    function snapshotNamespace(storage) {
        const target = storage || global.localStorage;
        if (!target) return {};
        return getEntries(target);
    }

    function restoreNamespace(snapshot, storage) {
        const entries = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : {};
        return applyEntriesAtomically(entries, storage || global.localStorage, { replacePrefixes: true });
    }

    function inspect(storage) {
        try {
            const target = storage || global.localStorage;
            if (!target) return { available: false, appKeyCount: 0, approximateBytes: 0, malformedJsonKeys: [], invalidDataKeys: [], missingCoreData: ['system_v2_save'], backupReady: false };
            const malformedJsonKeys = [];
            const invalidDataKeys = [];
            let approximateBytes = 0;
            const keys = [];
            for (let i = 0; i < target.length; i++) {
                const key = target.key(i);
                if (!key || !isAppKey(key)) continue;
                const value = target.getItem(key) || '';
                keys.push(key);
                approximateBytes += byteLength(key) + byteLength(value);
                if (STRING_KEYS.has(key)) {
                    if (value.length > 200 || (key === 'system_v2_quest_date' && value && !isValidDateOnly(value))) invalidDataKeys.push(key);
                    continue;
                }
                const parsed = safeParse(value);
                if (!parsed.ok) {
                    malformedJsonKeys.push(key);
                    continue;
                }
                if (validateKnownValue(key, parsed.value)) invalidDataKeys.push(key);
            }
            const missingCoreData = ['system_v2_save'].filter(key => target.getItem(key) === null);
            let progressEvents = 0;
            const history = safeParse(target.getItem('system_v2_progress_history') || '[]');
            if (history.ok && Array.isArray(history.value)) progressEvents = history.value.length;
            return {
                available: true,
                appKeyCount: keys.length,
                approximateBytes,
                malformedJsonKeys,
                invalidDataKeys,
                missingCoreData,
                progressEvents,
                backupReady: missingCoreData.length === 0 && malformedJsonKeys.length === 0 && invalidDataKeys.length === 0,
                checkedAt: new Date().toISOString()
            };
        } catch (error) {
            return { available: false, error: String(error && error.message || error), appKeyCount: 0, approximateBytes: 0, malformedJsonKeys: [], invalidDataKeys: [], missingCoreData: ['system_v2_save'], progressEvents: 0, backupReady: false };
        }
    }

    global.SYSTEMStorage = Object.freeze({
        APP_NAME,
        CURRENT_BACKUP_VERSION,
        APP_PREFIXES: APP_PREFIXES.slice(),
        isAppKey,
        checksumForEntries,
        createBackup,
        validateBackup,
        applyEntriesAtomically,
        snapshotNamespace,
        restoreNamespace,
        inspect
    });
})(typeof window !== 'undefined' ? window : globalThis);
