/**
 * SYSTEM Intelligence Engine 1.0.0
 * Local-first, evidence-aware analytics and adaptive mission planning.
 * No network access. It never changes XP, coins, rank, skills, or quest state.
 */
(function (global) {
  'use strict';

  const STAT_IDS = Object.freeze([
    'mathematics', 'physics', 'computer',
    'global-skills', 'entrepreneurship', 'unique-thinking'
  ]);
  const DAY_MS = 86400000;
  const HISTORY_LIMIT = 600;
  const LEARNING_MODES = Object.freeze(['practice', 'recall', 'explain', 'review', 'project', 'assessment', 'validation']);
  const EMPTY_MODE_COUNTS = () => Object.fromEntries([...LEARNING_MODES, 'unknown'].map(mode => [mode, 0]));
  const STAT_LABELS = Object.freeze({
    mathematics: { en: 'Mathematics', fa: 'ریاضیات' },
    physics: { en: 'Physics', fa: 'فزیک' },
    computer: { en: 'Computer & Programming', fa: 'کمپیوتر و برنامه‌نویسی' },
    'global-skills': { en: 'Global Skills', fa: 'مهارت‌های جهانی' },
    entrepreneurship: { en: 'Entrepreneurship', fa: 'کارآفرینی' },
    'unique-thinking': { en: 'Unique Thinking', fa: 'تفکر یگانه' }
  });

  // Natural-language focus cues let local planning honor a useful part of a free-text focus note.
  // This is transparent keyword matching, not a claim that a local model understands arbitrary text.
  const FOCUS_CUES = Object.freeze({
    mathematics: [
      'mathematics', 'mathematical', 'math', 'algebra', 'equation', 'equations', 'calculus',
      'geometry', 'trigonometry', 'probability', 'statistics', 'linear algebra', 'function',
      'functions', 'ریاضی', 'الجبر', 'جبر', 'معادله', 'معادلات', 'حسابان', 'هندسه', 'مثلثات', 'احتمال', 'آمار'
    ],
    physics: [
      'physics', 'mechanics', 'motion', 'force', 'energy', 'electricity', 'circuit', 'optics',
      'فیزیک', 'فزیک', 'میکانیک', 'حرکت', 'نیرو', 'انرژی', 'برق', 'مدار', 'نور'
    ],
    computer: [
      'computer', 'programming', 'programmer', 'python', 'javascript', 'coding', 'code', 'algorithm',
      'data structures', 'database', 'sql', 'web development', 'debug', 'git', 'کمپیوتر', 'کامپیوتر',
      'برنامه نویسی', 'برنامه‌نویسی', 'کدنویسی', 'پایتون', 'الگوریتم', 'ساختمان داده', 'دیتابیس', 'پایگاه داده'
    ],
    'global-skills': [
      'global skills', 'english', 'language', 'speaking', 'listening', 'writing', 'reading',
      'communication', 'presentation', 'vocabulary', 'pronunciation', 'انگلیسی', 'زبان', 'گفتاری',
      'شنیداری', 'نوشتاری', 'خواندن', 'مکالمه', 'ارتباطات', 'واژگان', 'تلفظ', 'ارائه'
    ],
    entrepreneurship: [
      'entrepreneurship', 'business', 'startup', 'start-up', 'marketing', 'sales', 'product',
      'customer', 'market research', 'negotiation', 'business model', 'کارآفرینی', 'کسب و کار',
      'تجارت', 'بازاریابی', 'فروش', 'مشتری', 'مدل تجارتی', 'مدل کسب‌وکار', 'مذاکره'
    ],
    'unique-thinking': [
      'unique thinking', 'critical thinking', 'creative thinking', 'logic', 'logical reasoning',
      'systems thinking', 'first principles', 'decision making', 'problem solving', 'root cause',
      'تفکر یگانه', 'تفکر انتقادی', 'تفکر خلاق', 'منطق', 'استدلال', 'تفکر سیستمی', 'اصول نخستین',
      'تصمیم گیری', 'تصمیم‌گیری', 'حل مسئله', 'ریشه مشکل'
    ]
  });

  function clamp(number, min, max) {
    return Math.max(min, Math.min(max, number));
  }

  function safeNum(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getLang() {
    return typeof document !== 'undefined' && document.body?.dataset?.systemLanguage === 'fa' ? 'fa' : 'en';
  }

  function label(stat, lang = getLang()) {
    const item = STAT_LABELS[stat];
    if (item) return item[lang === 'fa' ? 'fa' : 'en'];
    return String(stat || 'General');
  }

  function normalizeDigits(value) {
    return String(value || '')
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  }

  function normalizeText(value) {
    return normalizeDigits(value)
      .normalize('NFKC')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[ي]/g, 'ی')
      .replace(/[ك]/g, 'ک')
      .replace(/[\u200c\s]+/g, ' ')
      .trim()
      .toLocaleLowerCase();
  }

  function titleKey(value) {
    return normalizeText(value).replace(/[،؛.,!?؟:;()[\]{}"'`]/g, '').replace(/\s+/g, ' ');
  }

  function normalizeLearningMode(value) {
    const mode = normalizeText(value).replace(/[ _-]+/g, ' ');
    const aliases = {
      'drill': 'practice', 'exercise': 'practice', 'problem solving': 'practice',
      'active recall': 'recall', 'retrieval practice': 'recall', 'teach back': 'explain',
      'explanation': 'explain', 'spaced repetition': 'review', 'spaced review': 'review',
      'test': 'assessment', 'quiz': 'assessment', 'exam': 'assessment',
      'experiment': 'validation', 'validation': 'validation', 'prototype test': 'validation'
    };
    const normalized = aliases[mode] || mode;
    return LEARNING_MODES.includes(normalized) ? normalized : null;
  }

  // Task-mode inference is based on labels only. It is not proof that the task was done well.
  function inferLearningMode(entry) {
    const title = normalizeText(`${entry?.title || ''} ${entry?.type || ''}`);
    const patterns = [
      ['review', /\b(review|revision|spaced repetition|revisit)\b|مرور|بازبینی|تکرار فاصله/],
      ['recall', /\b(recall|retrieval|flash ?cards?|without looking|from memory)\b|یادآوری فعال|بدون نگاه/],
      ['assessment', /\b(test|quiz|exam|assessment|self.?test|check your answers)\b|آزمون|امتحان|تست/],
      ['project', /\b(project|build|implement|prototype|portfolio|deploy|program a)\b|پروژه|بساز|پیاده.?سازی/],
      ['validation', /\b(validate|validation|experiment|measure|customer interview|hypothesis)\b|اعتبارسنجی|آزمایش|فرضیه/],
      ['explain', /\b(explain|teach|write|summari[sz]e|present|describe|reflect)\b|توضیح|شرح|خلاصه|بازتاب/],
      ['practice', /\b(practice|solve|problems?|exercises?|drill|calculate|translate|code)\b|تمرین|حل کن|مسئله|محاسبه|کدنویسی/]
    ];
    for (const [mode, pattern] of patterns) if (pattern.test(title)) return mode;
    return 'unknown';
  }

  function parseDate(value) {
    if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return null;
    if (typeof value === 'string') {
      const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
      if (dateOnly) {
        const local = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
        return Number.isFinite(local.getTime()) ? local : null;
      }
    }
    const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(time) ? new Date(time) : null;
  }

  function localDateKey(dateLike) {
    const date = parseDate(dateLike);
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function dayOrdinal(dateKey) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
    if (!match) return NaN;
    return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS);
  }

  function dayDistance(olderKey, newerKey) {
    const older = dayOrdinal(olderKey);
    const newer = dayOrdinal(newerKey);
    return Number.isFinite(older) && Number.isFinite(newer) ? newer - older : NaN;
  }

  function normalizeStat(value) {
    const normalized = String(value || '').trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
    if (normalized === 'globalskills' || normalized === 'global-skill') return 'global-skills';
    if (normalized === 'uniquethinking' || normalized === 'unique-think') return 'unique-thinking';
    return STAT_IDS.includes(normalized) ? normalized : null;
  }

  function normalizeHistoryEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const at = String(entry.at || entry.timestamp || entry.date || '').slice(0, 40);
    const date = parseDate(at);
    const title = String(entry.title || entry.name || entry.description || '').trim().slice(0, 180);
    if (!date || !title) return null;
    const type = String(entry.type || 'activity').slice(0, 40);
    const explicitMode = normalizeLearningMode(entry.learningMode || entry.evidenceType || entry.taskMode);
    const allowedModeSources = ['explicit', 'planned', 'inferred-from-label'];
    const suppliedModeSource = allowedModeSources.includes(entry.learningModeSource) ? entry.learningModeSource : null;
    const rawScore = entry.score ?? entry.testScore ?? entry.outcomeScore;
    const score = rawScore === null || rawScore === undefined || rawScore === '' || !Number.isFinite(Number(rawScore))
      ? null : clamp(Number(rawScore), 0, 100);
    const passed = typeof entry.passed === 'boolean' ? entry.passed
      : typeof entry.outcome?.passed === 'boolean' ? entry.outcome.passed : null;
    const durationMinutes = clamp(safeNum(entry.durationMinutes ?? entry.minutesSpent, 0), 0, 1440);
    return {
      at: date.toISOString(),
      dateKey: localDateKey(date),
      type,
      title,
      xp: clamp(safeNum(entry.xp, 0), 0, 1000000),
      coins: clamp(safeNum(entry.coins, 0), 0, 1000000),
      stat: normalizeStat(entry.stat),
      skillId: typeof entry.skillId === 'string' ? entry.skillId.slice(0, 128) : null,
      goalId: typeof entry.goalId === 'string' ? entry.goalId.slice(0, 200) : null,
      questId: typeof entry.questId === 'string' ? entry.questId.slice(0, 200) : null,
      durationMinutes,
      learningMode: explicitMode || inferLearningMode({ title, type }),
      learningModeSource: explicitMode ? (suppliedModeSource || 'explicit') : 'inferred-from-label',
      score,
      passed,
      hasExplicitOutcome: score !== null || passed !== null
    };
  }

  function loadHistory(limit = HISTORY_LIMIT) {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = JSON.parse(localStorage.getItem('system_v2_progress_history') || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.slice(-limit).map(normalizeHistoryEntry).filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  function mergeHistory(primary, additional) {
    const merged = [];
    const seen = new Map();
    for (const entry of [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(additional) ? additional : [])]) {
      const item = normalizeHistoryEntry(entry);
      if (!item) continue;
      // Merge duplicate ledger and snapshot rows instead of double-counting them. The full local ledger
      // remains the primary source, while newer snapshots may supply explicit assessment metadata.
      const key = `${item.dateKey}|${titleKey(item.title)}|${item.stat || ''}|${item.type}|${item.goalId || ''}|${item.questId || ''}`;
      if (seen.has(key)) {
        const index = seen.get(key);
        const previous = merged[index];
        const preferItemMode = item.learningModeSource === 'explicit' || previous.learningModeSource !== 'explicit';
        const score = item.score !== null ? item.score : previous.score;
        const passed = item.passed !== null ? item.passed : previous.passed;
        merged[index] = {
          ...previous,
          ...item,
          durationMinutes: item.durationMinutes || previous.durationMinutes,
          learningMode: preferItemMode ? item.learningMode : previous.learningMode,
          learningModeSource: preferItemMode ? item.learningModeSource : previous.learningModeSource,
          score, passed, hasExplicitOutcome: score !== null || passed !== null
        };
        continue;
      }
      seen.set(key, merged.length);
      merged.push(item);
    }
    merged.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    return merged.slice(-HISTORY_LIMIT);
  }

  function readProvidedHistory(source) {
    if (!source || typeof source !== 'object') return [];
    if (Array.isArray(source.history)) return source.history;
    if (Array.isArray(source.history?.entries)) return source.history.entries;
    if (Array.isArray(source.recentSevenDayHistory?.recentEntries)) return source.recentSevenDayHistory.recentEntries;
    if (Array.isArray(source.recentActivity)) return source.recentActivity.map(item => ({
      ...item, at: item.at || item.date, title: item.title, type: item.type, stat: item.stat, xp: item.xp, coins: item.coins
    }));
    return [];
  }

  function normalizePlayer(source) {
    const statePlayer = typeof systemState !== 'undefined' && systemState?.player ? systemState.player : {};
    const player = source?.player && typeof source.player === 'object' ? source.player : statePlayer;
    return {
      level: Math.max(1, Math.floor(safeNum(player.level, 1))),
      xp: Math.max(0, safeNum(player.xp ?? player.xpIntoLevel, 0)),
      xpRequired: Math.max(1, safeNum(player.xpRequired, 1000)),
      rank: String(player.rank || 'E').slice(0, 12)
    };
  }

  function normalizeStats(source) {
    const stateStats = typeof systemState !== 'undefined' && systemState?.stats ? systemState.stats : {};
    const provided = source?.stats && typeof source.stats === 'object' ? source.stats : stateStats;
    const lookup = new Map();
    if (Array.isArray(provided)) {
      provided.forEach(item => {
        const id = normalizeStat(item?.id || item?.stat || item?.key);
        if (id) lookup.set(id, item);
      });
    } else {
      Object.entries(provided).forEach(([key, item]) => {
        const id = normalizeStat(key);
        if (id && item && typeof item === 'object') lookup.set(id, item);
      });
    }

    const stats = {};
    STAT_IDS.forEach(id => {
      const item = lookup.get(id) || {};
      const xp = Math.max(0, safeNum(item.xp ?? item.xpIntoLevel, 0));
      const xpRequired = Math.max(1, safeNum(item.xpRequired, 100));
      stats[id] = {
        level: Math.max(1, Math.floor(safeNum(item.level, 1))),
        xp,
        xpRequired,
        progress: clamp(xp / xpRequired, 0, 1),
        name: String(item.name || label(id)).slice(0, 80)
      };
    });
    return stats;
  }

  function normalizeActiveTitles(source) {
    const titles = source?.todayQuests?.activeTitles;
    if (!Array.isArray(titles)) return [];
    return titles.map(item => typeof item === 'string' ? item : item?.title)
      .map(value => String(value || '').trim().slice(0, 180)).filter(Boolean);
  }

  function deriveHistory(entries, now = new Date()) {
    entries = Array.isArray(entries) ? entries : [];
    const todayKey = localDateKey(now);
    const rows = entries.map(normalizeHistoryEntry).filter(Boolean).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const daySets = { d7: new Set(), prev7: new Set(), d14: new Set(), d30: new Set() };
    const windows = { d7: [], prev7: [], d14: [], d30: [] };
    const countByStat = rowsByWindow => {
      const result = Object.fromEntries(STAT_IDS.map(id => [id, 0]));
      rowsByWindow.forEach(row => { if (row.stat) result[row.stat]++; });
      return result;
    };
    const xpByStat7 = Object.fromEntries(STAT_IDS.map(id => [id, 0]));
    const xpByStat30 = Object.fromEntries(STAT_IDS.map(id => [id, 0]));
    const latestByStat = Object.fromEntries(STAT_IDS.map(id => [id, null]));
    const modeCounts7 = EMPTY_MODE_COUNTS();
    const modeCounts30 = EMPTY_MODE_COUNTS();
    const eventTypeCounts30 = {};
    const xp7Rows = [];
    let explicitOutcomeCount30 = 0;
    let explicitAssessmentOutcomeCount30 = 0;
    let scoredOutcomeCount30 = 0;
    let measuredMinutes30 = 0;

    rows.forEach(row => {
      const daysAgo = dayDistance(row.dateKey, todayKey);
      // Exclude future-dated entries from all analytics, even if their ISO timestamp parses.
      if (!Number.isFinite(daysAgo) || daysAgo < 0) return;
      if (row.stat && (!latestByStat[row.stat] || Date.parse(row.at) > Date.parse(latestByStat[row.stat].at))) {
        latestByStat[row.stat] = row;
      }
      if (daysAgo >= 30) return;
      windows.d30.push(row);
      daySets.d30.add(row.dateKey);
      const mode30 = LEARNING_MODES.includes(row.learningMode) ? row.learningMode : 'unknown';
      modeCounts30[mode30]++;
      eventTypeCounts30[row.type] = (eventTypeCounts30[row.type] || 0) + 1;
      measuredMinutes30 += row.durationMinutes || 0;
      if (row.hasExplicitOutcome) {
        explicitOutcomeCount30++;
        if (row.score !== null) scoredOutcomeCount30++;
        if (mode30 === 'assessment') explicitAssessmentOutcomeCount30++;
      }
      if (row.stat) xpByStat30[row.stat] += row.xp;
      if (daysAgo < 14) {
        windows.d14.push(row);
        daySets.d14.add(row.dateKey);
      }
      if (daysAgo < 7) {
        windows.d7.push(row);
        daySets.d7.add(row.dateKey);
        xp7Rows.push(row);
        if (row.stat) xpByStat7[row.stat] += row.xp;
        modeCounts7[LEARNING_MODES.includes(row.learningMode) ? row.learningMode : 'unknown']++;
      } else if (daysAgo < 14) {
        windows.prev7.push(row);
        daySets.prev7.add(row.dateKey);
      }
    });

    const eligibleRows = rows.filter(row => {
      const ago = dayDistance(row.dateKey, todayKey);
      return Number.isFinite(ago) && ago >= 0 && ago < 30;
    });
    const activeDates = new Set(eligibleRows.map(row => row.dateKey));

    // An unfinished mission today should not prematurely break a streak at the start of a new day.
    let currentStreak = 0;
    let streakCursor = activeDates.has(todayKey) ? todayKey : localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    while (activeDates.has(streakCursor)) {
      currentStreak++;
      const [year, month, day] = streakCursor.split('-').map(Number);
      streakCursor = localDateKey(new Date(year, month - 1, day - 1));
      if (currentStreak >= 30) break;
    }

    let longestStreak30 = 0;
    let run = 0;
    let previousOrdinal = null;
    [...activeDates].map(key => ({ key, ordinal: dayOrdinal(key) })).sort((a, b) => a.ordinal - b.ordinal).forEach(day => {
      if (previousOrdinal !== null && day.ordinal === previousOrdinal + 1) run++;
      else run = 1;
      longestStreak30 = Math.max(longestStreak30, run);
      previousOrdinal = day.ordinal;
    });

    const byStat7 = countByStat(windows.d7);
    const byStat14 = countByStat(windows.d14);
    const byStat30 = countByStat(windows.d30);
    const previousCount = windows.prev7.length;
    const currentCount = windows.d7.length;
    let trend = 'no-baseline';
    let trendPercent = null;
    if (previousCount === 0 && currentCount > 0) trend = 'starting';
    else if (previousCount > 0) {
      trendPercent = Math.round(((currentCount - previousCount) / previousCount) * 100);
      trend = trendPercent >= 20 ? 'up' : trendPercent <= -20 ? 'down' : 'steady';
    }
    const diversity = Object.values(byStat7).filter(count => count > 0).length;
    const xp7 = xp7Rows.reduce((sum, row) => sum + row.xp, 0);
    const xpPrev7 = windows.prev7.reduce((sum, row) => sum + row.xp, 0);
    const lastAtByStat = {};
    const lastTitleByStat = {};
    const lastLearningModeByStat = {};
    const daysSinceActivityByStat = {};
    const dueReviewStats = [];
    STAT_IDS.forEach(id => {
      const latest = latestByStat[id];
      if (!latest) {
        lastAtByStat[id] = null;
        lastTitleByStat[id] = '';
        lastLearningModeByStat[id] = null;
        daysSinceActivityByStat[id] = null;
        return;
      }
      const daysAgo = dayDistance(latest.dateKey, todayKey);
      lastAtByStat[id] = latest.at;
      lastTitleByStat[id] = latest.title;
      lastLearningModeByStat[id] = latest.learningMode;
      daysSinceActivityByStat[id] = daysAgo;
      if (daysAgo >= 3 && daysAgo <= 90) dueReviewStats.push({
        stat: id, title: latest.title, lastAt: latest.at, daysSince: daysAgo,
        learningMode: latest.learningMode, xp: latest.xp
      });
    });
    dueReviewStats.sort((a, b) => b.daysSince - a.daysSince || STAT_IDS.indexOf(a.stat) - STAT_IDS.indexOf(b.stat));
    const modeVariety30 = LEARNING_MODES.filter(mode => modeCounts30[mode] > 0).length;
    const modeVariety7 = LEARNING_MODES.filter(mode => modeCounts7[mode] > 0).length;
    const explicitOutcomeRate30 = windows.d30.length
      ? Math.round(100 * explicitOutcomeCount30 / windows.d30.length) : 0;

    return {
      total: rows.length,
      entries: rows,
      last7: windows.d7.length,
      previous7: windows.prev7.length,
      last14: windows.d14.length,
      last30: windows.d30.length,
      byStat7,
      byStat14,
      byStat30,
      xpByStat7,
      xpByStat30,
      xp7,
      xpPrev7,
      xp30: windows.d30.reduce((sum, row) => sum + row.xp, 0),
      activeDays7: daySets.d7.size,
      activeDays14: daySets.d14.size,
      activeDays30: daySets.d30.size,
      diversity,
      currentStreak,
      longestStreak30,
      trend,
      trendPercent,
      lastAtByStat,
      lastTitleByStat,
      lastLearningModeByStat,
      daysSinceActivityByStat,
      dueReviewStats,
      modeCounts7,
      modeCounts30,
      modeVariety7,
      modeVariety30,
      modeCoverage30: Math.round(100 * modeVariety30 / LEARNING_MODES.length),
      explicitOutcomeCount30,
      explicitAssessmentOutcomeCount30,
      scoredOutcomeCount30,
      explicitOutcomeRate30,
      measuredMinutes30,
      eventTypeCounts30,
      recentTitles: eligibleRows.slice(-30).reverse().map(row => row.title).filter(Boolean)
    };
  }

  function buildSnapshot(source) {
    const player = normalizePlayer(source);
    const stats = normalizeStats(source);
    const history = mergeHistory(loadHistory(), readProvidedHistory(source));
    const now = new Date();
    const derived = deriveHistory(history, now);
    const fallbackByStat = source?.recentSevenDayHistory?.completionsByStat;
    if (derived.last7 === 0 && fallbackByStat && typeof fallbackByStat === 'object') {
      STAT_IDS.forEach(id => { derived.byStat7[id] = Math.max(0, safeNum(fallbackByStat[id], 0)); });
    }
    const externalCount = source?.recentSevenDayHistory?.recordsAvailable;
    if (derived.last7 === 0 && !history.length && Number.isFinite(Number(externalCount)) && Number(externalCount) > 0) {
      // The external snapshot can contain a bounded summary when detailed records are unavailable.
      derived.last7 = Math.max(0, Math.floor(Number(externalCount)));
    }
    return {
      player,
      stats,
      history: derived,
      todayQuests: { activeTitles: normalizeActiveTitles(source) },
      generatedAt: now.toISOString(),
      snapshotSource: source ? 'provided-progress-snapshot' : 'live-local-state'
    };
  }

  function getSnapshotFromLegacy(source) {
    return buildSnapshot(source);
  }

  function analyze(inputSnapshot) {
    const snapshot = inputSnapshot && inputSnapshot.history && typeof inputSnapshot.history.last7 === 'number'
      && inputSnapshot.stats && !Array.isArray(inputSnapshot.stats)
      ? inputSnapshot
      : buildSnapshot(inputSnapshot);
    const stats = snapshot.stats || {};
    const history = snapshot.history || deriveHistory([], new Date());
    const counts7 = history.byStat7 || {};
    const counts14 = history.byStat14 || {};

    // Composite scores are prioritization signals, never a verified measure of ability or mastery.
    const scores = {};
    const components = {};
    STAT_IDS.forEach(id => {
      const item = stats[id] || { level: 1, progress: 0 };
      const levelSignal = clamp((Math.max(1, safeNum(item.level, 1)) - 1) / 15, 0, 1) * 40;
      const progressSignal = clamp(safeNum(item.progress, 0), 0, 1) * 10;
      const monthSignal = clamp(safeNum(history.byStat30?.[id], 0) / 8, 0, 1) * 15;
      const recentSignal = clamp(safeNum(counts7[id], 0) / 4, 0, 1) * 25;
      const mediumSignal = clamp(safeNum(counts14[id], 0) / 6, 0, 1) * 10;
      scores[id] = clamp(Math.round(levelSignal + progressSignal + monthSignal + recentSignal + mediumSignal), 0, 100);
      components[id] = {
        level: Math.round(levelSignal), inLevelProgress: Math.round(progressSignal),
        last30Days: Math.round(monthSignal), last7Days: Math.round(recentSignal), last14Days: Math.round(mediumSignal)
      };
    });
    const sorted = [...STAT_IDS].sort((a, b) => {
      if (scores[b] !== scores[a]) return scores[b] - scores[a];
      const levelDiff = safeNum(stats[b]?.level, 1) - safeNum(stats[a]?.level, 1);
      return levelDiff || STAT_IDS.indexOf(a) - STAT_IDS.indexOf(b);
    });
    const strongest = sorted[0];
    const weakest = sorted[sorted.length - 1];
    const activeDays7 = Math.max(0, safeNum(history.activeDays7, 0));
    const diversity = Object.values(counts7).filter(value => safeNum(value) > 0).length;
    const streak = Math.max(0, safeNum(history.currentStreak, 0));
    const momentum = Math.round(clamp(
      clamp(safeNum(history.last7, 0) / 12, 0, 1) * 30 +
      clamp(activeDays7 / 7, 0, 1) * 30 +
      (diversity / STAT_IDS.length) * 25 +
      clamp(streak / 7, 0, 1) * 15, 0, 100
    ));
    const total30 = Math.max(0, safeNum(history.last30, 0));
    const dataConfidence = total30 === 0 ? 20 : total30 < 3 ? 30 : total30 < 6 ? 40 : total30 < 12 ? 55 : total30 < 24 ? 70 : (activeDays7 >= 4 && history.activeDays30 >= 8 ? 85 : 75);
    const dataQuality = history.total === 0 ? 'baseline-only' : total30 < 3 ? 'very-limited' : total30 < 8 ? 'limited' : total30 < 20 ? 'moderate' : 'stronger';
    const scoreSpread = Math.max(...Object.values(scores)) - Math.min(...Object.values(scores));
    const balanceScore = total30 < 4 ? null : Math.round(100 - clamp(scoreSpread / 1.5, 0, 100));
    let fatigue = 'none';
    if (history.last7 >= 18 && diversity <= 2) fatigue = 'high';
    else if (history.last7 >= 12 && diversity <= 3) fatigue = 'medium';
    else if (history.previous7 >= 6 && history.last7 <= Math.max(1, Math.floor(history.previous7 * 0.2))) fatigue = 'drop';

    const priority = {};
    STAT_IDS.forEach(id => {
      const scoreGap = 100 - scores[id];
      const recentGap = 1 - clamp(safeNum(counts14[id], 0) / 4, 0, 1);
      const noRecent = safeNum(counts14[id], 0) === 0 ? 1 : 0;
      const daysSince = history.daysSinceActivityByStat?.[id];
      const recencyGap = daysSince === null || daysSince === undefined ? 18
        : daysSince >= 14 ? 18 : daysSince >= 7 ? 12 : daysSince >= 3 ? 6 : 0;
      // This is a planning priority, not a diagnosis of ability. Recent neglect and review timing matter separately from level.
      priority[id] = clamp(scoreGap * 0.48 + recentGap * 20 + noRecent * 10 + recencyGap, 0, 100);
    });
    const focusOrder = [...STAT_IDS].sort((a, b) => priority[b] - priority[a]);
    const focus = focusOrder[0];
    const synergies = {
      mathematics: ['physics', 'computer', 'unique-thinking'],
      physics: ['mathematics', 'computer', 'unique-thinking'],
      computer: ['mathematics', 'unique-thinking', 'global-skills'],
      'global-skills': ['entrepreneurship', 'unique-thinking', 'computer'],
      entrepreneurship: ['global-skills', 'unique-thinking', 'computer'],
      'unique-thinking': ['computer', 'entrepreneurship', 'mathematics']
    };
    const synergyBoost = (synergies[focus] || []).filter(id => scores[id] >= Math.max(0, scores[focus] - 18));
    const insights = [];
    if (!total30) {
      insights.push({
        en: 'There is not enough recent activity history yet. Recommendations use current branch levels only; record a few completed missions to improve personalization.',
        fa: 'هنوز سابقهٔ کافی از فعالیت‌های اخیر وجود ندارد. پیشنهادها فعلاً بر اساس سطح شاخه‌ها ساخته شده‌اند؛ چند مأموریت را ثبت کن تا شخصی‌سازی دقیق‌تر شود.'
      });
    } else if (momentum >= 75) {
      insights.push({ en: `Strong recorded momentum (${momentum}/100), supported by ${activeDays7} active day(s) in the last 7 days.`, fa: `شتاب ثبت‌شده قوی است (${momentum}/۱۰۰) و در ۷ روز گذشته ${activeDays7} روز فعالیت ثبت شده است.` });
    } else if (momentum <= 25 && history.total > 5) {
      insights.push({ en: 'Recorded momentum is low. A short, specific mission is a sensible restart; this is not evidence that motivation is low.', fa: 'شتاب ثبت‌شدهٔ اخیر پایین است. یک مأموریت کوتاه و مشخص شروع مناسبی است؛ این داده‌ها به‌تنهایی انگیزهٔ پایین را ثابت نمی‌کنند.' });
    }
    if (fatigue === 'high') {
      insights.push({ en: 'Workload concentration flag: many records are clustered in one or two branches. Consider rotating the next session; this is a scheduling signal, not a health assessment.', fa: 'نشانهٔ تمرکز بار کار: فعالیت‌ها در یک یا دو شاخه جمع شده‌اند. جلسهٔ بعدی را به شاخه‌ای دیگر اختصاص بده؛ این فقط نشانهٔ برنامه‌ریزی است، نه ارزیابی سلامت.' });
    } else if (fatigue === 'medium') {
      insights.push({ en: 'Activity is concentrated in a few branches. Add one short session from another branch to improve coverage.', fa: 'فعالیت در چند شاخه محدود متمرکز است. برای متعادل‌شدن پوشش، یک جلسهٔ کوتاه از شاخه‌ای دیگر اضافه کن.' });
    } else if (fatigue === 'drop') {
      insights.push({ en: 'Recorded activity is lower than the previous 7-day window. Restart gently and avoid treating the change as a personal failure.', fa: 'فعالیت ثبت‌شده نسبت به ۷ روز پیش کاهش یافته است. آرام شروع کن و این تغییر را شکست شخصی تلقی نکن.' });
    }
    if (history.trend === 'up') insights.push({ en: `Recorded completion events are up ${Math.max(0, history.trendPercent)}% versus the previous 7 days.`, fa: `رویدادهای تکمیل ثبت‌شده نسبت به ۷ روز پیش ${Math.max(0, history.trendPercent)}٪ افزایش یافته است.` });
    else if (history.trend === 'down' && fatigue !== 'drop') insights.push({ en: `Recorded completion events are down ${Math.abs(history.trendPercent)}% versus the previous 7 days. Check the plan's size and fit before adding more work.`, fa: `رویدادهای تکمیل ثبت‌شده نسبت به ۷ روز پیش ${Math.abs(history.trendPercent)}٪ کاهش یافته است. پیش از افزودن کار بیشتر، اندازه و تناسب برنامه را بررسی کن.` });
    if (total30 >= 4 && scoreSpread > 40) {
      insights.push({ en: `${label(strongest, 'en')} currently leads the local composite score. A small, measurable mission in ${label(weakest, 'en')} can broaden growth; score is not verified mastery.`, fa: `${label(strongest, 'fa')} در امتیاز ترکیبی محلی جلوتر است. یک مأموریت کوچک در ${label(weakest, 'fa')} می‌تواند رشد را گسترده‌تر کند؛ این امتیاز تسلط را ثابت نمی‌کند.` });
    }
    const dueReviewStats = Array.isArray(history.dueReviewStats) ? history.dueReviewStats.slice(0, 6) : [];
    const recognizedModes = LEARNING_MODES.filter(mode => safeNum(history.modeCounts30?.[mode], 0) > 0);
    const modeCoverage = clamp(safeNum(history.modeCoverage30, 0), 0, 100);
    const explicitOutcomeCount = Math.max(0, safeNum(history.explicitOutcomeCount30, 0));
    if (total30 > 0 && dueReviewStats.length) {
      const due = dueReviewStats[0];
      insights.push({
        en: `Spaced review opportunity: revisit ${label(due.stat, 'en')} after ${due.daysSince} day(s) since its last recorded activity. This is a scheduling suggestion, not evidence of forgetting.`,
        fa: `فرصت مرور فاصله‌دار: پس از ${due.daysSince} روز از آخرین فعالیت ثبت‌شده، موضوعی از ${label(due.stat, 'fa')} را دوباره بازیابی کن. این پیشنهاد زمان‌بندی است، نه اثبات فراموشی.`
      });
    }
    if (total30 > 0 && recognizedModes.length < 3) {
      insights.push({
        en: `Recorded task labels currently cover ${recognizedModes.length} of ${LEARNING_MODES.length} learning modes. Mix solving, recall, explanation, review, and projects where they fit; labels do not verify task quality.`,
        fa: `برچسب‌های ثبت‌شده فعلاً ${recognizedModes.length} مورد از ${LEARNING_MODES.length} روش یادگیری را پوشش می‌دهند. در صورت تناسب، حل مسئله، یادآوری، توضیح، مرور و پروژه را ترکیب کن؛ برچسب‌ها کیفیت اجرا را ثابت نمی‌کنند.`
      });
    }
    let nextAction;
    if (!history.last7 && dueReviewStats.length) {
      const due = dueReviewStats[0];
      nextAction = {
        en: `Revisit a topic from ${label(due.stat, 'en')} for 10–20 minutes using closed-book recall, then check your result.`,
        fa: `یک موضوع از ${label(due.stat, 'fa')} را ۱۰ تا ۲۰ دقیقه بدون نگاه‌کردن یادآوری کن و سپس نتیجه را بررسی کن.`
      };
    } else if (!history.last7) nextAction = {
      en: `Start with one 10–20 minute, measurable mission in ${label(focus, 'en')}; then record what you actually completed.`,
      fa: `با یک مأموریت ۱۰ تا ۲۰ دقیقه‌ای و قابل‌اندازه‌گیری در ${label(focus, 'fa')} شروع کن؛ سپس نتیجهٔ واقعی را ثبت کن.`
    };
    else if (fatigue === 'high' || fatigue === 'medium') {
      const nextStat = synergyBoost[0] || weakest;
      nextAction = { en: `Next session: choose one manageable task in ${label(nextStat, 'en')} to reduce branch concentration.`, fa: `جلسهٔ بعد: یک کار قابل‌مدیریت در ${label(nextStat, 'fa')} انتخاب کن تا تمرکز فعالیت روی چند شاخه کمتر شود.` };
    } else nextAction = {
      en: `Prioritize ${label(focus, 'en')} with one task that ends in evidence: a solved problem, a short explanation, a tested program, or a validated decision.`,
      fa: `روی ${label(focus, 'fa')} تمرکز کن و کاری را انتخاب کن که شاهد واقعی داشته باشد: مسئلهٔ حل‌شده، توضیح کوتاه، برنامهٔ آزمایش‌شده یا تصمیم اعتبارسنجی‌شده.`
    };

    const strongestStat = stats[strongest] || { level: 1 };
    const strengths = total30 > 0
      ? [`${label(strongest)} — Level ${strongestStat.level}; ${safeNum(counts7[strongest], 0)} recorded event(s) in the last 7 days.`]
      : [`${label(strongest)} — current Level ${strongestStat.level}; recent activity evidence is unavailable.`];
    const focusAreas = focusOrder.slice(0, 3).map(id => {
      const daysSince = history.daysSinceActivityByStat?.[id];
      const recencyReason = Number.isFinite(daysSince)
        ? ` Last recorded activity: ${daysSince} day(s) ago.`
        : ' No timestamped activity is recorded for this branch.';
      return {
        stat: id,
        priority: Math.round(priority[id]),
        reason: total30 > 0
          ? (safeNum(counts14[id], 0) === 0 ? `No recorded event in the last 14 days; consider a small diagnostic task.${recencyReason}` : `Planning score ${scores[id]}/100; ${counts14[id]} event(s) in the last 14 days.${recencyReason}`)
          : 'Current-state planning priority only; there is not enough activity history to infer a skill gap or trend.'
      };
    });
    const branchDiagnostics = STAT_IDS.map(id => ({
      stat: id, level: Math.max(1, Math.floor(safeNum(stats[id]?.level, 1))),
      score: scores[id], priority: Math.round(priority[id]),
      events7: safeNum(counts7[id], 0), events14: safeNum(counts14[id], 0),
      events30: safeNum(history.byStat30?.[id], 0), xp7: safeNum(history.xpByStat7?.[id], 0),
      xp30: safeNum(history.xpByStat30?.[id], 0),
      daysSinceActivity: history.daysSinceActivityByStat?.[id] ?? null,
      lastAt: history.lastAtByStat?.[id] || null,
      lastTitle: history.lastTitleByStat?.[id] || '',
      reviewDue: dueReviewStats.some(item => item.stat === id)
    })).sort((a, b) => b.priority - a.priority);
    const learningSignals = {
      reviewDueCount: dueReviewStats.length,
      reviewDue: dueReviewStats,
      modeCounts7: history.modeCounts7 || EMPTY_MODE_COUNTS(),
      modeCounts30: history.modeCounts30 || EMPTY_MODE_COUNTS(),
      modeVariety7: Math.max(0, safeNum(history.modeVariety7, 0)),
      modeVariety30: Math.max(0, safeNum(history.modeVariety30, recognizedModes.length)),
      modeCoverage30: modeCoverage,
      recognizedModes,
      explicitOutcomeCount30: explicitOutcomeCount,
      explicitAssessmentOutcomeCount30: Math.max(0, safeNum(history.explicitAssessmentOutcomeCount30, 0)),
      scoredOutcomeCount30: Math.max(0, safeNum(history.scoredOutcomeCount30, 0)),
      explicitOutcomeRate30: clamp(safeNum(history.explicitOutcomeRate30, 0), 0, 100),
      measuredMinutes30: Math.max(0, safeNum(history.measuredMinutes30, 0)),
      note: 'Learning-mode labels may be inferred from task titles or planned for a mission; they do not verify actual execution. Explicit outcome counts require a recorded numeric score or pass/fail value. Activity, XP, and even self-reported outcomes alone do not prove mastery.'
    };
    return {
      scores, scoreComponents: components, strongest, weakest, focus, focusOrder, priority,
      branchDiagnostics, learningSignals,
      momentum, fatigue, diversity, synergyBoost, insights, nextAction, strengths, focusAreas,
      trend: history.trend, trendPercent: history.trendPercent, activeDays7,
      currentStreak: streak, longestStreak30: Math.max(0, safeNum(history.longestStreak30, 0)),
      balanceScore, dataConfidence, dataQuality, scoreSpread, snapshot
    };
  }

  const MISSION_BANK = Object.freeze({
    mathematics: [
      { subskill: 'Algebra', tags: ['algebra', 'equation', 'الجبر', 'معادله'], title: { en: 'Solve and verify 5 algebra equations', fa: 'حل و بررسی ۵ معادلهٔ الجبری' }, desc: { en: 'Solve five equations of increasing difficulty, substitute each answer back, and explain one transformation.', fa: 'پنج معادله را از آسان به دشوار حل کن، جواب‌ها را بررسی کن و یک مرحله را توضیح بده.' }, diff: 'medium', min: 25, xp: 50, coins: 9 },
      { subskill: 'Recall', tags: ['recall', 'formula', 'مرور', 'فرمول'], title: { en: 'Rebuild 3 formulas from memory', fa: 'بازسازی ۳ فرمول از حافظه' }, desc: { en: 'Write three formulas without looking, define every symbol, then check and correct them.', fa: 'سه فرمول را بدون نگاه‌کردن بنویس، نمادها را تعریف کن و سپس بررسی و اصلاح کن.' }, diff: 'easy', min: 15, xp: 35, coins: 6 },
      { subskill: 'Error analysis', tags: ['error', 'mistake', 'تحلیل خطا', 'اشتباه'], title: { en: 'Repair 3 mathematics mistakes', fa: 'اصلاح ۳ اشتباه ریاضی' }, desc: { en: 'Re-solve three missed problems. Name the exact error, the rule behind it, and a check that would catch it next time.', fa: 'سه مسئلهٔ غلط را دوباره حل کن؛ خطای دقیق، قاعدهٔ مربوط و روش تشخیص آن در آینده را بنویس.' }, diff: 'hard', min: 30, xp: 60, coins: 11 },
      { subskill: 'Problem solving', tags: ['problem', 'حل مسئله', 'مسئله'], title: { en: 'Compare 2 solution methods', fa: 'مقایسهٔ ۲ روش حل' }, desc: { en: 'Solve one problem in two valid ways, then compare accuracy, clarity, and effort.', fa: 'یک مسئله را به دو روش درست حل کن و دقت، وضوح و تلاش دو روش را مقایسه کن.' }, diff: 'medium', min: 25, xp: 50, coins: 9 },
      { subskill: 'Calculus', tags: ['calculus', 'derivative', 'integral', 'حسابان', 'مشتق', 'انتگرال'], title: { en: 'Explain one calculus idea with a sketch', fa: 'توضیح یک مفهوم حسابان با رسم شکل' }, desc: { en: 'Choose a derivative or integral idea, draw a visual, and solve one example while explaining what the result means.', fa: 'یک مفهوم مشتق یا انتگرال انتخاب کن، شکل بکش و یک مثال را همراه با توضیح معنای نتیجه حل کن.' }, diff: 'hard', min: 30, xp: 60, coins: 11 }
    ],
    physics: [
      { subskill: 'Mechanics', tags: ['mechanics', 'force', 'motion', 'میکانیک', 'نیرو', 'حرکت'], title: { en: 'Draw a free-body diagram and solve', fa: 'رسم نمودار جسم آزاد و حل مسئله' }, desc: { en: 'Choose a real object, label its forces, state assumptions, and solve one related numerical problem with units.', fa: 'یک جسم واقعی انتخاب کن، نیروها و فرض‌ها را بنویس و یک مسئلهٔ مرتبط را با واحدها حل کن.' }, diff: 'medium', min: 25, xp: 50, coins: 9 },
      { subskill: 'Conceptual reasoning', tags: ['concept', 'مفهوم'], title: { en: 'Explain a physics law and its limits', fa: 'توضیح یک قانون فزیک و محدودیت آن' }, desc: { en: 'State a law in your own words, give an example, and explain when a common oversimplification fails.', fa: 'یک قانون را با زبان خودت بیان کن، مثال بزن و محدودیت یک ساده‌سازی رایج را توضیح بده.' }, diff: 'medium', min: 20, xp: 45, coins: 8 },
      { subskill: 'Derivation', tags: ['derive', 'derivation', 'equation', 'استخراج', 'معادله'], title: { en: 'Derive one equation from basic principles', fa: 'استخراج یک معادله از اصول پایه' }, desc: { en: 'Start from definitions or a known law, show each step, and list the conditions under which the equation applies.', fa: 'از تعریف یا قانون شناخته‌شده شروع کن، همهٔ مراحل را نشان بده و شرط‌های اعتبار معادله را بنویس.' }, diff: 'hard', min: 30, xp: 60, coins: 11 },
      { subskill: 'Measurement', tags: ['measurement', 'unit', 'اندازه گیری', 'واحد'], title: { en: 'Audit units in 3 physics answers', fa: 'بررسی واحدها در ۳ جواب فزیک' }, desc: { en: 'Check dimensions, conversions, significant figures, and whether the final magnitude is realistic.', fa: 'ابعاد، تبدیل واحد، رقم‌های معنادار و منطقی‌بودن اندازهٔ نتیجه را بررسی کن.' }, diff: 'easy', min: 20, xp: 40, coins: 7 }
    ],
    computer: [
      { subskill: 'Python', tags: ['python', 'پایتون'], title: { en: 'Build a Python function with 3 tests', fa: 'ساخت تابع پایتون همراه با ۳ آزمون' }, desc: { en: 'Write one function for a specific problem; test normal, boundary, and invalid inputs; explain one limitation.', fa: 'برای یک مسئله تابع بنویس؛ ورودی عادی، مرزی و نامعتبر را بیازما و یک محدودیت را توضیح بده.' }, diff: 'medium', min: 30, xp: 55, coins: 10 },
      { subskill: 'Debugging', tags: ['debug', 'bug', 'testing', 'خطایابی', 'آزمون'], title: { en: 'Fix one bug with a reproducible test', fa: 'رفع یک خطا با آزمون قابل تکرار' }, desc: { en: 'Reproduce a real bug, write the smallest failing case, fix the root cause, and rerun the test.', fa: 'یک خطای واقعی را بازتولید کن، کوچک‌ترین حالت شکست را بنویس، علت را اصلاح و آزمون را تکرار کن.' }, diff: 'hard', min: 35, xp: 65, coins: 12 },
      { subskill: 'Algorithms', tags: ['algorithm', 'data structure', 'الگوریتم', 'ساختمان داده'], title: { en: 'Implement and compare 2 algorithms', fa: 'پیاده‌سازی و مقایسهٔ ۲ الگوریتم' }, desc: { en: 'Implement two approaches to one small problem, test identical cases, and compare correctness and complexity.', fa: 'دو روش برای یک مسئله پیاده‌سازی کن، حالت‌های یکسان را بیازما و درستی و پیچیدگی را مقایسه کن.' }, diff: 'hard', min: 40, xp: 70, coins: 13 },
      { subskill: 'Code reading', tags: ['read code', 'refactor', 'clean code', 'خواندن کد'], title: { en: 'Explain and simplify an existing function', fa: 'توضیح و ساده‌سازی یک تابع موجود' }, desc: { en: 'Trace a function with one input, explain its behavior, improve readability, and rerun checks.', fa: 'یک تابع را با ورودی مشخص دنبال کن، رفتارش را توضیح بده، خوانایی را بهبود بده و بررسی را تکرار کن.' }, diff: 'medium', min: 25, xp: 50, coins: 9 },
      { subskill: 'Web fundamentals', tags: ['html', 'css', 'javascript', 'web', 'وب'], title: { en: 'Build one responsive accessible component', fa: 'ساخت یک مؤلفهٔ واکنش‌گرا و دسترس‌پذیر' }, desc: { en: 'Build a small interface element, test at narrow width and with keyboard navigation, and note one trade-off.', fa: 'یک عنصر کوچک رابط بساز، آن را در عرض کم و با صفحه‌کلید آزمایش کن و یک انتخاب طراحی را شرح بده.' }, diff: 'medium', min: 35, xp: 60, coins: 10 }
    ],
    'global-skills': [
      { subskill: 'Vocabulary', tags: ['english', 'vocabulary', 'انگلیسی', 'واژگان'], title: { en: 'Learn and actively recall 8 useful words', fa: 'یادگیری و یادآوری فعال ۸ واژهٔ کاربردی' }, desc: { en: 'Choose eight words related to your current study, write original sentences, then recall meanings without looking.', fa: 'هشت واژهٔ مرتبط با درس فعلی انتخاب کن، جملهٔ تازه بساز و سپس معنی آن‌ها را بدون نگاه‌کردن یادآوری کن.' }, diff: 'easy', min: 20, xp: 40, coins: 7 },
      { subskill: 'Speaking', tags: ['speaking', 'presentation', 'گفتار', 'مکالمه', 'ارائه'], title: { en: 'Record a 2-minute explanation and review it', fa: 'ضبط توضیح ۲ دقیقه‌ای و بازبینی آن' }, desc: { en: 'Explain one idea for two minutes, listen once, then identify one strength and one concrete improvement.', fa: 'یک ایده را دو دقیقه توضیح بده و ضبط کن؛ یک بار گوش بده و یک نقطهٔ قوت و یک بهبود مشخص پیدا کن.' }, diff: 'medium', min: 20, xp: 45, coins: 8 },
      { subskill: 'Writing', tags: ['writing', 'grammar', 'نوشتن', 'نگارش', 'گرامر'], title: { en: 'Write a clear 120-word explanation', fa: 'نوشتن توضیح واضح در حدود ۱۲۰ واژه' }, desc: { en: 'Explain a topic in about 120 words, check structure and grammar, and remove two unnecessary phrases.', fa: 'موضوعی را در حدود ۱۲۰ واژه توضیح بده، ساختار و دستور را بررسی کن و دو عبارت اضافی را حذف کن.' }, diff: 'medium', min: 25, xp: 50, coins: 9 },
      { subskill: 'Reading', tags: ['reading', 'critical reading', 'خواندن', 'مطالعه'], title: { en: 'Separate a source’s main claim from its evidence', fa: 'جداسازی ادعای اصلی از شواهد منبع' }, desc: { en: 'Read a short reliable text, summarize it in three sentences, and identify one claim plus the evidence supporting it.', fa: 'یک متن کوتاه و قابل‌اعتماد بخوان، در سه جمله خلاصه کن و یک ادعا و شاهد پشتیبان آن را جدا ساز.' }, diff: 'medium', min: 25, xp: 50, coins: 9 },
      { subskill: 'Listening', tags: ['listening', 'pronunciation', 'شنیداری', 'تلفظ'], title: { en: 'Listen, transcribe, and compare 60 seconds', fa: 'شنیدن، نوشتن و مقایسهٔ ۶۰ ثانیه' }, desc: { en: 'Listen to a short clip, transcribe what you hear, check the transcript, and collect three missed phrases.', fa: 'به بخش کوتاهی گوش بده، متنش را بنویس، با متن اصلی مقایسه کن و سه عبارت از دست‌رفته را یادداشت کن.' }, diff: 'medium', min: 20, xp: 45, coins: 8 }
    ],
    entrepreneurship: [
      { subskill: 'Customer discovery', tags: ['customer', 'market research', 'interview', 'مشتری', 'بازار', 'مصاحبه'], title: { en: 'Design 5 customer-discovery questions', fa: 'طراحی ۵ پرسش برای شناخت مشتری' }, desc: { en: 'Choose a specific audience and real problem. Write five neutral questions about past behavior, not just opinions.', fa: 'مخاطب و مشکل واقعی مشخص کن. پنج پرسش بی‌طرف دربارهٔ رفتار گذشته بنویس، نه فقط نظر افراد.' }, diff: 'medium', min: 25, xp: 50, coins: 9 },
      { subskill: 'Business model', tags: ['business model', 'revenue', 'cost', 'مدل تجارتی', 'هزینه', 'درآمد'], title: { en: 'Map a one-page business model', fa: 'ترسیم مدل کسب‌وکار در یک صفحه' }, desc: { en: 'Define target customer, problem, value, channel, major cost, and revenue source; mark the riskiest assumption.', fa: 'مشتری، مشکل، ارزش، کانال، هزینهٔ اصلی و منبع درآمد را مشخص کن و پرریسک‌ترین فرض را علامت بزن.' }, diff: 'medium', min: 30, xp: 55, coins: 10 },
      { subskill: 'Marketing', tags: ['marketing', 'positioning', 'بازاریابی'], title: { en: 'Write 3 value propositions for one audience', fa: 'نوشتن ۳ پیشنهاد ارزش برای یک مخاطب' }, desc: { en: 'Create three benefit-led messages for the same audience; compare clarity, specificity, and evidence.', fa: 'سه پیام مبتنی بر فایده برای یک مخاطب بنویس و وضوح، مشخص‌بودن و شواهد هر کدام را مقایسه کن.' }, diff: 'medium', min: 25, xp: 50, coins: 9 },
      { subskill: 'Finance', tags: ['finance', 'unit economics', 'بودجه', 'مالی', 'هزینه'], title: { en: 'Estimate simple unit economics', fa: 'تخمین اقتصاد سادهٔ هر واحد' }, desc: { en: 'Estimate a product’s price and variable cost, state assumptions, and calculate contribution per sale.', fa: 'قیمت و هزینهٔ متغیر محصولی را تخمین بزن، فرض‌ها را بنویس و سهم هر فروش را حساب کن.' }, diff: 'hard', min: 30, xp: 60, coins: 11 },
      { subskill: 'Experiment design', tags: ['experiment', 'hypothesis', 'validation', 'آزمایش', 'فرضیه'], title: { en: 'Test the riskiest business assumption cheaply', fa: 'آزمایش کم‌هزینهٔ پرریسک‌ترین فرض تجارتی' }, desc: { en: 'List three assumptions, rank by risk, and design the cheapest ethical test for the riskiest one.', fa: 'سه فرض را فهرست و بر اساس خطر مرتب کن؛ برای پرریسک‌ترین فرض، آزمایشی ارزان و اخلاقی طراحی کن.' }, diff: 'hard', min: 30, xp: 60, coins: 11 }
    ],
    'unique-thinking': [
      { subskill: 'First principles', tags: ['first principles', 'اصول نخستین'], title: { en: 'Break a problem into facts and assumptions', fa: 'تفکیک یک مسئله به واقعیت و فرض' }, desc: { en: 'Write the problem in one sentence, then separate facts, assumptions, constraints, and unknowns before proposing a solution.', fa: 'مسئله را در یک جمله بنویس و پیش از راه‌حل، واقعیت‌ها، فرض‌ها، محدودیت‌ها و مجهولات را جدا کن.' }, diff: 'medium', min: 25, xp: 50, coins: 9 },
      { subskill: 'Decision making', tags: ['decision', 'trade-off', 'تصمیم', 'مقایسه'], title: { en: 'Compare 2 decisions with explicit criteria', fa: 'مقایسهٔ ۲ تصمیم با معیارهای روشن' }, desc: { en: 'Score two plausible options for impact, effort, reversibility, and uncertainty; state what evidence could change your choice.', fa: 'دو گزینه را از نظر اثر، تلاش، برگشت‌پذیری و عدم‌قطعیت بسنج؛ بنویس چه شاهدی تصمیمت را عوض می‌کند.' }, diff: 'medium', min: 25, xp: 50, coins: 9 },
      { subskill: 'Root cause', tags: ['root cause', 'why', 'علت اصلی', 'علت ریشه'], title: { en: 'Find the root cause behind one recurring issue', fa: 'پیداکردن علت اصلی یک مشکل تکرارشونده' }, desc: { en: 'Describe one recurring problem, ask why several times, separate causes from symptoms, and propose a checkable countermeasure.', fa: 'یک مشکل تکرارشونده را شرح بده، چند بار چرا بپرس، علت را از نشانه جدا کن و راهکار قابل‌آزمایش پیشنهاد بده.' }, diff: 'hard', min: 30, xp: 60, coins: 11 },
      { subskill: 'Systems thinking', tags: ['systems thinking', 'feedback loop', 'تفکر سیستمی', 'حلقه بازخورد'], title: { en: 'Map a system and one feedback loop', fa: 'ترسیم یک سیستم و یک حلقهٔ بازخورد' }, desc: { en: 'Map inputs and outputs, mark one feedback loop, and predict one possible unintended consequence.', fa: 'ورودی و خروجی‌ها را ترسیم کن، یک حلقهٔ بازخورد را مشخص ساز و یک پیامد ناخواسته را پیش‌بینی کن.' }, diff: 'hard', min: 30, xp: 60, coins: 11 },
      { subskill: 'Estimation', tags: ['estimate', 'estimation', 'تخمین', 'برآورد'], title: { en: 'Make and check 3 reasoned estimates', fa: 'ساخت و بررسی ۳ تخمین استدلالی' }, desc: { en: 'Estimate three quantities before calculating or looking them up; show assumptions, compare actuals, and explain the gap.', fa: 'سه مقدار را پیش از محاسبه یا جستجو تخمین بزن؛ فرض‌ها را بنویس، نتیجهٔ واقعی را مقایسه و اختلاف را توضیح بده.' }, diff: 'medium', min: 20, xp: 45, coins: 8 }
    ]
  });

  function matchFocus(customFocus) {
    const note = normalizeText(customFocus);
    const matches = [];
    if (!note) return { order: [], primary: null, cues: [], note: '' };
    STAT_IDS.forEach(stat => {
      const hits = (FOCUS_CUES[stat] || []).map(cue => ({ cue, at: note.indexOf(normalizeText(cue)) }))
        .filter(item => item.at >= 0).sort((a, b) => a.at - b.at || b.cue.length - a.cue.length);
      if (hits.length) matches.push({ stat, at: hits[0].at, cue: hits[0].cue, hits });
    });
    matches.sort((a, b) => a.at - b.at || STAT_IDS.indexOf(a.stat) - STAT_IDS.indexOf(b.stat));
    return { order: matches.map(item => item.stat), primary: matches[0]?.stat || null, cues: matches, note };
  }

  function matchTemplateScore(template, focusMatch) {
    const note = normalizeText(focusMatch.note || '');
    if (!note) return 0;
    return (template.tags || []).reduce((score, tag) => score + (note.includes(normalizeText(tag)) ? 2 + normalizeText(tag).length / 20 : 0), 0)
      + (template.subskill && note.includes(normalizeText(template.subskill)) ? 3 : 0);
  }

  function parseMinutesLimit(note) {
    const normalized = normalizeText(note);
    const patterns = [
      /(?:under|below|less than|maximum|max|within)\s*(\d{1,3})\s*(?:minutes?|mins?|min)\b/i,
      /(?:حداکثر|کمتر از|زیر|تا)\s*(\d{1,3})\s*(?:دقیقه|دقیقه‌|دقیقه ای)?/i
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(normalized);
      if (match) return clamp(Number(match[1]), 5, 120);
    }
    return null;
  }

  function localizedText(item, lang = getLang()) {
    return item && typeof item === 'object' ? String(item[lang === 'fa' ? 'fa' : 'en'] || item.en || item.fa || '') : String(item || '');
  }

  function learningModeForTemplate(template) {
    const text = normalizeText(`${template?.subskill || ''} ${localizedText(template?.title, 'en')} ${localizedText(template?.desc, 'en')} ${localizedText(template?.title, 'fa')} ${localizedText(template?.desc, 'fa')}`);
    if (/review|recall|memory|فرمول|مرور|یادآوری/.test(text)) return 'recall';
    if (/error|mistake|repair|اشتباه|خطا/.test(text)) return 'practice';
    if (/test|quiz|assessment|آزمون|تست/.test(text)) return 'assessment';
    if (/project|build|implement|prototype|پروژه|بساز|پیاده/.test(text)) return 'project';
    if (/validate|validation|experiment|hypothesis|customer|اعتبارسنجی|آزمایش|فرضیه|مشتری/.test(text)) return 'validation';
    if (/explain|teach|write|summar|presentation|توضیح|شرح|نگارش|خلاصه|ارائه/.test(text)) return 'explain';
    return 'practice';
  }

  function learningTechniqueFor(mode, lang) {
    const techniques = {
      practice: { en: 'Deliberate practice with feedback', fa: 'تمرین هدفمند همراه با بازخورد' },
      recall: { en: 'Closed-book retrieval practice', fa: 'یادآوری فعال بدون نگاه‌کردن' },
      explain: { en: 'Explain-back / teach-back', fa: 'توضیح با زبان خودت' },
      review: { en: 'Spaced retrieval review', fa: 'مرور فاصله‌دار با یادآوری فعال' },
      project: { en: 'Build, test, and inspect an artifact', fa: 'ساخت، آزمایش و بررسی یک خروجی عملی' },
      assessment: { en: 'Low-stakes diagnostic check', fa: 'سنجش تشخیصی کم‌فشار' },
      validation: { en: 'Test a claim against evidence', fa: 'آزمودن ادعا با شواهد' }
    };
    return techniques[mode] || techniques.practice;
  }

  function successCriterionFor(stat, mode, lang) {
    const fa = {
      mathematics: 'حداقل یک جواب نهایی را مستقل بررسی کن و یک مرحلهٔ حل را توضیح بده.',
      physics: 'مفهوم، واحدها و مراحل حل را بنویس و نتیجه را با یک بررسی ساده بسنج.',
      computer: 'برنامه یا نمونه را اجرا کن؛ نتیجهٔ واقعی و دست‌کم یک حالت آزمایش‌شده را ثبت کن.',
      'global-skills': 'یک خروجی کوتاه بساز، دست‌کم یک خطا را اصلاح کن و نسخهٔ نهایی را نگه‌دار.',
      entrepreneurship: 'فرض اصلی، شواهد موجود و آزمایش بعدی را جداگانه بنویس.',
      'unique-thinking': 'دلیل تصمیم، یک محدودیت و روشی برای بررسی نتیجه را ثبت کن.'
    };
    const en = {
      mathematics: 'Independently check at least one final answer and explain one solution step.',
      physics: 'Show the concept, units, and solution steps, then run a basic reasonableness check.',
      computer: 'Run the program or prototype and record the observed output plus at least one tested case.',
      'global-skills': 'Produce a short artifact, correct at least one issue, and keep the final version.',
      entrepreneurship: 'Separate the main assumption, current evidence, and the next test.',
      'unique-thinking': 'Record the decision rationale, one limitation, and a way to check the result.'
    };
    const text = lang === 'fa' ? fa[stat] : en[stat];
    if (mode === 'recall' || mode === 'review') {
      return lang === 'fa'
        ? 'پیش از دیدن یادداشت‌ها پاسخ بده؛ سپس پاسخ را بررسی و موارد فراموش‌شده را اصلاح کن.'
        : 'Answer before opening notes, then check the response and correct anything missed.';
    }
    if (mode === 'assessment') {
      return lang === 'fa'
        ? 'پاسخ‌ها و نتیجهٔ واقعی را ثبت کن؛ اشتباه‌ها را از پاسخ‌های درست جدا ساز.'
        : 'Record the actual answers/results and separate mistakes from correct responses.';
    }
    return text || (lang === 'fa' ? 'یک خروجی قابل‌بررسی بساز و نتیجه را ثبت کن.' : 'Produce a checkable output and record the result.');
  }

  function reflectionPromptFor(lang) {
    return lang === 'fa'
      ? 'بازتاب کوتاه: چه چیزی روشن شد، چه چیزی هنوز نامطمئن است و قدم بعدی چیست؟'
      : 'Quick reflection: what became clear, what remains uncertain, and what is the next step?';
  }

  function cleanReviewTopic(value) {
    return String(value || '').trim()
      .replace(/^(?:spaced review|review|active recall review|مرور فاصله‌دار|مرور فعال|مرور):\s*/i, '')
      .slice(0, 88) || 'the previous topic';
  }

  function buildDeepLocalPlan(count = 4, customFocus = '', providedSnapshot) {
    const snapshot = buildSnapshot(providedSnapshot);
    const analysis = analyze(snapshot);
    const requested = clamp(Math.floor(safeNum(count, 4)) || 4, 1, 6);
    const focusMatch = matchFocus(String(customFocus || '').slice(0, 500));
    const explicitFocusOrder = focusMatch.order;
    const order = [...new Set([...explicitFocusOrder, analysis.focus, ...analysis.focusOrder, analysis.weakest, ...STAT_IDS])];
    const lang = getLang();
    const recent = new Set((analysis.snapshot.history.recentTitles || []).map(titleKey));
    const active = new Set((analysis.snapshot.todayQuests.activeTitles || []).map(titleKey));
    const used = new Set();
    const missions = [];
    const maxMinutes = parseMinutesLimit(focusMatch.note);

    const orderedBanks = order.map(stat => ({
      stat,
      bank: (MISSION_BANK[stat] || []).slice().sort((a, b) => matchTemplateScore(b, focusMatch) - matchTemplateScore(a, focusMatch))
    }));
    const bankByStat = new Map(orderedBanks.map(item => [item.stat, item.bank]));
    const addTemplate = (stat, template) => {
      if (!template || missions.length >= requested) return false;
      const title = localizedText(template.title, lang);
      const key = titleKey(title);
      if (used.has(key) || recent.has(key) || active.has(key)) return false;
      used.add(key);
      const branchEvents14 = safeNum(analysis.snapshot.history.byStat14?.[stat], 0);
      const difficulty = template.diff === 'hard' && branchEvents14 < 2 ? 'medium' : template.diff;
      const minutes = maxMinutes === null ? template.min : Math.min(template.min, maxMinutes);
      const baseDescription = localizedText(template.desc, lang);
      const learningMode = learningModeForTemplate(template);
      const technique = localizedText(learningTechniqueFor(learningMode, lang), lang);
      const criterion = successCriterionFor(stat, learningMode, lang);
      const reflection = reflectionPromptFor(lang);
      const followUpDays = learningMode === 'assessment' || learningMode === 'project' || learningMode === 'validation' ? 7 : 3;
      const plannedReviewDate = localDateKey(new Date(Date.now() + followUpDays * DAY_MS));
      const timeNote = minutes < template.min
        ? (lang === 'fa' ? ` این جلسه را به ${minutes} دقیقه محدود کن؛ بخش باقی‌مانده را به جلسهٔ بعد بسپار.` : ` Limit this session to ${minutes} minutes; carry the remaining work to another session.`)
        : '';
      const learningGuide = lang === 'fa'
        ? `\n\nروش یادگیری: ${technique}.\nمعیار پایان: ${criterion}\n${reflection}`
        : `\n\nLearning method: ${technique}.\nSuccess check: ${criterion}\n${reflection}`;
      missions.push({
        title, description: `${baseDescription}${timeNote}${learningGuide}`,
        stat, subskill: template.subskill, difficulty,
        estimatedMinutes: clamp(minutes, 5, 120), xp: clamp(template.xp, 20, 100), coins: clamp(template.coins, 0, 20),
        reason: lang === 'fa'
          ? `انتخاب محلی و قابل‌توضیح؛ ${explicitFocusOrder.includes(stat) ? 'همسو با اولویت نوشته‌شده' : `با اولویت ${label(stat, 'fa')}`}؛ شتاب ثبت‌شده ${analysis.momentum}/۱۰۰. ${branchEvents14 < 2 && template.diff === 'hard' ? 'دشواری برای کمبود سابقهٔ همین شاخه تعدیل شد، نه بر اساس قضاوت توانایی.' : ''}`
          : `Transparent local selection; ${explicitFocusOrder.includes(stat) ? 'aligned with your focus note' : `prioritized ${label(stat, 'en')}`}; recorded momentum ${analysis.momentum}/100. ${branchEvents14 < 2 && template.diff === 'hard' ? 'Difficulty was moderated because branch-specific history is sparse, not because ability was judged.' : ''}`,
        source: 'LOCAL', learningMode, learningModeSource: 'planned', learningTechnique: technique,
        successCriterion: criterion, reflectionPrompt: reflection,
        reviewIntervalDays: followUpDays, plannedReviewDate,
        adaptation: branchEvents14 < 2 ? 'sparse-branch-history' : 'branch-history-aware',
        completionEvidence: lang === 'fa'
          ? 'نتیجه را با شاهد واقعی ثبت کن: جواب بررسی‌شده، توضیح کوتاه، آزمون اجراشده یا تصمیم مستند.'
          : 'Record an actual result: a checked answer, short explanation, executed test, or documented decision.'
      });
      return true;
    };

    // A review opportunity appears 3–90 days after branch activity. It reuses the prior topic for spacing,
    // but is allowed to repeat the same review title because repetition after an interval is intentional.
    const dueReviews = analysis.learningSignals.reviewDue || [];
    const reviewCandidate = explicitFocusOrder.length
      ? dueReviews.find(item => explicitFocusOrder.includes(item.stat)) || null
      : dueReviews[0] || null;
    let reviewedStat = null;
    if (reviewCandidate && missions.length < requested) {
      const topic = cleanReviewTopic(reviewCandidate.title);
      const title = (lang === 'fa' ? `مرور فاصله‌دار: ${topic}` : `Spaced review: ${topic}`).slice(0, 180);
      const key = titleKey(title);
      if (!used.has(key) && !active.has(key)) {
        used.add(key);
        reviewedStat = reviewCandidate.stat;
        const minutes = maxMinutes === null ? 20 : Math.min(20, maxMinutes);
        const intervalDays = reviewCandidate.daysSince < 7 ? 7 : reviewCandidate.daysSince < 14 ? 14 : 30;
        const plannedReviewDate = localDateKey(new Date(Date.now() + intervalDays * DAY_MS));
        const technique = localizedText(learningTechniqueFor('review', lang), lang);
        const criterion = successCriterionFor(reviewCandidate.stat, 'review', lang);
        const reflection = reflectionPromptFor(lang);
        const description = lang === 'fa'
          ? `موضوع برای بازبینی: «${topic}». ابتدا از حافظه توضیح بده یا مسئله را دوباره حل کن؛ سپس با یادداشت یا منبع اصلی مقایسه و اشتباه‌ها را اصلاح کن. از آخرین فعالیت ثبت‌شده ${reviewCandidate.daysSince} روز گذشته است؛ این زمان‌بندی فقط پیشنهاد مرور است و فراموشی را ثابت نمی‌کند.\n\nروش یادگیری: ${technique}.\nمعیار پایان: ${criterion}\n${reflection}`
          : `Topic to revisit: “${topic}”. First explain it or solve the problem from memory; then compare with your notes/source and correct mistakes. ${reviewCandidate.daysSince} day(s) have passed since the last recorded activity; this is only a review-timing suggestion, not proof of forgetting.\n\nLearning method: ${technique}.\nSuccess check: ${criterion}\n${reflection}`;
        missions.push({
          title, description, stat: reviewCandidate.stat, subskill: 'Spaced retrieval review',
          difficulty: 'easy', estimatedMinutes: clamp(minutes, 5, 20), xp: 35, coins: 6,
          reason: lang === 'fa'
            ? `مرور بر اساس آخرین موضوع ثبت‌شده در ${label(reviewCandidate.stat, 'fa')} و فاصلهٔ ${reviewCandidate.daysSince} روزه؛ پیشنهاد زمان‌بندی است، نه تشخیص ضعف.`
            : `Review scheduled from the last recorded topic in ${label(reviewCandidate.stat, 'en')} after ${reviewCandidate.daysSince} day(s); this is scheduling, not a diagnosis of weakness.`,
          source: 'LOCAL', learningMode: 'review', learningModeSource: 'planned', learningTechnique: technique,
          successCriterion: criterion, reflectionPrompt: reflection,
          reviewIntervalDays: intervalDays, plannedReviewDate,
          adaptation: 'spaced-review-due',
          completionEvidence: lang === 'fa'
            ? 'پاسخ یا راه‌حل از حافظه، مقایسه با منبع و اصلاح حداقل یک مورد لازم را ثبت کن.'
            : 'Record an answer or solution from memory, a comparison with the source, and at least one correction if needed.'
        });
      }
    }

    // Explicitly requested branches get a task first; if a due review already occupies a branch, avoid doubling it immediately.
    for (const stat of explicitFocusOrder) {
      if (missions.length >= requested) break;
      if (stat === reviewedStat) continue;
      for (const template of bankByStat.get(stat) || []) {
        if (addTemplate(stat, template)) break;
      }
    }
    const maxBankLength = Math.max(0, ...orderedBanks.map(item => item.bank.length));
    for (let round = 0; round < maxBankLength && missions.length < requested; round++) {
      for (const { stat, bank } of orderedBanks) {
        if (missions.length >= requested) break;
        if (round === 0 && stat === reviewedStat) continue;
        addTemplate(stat, bank[round]);
      }
    }
    let fallbackIndex = 1;
    while (missions.length < requested) {
      const stat = order[(missions.length + fallbackIndex - 1) % order.length] || analysis.focus;
      const title = lang === 'fa' ? `تمرین تشخیصی ${label(stat, 'fa')} ${fallbackIndex}` : `${label(stat, 'en')} diagnostic practice ${fallbackIndex}`;
      const key = titleKey(title);
      fallbackIndex++;
      if (used.has(key) || recent.has(key) || active.has(key)) continue;
      used.add(key);
      const minutes = maxMinutes === null ? 20 : Math.min(20, maxMinutes);
      const technique = localizedText(learningTechniqueFor('assessment', lang), lang);
      const criterion = successCriterionFor(stat, 'assessment', lang);
      const reflection = reflectionPromptFor(lang);
      const description = lang === 'fa'
        ? `در ${minutes} دقیقه یک هدف کوچک انتخاب کن، پیش از مراجعه به یادداشت‌ها نتیجه را ثبت کن، سپس آن را بررسی و یک اشتباه یا نکتهٔ تازه را یادداشت کن.\n\nروش یادگیری: ${technique}.\nمعیار پایان: ${criterion}\n${reflection}`
        : `Choose one small target for ${minutes} minutes, record a result before checking notes, then verify it and note one error or new insight.\n\nLearning method: ${technique}.\nSuccess check: ${criterion}\n${reflection}`;
      missions.push({
        title, description, stat, subskill: 'Diagnostic practice', difficulty: 'medium', estimatedMinutes: minutes,
        xp: 40, coins: 7,
        reason: lang === 'fa' ? 'تمرین جایگزین محلی برای حفظ تنوع و قابل‌اندازه‌گیری‌بودن برنامه.' : 'Local fallback to preserve a distinct, measurable plan.',
        source: 'LOCAL', learningMode: 'assessment', learningModeSource: 'planned', learningTechnique: technique,
        successCriterion: criterion, reflectionPrompt: reflection,
        reviewIntervalDays: 3, plannedReviewDate: localDateKey(new Date(Date.now() + 3 * DAY_MS)),
        adaptation: 'diagnostic-fallback',
        completionEvidence: lang === 'fa' ? 'ثبت یک نتیجهٔ قابل‌بررسی و اصلاح لازم.' : 'Record a checkable result and any needed correction.'
      });
    }

    const localSummary = lang === 'fa'
      ? (analysis.snapshot.history.last30 > 0
        ? `برنامه از ${analysis.snapshot.history.last7} رویداد ثبت‌شده در ۷ روز اخیر، ${analysis.snapshot.history.activeDays7} روز فعال و سطح فعلی شاخه‌ها استفاده کرد. اطمینان داده: ${analysis.dataConfidence} از ۱۰۰.`
        : 'هنوز رویداد اخیر ثبت نشده است؛ برنامه بر اساس سطح‌های فعلی و اولویت نوشته‌شده ساخته شده و دربارهٔ عادت‌ها یا روند رشد ادعایی نمی‌کند.')
      : (analysis.snapshot.history.last30 > 0
        ? `Plan used ${analysis.snapshot.history.last7} recorded event(s) in the last 7 days, ${analysis.snapshot.history.activeDays7} active day(s), and current branch levels. Data confidence: ${analysis.dataConfidence}/100.`
        : 'No recent events are recorded yet. The plan uses current levels and the focus note; it does not infer habits or growth trends.');
    const focusAreas = analysis.focusAreas.map(area => ({
      stat: area.stat,
      reason: lang === 'fa'
        ? (area.reason.startsWith('Current level-based priority') ? 'اولویت بر اساس سطح فعلی است؛ سابقه برای تشخیص روند کافی نیست.' : `${label(area.stat, 'fa')}: ${area.reason}`)
        : `${label(area.stat, 'en')}: ${area.reason}`
    }));
    return {
      analysis: {
        summary: localSummary, strengths: analysis.strengths, focusAreas,
        nextStep: localizedText(analysis.nextAction, lang), momentum: analysis.momentum, fatigue: analysis.fatigue,
        trend: analysis.trend, trendPercent: analysis.trendPercent, activeDays7: analysis.activeDays7,
        currentStreak: analysis.currentStreak, balanceScore: analysis.balanceScore,
        dataConfidence: analysis.dataConfidence, dataQuality: analysis.dataQuality,
        learningSignals: analysis.learningSignals,
        branchDiagnostics: analysis.branchDiagnostics,
        source: 'SYSTEM Intelligence Engine 1.0.0',
        evidenceNote: lang === 'fa'
          ? 'این شاخص‌ها تخمینی و مبتنی بر فعالیت ثبت‌شده‌اند؛ امتیاز اطمینان، معیار آماری کالیبره‌شده نیست و فعالیت به‌تنهایی تسلط را ثابت نمی‌کند. آزمون، پروژه یا ارزیابی همچنان لازم است.'
          : 'These indicators are heuristic summaries of recorded activity; the evidence score is not calibrated statistical confidence, and activity alone does not prove mastery. Tests, projects, or assessment still matter.'
      },
      metrics: {
        momentum: analysis.momentum, trend: analysis.trend, trendPercent: analysis.trendPercent,
        activeDays7: analysis.activeDays7, currentStreak: analysis.currentStreak,
        balanceScore: analysis.balanceScore, dataConfidence: analysis.dataConfidence,
        dataQuality: analysis.dataQuality, recordedEvents7: analysis.snapshot.history.last7,
        recordedEvents30: analysis.snapshot.history.last30,
        reviewDueCount: analysis.learningSignals.reviewDueCount,
        learningModeCoverage: analysis.learningSignals.modeCoverage30,
        explicitOutcomeCount30: analysis.learningSignals.explicitOutcomeCount30
      },
      missions: missions.slice(0, requested)
    };
  }

  const Intelligence = Object.freeze({
    version: '8.0.0', analyze, buildDeepLocalPlan,
    getSnapshot: getSnapshotFromLegacy, STAT_IDS, STAT_LABELS, FOCUS_CUES, LEARNING_MODES,
    label, matchFocus, deriveHistory, normalizeHistoryEntry, normalizeLearningMode, inferLearningMode
  });
  global.SYSTEMIntelligence = Intelligence;

  function tryAttachInsightCard() {
    if (typeof document === 'undefined' || !document.createElement) return;
    const host = document.getElementById('status-page') || document.querySelector('.status-main-panel') || document.getElementById('ai-progress-analysis');
    if (!host || document.getElementById('system-intelligence-insight')) return;
    const analysis = analyze();
    const lang = getLang();
    const card = document.createElement('section');
    card.id = 'system-intelligence-insight'; card.className = 'system-intelligence-card';
    const header = document.createElement('div'); header.className = 'si-header';
    const title = document.createElement('strong'); title.textContent = 'SYSTEM Intelligence';
    const momentum = document.createElement('span'); momentum.className = 'si-momentum'; momentum.textContent = `${analysis.momentum}/100`;
    header.append(title, momentum);
    const next = document.createElement('p'); next.className = 'si-next'; next.textContent = localizedText(analysis.nextAction, lang);
    const list = document.createElement('ul'); list.className = 'si-insights';
    analysis.insights.slice(0, 2).forEach(insight => { const item = document.createElement('li'); item.textContent = localizedText(insight, lang); list.appendChild(item); });
    card.append(header, next, list); host.prepend(card);
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(tryAttachInsightCard, 800));
    else setTimeout(tryAttachInsightCard, 800);
  }
})(typeof window !== 'undefined' ? window : globalThis);
