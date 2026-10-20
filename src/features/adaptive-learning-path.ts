/** Deterministic adaptive next-quest planner. Pure logic only: never mutates storage or grants rewards. */
export type AdaptiveSkillState = {
  skillId: string;
  goalId?: string | null;
  milestoneId?: string | null;
  status?: 'not-started' | 'learning' | 'needs-practice' | 'verified';
  lastAssessedAt?: string | null;
  lastScore?: number | null;
  reviewIntervalDays?: number;
};
export type AdaptiveQuest = {
  id: string;
  title: string;
  skillIds: string[];
  goalId?: string | null;
  milestoneId?: string | null;
  difficulty?: number;
  estimatedMinutes?: number;
  prerequisiteSkillIds?: string[];
  kind?: 'practice' | 'review' | 'project' | 'assessment';
};
export type AdaptiveLearningInput = {
  now: string;
  skills: AdaptiveSkillState[];
  quests: AdaptiveQuest[];
  completedQuestIds?: string[];
  activeGoalId?: string | null;
  activeMilestoneId?: string | null;
  preferredMinutes?: number;
  passThreshold?: number;
  limit?: number;
};
export type AdaptiveQuestRecommendation = {
  questId: string;
  title: string;
  priority: number;
  reasons: string[];
  skillIds: string[];
  kind: 'practice' | 'review' | 'project' | 'assessment';
  estimatedMinutes: number;
};
export type AdaptiveLearningPlan = {
  generatedAt: string;
  recommendations: AdaptiveQuestRecommendation[];
  blockedQuestIds: string[];
  diagnostics: { considered: number; excludedCompleted: number; excludedPrerequisites: number; rewardIssued: false };
};
const validId = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v === v.trim() && v.length <= 200;
const dayMs = 86_400_000;
function daysSince(then: string | null | undefined, nowMs: number): number | null {
  if (!then) return null;
  const parsed = Date.parse(then);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, (nowMs - parsed) / dayMs);
}
/** Scores eligible quests using weak skills, due reviews, goal alignment, and realistic session length. */
export function recommendAdaptiveLearningPath(input: AdaptiveLearningInput): AdaptiveLearningPlan {
  if (!input || !Number.isFinite(Date.parse(input.now))) throw new Error('now must be a valid date');
  if (!Array.isArray(input.skills) || !Array.isArray(input.quests)) throw new Error('skills and quests must be lists');
  const threshold = input.passThreshold ?? 80;
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 100) throw new Error('passThreshold must be between 1 and 100');
  const preferredMinutes = input.preferredMinutes ?? 30;
  if (!Number.isFinite(preferredMinutes) || preferredMinutes < 5 || preferredMinutes > 480) throw new Error('preferredMinutes must be between 5 and 480');
  const limit = input.limit ?? 3;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('limit must be between 1 and 20');
  const nowMs = Date.parse(input.now);
  const skillMap = new Map<string, AdaptiveSkillState>();
  for (const skill of input.skills) {
    if (!skill || typeof skill !== 'object' || !validId(skill.skillId) || skillMap.has(skill.skillId)) throw new Error('Skill IDs must be valid and unique');
    if (skill.goalId != null && !validId(skill.goalId)) throw new Error(`Invalid goal ID for ${skill.skillId}`);
    if (skill.milestoneId != null && !validId(skill.milestoneId)) throw new Error(`Invalid milestone ID for ${skill.skillId}`);
    if (skill.status !== undefined && !['not-started', 'learning', 'needs-practice', 'verified'].includes(skill.status)) throw new Error(`Invalid status for ${skill.skillId}`);
    if (skill.reviewIntervalDays !== undefined && (!Number.isInteger(skill.reviewIntervalDays) || skill.reviewIntervalDays < 1 || skill.reviewIntervalDays > 3650)) throw new Error(`Invalid review interval for ${skill.skillId}`);
    if (skill.lastScore !== null && skill.lastScore !== undefined && (!Number.isFinite(skill.lastScore) || skill.lastScore < 0 || skill.lastScore > 100)) throw new Error(`Invalid score for ${skill.skillId}`);
    if (skill.lastAssessedAt && !Number.isFinite(Date.parse(skill.lastAssessedAt))) throw new Error(`Invalid assessment date for ${skill.skillId}`);
    skillMap.set(skill.skillId, skill);
  }
  const completedQuestIds = input.completedQuestIds ?? [];
  if (!Array.isArray(completedQuestIds)) throw new Error('completedQuestIds must be a list');
  const completed = new Set<string>();
  for (const id of completedQuestIds) {
    if (!validId(id)) throw new Error('Completed Quest IDs must be valid and trimmed');
    if (completed.has(id)) throw new Error('Completed Quest IDs must be unique');
    completed.add(id);
  }
  const questIds = new Set<string>();
  const blockedQuestIds: string[] = [];
  let excludedCompleted = 0, excludedPrerequisites = 0;
  const candidates: AdaptiveQuestRecommendation[] = [];
  for (const quest of input.quests) {
    if (!quest || typeof quest !== 'object' || !validId(quest.id) || questIds.has(quest.id) || !validId(quest.title) || !Array.isArray(quest.skillIds) || quest.skillIds.length === 0 || quest.skillIds.some(id => !validId(id)) || new Set(quest.skillIds).size !== quest.skillIds.length) throw new Error('Quest definitions must have unique IDs, titles, and unique valid skill IDs');
    if (quest.goalId != null && !validId(quest.goalId)) throw new Error(`Invalid goal ID for quest ${quest.id}`);
    if (quest.milestoneId != null && !validId(quest.milestoneId)) throw new Error(`Invalid milestone ID for quest ${quest.id}`);
    if (quest.prerequisiteSkillIds !== undefined && (!Array.isArray(quest.prerequisiteSkillIds) || quest.prerequisiteSkillIds.some(id => !validId(id)) || new Set(quest.prerequisiteSkillIds).size !== quest.prerequisiteSkillIds.length)) throw new Error(`Invalid prerequisite skills for ${quest.id}`);
    if (quest.kind !== undefined && !['practice', 'review', 'project', 'assessment'].includes(quest.kind)) throw new Error(`Invalid quest kind for ${quest.id}`);
    questIds.add(quest.id);
    if (completed.has(quest.id)) { excludedCompleted++; continue; }
    const prerequisites = quest.prerequisiteSkillIds ?? [];
    const unmet = prerequisites.some(id => skillMap.get(id)?.status !== 'verified');
    if (unmet) { excludedPrerequisites++; blockedQuestIds.push(quest.id); continue; }
    const matchedSkills = quest.skillIds.map(id => skillMap.get(id)).filter((v): v is AdaptiveSkillState => !!v);
    if (!matchedSkills.length) continue;
    const reasons: string[] = [];
    let priority = 20;
    for (const skill of matchedSkills) {
      const score = skill.lastScore;
      if (skill.status === 'needs-practice' || (score !== null && score !== undefined && score < threshold)) {
        priority += 45 + (score === null || score === undefined ? 0 : Math.round((threshold - score) / 2));
        reasons.push(`${skill.skillId}: needs practice`);
      } else if (skill.status !== 'verified' && (score === null || score === undefined)) {
        priority += 24; reasons.push(`${skill.skillId}: learning not yet assessed`);
      } else if (skill.status === 'verified') {
        const elapsed = daysSince(skill.lastAssessedAt, nowMs);
        const interval = skill.reviewIntervalDays ?? 7;
        if (elapsed !== null && elapsed >= interval) { priority += 28 + Math.min(12, Math.floor(elapsed - interval)); reasons.push(`${skill.skillId}: review due`); }
      }
      if (input.activeGoalId && skill.goalId === input.activeGoalId) { priority += 18; reasons.push('matches active goal'); }
      if (input.activeMilestoneId && skill.milestoneId === input.activeMilestoneId) { priority += 14; reasons.push('matches active milestone'); }
    }
    if (input.activeGoalId && quest.goalId === input.activeGoalId) { priority += 20; if (!reasons.includes('matches active goal')) reasons.push('directly linked to active goal'); }
    if (input.activeMilestoneId && quest.milestoneId === input.activeMilestoneId) { priority += 16; if (!reasons.includes('matches active milestone')) reasons.push('directly linked to active milestone'); }
    const minutes = quest.estimatedMinutes ?? 20;
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) throw new Error(`Invalid estimated minutes for ${quest.id}`);
    priority += Math.max(-12, 12 - Math.abs(minutes - preferredMinutes) * 0.6);
    const difficulty = quest.difficulty ?? 2;
    if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 5) throw new Error(`Invalid difficulty for ${quest.id}`);
    const weak = matchedSkills.some(s => s.status === 'needs-practice' || (s.lastScore !== null && s.lastScore !== undefined && s.lastScore < threshold));
    priority += weak && difficulty <= 3 ? 8 : 0;
    candidates.push({ questId: quest.id, title: quest.title, priority: Math.round(priority * 100) / 100, reasons: [...new Set(reasons.length ? reasons : ['supports ongoing skill development'])], skillIds: [...new Set(quest.skillIds)], kind: quest.kind ?? 'practice', estimatedMinutes: minutes });
  }
  candidates.sort((a, b) => b.priority - a.priority || a.questId.localeCompare(b.questId));
  // First diversify across skills. If fewer than `limit` distinct options exist,
  // fill the remaining slots with the next highest-ranked valid alternatives rather
  // than returning an artificially short path for a single-skill learner.
  const recommendations: AdaptiveQuestRecommendation[] = [];
  const selectedIds = new Set<string>();
  const covered = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.skillIds.some(id => !covered.has(id))) continue;
    recommendations.push(candidate);
    selectedIds.add(candidate.questId);
    candidate.skillIds.forEach(id => covered.add(id));
    if (recommendations.length >= limit) break;
  }
  if (recommendations.length < limit) {
    for (const candidate of candidates) {
      if (selectedIds.has(candidate.questId)) continue;
      recommendations.push(candidate);
      selectedIds.add(candidate.questId);
      if (recommendations.length >= limit) break;
    }
  }
  return { generatedAt: new Date(nowMs).toISOString(), recommendations, blockedQuestIds: blockedQuestIds.sort(), diagnostics: { considered: input.quests.length, excludedCompleted, excludedPrerequisites, rewardIssued: false } };
}
