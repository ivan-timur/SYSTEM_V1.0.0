import assert from 'node:assert/strict';
import {
  planBossQuestClaim,
  planCustomQuestCompletion,
  planGoalEvidenceDecision,
} from '../../dist/ts/features/quest-completion-plan.js';

let checks = 0;
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };
const ok = (value, message) => { assert.ok(value, message); checks += 1; };
const rejected = (fn, pattern, message) => { assert.throws(fn, pattern, message); checks += 1; };

const custom = {
  id: 'custom-1', title: 'Learn TypeScript', description: 'Finish one module', stat: 'computer',
  goalId: 'goal-1', skillId: null, xp: 75, coins: 12, completed: false,
};
const plan = planCustomQuestCompletion(custom, '2026-10-18T10:00:00.000Z');
ok(plan, 'valid incomplete Custom Quest gets a completion plan');
equal(plan.questId, 'custom-1', 'Custom Quest identity is stable');
equal(plan.completedAt, '2026-10-18T10:00:00.000Z', 'completion timestamp is explicit and stable');
equal(plan.reward.type, 'custom-quest', 'plan carries canonical reward type');
equal(plan.reward.xp, 75, 'plan reads XP from the validated stored quest');
equal(plan.reward.goalId, 'goal-1', 'plan preserves Goal link for evidence recording');
equal(plan.goalEvidence.questId, 'custom-1', 'Goal evidence uses the original Custom Quest ID');
equal(plan.goalEvidence.skillId, null, 'Goal evidence explicitly retains an empty Skill link for legacy quests');
const linkedSkillPlan = planCustomQuestCompletion({ ...custom, skillId: 'python.basics' }, '2026-10-18T10:00:00.000Z');
equal(linkedSkillPlan.goalEvidence.skillId, 'python.basics', 'Goal evidence carries the linked Skill ID across Quest completion');
equal(plan.progressField, 'totalCustomQuestsCompleted', 'plan uses the canonical Custom Quest lifetime counter');
equal(planCustomQuestCompletion({ ...custom, completed: true }), null, 'completed quest cannot be planned twice');
equal(planCustomQuestCompletion({ ...custom, id: ' bad ' }), null, 'invalid Quest ID fails closed through the completion guard');
rejected(() => planCustomQuestCompletion({ ...custom, xp: 1001 }), /XP must be an integer/, 'invalid saved reward cannot be planned');
rejected(() => planCustomQuestCompletion(custom, 'not-a-time'), /timestamp is invalid/, 'invalid completion timestamp is rejected');
rejected(() => planCustomQuestCompletion({ ...custom, stat: 'unknown' }), /Stat is invalid/, 'unknown Stat fails closed');
equal(planCustomQuestCompletion({ ...custom, skillId: 'legacy-skill-hint', stat: null }).reward.skillId, null, 'legacy general quests discard a stale Skill hint instead of becoming uncompletable');

const locked = planBossQuestClaim({ questId: 'boss-consistency', claimedIds: [], snapshot: { completedDailyQuestCount: 2 } });
equal(locked, null, 'locked Boss Quest produces no reward plan');
const unknown = planBossQuestClaim({ questId: 'boss-does-not-exist', claimedIds: [], snapshot: { completedDailyQuestCount: 20 } });
equal(unknown, null, 'unknown Boss Quest fails closed');
const duplicate = planBossQuestClaim({ questId: 'boss-consistency', claimedIds: ['boss-consistency'], snapshot: { completedDailyQuestCount: 3 } });
equal(duplicate, null, 'already claimed Boss Quest produces no reward plan');
const boss = planBossQuestClaim({ questId: 'boss-consistency', claimedIds: [], snapshot: { completedDailyQuestCount: 3 } });
ok(boss, 'eligible unclaimed Boss Quest gets a plan');
equal(boss.reward.type, 'boss-quest', 'Boss plan uses canonical reward type');
equal(boss.reward.xp, 250, 'Boss reward is taken from the canonical catalog');
equal(boss.progressField, 'totalBossQuestsCompleted', 'Boss plan uses canonical lifetime counter');

const stale = planGoalEvidenceDecision({ ok: true, staleGoalId: true });
equal(stale.action, 'detach-link', 'stale Goal is detached while the Custom reward can continue');
const mismatch = planGoalEvidenceDecision({ ok: false, reason: 'stat_mismatch' });
equal(mismatch.action, 'detach-link', 'branch mismatch removes only the optional Goal link');
const badEvidence = planGoalEvidenceDecision({ ok: false, reason: 'invalid_activity' });
equal(badEvidence.action, 'abort', 'invalid evidence aborts the parent transaction');
const unmatchedEvidence = planGoalEvidenceDecision({ ok: true, matched: false, goals: [] });
equal(unmatchedEvidence.action, 'abort', 'unmatched Goal evidence cannot silently commit a rewarded Quest');
const duplicateEvidence = planGoalEvidenceDecision({ ok: true, matched: true, duplicate: true });
equal(duplicateEvidence.action, 'no-op', 'duplicate Goal evidence never triggers another write/reward');
const incomplete = planGoalEvidenceDecision({ ok: true, matched: true, completedNow: false, goals: [{ id: 'goal-1' }] });
equal(incomplete.action, 'persist-goals', 'valid newly recorded evidence persists updated Goals');
equal(incomplete.completionReward, null, 'intermediate evidence has no Goal completion bonus');
const completedGoal = {
  id: 'goal-1', title: 'Build a learning project', stat: 'computer', completed: true, completionMode: 'evidence',
  evidence: [{ questId: 'custom-1', title: 'Learn TypeScript', at: '2026-10-18T10:00:00.000Z', stat: 'computer', xp: 75 }],
};
const completed = planGoalEvidenceDecision({ ok: true, matched: true, completedNow: true, goals: [completedGoal], goal: completedGoal });
equal(completed.action, 'persist-goals', 'newly completed Goal persists updated Goal data');
equal(completed.completionReward.type, 'goal-evidence-completion', 'Goal completion bonus uses canonical reward type');
equal(completed.completionReward.goalId, 'goal-1', 'Goal completion identity is anchored to the Goal');
equal(completed.completionReward.questId, 'custom-1', 'Goal completion event keeps the triggering evidence Quest');
equal(completed.completionReward.xp, 50, 'Goal completion bonus remains 50 XP');
equal(completed.completionReward.coins, 10, 'Goal completion bonus remains 10 Coins');
equal(planGoalEvidenceDecision({ ok: true, matched: true, completedNow: true, goals: [completedGoal], goal: completedGoal, curriculumEvaluation: { milestoneCount: 3, completedMilestones: 2, progressPercent: 67 } }).action, 'abort', 'curriculum mismatch blocks the Goal completion bonus');
equal(planGoalEvidenceDecision({ ok: true, matched: true, completedNow: true, goals: [completedGoal], goal: completedGoal, curriculumEvaluation: { milestoneCount: 3, completedMilestones: 3, progressPercent: 100 } }).action, 'persist-goals', 'consistent complete curriculum allows the established transaction to proceed');
equal(planGoalEvidenceDecision({ ok: true, matched: true, completedNow: true, goals: [], goal: { id: 'goal-1', title: 'Broken Goal', stat: null, completed: true, completionMode: 'evidence' } }).action, 'abort', 'completed Goal missing from the persisted collection cannot pay out');
equal(planGoalEvidenceDecision({ ok: true, matched: true, completedNow: true, goals: [], goal: { id: 'goal-1', title: 'Bad', stat: null, evidence: [{ questId: ' bad ' }] } }).action, 'abort', 'malformed evidence ID aborts without guessing an identity');

console.log(`Typed Quest completion-plan tests passed: ${checks} assertions across Custom, Boss, Goal evidence, payout guards and duplicate protection.`);
