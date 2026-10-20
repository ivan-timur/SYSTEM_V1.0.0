/** Pure domain rules for the Daily Quest XP streak.
 * The caller persists the returned state in the same transaction as the Quest reward.
 */
export interface DailyQuestStreakRecord {
  id: 'daily-quest-streak';
  lastDate: string | null;
  streak: number;
  bestStreak: number;
  updatedAt: string;
  importedFrom?: string;
}

export interface DailyQuestStreakTransition {
  state: DailyQuestStreakRecord;
  multiplier: number;
  advanced: boolean;
  daysSinceLastCompletion: number | null;
}

function validDateStamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function calendarDayNumber(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function validatePrevious(value: unknown): DailyQuestStreakRecord | undefined {
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Stored Daily Quest streak is invalid');
  const item = value as Record<string, unknown>;
  if (item.id !== 'daily-quest-streak') throw new Error('Stored Daily Quest streak identity is invalid');
  if (item.lastDate !== null && !validDateStamp(item.lastDate)) throw new Error('Stored Daily Quest streak date is invalid');
  for (const field of ['streak', 'bestStreak'] as const) {
    if (!Number.isSafeInteger(item[field]) || Number(item[field]) < 0 || Number(item[field]) > 1_000_000_000) {
      throw new Error(`Stored Daily Quest streak ${field} is invalid`);
    }
  }
  if (item.lastDate === null && Number(item.streak) !== 0) throw new Error('Empty Daily Quest streak cannot have a positive current streak');
  if (item.lastDate !== null && Number(item.streak) < 1) throw new Error('A dated Daily Quest streak must be positive');
  if (Number(item.bestStreak) < Number(item.streak)) throw new Error('Daily Quest best streak cannot be below the current streak');
  if (typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt))) throw new Error('Stored Daily Quest streak timestamp is invalid');
  return item as unknown as DailyQuestStreakRecord;
}

/** +5% per consecutive active day after Day 1, capped at +50%. */
export function dailyQuestStreakMultiplier(streak: number): number {
  if (!Number.isSafeInteger(streak) || streak < 0 || streak > 1_000_000_000) throw new Error('Daily Quest streak count is invalid');
  return 1 + Math.min(Math.max(0, streak - 1), 10) * 0.05;
}

/**
 * Advances no more than once per local calendar date. Missing days reset to Day 1;
 * a clock moving backward is rejected rather than silently manufacturing a streak.
 */
export function calculateDailyQuestStreak(
  previousValue: unknown,
  localDateStamp: string,
  now = new Date().toISOString(),
): DailyQuestStreakTransition {
  if (!validDateStamp(localDateStamp)) throw new Error('Daily Quest streak requires a real local calendar date');
  if (!Number.isFinite(Date.parse(now))) throw new Error('Daily Quest streak timestamp is invalid');
  const previous = validatePrevious(previousValue);
  if (!previous) {
    const state: DailyQuestStreakRecord = {
      id: 'daily-quest-streak', lastDate: localDateStamp,
      streak: 1, bestStreak: 1, updatedAt: now,
    };
    return { state, multiplier: 1, advanced: true, daysSinceLastCompletion: null };
  }

  const gap = previous.lastDate === null ? null : calendarDayNumber(localDateStamp) - calendarDayNumber(previous.lastDate);
  if (gap !== null && gap < 0) throw new Error('Daily Quest streak date moved backward; progression was not changed');

  // Additional Quests on the same date use the same multiplier and do not add days.
  if (gap === 0) {
    return {
      state: { ...previous },
      multiplier: dailyQuestStreakMultiplier(previous.streak),
      advanced: false,
      daysSinceLastCompletion: 0,
    };
  }

  const nextStreak = gap === 1 ? previous.streak + 1 : 1;
  const state: DailyQuestStreakRecord = {
    id: 'daily-quest-streak',
    lastDate: localDateStamp,
    streak: nextStreak,
    bestStreak: Math.max(previous.bestStreak, nextStreak),
    updatedAt: now,
    ...(previous.importedFrom ? { importedFrom: previous.importedFrom } : {}),
  };
  return {
    state,
    multiplier: dailyQuestStreakMultiplier(nextStreak),
    advanced: true,
    daysSinceLastCompletion: gap,
  };
}
