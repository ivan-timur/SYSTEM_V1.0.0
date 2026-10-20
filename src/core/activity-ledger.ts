/**
 * Pure domain rules for SYSTEM's local activity ledger and lifetime progress counters.
 *
 * Persistence remains in the legacy adapter during the gradual migration: this module
 * never reads the DOM, localStorage, IndexedDB, or AI provider credentials. It only
 * validates, normalizes, and summarizes records supplied by the caller.
 */

export const SYSTEM_MAX_ACTIVITY_RECORDS = 300;
export const SYSTEM_PROGRESS_COUNTER_CAP = 1_000_000_000_000;

export const SYSTEM_ACTIVITY_STATS = [
  'entrepreneurship',
  'global-skills',
  'mathematics',
  'computer',
  'physics',
  'unique-thinking',
] as const;

export const SYSTEM_LEARNING_MODES = [
  'practice',
  'recall',
  'explain',
  'review',
  'project',
  'assessment',
  'validation',
] as const;

export type SystemActivityStat = typeof SYSTEM_ACTIVITY_STATS[number];
export type SystemLearningMode = typeof SYSTEM_LEARNING_MODES[number];
export type SystemLearningModeSource = 'explicit' | 'planned' | 'inferred-from-label';

export interface SystemProgressCounters {
  totalXpEarned: number;
  totalStatXpEarned: number;
  totalDailyQuestsCompleted: number;
  totalCustomQuestsCompleted: number;
  totalBossQuestsCompleted: number;
  totalLevelsGained: number;
  totalStatLevelUps: number;
}

export type SystemProgressCounterKey = keyof SystemProgressCounters;

export interface SystemActivityRecord extends Record<string, unknown> {
  at: string;
  type: string;
  title: string;
  stat: SystemActivityStat | null;
  skillId: string | null;
  goalId: string | null;
  questId: string | null;
  xp: number;
  coins: number;
  eventId?: string;
  learningMode?: SystemLearningMode;
  learningModeSource?: SystemLearningModeSource;
  evidenceType?: string;
  durationMinutes?: number;
  score?: number;
  passed?: boolean;
}

/** Old saves intentionally allow unknown metadata fields, which are preserved. */
export interface SystemHistoricalActivity extends Record<string, unknown> {
  at: string;
  title: string;
}

export interface SystemActivitySummary {
  days: number;
  activities: number;
  xp: number;
  coins: number;
  byStat: Record<string, number>;
}

export type ActivityEvidenceUpdate =
  | { ok: true; activities: SystemHistoricalActivity[]; updatedIndex: number }
  | { ok: false; reason: 'invalid-quest' | 'invalid-evidence' | 'activity-not-found' };

const COUNTER_KEYS: readonly SystemProgressCounterKey[] = [
  'totalXpEarned',
  'totalStatXpEarned',
  'totalDailyQuestsCompleted',
  'totalCustomQuestsCompleted',
  'totalBossQuestsCompleted',
  'totalLevelsGained',
  'totalStatLevelUps',
];

const VALID_STATS = new Set<string>(SYSTEM_ACTIVITY_STATS);
const VALID_LEARNING_MODES = new Set<string>(SYSTEM_LEARNING_MODES);
const VALID_LEARNING_MODE_SOURCES = new Set<string>(['explicit', 'planned', 'inferred-from-label']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeNumber(value: unknown): number {
  try {
    const result = Number(value);
    return Number.isFinite(result) ? result : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

function safeString(value: unknown, fallback: string): string {
  try {
    return String(value);
  } catch {
    return fallback;
  }
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = safeNumber(value);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return Math.floor(Math.min(maximum, parsed));
}

export function createDefaultProgressCounters(): SystemProgressCounters {
  return {
    totalXpEarned: 0,
    totalStatXpEarned: 0,
    totalDailyQuestsCompleted: 0,
    totalCustomQuestsCompleted: 0,
    totalBossQuestsCompleted: 0,
    totalLevelsGained: 0,
    totalStatLevelUps: 0,
  };
}

/**
 * Normalize counters against a fixed allowlist. Unknown keys are ignored, corrupt
 * values become zero, and persisted values use the same cap as live increments.
 */
export function normalizeProgressCounters(
  input: unknown,
  maximum = SYSTEM_PROGRESS_COUNTER_CAP,
): SystemProgressCounters {
  const source = isRecord(input) ? input : {};
  const cap = Number.isSafeInteger(maximum) && maximum >= 0 ? maximum : SYSTEM_PROGRESS_COUNTER_CAP;
  const normalized = createDefaultProgressCounters();
  for (const key of COUNTER_KEYS) {
    const value = safeNumber(source[key]);
    normalized[key] = Number.isFinite(value)
      ? Math.floor(Math.min(cap, Math.max(0, value)))
      : 0;
  }
  return normalized;
}

export interface CounterIncrementResult {
  ok: boolean;
  value?: number;
}

/** Returns a proposed value; callers decide when the persistence write is committed. */
export function proposeProgressCounterIncrement(
  counters: unknown,
  field: unknown,
  amount: unknown = 1,
  maximum = SYSTEM_PROGRESS_COUNTER_CAP,
): CounterIncrementResult {
  if (typeof field !== 'string' || !COUNTER_KEYS.includes(field as SystemProgressCounterKey)) {
    return { ok: false };
  }
  const increment = safeNumber(amount);
  if (!Number.isFinite(increment) || increment <= 0) return { ok: false };
  const source = isRecord(counters) ? counters : {};
  const current = safeNumber(source[field]);
  const cap = Number.isSafeInteger(maximum) && maximum >= 0 ? maximum : SYSTEM_PROGRESS_COUNTER_CAP;
  const currentValue = Number.isFinite(current) ? Math.max(0, Math.min(cap, current)) : 0;
  // Keep the legacy behavior for positive sub-unit values: they are accepted but add zero.
  const next = Math.min(cap, currentValue + Math.floor(increment));
  return { ok: true, value: Math.floor(next) };
}

/**
 * Preserve backward compatibility with prior activity records: validate only the
 * stable timestamp/title anchors and retain other fields rather than dropping data.
 */
export function normalizeActivityHistory(input: unknown): SystemHistoricalActivity[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is Record<string, unknown> => isRecord(item)
      && typeof item.at === 'string'
      && typeof item.title === 'string')
    .slice(-SYSTEM_MAX_ACTIVITY_RECORDS)
    .map(item => ({ ...item, at: item.at as string, title: item.title as string }));
}

function validOptionalText(value: unknown, maximumLength: number): value is string {
  return typeof value === 'string' && value.length <= maximumLength;
}

/** Build a safe activity record without writing it or granting any progression. */
export function createActivityRecord(
  input: unknown = {},
  timestamp = new Date().toISOString(),
): SystemActivityRecord {
  const event = isRecord(input) ? input : {};
  const safeTimestamp = typeof timestamp === 'string' && Number.isFinite(Date.parse(timestamp))
    ? timestamp
    : new Date().toISOString();
  const rawType = event.type || 'activity';
  const rawTitle = event.title || 'Completed activity';
  const xp = safeNumber(event.xp);
  const coins = safeNumber(event.coins);
  const item: SystemActivityRecord = {
    at: safeTimestamp,
    type: safeString(rawType, 'activity').slice(0, 40),
    title: safeString(rawTitle, 'Completed activity').trim().slice(0, 140),
    stat: typeof event.stat === 'string' && VALID_STATS.has(event.stat) ? event.stat as SystemActivityStat : null,
    skillId: validOptionalText(event.skillId, 128) ? event.skillId : null,
    goalId: validOptionalText(event.goalId, 200) ? event.goalId : null,
    questId: validOptionalText(event.questId, 200) ? event.questId : null,
    xp: Number.isFinite(xp) ? Math.max(0, Math.min(1000, Math.floor(xp))) : 0,
    coins: Number.isFinite(coins) ? Math.max(0, Math.min(1000, Math.floor(coins))) : 0,
  };

  if (typeof event.eventId === 'string' && event.eventId.length > 0 && event.eventId.length <= 280) {
    item.eventId = event.eventId;
  }
  if (typeof event.learningMode === 'string' && VALID_LEARNING_MODES.has(event.learningMode)) {
    item.learningMode = event.learningMode as SystemLearningMode;
    item.learningModeSource = typeof event.learningModeSource === 'string'
      && VALID_LEARNING_MODE_SOURCES.has(event.learningModeSource)
      ? event.learningModeSource as SystemLearningModeSource
      : 'explicit';
  }
  if (validOptionalText(event.evidenceType, 40)) item.evidenceType = event.evidenceType;
  const durationMinutes = safeNumber(event.durationMinutes);
  if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
    item.durationMinutes = Math.min(1440, Math.round(durationMinutes));
  }
  const score = safeNumber(event.score);
  if (event.score !== undefined && event.score !== null && event.score !== '' && Number.isFinite(score)) {
    item.score = Math.max(0, Math.min(100, score));
  }
  if (typeof event.passed === 'boolean') item.passed = event.passed;
  return item;
}

export function appendActivityRecord(
  records: readonly SystemHistoricalActivity[],
  activity: SystemHistoricalActivity,
): SystemHistoricalActivity[] {
  return [...records, activity].slice(-SYSTEM_MAX_ACTIVITY_RECORDS);
}

function isOptionalEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function isValidEvidenceInput(evidence: Record<string, unknown>): boolean {
  const mode = evidence.learningMode;
  if (!isOptionalEmpty(mode) && !(typeof mode === 'string' && VALID_LEARNING_MODES.has(mode))) return false;

  const score = evidence.score;
  if (!isOptionalEmpty(score)) {
    const number = safeNumber(score);
    if (!Number.isFinite(number) || number < 0 || number > 100) return false;
  }

  const duration = evidence.durationMinutes;
  if (!isOptionalEmpty(duration)) {
    const number = safeNumber(duration);
    if (!Number.isFinite(number) || number < 1 || number > 1440) return false;
  }

  const passed = evidence.passed;
  if (!isOptionalEmpty(passed) && typeof passed !== 'boolean') return false;
  return true;
}

/**
 * Return a new activity history with the last matching AI Daily Quest enriched by
 * self-reported evidence. Evidence is metadata only and cannot alter XP or Coins.
 */
export function updateActivityEvidence(
  records: readonly SystemHistoricalActivity[],
  questInput: unknown,
  evidenceInput: unknown = {},
): ActivityEvidenceUpdate {
  if (!isRecord(questInput)
      || typeof questInput.id !== 'string'
      || typeof questInput.title !== 'string') {
    return { ok: false, reason: 'invalid-quest' };
  }
  const evidence = isRecord(evidenceInput) ? evidenceInput : {};
  if (!isValidEvidenceInput(evidence)) return { ok: false, reason: 'invalid-evidence' };

  let matchedIndex = -1;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const item = records[index];
    if (!item || item.type !== 'ai-daily-quest') continue;
    if ((Boolean(item.questId) && item.questId === questInput.id)
        || (!item.questId && item.title === questInput.title)) {
      matchedIndex = index;
      break;
    }
  }
  if (matchedIndex < 0) return { ok: false, reason: 'activity-not-found' };

  const current = records[matchedIndex];
  const updated: SystemHistoricalActivity = { ...current };
  if (typeof evidence.learningMode === 'string' && VALID_LEARNING_MODES.has(evidence.learningMode)) {
    updated.learningMode = evidence.learningMode;
    updated.learningModeSource = 'explicit';
  }
  if (!isOptionalEmpty(evidence.score)) {
    const score = safeNumber(evidence.score);
    updated.score = Math.max(0, Math.min(100, score));
  }
  if (typeof evidence.passed === 'boolean') updated.passed = evidence.passed;
  if (!isOptionalEmpty(evidence.durationMinutes)) {
    const duration = safeNumber(evidence.durationMinutes);
    updated.durationMinutes = Math.max(1, Math.min(1440, Math.round(duration)));
  }
  const activities = [...records];
  activities[matchedIndex] = updated;
  return { ok: true, activities, updatedIndex: matchedIndex };
}

function normalizeBoundedLimit(value: unknown, fallback: number, maximum: number): number {
  const parsed = safeNumber(value);
  if (!Number.isFinite(parsed) || parsed === 0) return fallback;
  return Math.max(1, Math.min(maximum, Math.floor(parsed)));
}

export function listActivities(
  history: readonly SystemHistoricalActivity[],
  limit: unknown = SYSTEM_MAX_ACTIVITY_RECORDS,
): SystemHistoricalActivity[] {
  const safeLimit = normalizeBoundedLimit(limit, SYSTEM_MAX_ACTIVITY_RECORDS, SYSTEM_MAX_ACTIVITY_RECORDS);
  return history.slice(-safeLimit).reverse().map(item => ({ ...item }));
}

/** Matches the historical dashboard API: old future-dated entries are not silently rewritten. */
export function summarizeActivities(
  history: readonly SystemHistoricalActivity[],
  daysInput: unknown = 7,
  nowMs = Date.now(),
): SystemActivitySummary {
  const days = normalizeBoundedLimit(daysInput, 7, 365);
  const since = nowMs - days * 86_400_000;
  const recent = history.filter(item => {
    const time = Date.parse(item.at);
    return Number.isFinite(time) && time >= since;
  });
  const byStat: Record<string, number> = {};
  let xp = 0;
  let coins = 0;
  for (const item of recent) {
    const itemXp = safeNumber(item.xp);
    const itemCoins = safeNumber(item.coins);
    if (Number.isFinite(itemXp)) xp += itemXp;
    if (Number.isFinite(itemCoins)) coins += itemCoins;
    const stat = typeof item.stat === 'string' && VALID_STATS.has(item.stat) ? item.stat : null;
    if (stat) byStat[stat] = (byStat[stat] || 0) + 1;
  }
  return { days, activities: recent.length, xp, coins, byStat };
}

/** Return records inside an inclusive timestamp window (used by the AI planning snapshot). */
export function selectActivitiesInRange(
  history: readonly SystemHistoricalActivity[],
  fromMs: number,
  throughMs: number,
): SystemHistoricalActivity[] {
  if (!Number.isFinite(fromMs) || !Number.isFinite(throughMs) || fromMs > throughMs) return [];
  return history.filter(item => {
    const time = Date.parse(item.at);
    return Number.isFinite(time) && time >= fromMs && time <= throughMs;
  });
}

/** Count only recognized Stats; malformed or stale Stat labels collapse to `general`. */
export function countActivitiesByStat(
  history: readonly SystemHistoricalActivity[],
  fallback = 'general',
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of history) {
    const stat = typeof item.stat === 'string' && VALID_STATS.has(item.stat) ? item.stat : fallback;
    result[stat] = (result[stat] || 0) + 1;
  }
  return result;
}
