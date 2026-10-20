/* SYSTEM — evidence-aware assessment log; assessments never grant progression rewards. */
(function attachSkillMastery(global) {
  'use strict';
  const KEY = 'system_v2_skill_assessments';
  const MAX = 300;
  const STATS = new Set(['entrepreneurship', 'global-skills', 'mathematics', 'computer', 'physics', 'unique-thinking']);
  const TYPES = new Set(['practice', 'test', 'project']);
  function valid(item) {
    return !!item && typeof item.id === 'string' && typeof item.at === 'string' &&
      STATS.has(item.stat) && TYPES.has(item.type) && Number.isInteger(item.score) &&
      item.score >= 0 && item.score <= 100 && typeof item.evidence === 'boolean' && typeof item.note === 'string' &&
      (item.skillId === undefined || (typeof item.skillId === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}._:-]{0,119}$/u.test(item.skillId))) &&
      (item.skillTitle === undefined || (typeof item.skillTitle === 'string' && item.skillTitle.trim().length > 0 && item.skillTitle.length <= 180)) &&
      (item.questId === undefined || (typeof item.questId === 'string' && item.questId.length <= 160));
  }
  function load() {
    try {
      const data = JSON.parse(global.localStorage.getItem(KEY) || '[]');
      return Array.isArray(data) ? data.filter(valid).slice(-MAX) : [];
    } catch (_) { return []; }
  }
  let records = load();
  let hydration = Promise.resolve();
  const durable = () => global.SYSTEMDurableSkillAssessments;
  // One-way compatibility migration: retain localStorage and copy missing records to IndexedDB.
  hydration = Promise.resolve().then(async () => {
    const store = durable(); if (!store || typeof store.list !== 'function' || typeof store.save !== 'function') return;
    let saved = await store.list(MAX);
    const known = new Set(saved.map(x => x.id));
    for (const item of records) { if (!known.has(item.id)) { try { const result = await store.save(item); if (result.saved || result.duplicate) known.add(item.id); } catch (_) { /* legacy copy remains intact */ } } }
    saved = await store.list(MAX);
    records = saved.slice().reverse();
    // Keep existing localStorage copy as a recovery path; do not delete or overwrite it during migration.
  }).catch(() => {});
  function persist() {
    try { global.localStorage.setItem(KEY, JSON.stringify(records)); return true; }
    catch (_) { return false; }
  }
  function copy(x) { return { ...x }; }
  function readiness(items) {
    const recent = items.slice(-3);
    const average = recent.length ? Math.round(recent.reduce((sum, x) => sum + x.score, 0) / recent.length) : null;
    const evidence = recent.some(x => x.evidence && (x.type === 'test' || x.type === 'project'));
    return { count: items.length, recentCount: recent.length, average, evidence, ready: recent.length >= 2 && average >= 80 && evidence };
  }
  const api = {
    ready() { return hydration; },
    async record(input = {}) {
      await hydration;
      const stat = String(input.stat || '');
      const type = String(input.type || '');
      const score = Number(input.score);
      if (!STATS.has(stat)) return { ok: false, error: 'invalid-stat' };
      if (!TYPES.has(type)) return { ok: false, error: 'invalid-type' };
      if (!Number.isInteger(score) || score < 0 || score > 100) return { ok: false, error: 'invalid-score' };
      const rawSkillId = String(input.skillId || '').trim();
      const rawSkillTitle = String(input.skillTitle || '').trim();
      if (rawSkillId && (!/^[\p{L}\p{N}][\p{L}\p{N}._:-]{0,119}$/u.test(rawSkillId) || !rawSkillTitle || rawSkillTitle.length > 180)) return { ok: false, error: 'invalid-skill' };
      const questId = String(input.questId || '').trim().slice(0, 160);
      if (rawSkillId && questId && input.evidence === true && records.some(x => x.skillId === rawSkillId && x.questId === questId && x.evidence === true)) return { ok: false, error: 'duplicate-quest-evidence' };
      const item = { id: 'assessment-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(), stat, type, score, evidence: input.evidence === true, note: String(input.note || '').trim().slice(0, 500), ...(rawSkillId ? { skillId: rawSkillId, skillTitle: rawSkillTitle } : {}), ...(questId ? { questId } : {}) };
      const previous = records;
      const store = durable();
      if (store && typeof store.save === 'function') {
        try {
          const saved = await store.save(item);
          if (!saved.saved && saved.duplicate) return { ok: false, error: 'duplicate-quest-evidence' };
        } catch (_) { return { ok: false, error: 'storage-unavailable' }; }
      }
      records = records.concat(item).slice(-MAX);
      if (!persist()) { records = previous; return { ok: false, error: 'storage-unavailable' }; }
      return { ok: true, assessment: copy(item) };
    },
    list(limit = 30) { const n = Math.max(1, Math.min(MAX, Math.floor(Number(limit) || 30))); return records.slice(-n).reverse().map(copy); },
    summary() {
      const byStat = {};
      for (const stat of STATS) { const items = records.filter(x => x.stat === stat); byStat[stat] = readiness(items); }
      const skillIds = [...new Set(records.filter(x => x.skillId).map(x => x.skillId))];
      const bySkill = Object.fromEntries(skillIds.map(skillId => {
        const items = records.filter(x => x.skillId === skillId);
        const result = readiness(items);
        return [skillId, { ...result, title: items[items.length - 1].skillTitle || skillId, stat: items[items.length - 1].stat, status: result.ready ? 'ready-for-review' : (items.some(x => x.evidence) ? 'evidence-recorded' : 'learning') }];
      }));
      return { total: records.length, readyCount: Object.values(byStat).filter(x => x.ready).length, byStat, bySkill };
    },
    catalog(stat) {
      const curriculum = global.SYSTEMSkillCurriculum || {};
      const tools = global.SYSTEMSkillCurriculumTools;
      const branch = curriculum[String(stat || '')];
      if (!branch || !tools || typeof tools.flatten !== 'function') return [];
      const output = [];
      Object.keys(branch).sort((a, b) => Number(a) - Number(b)).forEach(index => {
        tools.flatten(branch[index]).forEach(node => output.push({ id: node.id, title: node.fa || node.en || node.id, titleEn: node.en || node.fa || node.id, stat, branch: Number(index) }));
      });
      return output;
    },
    skillSummary(skillId) {
      const items = records.filter(x => x.skillId === String(skillId || ''));
      const result = readiness(items);
      return { ...result, skillId: String(skillId || ''), title: items.length ? items[items.length - 1].skillTitle : null, status: result.ready ? 'ready-for-review' : (items.some(x => x.evidence) ? 'evidence-recorded' : 'learning') };
    },
    exportJSON() { return JSON.stringify({ app: 'SYSTEM', formatVersion: 1, exportedAt: new Date().toISOString(), assessments: records.map(copy) }, null, 2); }
  };
  global.SYSTEMSkillMastery = api;
})(window);
