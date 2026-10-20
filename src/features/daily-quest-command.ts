/**
 * Daily Quest application command.
 *
 * This module is deliberately independent from the DOM and the legacy controller.
 * It resolves the canonical TypeScript Quest ID, supports read-only aliases from
 * older migration builds, and delegates all player mutations to the one IndexedDB
 * progression transaction. It is prepared for cutover but is not wired into the
 * legacy UI until the real-browser gate passes.
 */
import type { ProgressionRules } from '../core/progression.js';
import { getCanonicalDomainQuestId, getLegacyDomainQuestIdAliases, getProgressionRewardIdentity, SYSTEM_STAT_IDS } from '../core/reward-command.js';
import { SYSTEM_CORE_DAILY_QUESTS } from '../data/quest-catalog.js';
import {
  completeQuestInDatabase,
  findPersistedQuestByCandidates,
  type PersistedCompletion,
  type PersistedQuest,
  type ProgressionActivityInput,
  type ProgressionTransactionEffects,
} from '../storage/indexeddb.js';

export type DailyQuestCommandType = 'daily-quest' | 'ai-daily-quest';

export interface DailyQuestEvidence {
  learningMode?: 'practice' | 'recall' | 'explain' | 'review' | 'project' | 'assessment' | 'validation';
  learningModeSource?: 'explicit' | 'inferred';
  evidenceType?: string;
  durationMinutes?: number;
  score?: number;
}

export interface DailyPrizeSelection {
  type: 'xp' | 'coins' | 'xp-coins' | 'item' | 'custom';
  title: string;
  xpReward: number;
  coinReward: number;
  itemId?: string;
}

export interface DailyQuestCommandInput {
  type: DailyQuestCommandType;
  sourceQuestId: string;
  localDateStamp: string;
  /** Expected UI/catalog Stat; when saved Quest metadata exists it must agree. */
  statId?: string | null;
  /** Evidence metadata only; XP/Coins/Skill rewards are always read from the persisted Quest. */
  evidence?: DailyQuestEvidence;
  /** May only be passed with the final core Daily Quest; the transaction enforces the six-Quest gate. */
  dailyPrize?: DailyPrizeSelection;
  now?: string;
}

export interface DailyQuestRecord extends PersistedQuest {
  statId?: string;
  stat?: string;
  legacySourceType?: string;
  legacySourceId?: string;
}

export interface DailyQuestPersistencePort {
  findQuest(candidates: readonly string[]): Promise<DailyQuestRecord | undefined>;
  complete(questId: string, rules: ProgressionRules, now: string, effects: ProgressionTransactionEffects): Promise<PersistedCompletion>;
}

function validDateStamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateSourceId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 200) {
    throw new Error('Daily Quest source ID must be a non-empty, trimmed string of at most 200 characters');
  }
}

function legacyAlias(type: DailyQuestCommandType, sourceId: string, date: string): string {
  const [alias] = getLegacyDomainQuestIdAliases(type, sourceId, date);
  if (!alias) throw new Error('A legacy Daily Quest alias could not be derived');
  return alias;
}

function validateResolvedQuest(
  quest: DailyQuestRecord,
  candidateIds: readonly string[],
  type: DailyQuestCommandType,
  sourceId: string,
): void {
  if (!candidateIds.includes(quest.id)) throw new Error('Resolved Daily Quest ID is outside the allowed identity candidates');
  if (typeof quest.title !== 'string' || !quest.title.trim()) throw new Error('Stored Daily Quest title is invalid');
  if (!['available', 'in-progress', 'completed'].includes(quest.status)) throw new Error('Stored Daily Quest status is invalid');
  if (!Number.isSafeInteger(quest.xpReward) || quest.xpReward <= 0) throw new Error('Stored Daily Quest XP reward is invalid');
  if (!Number.isSafeInteger(quest.coinReward ?? 0) || (quest.coinReward ?? 0) < 0) throw new Error('Stored Daily Quest Coin reward is invalid');
  if (quest.legacySourceType !== undefined && quest.legacySourceType !== type) {
    throw new Error('Stored Daily Quest source type conflicts with the command');
  }
  if (quest.legacySourceId !== undefined && quest.legacySourceId !== sourceId) {
    throw new Error('Stored Daily Quest source ID conflicts with the command');
  }
  // Only old migration IDs may use the compatibility alias. They must retain
  // their migration metadata so an unrelated record cannot be mistaken for one.
  if (quest.id !== candidateIds[0] && (quest.legacySourceType !== type || quest.legacySourceId !== sourceId)) {
    throw new Error('Legacy Daily Quest alias has no matching migration provenance');
  }
}

const indexedDbPort: DailyQuestPersistencePort = {
  async findQuest(candidates) {
    const record = await findPersistedQuestByCandidates(candidates);
    return record as DailyQuestRecord | undefined;
  },
  complete: (questId, rules, now, effects) => completeQuestInDatabase(questId, rules, now, effects),
};

/**
 * Complete one persisted Daily Quest. The saved Quest record is authoritative for
 * XP, Coins, title and Skill rewards; caller-supplied reward numbers are never used.
 */
export async function completeDailyQuestCommand(
  input: DailyQuestCommandInput,
  rules: ProgressionRules,
  persistence: DailyQuestPersistencePort = indexedDbPort,
): Promise<PersistedCompletion> {
  if (!input || typeof input !== 'object') throw new Error('Daily Quest command input is required');
  if (input.type !== 'daily-quest' && input.type !== 'ai-daily-quest') throw new Error('Unsupported Daily Quest command type');
  validateSourceId(input.sourceQuestId);
  if (!validDateStamp(input.localDateStamp)) throw new Error('A valid local date is required for Daily Quest completion');
  const now = input.now ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(now))) throw new Error('Daily Quest completion timestamp is invalid');

  if (input.statId !== undefined && input.statId !== null && !SYSTEM_STAT_IDS.includes(input.statId as typeof SYSTEM_STAT_IDS[number])) {
    throw new Error(`Unknown Daily Quest Stat ID: ${String(input.statId)}`);
  }

  const canonicalId = getCanonicalDomainQuestId(input.type, input.sourceQuestId, input.localDateStamp);
  const candidates = [canonicalId, legacyAlias(input.type, input.sourceQuestId, input.localDateStamp)];
  const quest = await persistence.findQuest(candidates);
  if (!quest) throw new Error(`Daily Quest has not been seeded in IndexedDB: ${canonicalId}`);
  validateResolvedQuest(quest, candidates, input.type, input.sourceQuestId);

  const persistedStat = quest.statId ?? quest.stat;
  if (persistedStat && input.statId && persistedStat !== input.statId) {
    throw new Error('Daily Quest Stat mapping differs from the persisted catalogue');
  }
  const statId = persistedStat || input.statId || null;
  if (statId && !SYSTEM_STAT_IDS.includes(statId as typeof SYSTEM_STAT_IDS[number])) {
    throw new Error(`Stored Daily Quest contains an unknown Stat ID: ${statId}`);
  }

  let requiredQuestIds: string[] | undefined;
  let prizeEffects: ProgressionTransactionEffects['dailyPrize'];
  if (input.dailyPrize) {
    if (input.type !== 'daily-quest' || !SYSTEM_CORE_DAILY_QUESTS.some(item => item.id === input.sourceQuestId)) {
      throw new Error('The Daily Prize can only be claimed by a core Daily Quest completion');
    }
    const records = await Promise.all(SYSTEM_CORE_DAILY_QUESTS.map(async item => {
      const canonical = getCanonicalDomainQuestId('daily-quest', item.id, input.localDateStamp);
      const alias = legacyAlias('daily-quest', item.id, input.localDateStamp);
      const record = await persistence.findQuest([canonical, alias]);
      if (!record) throw new Error(`Daily Prize gate is missing core Quest ${item.id} for ${input.localDateStamp}`);
      validateResolvedQuest(record, [canonical, alias], 'daily-quest', item.id);
      return record.id;
    }));
    requiredQuestIds = [...new Set(records)];
    if (requiredQuestIds.length !== 6 || !requiredQuestIds.includes(quest.id)) {
      throw new Error('Daily Prize gate could not resolve all six unique core Daily Quests');
    }
    prizeEffects = {
      id: `daily-prize:${input.localDateStamp}`,
      date: input.localDateStamp,
      type: input.dailyPrize.type,
      title: input.dailyPrize.title,
      xpReward: input.dailyPrize.xpReward,
      coinReward: input.dailyPrize.coinReward,
      ...(input.dailyPrize.itemId ? { itemId: input.dailyPrize.itemId } : {}),
      sourceQuestId: quest.id,
      requiredQuestIds,
    };
  }

  const rewardIdentity = getProgressionRewardIdentity({ type: input.type, questId: input.sourceQuestId }, input.localDateStamp);
  if (!rewardIdentity.idempotencyKey) throw new Error('Daily Quest idempotency identity could not be created');

  const activity: ProgressionActivityInput = {
    eventId: rewardIdentity.idempotencyKey,
    type: input.type,
    title: quest.title,
    stat: statId,
    skillId: quest.skillId ?? quest.skillRewards?.[0]?.skillId ?? null,
    questId: input.sourceQuestId,
    ...(input.evidence?.learningMode ? { learningMode: input.evidence.learningMode } : {}),
    ...(input.evidence?.learningModeSource ? { learningModeSource: input.evidence.learningModeSource } : {}),
    ...(input.evidence?.evidenceType ? { evidenceType: input.evidence.evidenceType } : {}),
    ...(input.evidence?.durationMinutes !== undefined ? { durationMinutes: input.evidence.durationMinutes } : {}),
    ...(input.evidence?.score !== undefined ? { score: input.evidence.score } : {}),
  };
  const isCoreDailyQuest = input.type === 'daily-quest'
    && SYSTEM_CORE_DAILY_QUESTS.some(item => item.id === input.sourceQuestId);
  const effects: ProgressionTransactionEffects = {
    activity,
    progressCounterDeltas: input.type === 'daily-quest'
      ? { totalDailyQuestsCompleted: 1 }
      : { totalAIDailyQuestsCompleted: 1 },
    ...(statId ? { statAward: { statId, xpAmount: quest.xpReward } } : {}),
    ...(isCoreDailyQuest ? { dailyQuestStreak: { date: input.localDateStamp, sourceQuestId: input.sourceQuestId } } : {}),
    ...(prizeEffects ? { dailyPrize: prizeEffects } : {}),
  };

  return persistence.complete(quest.id, rules, now, effects);
}

/** Exposes the exact canonical and backward-compatible IDs for diagnostics/tests. */
export function getDailyQuestIdCandidates(type: DailyQuestCommandType, sourceId: string, date: string): readonly string[] {
  validateSourceId(sourceId);
  if (!validDateStamp(date)) throw new Error('A valid local date is required for Daily Quest IDs');
  return Object.freeze([getCanonicalDomainQuestId(type, sourceId, date), legacyAlias(type, sourceId, date)]);
}
