/**
 * Canonical command contract for every SYSTEM Quest reward route.
 *
 * This module owns reward input validation, stable domain Quest IDs and local
 * idempotency identity construction. The legacy UI remains an adapter: it may
 * still write its existing localStorage-shaped state, but it must not invent a
 * second identity for the same reward.
 */

export const SYSTEM_STAT_IDS = Object.freeze([
  'entrepreneurship', 'global-skills', 'mathematics', 'computer', 'physics', 'unique-thinking',
] as const);

export const SYSTEM_QUEST_REWARD_TYPES = Object.freeze([
  'daily-quest', 'ai-daily-quest', 'custom-quest', 'boss-quest', 'goal', 'goal-evidence-completion',
] as const);

export type SystemQuestRewardType = typeof SYSTEM_QUEST_REWARD_TYPES[number];
type UnknownRecord = Record<string, unknown>;

const REQUIRED_TYPES = new Set<string>(SYSTEM_QUEST_REWARD_TYPES);
const DAILY_TYPES = new Set<string>(['daily-quest', 'ai-daily-quest']);
const DAILY_RETENTION_IDENTITY_PREFIX = 'v1';
const DEFAULT_NUMERIC_CAP = 1_000_000_000_000;

export interface ProgressionRewardIdentity {
  required: boolean;
  idempotencyKey: string | null;
  rewardType: string;
}

export interface PreparedProgressionReward extends ProgressionRewardIdentity {
  title: string;
  matchingText: string;
  statId: string | null;
  skillId: string | null;
  goalId: string | null;
  sourceQuestId: string | null;
  domainQuestId: string;
  xp: number;
  coins: number;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanIdentifier(value: unknown, label: string, maxLength = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength || value !== value.trim()) {
    throw new Error(`${label} must be a non-empty, trimmed string of at most ${maxLength} characters`);
  }
  return value;
}

function requiredType(value: unknown): string {
  const type = value === undefined || value === null || value === '' ? 'activity' : value;
  if (typeof type !== 'string' || !type.trim() || type !== type.trim() || type.length > 40) {
    throw new Error('Reward type must be a non-empty string of at most 40 characters');
  }
  return type;
}

function isValidDateStamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Canonical persisted Quest identity shared by migration and runtime commands.
 * Unlike silent truncation, an oversized ID is rejected to prevent two distinct
 * source IDs from collapsing to the same key.
 */
export function getCanonicalDomainQuestId(
  rewardType: string,
  sourceId: string,
  localDateStamp?: string,
): string {
  if (!REQUIRED_TYPES.has(rewardType)) throw new Error(`Unsupported Quest reward type: ${rewardType}`);
  const cleanSourceId = cleanIdentifier(sourceId, 'Quest source ID');
  const namespace = rewardType === 'goal-evidence-completion' ? 'goal' : rewardType;
  let suffix = '';
  if (DAILY_TYPES.has(rewardType)) {
    if (!isValidDateStamp(localDateStamp)) throw new Error('A valid local date is required for a repeatable Daily Quest ID');
    suffix = `:${localDateStamp}`;
  }
  const id = `${namespace}:${cleanSourceId}${suffix}`;
  if (id.length > 200) throw new Error('Canonical domain Quest ID exceeds the supported 200-character limit');
  return id;
}

/**
 * Read-only aliases for records written by older migration planners. These IDs
 * are never emitted for new records and are safe only when stored provenance
 * matches the requested source type and source ID.
 */
export function getLegacyDomainQuestIdAliases(
  rewardType: string,
  sourceId: string,
  localDateStamp?: string,
): readonly string[] {
  if (!REQUIRED_TYPES.has(rewardType)) throw new Error(`Unsupported Quest reward type: ${rewardType}`);
  const cleanSourceId = cleanIdentifier(sourceId, 'Quest source ID');
  let alias: string | undefined;
  if (rewardType === 'daily-quest') {
    if (!isValidDateStamp(localDateStamp)) throw new Error('A valid local date is required for a Daily Quest compatibility alias');
    alias = `daily:${localDateStamp}:${cleanSourceId}`;
  } else if (rewardType === 'ai-daily-quest') {
    if (!isValidDateStamp(localDateStamp)) throw new Error('A valid local date is required for an AI Daily Quest compatibility alias');
    alias = `ai-daily:${localDateStamp}:${cleanSourceId}`;
  } else if (rewardType === 'custom-quest') {
    alias = `custom:${cleanSourceId}`;
  } else if (rewardType === 'boss-quest') {
    alias = `boss:${cleanSourceId}`;
  } else {
    alias = `goal:${cleanSourceId}`;
  }
  const canonical = getCanonicalDomainQuestId(rewardType, cleanSourceId, localDateStamp);
  return Object.freeze(alias && alias !== canonical ? [alias] : []);
}

/** Returns the canonical duplicate-protection identity for known Quest reward types. */
export function getProgressionRewardIdentity(input: unknown, localDateStamp?: string): ProgressionRewardIdentity {
  if (!isRecord(input)) throw new Error('Progression reward must be an object');
  const rewardType = requiredType(input.type);
  if (!REQUIRED_TYPES.has(rewardType)) return { required: false, idempotencyKey: null, rewardType };

  let namespace = rewardType;
  let identity: string;
  if (rewardType === 'goal' || rewardType === 'goal-evidence-completion') {
    // Manual and evidence-based Goal completion must share one payout identity.
    namespace = 'goal';
    identity = cleanIdentifier(input.goalId, 'Goal ID');
  } else {
    identity = cleanIdentifier(input.questId, 'Quest ID');
  }

  let key = `${DAILY_RETENTION_IDENTITY_PREFIX}|${namespace}|${identity}`;
  if (DAILY_TYPES.has(rewardType)) {
    if (!isValidDateStamp(localDateStamp)) throw new Error('A valid local date is required for a repeatable Daily Quest reward');
    key += `|${localDateStamp}`;
  }
  if (key.length > 280) throw new Error('Reward event ID is too long to store safely');
  return { required: true, idempotencyKey: key, rewardType };
}

/**
 * Validate and canonicalize the common input shared by Daily, AI Daily, Custom,
 * Boss, Goal and Goal-evidence rewards. This function is pure: no browser state,
 * UI, localStorage, or IndexedDB writes occur here.
 */
export function prepareProgressionReward(
  input: unknown,
  localDateStamp: string,
  validStatIds: readonly string[] = SYSTEM_STAT_IDS,
  numericCap = DEFAULT_NUMERIC_CAP,
  now = new Date().toISOString(),
): PreparedProgressionReward {
  if (!isRecord(input)) throw new Error('Progression reward must be an object');
  if (!Number.isFinite(numericCap) || numericCap < 1) throw new Error('Progression numeric cap is invalid');
  if (!Number.isFinite(Date.parse(now))) throw new Error('Progression reward timestamp is invalid');

  const identity = getProgressionRewardIdentity(input, localDateStamp);
  const xpNumber = input.xp === undefined || input.xp === null || input.xp === '' ? Number.NaN : Number(input.xp);
  const coinInput = input.coins === undefined || input.coins === null || input.coins === '' ? 0 : Number(input.coins);
  if (!Number.isFinite(xpNumber) || xpNumber <= 0) throw new Error('Quest XP reward must be a positive finite number');
  if (!Number.isFinite(coinInput) || coinInput < 0) throw new Error('Quest Coin reward must be a finite non-negative number');

  const rawStat = input.stat === undefined || input.stat === null || input.stat === '' || input.stat === 'general'
    ? null : input.stat;
  if (rawStat !== null && (typeof rawStat !== 'string' || !validStatIds.includes(rawStat))) {
    throw new Error(`Unknown Stat ID: ${String(rawStat)}`);
  }
  const rawSkillId = input.skillId === undefined || input.skillId === null || input.skillId === '' ? null : input.skillId;
  if (rawSkillId !== null && (typeof rawSkillId !== 'string' || !rawSkillId.trim() || rawSkillId !== rawSkillId.trim() || rawSkillId.length > 200)) {
    throw new Error('Skill ID is invalid');
  }
  if (rawStat === null && rawSkillId !== null) throw new Error('A Skill reward requires a valid parent Stat');

  const normalizeOptionalId = (value: unknown, label: string): string | null => {
    if (value === undefined || value === null || value === '') return null;
    return cleanIdentifier(value, label);
  };
  const goalId = normalizeOptionalId(input.goalId, 'Goal ID');
  const sourceQuestId = normalizeOptionalId(input.questId, 'Quest ID');

  const titleCandidate = String(input.title || 'Completed activity').trim().slice(0, 140);
  const title = titleCandidate || 'Completed activity';
  const matchingText = String(input.matchingText || title).slice(0, 320);
  const xp = Math.floor(Math.min(numericCap, xpNumber));
  if (xp < 1) throw new Error('Quest XP reward is below the supported minimum after normalization');
  const coins = Math.floor(Math.min(numericCap, coinInput));

  let domainQuestId: string;
  if (REQUIRED_TYPES.has(identity.rewardType)) {
    // Goals use Goal ID for both manual and evidence completion so they resolve
    // to the same persisted Quest, matching their shared payout identity.
    const sourceId = identity.rewardType === 'goal' || identity.rewardType === 'goal-evidence-completion'
      ? goalId
      : sourceQuestId;
    if (!sourceId) throw new Error('Canonical Quest source ID is missing');
    domainQuestId = getCanonicalDomainQuestId(identity.rewardType, sourceId, localDateStamp);
  } else {
    const baseId = sourceQuestId || goalId || `${identity.rewardType}:${now}`.slice(0, 170);
    domainQuestId = `${identity.rewardType}:${baseId}${DAILY_TYPES.has(identity.rewardType) ? `:${localDateStamp}` : ''}`.slice(0, 200);
  }
  if (!domainQuestId.trim()) throw new Error('Canonical domain Quest ID could not be created');

  return {
    ...identity,
    title,
    matchingText,
    statId: rawStat as string | null,
    skillId: rawSkillId as string | null,
    goalId,
    sourceQuestId,
    domainQuestId,
    xp,
    coins,
  };
}
