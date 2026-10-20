/* SYSTEM — Auto-snapshots (rolling local safety net).
 * Snapshots use the sys_autosnap_ prefix, which is NOT a SYSTEM-owned prefix, so they are
 * never included in exported backups and are never wiped by a restore. Best-effort only:
 * localStorage is not a database. Keep exporting real backups. */
(function (global) {
    "use strict";
    var PREFIX = "sys_autosnap_";
    var KEEP = 3;
    var MAX_BYTES = 1500000;

    function list() {
        var out = [];
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf(PREFIX) === 0) out.push(k);
            }
        } catch (e) { return []; }
        return out.sort();
    }

    function isQuotaError(error) {
        return Boolean(error && (
            error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
            error.code === 22 || error.code === 1014 || /quota|storage full|exceeded the storage/i.test(String(error.message || error))
        ));
    }

    function writeSnapshotPreservingRecovery(key, serialized) {
        try {
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            // Never delete snapshots for a generic failure (for example bad JSON or a
            // coding error). On quota-only failures, prune oldest backups one at a time,
            // always preserving at least one previously successful recovery point.
            if (!isQuotaError(error)) return false;
            var candidates = list().filter(function (existing) { return existing !== key; }).sort();
            while (candidates.length > 1) {
                try { localStorage.removeItem(candidates.shift()); } catch (removeError) { return false; }
                try {
                    localStorage.setItem(key, serialized);
                    return true;
                } catch (retryError) {
                    if (!isQuotaError(retryError)) return false;
                }
            }
            return false;
        }
    }

    function snapshot() {
        try {
            if (!global.SYSTEMStorage || !localStorage.getItem("system_v2_save")) return false;
            var day = new Date().toISOString().slice(0, 10);
            var key = PREFIX + day;
            var backup = global.SYSTEMStorage.createBackup(localStorage);
            if (!backup || !backup.serialized || backup.serialized.length > MAX_BYTES) return false;
            if (!writeSnapshotPreservingRecovery(key, backup.serialized)) return false;
            list().slice(0, Math.max(0, list().length - KEEP)).forEach(function (old) { localStorage.removeItem(old); });
            return true;
        } catch (e) {
            // A failed new snapshot must never wipe earlier valid snapshots. Recovery
            // points are more valuable than making room for an unverified replacement.
            return false;
        }
    }

    function restoreLatest() {
        var keys = list();
        if (!keys.length) return { ok: false, reason: "no-snapshot" };
        try {
            var imported = JSON.parse(localStorage.getItem(keys[keys.length - 1]));
            var v = global.SYSTEMStorage.validateBackup(imported); // throws if invalid
            var r = global.SYSTEMStorage.applyEntriesAtomically(v.entries, localStorage, { replacePrefixes: true });
            return r && r.ok ? { ok: true, key: keys[keys.length - 1] } : { ok: false, reason: "write-failed" };
        } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
    }

    function injectButton() {
        var exportBtn = document.getElementById("system-export-backup");
        if (!exportBtn || document.getElementById("system-restore-snapshot")) return;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.id = "system-restore-snapshot";
        btn.className = "system-primary-button";
        var n = list().length;
        btn.textContent = "Restore latest auto-snapshot (" + n + ")";
        btn.disabled = n === 0;
        btn.addEventListener("click", function () {
            if (!confirm("Replace current SYSTEM data with the latest automatic snapshot? Export a backup first if unsure.")) return;
            var r = restoreLatest();
            if (r.ok) location.reload(); else alert("Snapshot restore failed: " + r.reason);
        });
        exportBtn.parentNode.appendChild(btn);
    }

    global.SYSTEMAutoBackup = Object.freeze({ snapshot: snapshot, list: list, restoreLatest: restoreLatest, PREFIX: PREFIX });

    function start() {
        snapshot();
        document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") snapshot(); });
        try { new MutationObserver(injectButton).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* ignore */ }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(window);
