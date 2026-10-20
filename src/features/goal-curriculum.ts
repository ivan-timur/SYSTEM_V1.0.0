/**
 * Pure Goal -> Milestone -> Skill -> Quest -> Evidence evaluation contract.
 * This module evaluates progress only: it never writes storage or grants XP/Coins.
 * The legacy Goal adapter can adopt its output inside the existing transaction.
 */
import { SYSTEM_STAT_IDS } from '../core/reward-command.js';

export type GoalStatId = typeof SYSTEM_STAT_IDS[number];
export type SkillVerificationMethod = 'assessment' | 'project-review' | 'manual-check';
export interface SkillVerification {
  method: SkillVerificationMethod;
  verifiedAt: string;
  score: number;
}
export interface GoalCurriculumEvidence {
  id: string;
  questId: string;
  milestoneId: string;
  title: string;
  at: string;
  stat: GoalStatId | null;
  skillId: string | null;
  /** Skill credit requires a separate, explicit verification record; a quest's skill assignment alone is not mastery. */
  skillVerification: SkillVerification | null;
  passed: boolean;
}
export interface GoalMilestoneDefinition {
  id: string;
  title: string;
  requiredEvidence: number;
  requiredSkillIds: string[];
  prerequisiteIds: string[];
}
export interface GoalCurriculumDefinition {
  id: string;
  title: string;
  stat: GoalStatId | null;
  milestones: GoalMilestoneDefinition[];
  evidence: GoalCurriculumEvidence[];
  completed: boolean;
}
export interface MilestoneEvaluation {
  id: string;
  title: string;
  unlocked: boolean;
  evidenceCount: number;
  evidenceRequired: number;
  verifiedSkillIds: string[];
  requiredSkillIds: string[];
  complete: boolean;
}
export interface GoalCurriculumEvaluation {
  goalId: string;
  milestoneCount: number;
  completedMilestones: number;
  progressPercent: number;
  milestones: MilestoneEvaluation[];
  readyToComplete: boolean;
  alreadyCompleted: boolean;
  /** Explicitly false: evaluation is not a reward command. */
  rewardIssued: false;
}

const MAX_ID = 200;
const MAX_TITLE = 180;
const MAX_MILESTONES = 100;
const MAX_EVIDENCE_PER_MILESTONE = 1000;
const VALID_STATS = new Set<string>(SYSTEM_STAT_IDS);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > MAX_ID) {
    throw new Error(`${label} must be a non-empty trimmed ID of at most ${MAX_ID} characters`);
  }
  return value;
}
function title(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > MAX_TITLE) {
    throw new Error(`${label} must be text of 1-${MAX_TITLE} characters`);
  }
  return value.trim();
}
function cleanIds(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be a list`);
  const seen = new Set<string>();
  return value.map((item) => id(item, label)).filter((item) => {
    if (seen.has(item)) throw new Error(`${label} contains duplicate ID: ${item}`);
    seen.add(item); return true;
  });
}

/** Validate the graph before evaluation; reject unknown/cyclic prerequisite references. */
export function validateGoalCurriculum(value: unknown): GoalCurriculumDefinition {
  if (!isRecord(value)) throw new Error('Goal curriculum must be an object');
  const goalId = id(value.id, 'Goal ID');
  const goalTitle = title(value.title, 'Goal title');
  const stat = value.stat === null || value.stat === undefined || value.stat === '' ? null : value.stat;
  if (stat !== null && (typeof stat !== 'string' || !VALID_STATS.has(stat))) throw new Error('Goal Stat is invalid');
  if (!Array.isArray(value.milestones) || value.milestones.length < 1 || value.milestones.length > MAX_MILESTONES) {
    throw new Error(`Goal must contain 1-${MAX_MILESTONES} milestones`);
  }
  const milestoneIds = new Set<string>();
  const milestones = value.milestones.map((raw, index): GoalMilestoneDefinition => {
    if (!isRecord(raw)) throw new Error(`Milestone ${index + 1} must be an object`);
    const milestoneId = id(raw.id, 'Milestone ID');
    if (milestoneIds.has(milestoneId)) throw new Error(`Duplicate Milestone ID: ${milestoneId}`);
    milestoneIds.add(milestoneId);
    const requiredEvidence = raw.requiredEvidence;
    if (!Number.isSafeInteger(requiredEvidence) || Number(requiredEvidence) < 1 || Number(requiredEvidence) > MAX_EVIDENCE_PER_MILESTONE) {
      throw new Error(`Milestone ${milestoneId} evidence target is invalid`);
    }
    return {
      id: milestoneId,
      title: title(raw.title, 'Milestone title'),
      requiredEvidence: Number(requiredEvidence),
      requiredSkillIds: cleanIds(raw.requiredSkillIds ?? [], 'Required Skill IDs'),
      prerequisiteIds: cleanIds(raw.prerequisiteIds ?? [], 'Milestone prerequisites'),
    };
  });
  const byId = new Map(milestones.map(item => [item.id, item]));
  for (const milestone of milestones) {
    for (const prerequisite of milestone.prerequisiteIds) {
      if (!byId.has(prerequisite)) throw new Error(`Unknown prerequisite ${prerequisite} on milestone ${milestone.id}`);
      if (prerequisite === milestone.id) throw new Error(`Milestone ${milestone.id} cannot depend on itself`);
    }
  }
  // DFS detects cycles even when a cycle does not point directly to the current milestone.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (milestoneId: string): void => {
    if (visiting.has(milestoneId)) throw new Error(`Milestone prerequisite cycle detected at ${milestoneId}`);
    if (visited.has(milestoneId)) return;
    visiting.add(milestoneId);
    for (const prerequisite of byId.get(milestoneId)!.prerequisiteIds) visit(prerequisite);
    visiting.delete(milestoneId); visited.add(milestoneId);
  };
  for (const milestone of milestones) visit(milestone.id);

  if (!Array.isArray(value.evidence)) throw new Error('Goal evidence must be a list');
  const evidenceIds = new Set<string>();
  const evidenceQuestMilestonePairs = new Set<string>();
  const evidence = value.evidence.map((raw, index): GoalCurriculumEvidence => {
    if (!isRecord(raw)) throw new Error(`Evidence ${index + 1} must be an object`);
    const evidenceId = id(raw.id, 'Evidence ID');
    if (evidenceIds.has(evidenceId)) throw new Error(`Duplicate Evidence ID: ${evidenceId}`);
    evidenceIds.add(evidenceId);
    const questId = id(raw.questId, 'Evidence Quest ID');
    const milestoneId = id(raw.milestoneId, 'Evidence Milestone ID');
    if (!byId.has(milestoneId)) throw new Error(`Evidence references unknown milestone: ${milestoneId}`);
    const pair = `${milestoneId}\u0000${questId}`;
    if (evidenceQuestMilestonePairs.has(pair)) throw new Error(`Duplicate Quest evidence for milestone ${milestoneId}: ${questId}`);
    evidenceQuestMilestonePairs.add(pair);
    if (typeof raw.at !== 'string' || !Number.isFinite(Date.parse(raw.at))) throw new Error(`Evidence timestamp is invalid: ${evidenceId}`);
    const rawStat = raw.stat === null || raw.stat === undefined || raw.stat === '' ? null : raw.stat;
    if (rawStat !== null && (typeof rawStat !== 'string' || !VALID_STATS.has(rawStat))) throw new Error(`Evidence Stat is invalid: ${evidenceId}`);
    const rawSkillId = raw.skillId === null || raw.skillId === undefined || raw.skillId === '' ? null : id(raw.skillId, 'Evidence Skill ID');
    const rawVerification = raw.skillVerification;
    let skillVerification: SkillVerification | null = null;
    if (rawVerification !== null && rawVerification !== undefined) {
      if (!isRecord(rawVerification)) throw new Error(`Skill verification is invalid: ${evidenceId}`);
      const method = rawVerification.method;
      if (method !== 'assessment' && method !== 'project-review' && method !== 'manual-check') throw new Error(`Skill verification method is invalid: ${evidenceId}`);
      if (typeof rawVerification.verifiedAt !== 'string' || !Number.isFinite(Date.parse(rawVerification.verifiedAt))) throw new Error(`Skill verification timestamp is invalid: ${evidenceId}`);
      if (typeof rawVerification.score !== 'number' || !Number.isFinite(rawVerification.score) || rawVerification.score < 0 || rawVerification.score > 100) throw new Error(`Skill verification score is invalid: ${evidenceId}`);
      if (!rawSkillId) throw new Error(`Skill verification requires a Skill ID: ${evidenceId}`);
      skillVerification = { method, verifiedAt: rawVerification.verifiedAt, score: rawVerification.score };
    }
    return {
      id: evidenceId, questId, milestoneId, title: title(raw.title, 'Evidence title'), at: raw.at,
      stat: rawStat as GoalStatId | null, skillId: rawSkillId, skillVerification, passed: raw.passed === true,
    };
  });
  return { id: goalId, title: goalTitle, stat: stat as GoalStatId | null, milestones, evidence, completed: value.completed === true };
}

/**
 * Evaluate only passed, unique evidence. Milestones unlock when every prerequisite
 * is complete; locked milestones cannot accrue progress. A Skill assignment alone
 * never proves mastery: explicit verification with score >= 80 is required.
 */
export function evaluateGoalCurriculum(value: unknown): GoalCurriculumEvaluation {
  const goal = validateGoalCurriculum(value);
  const evidenceByMilestone = new Map<string, GoalCurriculumEvidence[]>();
  for (const milestone of goal.milestones) evidenceByMilestone.set(milestone.id, []);
  for (const item of goal.evidence) {
    if (!item.passed || (goal.stat !== null && item.stat !== goal.stat)) continue;
    evidenceByMilestone.get(item.milestoneId)!.push(item);
  }
  const results = new Map<string, MilestoneEvaluation>();
  // Iterate to a fixed point so input order does not affect prerequisite evaluation.
  let changed = true;
  while (changed) {
    changed = false;
    for (const milestone of goal.milestones) {
      if (results.has(milestone.id)) continue;
      const unlocked = milestone.prerequisiteIds.every(prerequisite => results.get(prerequisite)?.complete === true);
      if (!unlocked) {
        if (milestone.prerequisiteIds.some(prerequisite => !results.has(prerequisite))) continue;
        results.set(milestone.id, { id: milestone.id, title: milestone.title, unlocked: false, evidenceCount: 0,
          evidenceRequired: milestone.requiredEvidence, verifiedSkillIds: [], requiredSkillIds: milestone.requiredSkillIds, complete: false });
        changed = true; continue;
      }
      const evidence = evidenceByMilestone.get(milestone.id) ?? [];
      const verifiedSkillIds = [...new Set(evidence
        .filter(item => item.skillId !== null && item.skillVerification !== null && item.skillVerification.score >= 80)
        .map(item => item.skillId as string))].sort();
      const evidenceCount = Math.min(milestone.requiredEvidence, evidence.length);
      const skillsComplete = milestone.requiredSkillIds.every(skillId => verifiedSkillIds.includes(skillId));
      const complete = evidenceCount >= milestone.requiredEvidence && skillsComplete;
      results.set(milestone.id, { id: milestone.id, title: milestone.title, unlocked: true, evidenceCount,
        evidenceRequired: milestone.requiredEvidence, verifiedSkillIds, requiredSkillIds: milestone.requiredSkillIds, complete });
      changed = true;
    }
  }
  // Cycles were rejected in validation, so all nodes should have resolved.
  if (results.size !== goal.milestones.length) throw new Error('Milestone graph could not be evaluated');
  const milestones = goal.milestones.map(item => results.get(item.id)!);
  const completedMilestones = milestones.filter(item => item.complete).length;
  const readyToComplete = !goal.completed && completedMilestones === milestones.length;
  return {
    goalId: goal.id, milestoneCount: milestones.length, completedMilestones,
    progressPercent: Math.round((completedMilestones / milestones.length) * 100), milestones,
    readyToComplete, alreadyCompleted: goal.completed, rewardIssued: false,
  };
}
