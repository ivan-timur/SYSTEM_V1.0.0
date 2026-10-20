/**
 * Pure, typed eligibility rules for permanent SYSTEM achievements.
 *
 * The legacy Rewards screen still owns presentation and claim persistence during
 * the gradual migration. It must delegate achievement criteria to this module;
 * do not copy these thresholds into UI/controller code.
 */
export interface AchievementSnapshot {
  playerLevel: number;
  totalDailyQuestsCompleted: number;
  bestDailyStreak: number;
  totalBossQuestsCompleted: number;
  maxStatLevel: number;
  totalCustomQuestsCompleted: number;
}

type AchievementMetric = keyof AchievementSnapshot;

export interface AchievementRule {
  readonly id: string;
  readonly metric: AchievementMetric;
  readonly threshold: number;
}

/** IDs are persisted in existing saves, so never rename them casually. */
export const SYSTEM_ACHIEVEMENT_RULES: readonly AchievementRule[] = Object.freeze([
  { id: 'achievement-first-mission', metric: 'totalDailyQuestsCompleted', threshold: 1 },
  { id: 'achievement-quest-adept', metric: 'totalDailyQuestsCompleted', threshold: 10 },
  { id: 'achievement-streak-3', metric: 'bestDailyStreak', threshold: 3 },
  { id: 'achievement-streak-7', metric: 'bestDailyStreak', threshold: 7 },
  { id: 'achievement-boss-slayer', metric: 'totalBossQuestsCompleted', threshold: 1 },
  { id: 'achievement-skill-seeker', metric: 'maxStatLevel', threshold: 2 },
  { id: 'achievement-level-five', metric: 'playerLevel', threshold: 5 },
  { id: 'achievement-quest-architect', metric: 'totalCustomQuestsCompleted', threshold: 1 },
] as const);

const RULES_BY_ID = new Map(SYSTEM_ACHIEVEMENT_RULES.map(rule => [rule.id, rule]));
const SNAPSHOT_METRICS: readonly AchievementMetric[] = Object.freeze([
  'playerLevel',
  'totalDailyQuestsCompleted',
  'bestDailyStreak',
  'totalBossQuestsCompleted',
  'maxStatLevel',
  'totalCustomQuestsCompleted',
]);

/** Strict validation keeps malformed storage values from accidentally unlocking rewards. */
export function isValidAchievementSnapshot(value: unknown): value is AchievementSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  return SNAPSHOT_METRICS.every(metric =>
    Number.isSafeInteger(snapshot[metric]) && Number(snapshot[metric]) >= (metric === 'playerLevel' ? 1 : 0)
  );
}

/**
 * Evaluate one achievement against a normalized snapshot. Unknown IDs and bad
 * snapshots fail closed, which is safer than allowing a reward from bad data.
 */
export function isAchievementEligible(id: string, snapshot: unknown): boolean {
  if (typeof id !== 'string' || !id.trim() || !isValidAchievementSnapshot(snapshot)) return false;
  const rule = RULES_BY_ID.get(id);
  if (!rule) return false;
  return snapshot[rule.metric] >= rule.threshold;
}

/** Stable IDs for contract tests, migration checks, and diagnostics. */
export function getAchievementRuleIds(): string[] {
  return SYSTEM_ACHIEVEMENT_RULES.map(rule => rule.id);
}
