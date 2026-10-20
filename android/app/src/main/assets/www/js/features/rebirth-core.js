/* SYSTEM — additive, idempotent local activity ledger. Existing storage keys are untouched. */
(function (w) {
  'use strict';
  if (w.SYSTEMRebirth) return;
  const KEY = 'system.rebirth.activity-ledger.v1';
  const MAX_EVENTS = 2000;
  const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  const emit = (type, payload = {}, id) => {
    if (!/^[a-z][a-z0-9_.-]{1,63}$/i.test(String(type))) throw new TypeError('Invalid activity type');
    const events = read();
    const eventId = String(id || (w.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)));
    if (events.some(e => e.id === eventId)) return { ok: true, duplicate: true, event: events.find(e => e.id === eventId) };
    const safePayload = JSON.parse(JSON.stringify(payload, (k, v) => /password|token|secret|api.?key/i.test(k) ? undefined : v));
    const event = { id: eventId, type: String(type), at: new Date().toISOString(), payload: safePayload };
    events.push(event);
    try { localStorage.setItem(KEY, JSON.stringify(events.slice(-MAX_EVENTS))); }
    catch (error) { return { ok: false, error: 'storage_unavailable' }; }
    w.dispatchEvent(new CustomEvent('system:activity', { detail: event }));
    return { ok: true, duplicate: false, event };
  };
  w.SYSTEMRebirth = Object.freeze({ version: '8.0.0', emit, history: (limit = 100) => read().slice(-Math.max(0, Math.min(500, Number(limit) || 100))).reverse(), clear: () => { try { localStorage.removeItem(KEY); return true; } catch (_) { return false; } } });
})(window);
