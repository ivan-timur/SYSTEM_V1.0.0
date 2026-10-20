/** Real ES-module boundary for the storage/backup service during gradual migration. */
import "../core/storage.js";

export const SYSTEMStorage = window.SYSTEMStorage;
if (!SYSTEMStorage) {
    throw new Error("SYSTEM storage service failed to initialize.");
}
