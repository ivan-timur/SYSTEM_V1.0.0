/**
 * Phase 11 — conservative storage capability gate.
 * This module never migrates, clears, or changes user data. It reports browser
 * capabilities and only requests persistent storage when explicitly invoked.
 */
const hasIndexedDB = () => typeof globalThis.indexedDB !== 'undefined';

export function inspectDurableStorageCapabilities() {
    const storage = globalThis.navigator?.storage;
    return Object.freeze({
        indexedDBAvailable: hasIndexedDB(),
        storageEstimateAvailable: typeof storage?.estimate === 'function',
        persistenceQueryAvailable: typeof storage?.persisted === 'function',
        persistenceRequestAvailable: typeof storage?.persist === 'function',
        localStorageAvailable: (() => {
            try {
                const candidate = globalThis.localStorage;
                if (!candidate) return false;
                const key = '__system_storage_probe__';
                candidate.setItem(key, '1');
                candidate.removeItem(key);
                return true;
            } catch { return false; }
        })(),
    });
}

/** Read-only storage estimate; unsupported browsers return a stable unavailable result. */
export async function estimateDurableStorage() {
    const estimate = globalThis.navigator?.storage?.estimate;
    if (typeof estimate !== 'function') return { available: false, usage: null, quota: null };
    try {
        const result = await estimate.call(globalThis.navigator.storage);
        return {
            available: true,
            usage: Number.isFinite(result?.usage) ? result.usage : null,
            quota: Number.isFinite(result?.quota) ? result.quota : null,
        };
    } catch {
        return { available: false, usage: null, quota: null };
    }
}

/**
 * Explicitly request browser-persistent storage. This is a best-effort request,
 * not a guarantee; callers must still handle eviction, quota and transaction errors.
 */
export async function requestPersistentStorage() {
    const storage = globalThis.navigator?.storage;
    if (typeof storage?.persist !== 'function') {
        return { supported: false, persisted: false };
    }
    try {
        const persisted = await storage.persist();
        return { supported: true, persisted: persisted === true };
    } catch {
        return { supported: true, persisted: false };
    }
}

/** Query persistent-storage status without prompting or changing anything. */
export async function queryPersistentStorage() {
    const storage = globalThis.navigator?.storage;
    if (typeof storage?.persisted !== 'function') {
        return { supported: false, persisted: false };
    }
    try {
        return { supported: true, persisted: (await storage.persisted()) === true };
    } catch {
        return { supported: true, persisted: false };
    }
}
