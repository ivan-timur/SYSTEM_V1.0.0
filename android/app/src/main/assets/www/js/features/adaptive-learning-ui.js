/* SYSTEM Phase 22 — live adaptive-learning bridge. Read-only: recommendations never grant XP or mutate progress. */
(function installAdaptiveLearningUI() {
  'use strict';
  const GOALS_KEY = 'system_v2_goals';
  const CUSTOM_QUESTS_KEY = 'system_v2_custom_quests';
  const ASSESSMENTS_KEY = 'system_v2_skill_assessments';
  const COMPLETED_DAILY_KEY = 'system_v2_daily_quests';
  const VALID_STATS = ['entrepreneurship', 'global-skills', 'mathematics', 'computer', 'physics', 'unique-thinking'];
  const STAT_LABELS = {
    entrepreneurship: 'Entrepreneurship', 'global-skills': 'Global Skills', mathematics: 'Mathematics',
    computer: 'Computer & Programming', physics: 'Physics', 'unique-thinking': 'Unique Thinking'
  };
  const read = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value == null ? fallback : value; }
    catch (_) { return fallback; }
  };
  const safeString = (value, max = 180) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const validStat = value => VALID_STATS.includes(value) ? value : null;
  function goalsData() {
    const raw = read(GOALS_KEY, []);
    return Array.isArray(raw) ? raw.filter(g => g && typeof g.id === 'string' && typeof g.title === 'string') : [];
  }
  function assessmentsData() {
    const raw = read(ASSESSMENTS_KEY, []);
    return Array.isArray(raw) ? raw.filter(a => a && typeof a.skillId === 'string' && validStat(a.stat) && Number.isFinite(Number(a.score)) && Number(a.score) >= 0 && Number(a.score) <= 100) : [];
  }
  function questData() {
    const output = [];
    const custom = read(CUSTOM_QUESTS_KEY, []);
    if (Array.isArray(custom)) custom.forEach(q => {
      if (!q || typeof q.id !== 'string' || !safeString(q.title)) return;
      const stat = validStat(q.stat);
      const skillIds = q.skillId ? [safeString(q.skillId, 200)] : [];
      if (!skillIds.length && stat) {
        const latest = assessmentsData().filter(a => a.stat === stat && a.skillId).sort((a,b) => Date.parse(b.at || 0)-Date.parse(a.at || 0))[0];
        if (latest) skillIds.push(latest.skillId);
      }
      if (!skillIds.length) return;
      output.push({ id: q.id, title: safeString(q.title), skillIds, goalId: typeof q.goalId === 'string' ? q.goalId : null,
        milestoneId: typeof q.milestoneId === 'string' ? q.milestoneId : (typeof q.goalId === 'string' ? `legacy-${q.goalId}-${Math.min(20, Math.max(1, Number(goalsData().find(g => g.id === q.goalId)?.progressCount || 0) + 1))}` : null), difficulty: ({easy:1,medium:2,hard:4})[q.difficulty] || 2,
        estimatedMinutes: Math.max(1, Math.min(1440, Number(q.estimatedMinutes) || 25)), kind: 'practice',
        stat, completed: q.completed === true });
    });
    // Existing Daily Quest cards are discoverable from the live DOM. Only associate them
    // with a skill when a recent assessment provides a defensible stat-to-skill mapping.
    const completed = read(COMPLETED_DAILY_KEY, {});
    document.querySelectorAll('#quest-page [data-quest-id]').forEach(card => {
      const id = safeString(card.getAttribute('data-quest-id'), 200);
      const title = safeString(card.querySelector('h3')?.textContent || card.getAttribute('aria-label'));
      if (!id || !title || output.some(q => q.id === id)) return;
      const text = `${title} ${card.textContent || ''}`.toLowerCase();
      const stat = text.includes('math') || text.includes('ریاضی') ? 'mathematics'
        : text.includes('physics') || text.includes('فزیک') ? 'physics'
        : text.includes('program') || text.includes('code') || text.includes('کمپیوتر') ? 'computer'
        : text.includes('business') || text.includes('entrepreneur') || text.includes('کسب‌وکار') ? 'entrepreneurship'
        : null;
      if (!stat) return;
      const latest = assessmentsData().filter(a => a.stat === stat && a.skillId).sort((a,b) => Date.parse(b.at || 0)-Date.parse(a.at || 0))[0];
      if (!latest) return;
      output.push({ id, title, skillIds: [latest.skillId], estimatedMinutes: 25, difficulty: 2, kind: 'practice', completed: completed[id] === true || card.classList.contains('completed') });
    });
    return output;
  }
  function create(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function render() {
    const page = document.getElementById('quest-page');
    if (!page || !window.SYSTEMAdaptiveLearning || !window.SYSTEMAdaptiveLearning.recommend) return;
    let panel = document.getElementById('adaptive-learning-panel');
    if (!panel) {
      panel = create('section', 'adaptive-learning-panel'); panel.id = 'adaptive-learning-panel';
      panel.setAttribute('aria-labelledby', 'adaptive-learning-title');
      const header = create('div', 'adaptive-learning-header');
      const headingWrap = create('div');
      headingWrap.append(create('p', 'adaptive-learning-eyebrow', 'PERSONALIZED LEARNING ENGINE'));
      headingWrap.append(create('h2', '', 'Your next best steps')); headingWrap.lastChild.id = 'adaptive-learning-title';
      headingWrap.append(create('p', 'adaptive-learning-subtitle', 'Suggestions use your saved goals, quest links and recorded skill assessments.'));
      const refresh = create('button', 'adaptive-learning-refresh', 'Refresh path'); refresh.type = 'button'; refresh.dataset.adaptiveRefresh = 'true';
      header.append(headingWrap, refresh); panel.append(header, create('div', 'adaptive-learning-results'));
      const questLayout = page.querySelector('.quest-layout');
      if (questLayout) page.insertBefore(panel, questLayout); else page.append(panel);
      refresh.addEventListener('click', () => renderResults(panel));
      window.addEventListener('system-roadmap-updated', () => renderResults(panel));
      window.addEventListener('storage', event => { if ([GOALS_KEY, CUSTOM_QUESTS_KEY, ASSESSMENTS_KEY, COMPLETED_DAILY_KEY].includes(event.key)) renderResults(panel); });
    }
    renderResults(panel);
  }
  function renderResults(panel) {
    const results = panel.querySelector('.adaptive-learning-results');
    if (!results) return;
    results.replaceChildren();

    const goals = goalsData();
    const activeGoal = goals.find(g => g.completed !== true && g.completionMode !== 'manual') || goals.find(g => g.completed !== true) || null;
    const evidence = activeGoal && Array.isArray(activeGoal.evidence) ? activeGoal.evidence : [];
    const assessments = assessmentsData();
    const quests = questData();
    const completedQuestIds = quests.filter(q => q.completed).map(q => q.id);

    // Prepare one canonical active milestone from the same goal projection used by
    // the visible roadmap. This keeps the UI and the typed learning-cycle engine aligned.
    let curriculum = null;
    let curriculumPreview = null;
    let activeMilestoneId = null;
    if (activeGoal) {
      try {
        curriculum = window.SYSTEMGoalProgress?.toLegacyCurriculum(activeGoal) || null;
        if (curriculum && window.SYSTEMGoalCurriculum?.evaluate) {
          curriculumPreview = window.SYSTEMGoalCurriculum.evaluate(curriculum);
          activeMilestoneId = curriculumPreview.milestones.find(m => m.unlocked && !m.complete)?.id || null;
        } else {
          curriculumPreview = window.SYSTEMGoalProgress?.evaluateLegacyCurriculum(activeGoal) || null;
          activeMilestoneId = curriculumPreview?.milestones?.find(m => m.unlocked && !m.complete)?.id || null;
        }
      } catch (_) { curriculum = null; curriculumPreview = null; activeMilestoneId = null; }
    }

    // Bind assessed skills to goal/milestone only through an explicit quest link.
    // A stat match or XP value is not enough to infer a skill's mastery or ownership.
    const linksBySkill = new Map();
    quests.forEach(quest => {
      (quest.skillIds || []).forEach(skillId => {
        const existing = linksBySkill.get(skillId);
        const rank = link => (activeGoal && link.goalId === activeGoal.id ? 2 : 0)
          + (activeMilestoneId && link.milestoneId === activeMilestoneId ? 1 : 0);
        if (!existing || rank(quest) > rank(existing)) linksBySkill.set(skillId, quest);
      });
    });
    const latestBySkill = new Map();
    assessments.slice().sort((a,b) => Date.parse(a.at || 0)-Date.parse(b.at || 0)).forEach(a => latestBySkill.set(a.skillId, a));
    const skills = [...latestBySkill.entries()].map(([skillId, a]) => {
      let verified = false;
      try { verified = window.SYSTEMSkillMastery?.skillSummary(skillId)?.ready === true; } catch (_) { verified = false; }
      const link = linksBySkill.get(skillId);
      return {
        skillId,
        goalId: link && typeof link.goalId === 'string' ? link.goalId : null,
        milestoneId: link && typeof link.milestoneId === 'string' ? link.milestoneId : null,
        status: verified ? 'verified' : Number(a.score) < 80 ? 'needs-practice' : 'learning',
        lastScore: Number(a.score),
        lastAssessedAt: a.at || null,
        reviewIntervalDays: 7
      };
    });

    let plan = null;
    let cycle = null;
    const plannerInput = {
      now: new Date().toISOString(),
      skills,
      quests: quests.map(q => ({
        id: q.id, title: q.title, skillIds: q.skillIds, goalId: q.goalId || null,
        milestoneId: q.milestoneId || null, difficulty: q.difficulty,
        estimatedMinutes: q.estimatedMinutes, kind: q.kind,
        prerequisiteSkillIds: Array.isArray(q.prerequisiteSkillIds) ? q.prerequisiteSkillIds : []
      })),
      completedQuestIds,
      preferredMinutes: 25,
      limit: 3
    };
    try {
      if (activeGoal && curriculum && window.SYSTEMLearningCycle?.evaluate) {
        cycle = window.SYSTEMLearningCycle.evaluate({
          goal: curriculum,
          activeGoalId: activeGoal.id,
          adaptive: plannerInput
        });
        plan = cycle.learningPlan;
        curriculumPreview = cycle.evaluation;
        activeMilestoneId = cycle.activeMilestoneId;
      } else {
        plan = window.SYSTEMAdaptiveLearning.recommend({
          ...plannerInput,
          activeGoalId: activeGoal?.id || null,
          activeMilestoneId
        });
      }
    } catch (error) {
      results.append(create('p', 'adaptive-learning-error', 'The learning path could not be calculated from the current records. Check saved skill and quest links, then refresh.'));
      console.warn('SYSTEM learning-cycle engine rejected current records:', error);
      if (activeGoal) {
        const fallback = create('p', 'adaptive-learning-integrity-note', 'Goal progress remains saved. Recommendations are paused because the joined learning-cycle check rejected inconsistent input.');
        results.append(fallback);
      }
      return;
    }

    if (activeGoal) {
      const goalSummary = create('div', 'adaptive-learning-goal-summary');
      const goalHeading = create('strong', '', `Active goal: ${safeString(activeGoal.title, 100)}`);
      const progress = curriculumPreview ? curriculumPreview.progressPercent
        : Math.round(100 * Math.max(0, Number(activeGoal.progressCount) || 0) / Math.max(1, Number(activeGoal.targetCount) || 1));
      goalSummary.append(goalHeading, create('span', 'adaptive-learning-goal-progress', `${progress}% · ${curriculumPreview ? `${curriculumPreview.completedMilestones}/${curriculumPreview.milestoneCount} milestones` : `${Number(activeGoal.progressCount) || 0}/${Number(activeGoal.targetCount) || 1} evidence items`}`));
      if (curriculumPreview) {
        const list = create('ol', 'adaptive-learning-milestones');
        curriculumPreview.milestones.forEach(m => list.append(create('li', m.complete ? 'is-complete' : m.unlocked ? 'is-unlocked' : 'is-locked', `${m.title} — ${m.complete ? 'Complete' : m.unlocked ? `${m.evidenceCount}/${m.evidenceRequired} evidence` : 'Locked until prerequisite is complete'}`)));
        goalSummary.append(list);
      }
      if (cycle) {
        const actions = {
          'complete-milestone-evidence': 'Next action: collect valid evidence for the active milestone.',
          'verify-required-skills': 'Next action: verify the skills required by the active milestone.',
          'work-on-recommendation': 'Next action: work on one of the recommended quests.',
          'goal-complete': 'Goal curriculum is complete.',
          'create-relevant-quests': 'Create a quest linked to this goal and its active milestone.'
        };
        if (actions[cycle.nextAction]) goalSummary.append(create('p', 'adaptive-learning-integrity-note', actions[cycle.nextAction]));
      }
      results.append(goalSummary);
    }

    if (!skills.length || !quests.length) {
      const empty = create('div', 'adaptive-learning-empty');
      empty.append(create('strong', '', 'Your learning path is waiting for evidence.'));
      empty.append(create('p', '', !assessments.length
        ? 'Record a skill assessment with a skill ID first. The engine will not guess your mastery from XP or clicks.'
        : 'Create or link a quest to a skill supported by your saved assessments. Recommendations appear when a valid skill–quest link exists.'));
      results.append(empty);
      results.append(create('small', 'adaptive-learning-integrity-note', `Saved goals: ${goals.length} · Evidence entries for active goal: ${evidence.length} · No XP or rewards are issued by recommendations.`));
      return;
    }
    if (!plan || !plan.diagnostics || plan.diagnostics.rewardIssued !== false || (cycle && cycle.diagnostics.rewardsIssued !== false)) {
      results.append(create('p', 'adaptive-learning-error', 'The recommendation engine returned an invalid reward boundary; recommendations were not rendered.'));
      return;
    }
    if (!plan.recommendations.length) {
      results.append(create('p', 'adaptive-learning-empty', 'No eligible recommendation yet. Check whether your quests link to assessed skills and whether their prerequisites are verified.'));
    }
    plan.recommendations.forEach((item, index) => {
      const card = create('article', 'adaptive-learning-card');
      const number = create('span', 'adaptive-learning-number', String(index + 1).padStart(2, '0'));
      const body = create('div', 'adaptive-learning-card-body');
      body.append(create('h3', '', item.title));
      body.append(create('p', 'adaptive-learning-meta', `${item.estimatedMinutes} min · Priority ${item.priority.toFixed(1)} · ${item.kind}`));
      const reasons = create('ul', 'adaptive-learning-reasons');
      item.reasons.slice(0, 3).forEach(reason => reasons.append(create('li', '', reason)));
      body.append(reasons);
      const action = create('button', 'adaptive-learning-open', 'Open quest'); action.type = 'button';
      action.addEventListener('click', () => {
        const target = [...document.querySelectorAll('#quest-page [data-quest-id]')]
          .find(node => node.getAttribute('data-quest-id') === item.questId);
        if (target) {
          target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
          target.classList.add('adaptive-learning-highlight');
          setTimeout(() => target.classList.remove('adaptive-learning-highlight'), 1400);
        } else if (typeof window.notifySystem === 'function') window.notifySystem('This recommendation is no longer visible. Refresh the learning path.');
      });
      card.append(number, body, action); results.append(card);
    });
    results.append(create('small', 'adaptive-learning-integrity-note', `Evaluated ${plan.diagnostics.considered} quest records · ${plan.diagnostics.excludedCompleted} completed excluded · ${plan.diagnostics.excludedPrerequisites} blocked by prerequisites · reward issued: no.`));
  }
  function start() { render(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  window.addEventListener('system-app-ready', start, { once: true });
  window.addEventListener('system-skill-assessment-saved', () => { const panel = document.getElementById('adaptive-learning-panel'); if (panel) renderResults(panel); });
})();
