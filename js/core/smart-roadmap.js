/* SYSTEM — deadline-aware roadmap intelligence; roadmap items never grant XP/coins. */
(function attachSmartRoadmap(global) {
  'use strict';

  const KEY = 'system_v2_smart_roadmap';
  const MAX = 200;
  const MAX_IMPORT_CHARS = 512 * 1024;
  const STATS = new Set(['entrepreneurship', 'global-skills', 'mathematics', 'computer', 'physics', 'unique-thinking']);
  const PRIORITIES = new Set(['low', 'normal', 'high']);
  const STATUSES = new Set(['todo', 'doing', 'done']);

  function validDateOnly(value) {
    if (value === '') return true;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00.000Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function validTimestamp(value, allowEmpty) {
    if (allowEmpty && value === '') return true;
    return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));
  }

  function valid(item) {
    return !!item && typeof item === 'object' && !Array.isArray(item) &&
      typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 160 &&
      typeof item.title === 'string' && item.title.trim().length > 0 && item.title.length <= 120 &&
      typeof item.note === 'string' && item.note.length <= 500 &&
      STATS.has(item.stat) && PRIORITIES.has(item.priority) && STATUSES.has(item.status) &&
      validTimestamp(item.createdAt, false) && validTimestamp(item.completedAt, true) &&
      validDateOnly(item.dueDate);
  }

  function load() {
    try {
      const data = JSON.parse(global.localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(data)) return [];
      const seen = new Set();
      return data.filter(item => {
        if (!valid(item) || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      }).slice(-MAX);
    } catch (_) { return []; }
  }

  let items = load();
  function persist() {
    try { global.localStorage.setItem(KEY, JSON.stringify(items)); return true; }
    catch (_) { return false; }
  }
  function clone(item) { return { ...item }; }
  function fail(error) { return { ok: false, error }; }
  function makeId() { return 'roadmap-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
  function localDateString(date = new Date()) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function announceChange(external = false) {
    try {
      if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
        global.dispatchEvent(new global.CustomEvent('system-roadmap-updated', { detail: { external } }));
      }
    } catch (_) { /* Notifications must never invalidate a successful save. */ }
  }
  function sameItem(a, b) {
    return a.id === b.id && a.title === b.title && a.note === b.note && a.stat === b.stat &&
      a.priority === b.priority && a.dueDate === b.dueDate && a.status === b.status &&
      a.createdAt === b.createdAt && a.completedAt === b.completedAt;
  }
  function normalizeFields(input, old) {
    const read = key => Object.prototype.hasOwnProperty.call(input, key) ? input[key] : old[key];
    const title = String(read('title') == null ? '' : read('title')).trim().slice(0, 120);
    const note = String(read('note') == null ? '' : read('note')).trim().slice(0, 500);
    const stat = String(read('stat') == null ? '' : read('stat'));
    const priority = String(read('priority') == null ? '' : read('priority'));
    const dueDate = String(read('dueDate') == null ? '' : read('dueDate'));
    if (!title) return fail('invalid-title');
    if (!STATS.has(stat)) return fail('invalid-stat');
    if (!PRIORITIES.has(priority)) return fail('invalid-priority');
    if (!validDateOnly(dueDate)) return fail('invalid-date');
    return { ok: true, fields: { title, note, stat, priority, dueDate } };
  }

  const api = {
    add(input = {}) {
      if (items.length >= MAX) return fail('limit-reached');
      const base = { title: '', note: '', stat: '', priority: 'normal', dueDate: '' };
      const normalized = normalizeFields(input, base);
      if (!normalized.ok) return normalized;
      const item = {
        id: makeId(), ...normalized.fields, status: 'todo',
        createdAt: new Date().toISOString(), completedAt: ''
      };
      const previous = items;
      items = items.concat(item);
      if (!persist()) { items = previous; return fail('storage-unavailable'); }
      announceChange();
      return { ok: true, item: clone(item) };
    },

    update(id, input = {}) {
      const index = items.findIndex(item => item.id === String(id));
      if (index < 0) return fail('not-found');
      const old = items[index];
      const normalized = normalizeFields(input, old);
      if (!normalized.ok) return normalized;
      const updated = { ...old, ...normalized.fields };
      if (sameItem(old, updated)) return { ok: true, item: clone(old), unchanged: true };
      const previous = items;
      items = items.map((item, i) => i === index ? updated : item);
      if (!persist()) { items = previous; return fail('storage-unavailable'); }
      announceChange();
      return { ok: true, item: clone(updated) };
    },

    setStatus(id, status) {
      if (!STATUSES.has(status)) return fail('invalid-status');
      const index = items.findIndex(item => item.id === String(id));
      if (index < 0) return fail('not-found');
      const old = items[index];
      if (old.status === status) return { ok: true, item: clone(old), unchanged: true };
      const previous = items;
      items = items.map((item, i) => i === index ? {
        ...item, status,
        completedAt: status === 'done' ? (item.completedAt || new Date().toISOString()) : ''
      } : item);
      if (!persist()) { items = previous; return fail('storage-unavailable'); }
      announceChange();
      return { ok: true, item: clone(items.find(item => item.id === String(id))) };
    },

    remove(id) {
      const previous = items;
      const next = items.filter(item => item.id !== String(id));
      if (next.length === previous.length) return fail('not-found');
      items = next;
      if (!persist()) { items = previous; return fail('storage-unavailable'); }
      announceChange();
      return { ok: true };
    },

    list() {
      const rank = { high: 0, normal: 1, low: 2 };
      const today = localDateString();
      const urgency = item => item.status === 'done' ? 3 : !item.dueDate ? 2 : item.dueDate < today ? 0 : item.dueDate === today ? 1 : 2;
      return items.map(clone).sort((a, b) => (a.status === 'done') - (b.status === 'done') ||
        urgency(a) - urgency(b) || rank[a.priority] - rank[b.priority] ||
        (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31') ||
        a.createdAt.localeCompare(b.createdAt));
    },

    summary() {
      const done = items.filter(item => item.status === 'done').length;
      const today = localDateString();
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 7);
      const horizonDate = localDateString(horizon);
      const openDated = items.filter(item => item.status !== 'done' && item.dueDate);
      const overdue = openDated.filter(item => item.dueDate < today).length;
      const dueToday = openDated.filter(item => item.dueDate === today).length;
      const dueSoon = openDated.filter(item => item.dueDate >= today && item.dueDate <= horizonDate).length;
      const nextDeadline = openDated.map(item => item.dueDate).filter(date => date >= today).sort()[0] || '';
      return {
        total: items.length,
        done,
        active: items.length - done,
        percent: items.length ? Math.round(done / items.length * 100) : 0,
        overdue, dueToday, dueSoon, nextDeadline,
        byStat: Object.fromEntries([...STATS].map(stat => [stat, {
          total: items.filter(item => item.stat === stat).length,
          done: items.filter(item => item.stat === stat && item.status === 'done').length
        }]))
      };
    },

    exportJSON() {
      return JSON.stringify({ app: 'SYSTEM', formatVersion: 1, exportedAt: new Date().toISOString(), milestones: items.map(clone) }, null, 2);
    },

    importJSON(raw, options = {}) {
      if (typeof raw !== 'string') return fail('invalid-backup');
      if (raw.length > MAX_IMPORT_CHARS) return fail('backup-too-large');
      let parsed;
      try { parsed = JSON.parse(raw); } catch (_) { return fail('invalid-json'); }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.app !== 'SYSTEM' ||
          parsed.formatVersion !== 1 || !Array.isArray(parsed.milestones)) return fail('invalid-backup');
      if (parsed.milestones.length > MAX) return fail('limit-reached');
      if (!parsed.milestones.every(valid)) return fail('invalid-item');
      const ids = new Set();
      for (const item of parsed.milestones) {
        if (ids.has(item.id)) return fail('duplicate-id');
        ids.add(item.id);
      }
      const mode = options.mode || 'merge';
      if (mode !== 'merge' && mode !== 'replace') return fail('invalid-mode');
      let next;
      let imported = 0;
      let skipped = 0;
      if (mode === 'replace') {
        next = parsed.milestones.map(clone);
        imported = next.length;
      } else {
        next = items.map(clone);
        const byId = new Map(next.map(item => [item.id, item]));
        for (const rawItem of parsed.milestones) {
          let item = clone(rawItem);
          const existing = byId.get(item.id);
          if (existing && sameItem(existing, item)) { skipped++; continue; }
          if (existing) item.id = makeId();
          while (byId.has(item.id)) item.id = makeId();
          byId.set(item.id, item);
          next.push(item);
          imported++;
        }
      }
      if (next.length > MAX) return fail('limit-reached');
      const previous = items;
      items = next;
      if (!persist()) { items = previous; return fail('storage-unavailable'); }
      announceChange();
      return { ok: true, imported, skipped, total: items.length, mode };
    },

    refresh() {
      items = load();
      return this.list();
    },

    insights() {
      const today = localDateString();
      const now = Date.now();
      const open = items.filter(item => item.status !== 'done');
      const inProgress = open.filter(item => item.status === 'doing');
      const staleInProgress = inProgress.filter(item => {
        const created = Date.parse(item.createdAt);
        return Number.isFinite(created) && now - created >= 7 * 24 * 60 * 60 * 1000;
      });
      const byStat = Object.fromEntries([...STATS].map(stat => {
        const all = items.filter(item => item.stat === stat);
        const done = all.filter(item => item.status === 'done').length;
        return [stat, { total: all.length, done, open: all.length - done,
          completionPercent: all.length ? Math.round(done / all.length * 100) : 0 }];
      }));
      const openByPriority = { high: 0, normal: 0, low: 0 };
      for (const item of open) openByPriority[item.priority]++;
      const weakestActiveStat = Object.entries(byStat)
        .filter(([, value]) => value.total > 0 && value.open > 0)
        .sort((a, b) => a[1].completionPercent - b[1].completionPercent || b[1].open - a[1].open)[0];
      const overdueItems = open.filter(item => item.dueDate && item.dueDate < today);
      const dueTodayItems = open.filter(item => item.dueDate === today);
      const dueSoonItems = open.filter(item => item.dueDate && item.dueDate > today && item.dueDate <= horizonDate);
      const completed = items.length - open.length;
      const completionPercent = items.length ? Math.round(completed / items.length * 100) : 0;
      // Transparent, explainable workload signal; it is a planning aid, not a prediction.
      const pressureScore = Math.min(100, overdueItems.length * 18 + dueTodayItems.length * 12 +
        dueSoonItems.length * 5 + openByPriority.high * 4 + staleInProgress.length * 3);
      let recommendation = 'start-small';
      if (overdueItems.length) recommendation = 'resolve-overdue';
      else if (dueTodayItems.length) recommendation = 'finish-today';
      else if (staleInProgress.length) recommendation = 'review-stalled';
      else if (openByPriority.high > 0) recommendation = 'high-priority';
      else if (open.length === 0 && items.length > 0) recommendation = 'plan-next';
      else if (open.length === 0) recommendation = 'create-first';
      return {
        generatedAt: new Date().toISOString(),
        openCount: open.length,
        completedCount: completed,
        completionPercent,
        inProgressCount: inProgress.length,
        staleInProgressCount: staleInProgress.length,
        staleInProgressIds: staleInProgress.map(item => item.id),
        highPriorityOpenCount: openByPriority.high,
        openByPriority,
        overdueCount: overdueItems.length,
        dueTodayCount: dueTodayItems.length,
        dueSoonCount: dueSoonItems.length,
        pressureScore,
        pressureBand: pressureScore >= 70 ? 'high' : pressureScore >= 35 ? 'medium' : 'low',
        recommendation,
        weakestActiveStat: weakestActiveStat ? { stat: weakestActiveStat[0], ...weakestActiveStat[1] } : null,
        byStat
      };
    },

    weeklyReview() {
      // Rolling review based on retained timestamps; this is not a historical snapshot.
      const now = Date.now();
      const windowStart = now - 7 * 24 * 60 * 60 * 1000;
      const recentlyCreated = items.filter(item => {
        const time = Date.parse(item.createdAt);
        return Number.isFinite(time) && time >= windowStart && time <= now;
      });
      const recentlyCompleted = items.filter(item => {
        const time = Date.parse(item.completedAt);
        return item.status === 'done' && Number.isFinite(time) && time >= windowStart && time <= now;
      });
      const overdueOpen = items.filter(item => item.status !== 'done' && item.dueDate && item.dueDate < localDateString());
      const completedByStat = Object.fromEntries([...STATS].map(stat => [stat, recentlyCompleted.filter(item => item.stat === stat).length]));
      const leadingStat = Object.entries(completedByStat).filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      return {
        periodDays: 7, generatedAt: new Date(now).toISOString(),
        createdCount: recentlyCreated.length, completedCount: recentlyCompleted.length,
        overdueOpenCount: overdueOpen.length,
        netOpenChange: recentlyCreated.length - recentlyCompleted.length,
        completedByStat,
        leadingStat: leadingStat ? { stat: leadingStat[0], completedCount: leadingStat[1] } : null
      };
    },

    getLimit() { return MAX; }
  };

  if (typeof global.addEventListener === 'function') {
    global.addEventListener('storage', event => {
      if (event && (event.key === KEY || event.key === null)) {
        items = load();
        announceChange(true);
      }
    });
  }
  global.SYSTEMSmartRoadmap = api;
})(window);
