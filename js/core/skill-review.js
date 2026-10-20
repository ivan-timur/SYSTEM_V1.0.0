/* SYSTEM — Skill Review: lightweight evidence-aware self-assessment, no XP farming. */
(function attachSystemSkillReview(global) {
  'use strict';
  const KEY = 'system_v2_skill_reviews';
  const MAX_REVIEWS = 300;
  const VALID_STATS = new Set(['entrepreneurship', 'global-skills', 'mathematics', 'computer', 'physics', 'unique-thinking']);

  function load() {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(item => item && typeof item.id === 'string' && typeof item.at === 'string' &&
        VALID_STATS.has(item.stat) && Number.isInteger(item.rating) && item.rating >= 1 && item.rating <= 5 &&
        typeof item.evidence === 'boolean' && typeof item.note === 'string').slice(-MAX_REVIEWS);
    } catch (_) { return []; }
  }

  let reviews = load();
  function persist() {
    try { global.localStorage.setItem(KEY, JSON.stringify(reviews)); return true; }
    catch (_) { return false; }
  }
  function safeReview(item) { return { ...item }; }

  const api = {
    record(input = {}) {
      const stat = String(input.stat || '');
      const rating = Number(input.rating);
      if (!VALID_STATS.has(stat)) return { ok: false, error: 'invalid-stat' };
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: 'invalid-rating' };
      const item = {
        id: 'review-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
        at: new Date().toISOString(), stat, rating,
        evidence: input.evidence === true,
        note: String(input.note || '').trim().slice(0, 500)
      };
      const previous = reviews;
      reviews = reviews.concat(item).slice(-MAX_REVIEWS);
      if (!persist()) { reviews = previous; return { ok: false, error: 'storage-unavailable' }; }
      return { ok: true, review: safeReview(item) };
    },
    list(limit = 30) {
      const count = Math.max(1, Math.min(MAX_REVIEWS, Math.floor(Number(limit) || 30)));
      return reviews.slice(-count).reverse().map(safeReview);
    },
    summary() {
      const byStat = {};
      for (const stat of VALID_STATS) {
        const items = reviews.filter(item => item.stat === stat);
        byStat[stat] = { count: items.length, average: items.length ? Math.round(items.reduce((s, x) => s + x.rating, 0) / items.length * 10) / 10 : null, latestAt: items.length ? items[items.length - 1].at : null };
      }
      return { total: reviews.length, evidenceCount: reviews.filter(item => item.evidence).length, byStat };
    },
    recommendation() {
      const summary = api.summary();
      const reviewed = Object.entries(summary.byStat).filter(([, value]) => value.count > 0);
      if (!reviewed.length) return { stat: null, reason: 'no-data' };
      reviewed.sort((a, b) => (a[1].average - b[1].average) || (Date.parse(a[1].latestAt) - Date.parse(b[1].latestAt)));
      return { stat: reviewed[0][0], average: reviewed[0][1].average, count: reviewed[0][1].count, reason: 'lowest-self-rating' };
    },
    exportJSON() {
      return JSON.stringify({ app: 'SYSTEM', formatVersion: 1, exportedAt: new Date().toISOString(), reviews: reviews.map(safeReview) }, null, 2);
    }
  };
  global.SYSTEMSkillReview = api;
})(window);
