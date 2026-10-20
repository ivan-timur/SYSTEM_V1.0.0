/**
 * SYSTEM — Status & Quest More (⋯)
 * Status: only 6 stats visible; secondary tools behind corner ⋯
 * Quest: Daily + Boss + Custom visible; Command Center / metrics behind ⋯
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function isFa() {
    return document.body && document.body.dataset.systemLanguage === 'fa';
  }


  function escapeLedgerText(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function renderActivityLedger(panel) {
    const api = window.SYSTEMProgressLedger;
    if (!api || typeof api.list !== 'function') {
      panel.innerHTML = '<p class="grok-hint">' + (isFa() ? 'دفتر فعالیت هنوز آماده نیست؛ صفحه را تازه‌سازی کنید.' : 'Activity ledger is not ready yet. Refresh the page.') + '</p>';
      return;
    }
    const langFa = isFa();
    const summary = api.summary(7);
    const activities = api.list(50);
    const fmt = (date) => {
      const parsed = new Date(date);
      return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString(langFa ? 'fa-AF' : undefined, { dateStyle: 'medium', timeStyle: 'short' });
    };
    const rows = activities.map(item => '<article class="system-ledger-row">' +
      '<div class="system-ledger-row-main"><strong>' + escapeLedgerText(item.title) + '</strong><small>' + escapeLedgerText(fmt(item.at)) + ' · ' + escapeLedgerText(item.type) + (item.stat ? ' · ' + escapeLedgerText(item.stat) : '') + '</small></div>' +
      '<div class="system-ledger-rewards"><span>+' + Number(item.xp || 0) + ' XP</span><span>+' + Number(item.coins || 0) + ' ◈</span></div></article>').join('');
    panel.innerHTML = '<section class="system-ledger">' +
      '<div class="system-ledger-head"><div><h3>' + (langFa ? 'دفتر فعالیت' : 'Activity Ledger') + '</h3><p>' + (langFa ? 'خلاصهٔ فعالیت‌های ثبت‌شده در ۷ روز گذشته' : 'Recorded activity from the last 7 days') + '</p></div><button type="button" data-ledger-export>' + (langFa ? 'دریافت JSON' : 'Export JSON') + '</button></div>' +
      '<div class="system-ledger-stats"><div><strong>' + summary.activities + '</strong><span>' + (langFa ? 'فعالیت' : 'Activities') + '</span></div><div><strong>' + summary.xp.toLocaleString(langFa ? 'fa-AF' : undefined) + '</strong><span>XP</span></div><div><strong>' + summary.coins.toLocaleString(langFa ? 'fa-AF' : undefined) + '</strong><span>' + (langFa ? 'سکه' : 'Coins') + '</span></div></div>' +
      '<div class="system-ledger-list">' + (rows || '<p class="grok-hint">' + (langFa ? 'هنوز فعالیتی ثبت نشده است. پس از تکمیل مأموریت‌ها، تاریخچه اینجا نمایش داده می‌شود.' : 'No activities recorded yet. Complete a quest to start building your history.') + '</p>') + '</div>' +
      '<p class="system-ledger-note">' + (langFa ? 'این دفتر فقط رویدادهایی را نشان می‌دهد که SYSTEM ثبت کرده است؛ ساعت دستگاه می‌تواند بر زمان ثبت اثر بگذارد.' : 'This ledger shows events recorded by SYSTEM. Device clock changes can affect timestamps.') + '</p></section>';
    const exportButton = panel.querySelector('[data-ledger-export]');
    if (exportButton) exportButton.addEventListener('click', function () {
      const blob = new Blob([api.exportJSON()], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'system-activity-ledger-' + new Date().toISOString().slice(0, 10) + '.json';
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }

  const SKILL_REVIEW_STATS = [
    ['entrepreneurship', 'کارآفرینی', 'Entrepreneurship'],
    ['global-skills', 'مهارت‌های جهانی', 'Global Skills'],
    ['mathematics', 'ریاضی', 'Mathematics'],
    ['computer', 'کمپیوتر', 'Computer'],
    ['physics', 'فزیک', 'Physics'],
    ['unique-thinking', 'تفکر ویژه', 'Unique Thinking']
  ];

  function renderSkillReview(panel) {
    const api = window.SYSTEMSkillReview;
    const fa = isFa();
    if (!api) {
      panel.innerHTML = '<p class="grok-hint">' + (fa ? 'مرور مهارت در دسترس نیست؛ صفحه را تازه‌سازی کنید.' : 'Skill Review is unavailable; refresh the page.') + '</p>';
      return;
    }
    const stats = SKILL_REVIEW_STATS.map(item => '<option value="' + item[0] + '">' + (fa ? item[1] : item[2]) + '</option>').join('');
    const ratingLabels = fa ? ['۱ — خیلی کم', '۲ — کم', '۳ — متوسط', '۴ — خوب', '۵ — بسیار خوب'] : ['1 — Very low', '2 — Low', '3 — Moderate', '4 — Good', '5 — Very strong'];
    const options = ratingLabels.map((label, index) => '<option value="' + (index + 1) + '">' + label + '</option>').join('');
    const summary = api.summary();
    const recommendation = api.recommendation();
    const recName = SKILL_REVIEW_STATS.find(item => item[0] === recommendation.stat);
    const history = api.list(8).map(item => {
      const name = SKILL_REVIEW_STATS.find(stat => stat[0] === item.stat);
      const date = new Date(item.at);
      const dateText = Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(fa ? 'fa-AF' : undefined, { dateStyle: 'medium', timeStyle: 'short' });
      return '<article class="skill-review-history-row"><div><strong>' + escapeLedgerText(name ? (fa ? name[1] : name[2]) : item.stat) + '</strong><small>' + escapeLedgerText(dateText) + (item.evidence ? ' · ' + (fa ? 'شواهد عملی دارد' : 'Evidence recorded') : '') + (item.note ? '<br>' + escapeLedgerText(item.note) : '') + '</small></div><span>' + item.rating + '/5</span></article>';
    }).join('');
    panel.innerHTML = '<section class="system-skill-review"><header class="system-skill-review-head"><div><h3>' + (fa ? 'مرور و ارزیابی مهارت' : 'Skill Review') + '</h3><p>' + (fa ? 'اعتماد خود را ارزیابی کن و شواهد عملی ثبت کن؛ این امتیاز XP نمی‌دهد.' : 'Rate your confidence and record evidence. Reviews do not award XP.') + '</p></div><div class="skill-review-total"><strong>' + summary.total + '</strong><small>' + (fa ? 'مرور ثبت‌شده' : 'reviews') + '</small></div></header>' +
      (recName ? '<div class="skill-review-recommendation"><span>' + (fa ? 'پیشنهاد تمرکز' : 'Suggested focus') + '</span><strong>' + (fa ? recName[1] : recName[2]) + '</strong><small>' + (fa ? 'میانگین خودارزیابی: ' + recommendation.average + ' از ۵؛ این پیشنهاد بر پایه ارزیابی خودت است، نه آزمون مستقل.' : 'Self-rating average: ' + recommendation.average + '/5. This is self-reported, not an independent test.') + '</small></div>' : '<p class="grok-hint">' + (fa ? 'اولین مرور را ثبت کن تا یک پیشنهاد تمرکز ساخته شود.' : 'Record your first review to get a focus suggestion.') + '</p>') +
      '<form class="skill-review-form" data-skill-review-form><label>' + (fa ? 'شاخه مهارت' : 'Skill branch') + '<select name="stat" required>' + stats + '</select></label><label>' + (fa ? 'میزان اطمینان فعلی' : 'Current confidence') + '<select name="rating" required>' + options + '</select></label><label class="skill-review-evidence"><input type="checkbox" name="evidence"> <span>' + (fa ? 'برای این ارزیابی، شواهد عملی دارم (تمرین، آزمون یا پروژه)' : 'I have practical evidence (exercise, test, or project)') + '</span></label><label>' + (fa ? 'یادداشت یا مدرک (اختیاری)' : 'Note or evidence (optional)') + '<textarea name="note" maxlength="500" rows="3" placeholder="' + (fa ? 'چه کاری انجام دادی یا چه چیزی را باید تمرین کنی؟' : 'What did you do, or what should you practise next?') + '"></textarea></label><button type="submit" class="skill-review-submit">' + (fa ? 'ثبت مرور مهارت' : 'Save skill review') + '</button><p class="skill-review-feedback" role="status" aria-live="polite"></p></form>' +
      '<div class="skill-review-history"><h4>' + (fa ? 'مرورهای اخیر' : 'Recent reviews') + '</h4>' + (history || '<p class="grok-hint">' + (fa ? 'هنوز مروری ثبت نشده است.' : 'No reviews yet.') + '</p>') + '</div><button type="button" class="skill-review-export" data-skill-review-export>' + (fa ? 'خروجی گرفتن از مرورها (JSON)' : 'Export reviews (JSON)') + '</button><p class="system-ledger-note">' + (fa ? 'این ارزیابی خوداظهاری است و مهارت را به‌طور مستقل تأیید نمی‌کند. اطلاعات فقط در همین مرورگر ذخیره می‌شود.' : 'This is a self-assessment and does not independently verify mastery. Data stays in this browser.') + '</p></section>';
    const form = panel.querySelector('[data-skill-review-form]');
    if (form) form.addEventListener('submit', function (event) {
      event.preventDefault();
      const data = new FormData(form);
      const result = api.record({ stat: data.get('stat'), rating: Number(data.get('rating')), evidence: data.get('evidence') === 'on', note: data.get('note') });
      const feedback = form.querySelector('.skill-review-feedback');
      if (!result.ok) {
        if (feedback) feedback.textContent = fa ? 'ثبت انجام نشد؛ ورودی‌ها را بررسی کن و فضای ذخیره‌سازی را بررسی کن.' : 'Could not save. Check the values and available browser storage.';
        return;
      }
      renderSkillReview(panel);
      const nextFeedback = panel.querySelector('.skill-review-feedback');
      if (nextFeedback) nextFeedback.textContent = fa ? 'مرور مهارت با موفقیت ثبت شد.' : 'Skill review saved.';
    });
    const exportButton = panel.querySelector('[data-skill-review-export]');
    if (exportButton) exportButton.addEventListener('click', function () {
      const blob = new Blob([api.exportJSON()], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'system-skill-reviews-' + new Date().toISOString().slice(0, 10) + '.json';
      link.hidden = true; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }

  async function renderSkillMastery(panel) {
    const api = window.SYSTEMSkillMastery;
    const fa = isFa();
    if (!api) { panel.innerHTML = '<p class="grok-hint">' + (fa ? 'ردیاب تسلط در دسترس نیست؛ صفحه را تازه‌سازی کنید.' : 'Mastery Tracker is unavailable; refresh the page.') + '</p>'; return; }
    if (typeof api.ready === 'function') await api.ready();
    const stats = SKILL_REVIEW_STATS.map(x => '<option value="' + x[0] + '">' + (fa ? x[1] : x[2]) + '</option>').join('');
    const typeNames = fa ? { practice: 'تمرین', test: 'آزمون', project: 'پروژه' } : { practice: 'Practice', test: 'Test', project: 'Project' };
    const typeOptions = Object.entries(typeNames).map(([v, label]) => '<option value="' + v + '">' + label + '</option>').join('');
    const summary = api.summary();
    const rows = api.list(10).map(item => {
      const stat = SKILL_REVIEW_STATS.find(x => x[0] === item.stat);
      const date = new Date(item.at);
      const dateText = Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(fa ? 'fa-AF' : undefined, { dateStyle: 'medium', timeStyle: 'short' });
      return '<article class="skill-review-history-row"><div><strong>' + escapeLedgerText(item.skillTitle || (fa ? 'مهارت عمومی' : 'General skill')) + ' · ' + escapeLedgerText(stat ? (fa ? stat[1] : stat[2]) : item.stat) + ' · ' + escapeLedgerText(typeNames[item.type] || item.type) + '</strong><small>' + escapeLedgerText(dateText) + (item.evidence ? ' · ' + (fa ? 'شواهد عملی' : 'Evidence noted') : '') + (item.questId ? ' · ' + (fa ? 'مأموریت: ' : 'Quest: ') + escapeLedgerText(item.questId) : '') + (item.note ? '<br>' + escapeLedgerText(item.note) : '') + '</small></div><span>' + item.score + '%</span></article>';
    }).join('');
    const cards = SKILL_REVIEW_STATS.map(x => {
      const r = summary.byStat[x[0]];
      const status = r.ready ? (fa ? 'آمادگی اولیه' : 'Readiness candidate') : (fa ? 'شواهد ناکافی' : 'More evidence needed');
      return '<article class="mastery-stat-card"><div><strong>' + (fa ? x[1] : x[2]) + '</strong><span>' + status + '</span></div><b>' + (r.average == null ? '—' : r.average + '%') + '</b><small>' + r.count + ' ' + (fa ? 'ارزیابی' : 'assessment(s)') + '</small></article>';
    }).join('');
    const skillRows = Object.entries(summary.bySkill || {}).map(([skillId, item]) => {
      const stateLabel = item.status === 'ready-for-review' ? (fa ? 'آمادهٔ بازبینی' : 'Ready for review') : item.status === 'evidence-recorded' ? (fa ? 'شواهد ثبت شده' : 'Evidence recorded') : (fa ? 'در حال یادگیری' : 'Learning');
      return '<article class="mastery-stat-card mastery-skill-record"><div><strong>' + escapeLedgerText(item.title) + '</strong><span>' + stateLabel + '</span></div><b>' + (item.average == null ? '—' : item.average + '%') + '</b><small>' + escapeLedgerText(skillId) + ' · ' + item.count + ' ' + (fa ? 'ارزیابی' : 'assessment(s)') + '</small></article>';
    }).join('');
    const initialCatalog = api.catalog('entrepreneurship');
    const catalogOptions = initialCatalog.map(item => '<option value="' + escapeLedgerText(item.id) + '" data-title="' + escapeLedgerText(item.title) + '" data-stat="' + escapeLedgerText(item.stat) + '">' + escapeLedgerText(item.title) + '</option>').join('');
    panel.innerHTML = '<section class="system-skill-review system-mastery-review"><header class="system-skill-review-head"><div><h3>' + (fa ? 'ردیاب شواهد و تسلط' : 'Mastery & Evidence Tracker') + '</h3><p>' + (fa ? 'مهارت را از درخت رسمی انتخاب کن؛ شواهد مأموریت را به همان مهارت پیوند بده. این بخش XP یا سکه نمی‌دهد.' : 'Choose a skill from the official tree and link quest evidence to it. This tool does not award XP or coins.') + '</p></div><div class="skill-review-total"><strong>' + summary.total + '</strong><small>' + (fa ? 'ثبت' : 'records') + '</small></div></header>' +
      '<div class="mastery-stat-grid">' + cards + '</div>' +
      '<section class="mastery-skill-status"><h4>' + (fa ? 'وضعیت هر مهارت' : 'Per-skill status') + '</h4>' + (skillRows || '<p class="grok-hint">' + (fa ? 'پس از ثبت ارزیابی با نام و شناسهٔ دقیق، وضعیت هر مهارت اینجا نمایش داده می‌شود.' : 'Record an assessment with an exact skill name and ID to track each skill here.') + '</p>') + '</section>' +
      '<div class="skill-review-recommendation"><strong>' + (fa ? 'معیار آمادگی' : 'Readiness rule') + '</strong><small>' + (fa ? 'حداقل دو ارزیابی از سه ارزیابی اخیر، میانگین حداقل ۸۰٪ و دست‌کم یک آزمون یا پروژه با شواهد عملی لازم است. این فقط آمادگی برای بازبینی است؛ نه تأیید مستقل تسلط.' : 'Requires at least two assessments, an average of 80% across the latest three, and practical evidence on a test or project. This means ready for review, not independently verified mastery.') + '</small></div>' +
      '<form class="skill-review-form" data-mastery-form><label>' + (fa ? 'شاخه مهارت' : 'Skill branch') + '<select name="stat" required>' + stats + '</select></label><label>' + (fa ? 'انتخاب از درخت مهارت' : 'Choose from Skill Tree') + '<select name="catalogSkill" data-catalog-skill required>' + catalogOptions + '</select></label><input type="hidden" name="skillTitle" value="' + escapeLedgerText(initialCatalog[0]?.title || '') + '"><input type="hidden" name="skillId" value="' + escapeLedgerText(initialCatalog[0]?.id || '') + '"><label>' + (fa ? 'شناسه مأموریت مرتبط (اختیاری)' : 'Related Quest ID (optional)') + '<input name="questId" maxlength="160" placeholder="quest-id"></label><label>' + (fa ? 'نوع ارزیابی' : 'Assessment type') + '<select name="type" required>' + typeOptions + '</select></label><label>' + (fa ? 'نمره (۰ تا ۱۰۰)' : 'Score (0–100)') + '<input name="score" type="number" min="0" max="100" step="1" required inputmode="numeric"></label><label class="skill-review-evidence"><input type="checkbox" name="evidence"><span>' + (fa ? 'شواهد عملی قابل بررسی دارم' : 'I have practical evidence to review') + '</span></label><label>' + (fa ? 'یادداشت (اختیاری)' : 'Notes (optional)') + '<textarea name="note" maxlength="500" rows="3"></textarea></label><button class="skill-review-submit" type="submit">' + (fa ? 'ثبت ارزیابی' : 'Save assessment') + '</button><p class="skill-review-feedback" role="status" aria-live="polite"></p></form>' +
      '<div class="skill-review-history"><h4>' + (fa ? 'ارزیابی‌های اخیر' : 'Recent assessments') + '</h4>' + (rows || '<p class="grok-hint">' + (fa ? 'هنوز ارزیابی ثبت نشده است.' : 'No assessments recorded yet.') + '</p>') + '</div><button type="button" class="skill-review-export" data-mastery-export>' + (fa ? 'خروجی JSON' : 'Export JSON') + '</button><p class="system-ledger-note">' + (fa ? 'اطلاعات فقط در همین مرورگر ذخیره می‌شود. نمره‌ها خوداظهاری‌اند و به‌تنهایی مهارت را اثبات نمی‌کنند.' : 'Data stays in this browser. Scores are self-reported and do not independently prove mastery.') + '</p></section>';
    const form = panel.querySelector('[data-mastery-form]');
    if (form) form.addEventListener('submit', async function (event) {
      event.preventDefault(); const data = new FormData(form);
      const result = await api.record({ stat: data.get('stat'), skillId: data.get('skillId'), skillTitle: data.get('skillTitle'), questId: data.get('questId'), type: data.get('type'), score: Number(data.get('score')), evidence: data.get('evidence') === 'on', note: data.get('note') });
      if (!result.ok) { const feedback = form.querySelector('.skill-review-feedback'); if (feedback) feedback.textContent = result.error === 'duplicate-quest-evidence' ? (fa ? 'برای این مهارت، شواهد این مأموریت قبلاً ثبت شده است.' : 'Evidence for this quest is already recorded for this skill.') : (fa ? 'ثبت نشد؛ مهارت، نمره و فضای ذخیره‌سازی را بررسی کن.' : 'Could not save. Check skill, score and available storage.'); return; }
      renderSkillMastery(panel); const feedback = panel.querySelector('.skill-review-feedback'); if (feedback) feedback.textContent = fa ? 'ارزیابی ثبت شد.' : 'Assessment saved.';
    });
    const branchSelect = panel.querySelector('[name="stat"]');
    const skillSelect = panel.querySelector('[data-catalog-skill]');
    function refreshCatalog() {
      if (!branchSelect || !skillSelect) return;
      const catalog = api.catalog(branchSelect.value);
      skillSelect.innerHTML = catalog.map(item => '<option value="' + escapeLedgerText(item.id) + '" data-title="' + escapeLedgerText(item.title) + '">' + escapeLedgerText(item.title) + '</option>').join('');
      const chosen = catalog[0];
      form.elements.skillId.value = chosen ? chosen.id : '';
      form.elements.skillTitle.value = chosen ? chosen.title : '';
      skillSelect.disabled = !chosen;
    }
    if (branchSelect) branchSelect.addEventListener('change', refreshCatalog);
    if (skillSelect) skillSelect.addEventListener('change', function () {
      const selected = skillSelect.selectedOptions[0];
      form.elements.skillId.value = selected ? selected.value : '';
      form.elements.skillTitle.value = selected ? selected.getAttribute('data-title') || selected.textContent : '';
    });
    const exportButton = panel.querySelector('[data-mastery-export]');
    if (exportButton) exportButton.addEventListener('click', function () { const blob = new Blob([api.exportJSON()], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'system-mastery-assessments-' + new Date().toISOString().slice(0, 10) + '.json'; link.hidden = true; document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); });
  }

  let roadmapFilterState = { query: '', status: 'all', stat: 'all' };
  let roadmapEditId = null;

  function applyRoadmapFilters(panel) {
    const query = String(roadmapFilterState.query || '').trim().toLocaleLowerCase();
    const status = roadmapFilterState.status || 'all';
    const stat = roadmapFilterState.stat || 'all';
    const cards = Array.from(panel.querySelectorAll('[data-roadmap-filter-item]'));
    let visible = 0;
    cards.forEach(function (card) {
      const matches = (!query || (card.getAttribute('data-search') || '').includes(query)) &&
        (status === 'all' || card.getAttribute('data-status') === status) &&
        (stat === 'all' || card.getAttribute('data-stat') === stat);
      card.hidden = !matches;
      if (matches) visible++;
    });
    const noMatches = panel.querySelector('[data-roadmap-no-results]');
    if (noMatches) noMatches.hidden = cards.length === 0 || visible > 0;
  }

  function renderSmartRoadmap(panel) {
    const api = window.SYSTEMSmartRoadmap;
    const fa = isFa();
    if (!api) { panel.innerHTML = '<p class="grok-hint">' + (fa ? 'نقشه راه هوشمند در دسترس نیست؛ صفحه را تازه‌سازی کنید.' : 'Smart Roadmap is unavailable; refresh the page.') + '</p>'; return; }
    const labels = {
      'entrepreneurship': fa ? 'کارآفرینی' : 'Entrepreneurship', 'global-skills': fa ? 'مهارت‌های جهانی' : 'Global Skills',
      mathematics: fa ? 'ریاضی' : 'Mathematics', computer: fa ? 'کمپیوتر' : 'Computer', physics: fa ? 'فزیک' : 'Physics', 'unique-thinking': fa ? 'تفکر ویژه' : 'Unique Thinking'
    };
    const summary = api.summary();
    const weeklyReview = typeof api.weeklyReview === 'function' ? api.weeklyReview() : null;
    const weeklyCard = weeklyReview
      ? '<section class="roadmap-weekly-review" aria-label="' + (fa ? 'مرور هفتگی' : 'Weekly review') + '"><div><span>' + (fa ? 'مرور ۷ روز گذشته' : 'LAST 7 DAYS') + '</span><strong>' + weeklyReview.completedCount + '</strong><small>' + (fa ? 'گام تکمیل‌شده' : 'milestones completed') + '</small></div><div><strong>' + weeklyReview.createdCount + '</strong><small>' + (fa ? 'گام تازه' : 'new milestones') + '</small></div><div><strong>' + weeklyReview.overdueOpenCount + '</strong><small>' + (fa ? 'گام عقب‌افتادهٔ فعلی' : 'currently overdue') + '</small></div></section>' : '';
    // Explainable focus recommendation: overdue first, then nearest deadline, priority, and in-progress status.
    const todayKey = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const focusCandidates = api.list().filter(item => item.status !== 'done').slice().sort((a, b) => {
      const overdueA = !!a.dueDate && a.dueDate < todayKey, overdueB = !!b.dueDate && b.dueDate < todayKey;
      if (overdueA !== overdueB) return overdueA ? -1 : 1;
      if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      const rank = { high: 0, normal: 1, low: 2 };
      if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
      if ((a.status === 'doing') !== (b.status === 'doing')) return a.status === 'doing' ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
    const focusItem = focusCandidates[0] || null;
    const focusCard = focusItem
      ? '<section class="roadmap-focus-card" aria-label="' + (fa ? 'پیشنهاد تمرکز امروز' : 'Suggested focus') + '"><div><span class="roadmap-focus-eyebrow">' + (fa ? 'گام پیشنهادی بعدی' : 'NEXT BEST ACTION') + '</span><h4>' + escapeLedgerText(focusItem.title) + '</h4><p>' + (focusItem.dueDate && focusItem.dueDate < todayKey ? (fa ? 'این گام از مهلت گذشته؛ ابتدا آن را بررسی کن.' : 'This milestone is overdue; review it first.') : focusItem.dueDate === todayKey ? (fa ? 'مهلت این گام امروز است.' : 'This milestone is due today.') : focusItem.status === 'doing' ? (fa ? 'این گام را ادامه بده تا کارهای نیمه‌تمام کمتر شوند.' : 'Continue this in-progress milestone to reduce work in progress.') : (fa ? 'بر اساس مهلت و اولویت ثبت‌شده پیشنهاد شده است.' : 'Suggested from its deadline and recorded priority.')) + '</p></div><button type="button" class="roadmap-action" data-roadmap-focus="' + escapeLedgerText(focusItem.id) + '">' + (fa ? 'نمایش این گام' : 'Focus this task') + '</button></section>'
      : '<section class="roadmap-focus-card is-empty"><div><span class="roadmap-focus-eyebrow">' + (fa ? 'تمرکز امروز' : 'TODAY’S FOCUS') + '</span><h4>' + (fa ? 'همهٔ گام‌ها تکمیل شده‌اند' : 'All milestones completed') + '</h4><p>' + (fa ? 'برای ادامه، یک گام تازه به نقشه راه اضافه کن.' : 'Add a new milestone to keep moving forward.') + '</p></div></section>';
    const priorityLabels = fa ? { high: 'بالا', normal: 'معمولی', low: 'پایین' } : { high: 'High', normal: 'Normal', low: 'Low' };
    const statusLabels = fa ? { todo: 'انجام‌نشده', doing: 'در حال انجام', done: 'تکمیل‌شده' } : { todo: 'To do', doing: 'In progress', done: 'Done' };
    const filterStatusLabels = fa ? { all: 'همه وضعیت‌ها', todo: 'انجام‌نشده', doing: 'در حال انجام', done: 'تکمیل‌شده' } : { all: 'All statuses', todo: 'To do', doing: 'In progress', done: 'Done' };
    const statOptions = Object.keys(labels).map(key => '<option value="' + key + '">' + labels[key] + '</option>').join('');
    const filterOptions = Object.keys(labels).map(key => '<option value="' + key + '">' + labels[key] + '</option>').join('');
    const editing = roadmapEditId ? api.list().find(item => item.id === roadmapEditId) : null;
    if (roadmapEditId && !editing) roadmapEditId = null;
    const editingItem = editing || null;
    const rows = api.list().map(item => {
      const overdue = item.status !== 'done' && item.dueDate && item.dueDate < new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
      const due = item.dueDate ? (fa ? 'مهلت: ' : 'Due: ') + item.dueDate : (fa ? 'بدون مهلت' : 'No deadline');
      const nextStatus = item.status === 'todo' ? 'doing' : item.status === 'doing' ? 'done' : 'todo';
      const actionLabel = item.status === 'todo' ? (fa ? 'شروع' : 'Start') : item.status === 'doing' ? (fa ? 'تکمیل' : 'Complete') : (fa ? 'بازگشایی' : 'Reopen');
      const searchable = (item.title + ' ' + item.note + ' ' + labels[item.stat] + ' ' + statusLabels[item.status]).toLocaleLowerCase();
      return '<article class="roadmap-item ' + (item.status === 'done' ? 'is-done' : '') + '" data-roadmap-filter-item data-status="' + item.status + '" data-stat="' + item.stat + '" data-search="' + escapeLedgerText(searchable) + '"><div class="roadmap-item-top"><span class="roadmap-item-title">' + escapeLedgerText(item.title) + '</span><span class="roadmap-badge ' + item.priority + '">' + (fa ? 'اولویت ' : 'Priority: ') + priorityLabels[item.priority] + '</span></div>' +
        (item.note ? '<p>' + escapeLedgerText(item.note) + '</p>' : '') + '<small>' + escapeLedgerText(labels[item.stat]) + ' · ' + escapeLedgerText(statusLabels[item.status]) + ' · ' + escapeLedgerText(due) + '</small>' +
        (overdue ? '<span class="roadmap-badge overdue">' + (fa ? 'از مهلت گذشته' : 'Overdue') + '</span>' : '') +
        '<div class="roadmap-item-actions"><button type="button" class="roadmap-action" data-roadmap-status="' + escapeLedgerText(item.id) + '" data-next-status="' + nextStatus + '">' + actionLabel + '</button><button type="button" class="roadmap-action" data-roadmap-edit="' + escapeLedgerText(item.id) + '">' + (fa ? 'ویرایش' : 'Edit') + '</button><button type="button" class="roadmap-action" data-roadmap-remove="' + escapeLedgerText(item.id) + '">' + (fa ? 'حذف' : 'Delete') + '</button></div></article>';
    }).join('');
    const titleValue = editingItem ? editingItem.title : '';
    const noteValue = editingItem ? editingItem.note : '';
    const selectedStat = editingItem ? editingItem.stat : (Object.keys(labels)[0]);
    const selectedPriority = editingItem ? editingItem.priority : 'normal';
    const selectedDue = editingItem ? editingItem.dueDate : '';
    const selectAttr = (value, selected) => value === selected ? ' selected' : '';
    panel.innerHTML = '<section class="system-roadmap"><header class="system-roadmap-head"><div><h3>' + (fa ? 'نقشه راه هوشمند' : 'Smart Roadmap') + '</h3><p>' + (fa ? 'هدف‌ها را به گام‌های کوچک، اولویت‌دار و زمان‌بندی‌شده تبدیل کن.' : 'Turn goals into small, prioritized and time-bound milestones.') + '</p></div><div class="roadmap-header-actions"><label class="roadmap-import-mode">' + (fa ? 'حالت ورود' : 'Import mode') + '<select data-roadmap-import-mode><option value="merge">' + (fa ? 'ادغام' : 'Merge') + '</option><option value="replace">' + (fa ? 'جایگزینی' : 'Replace') + '</option></select></label><button type="button" class="roadmap-action" data-roadmap-import-trigger>' + (fa ? 'واردکردن JSON' : 'Import JSON') + '</button><button type="button" class="roadmap-action" data-roadmap-export>' + (fa ? 'خروجی JSON' : 'Export JSON') + '</button><input type="file" accept="application/json,.json" data-roadmap-import-file hidden></div></header>' +
      focusCard + weeklyCard + '<div class="roadmap-kpis"><div class="roadmap-kpi"><strong>' + summary.total + '</strong><span>' + (fa ? 'گام‌ها' : 'Milestones') + '</span></div><div class="roadmap-kpi"><strong>' + summary.done + '</strong><span>' + (fa ? 'تکمیل‌شده' : 'Completed') + '</span></div><div class="roadmap-kpi"><strong>' + summary.percent + '%</strong><span>' + (fa ? 'پیشرفت' : 'Progress') + '</span></div><div class="roadmap-kpi"><strong>' + summary.overdue + '</strong><span>' + (fa ? 'عقب‌افتاده' : 'Overdue') + '</span></div><div class="roadmap-kpi"><strong>' + (summary.dueSoon || 0) + '</strong><span>' + (fa ? 'مهلت تا ۷ روز' : 'Due in 7 days') + '</span></div></div>' +
      '<div class="roadmap-progress"><div class="roadmap-progress-head"><strong>' + (fa ? 'پیشرفت کلی نقشه راه' : 'Overall roadmap progress') + '</strong><span>' + summary.done + ' / ' + summary.total + '</span></div><div class="roadmap-progress-track" role="progressbar" aria-label="' + (fa ? 'پیشرفت نقشه راه' : 'Roadmap progress') + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + summary.percent + '"><span style="width:' + summary.percent + '%"></span></div></div>' +
      '<div class="roadmap-toolbar"><label>' + (fa ? 'جست‌وجو' : 'Search') + '<input type="search" data-roadmap-search maxlength="120" value="' + escapeLedgerText(roadmapFilterState.query) + '" placeholder="' + (fa ? 'جست‌وجوی عنوان یا یادداشت...' : 'Search title or notes...') + '"></label><label>' + (fa ? 'وضعیت' : 'Status') + '<select data-roadmap-filter-status>' + Object.keys(filterStatusLabels).map(key => '<option value="' + key + '"' + selectAttr(key, roadmapFilterState.status) + '>' + filterStatusLabels[key] + '</option>').join('') + '</select></label><label>' + (fa ? 'شاخه' : 'Branch') + '<select data-roadmap-filter-stat><option value="all">' + (fa ? 'همه شاخه‌ها' : 'All branches') + '</option>' + filterOptions.replace(/<option value="([^"]+)">/g, (match, key) => '<option value="' + key + '"' + selectAttr(key, roadmapFilterState.stat) + '>') + '</select></label></div>' +
      '<form class="roadmap-form" data-roadmap-form data-editing-id="' + (editingItem ? escapeLedgerText(editingItem.id) : '') + '"><label>' + (fa ? 'عنوان گام' : 'Milestone title') + '<input name="title" maxlength="120" required value="' + escapeLedgerText(titleValue) + '" placeholder="' + (fa ? 'مثلاً: ساخت پروژه کوچک پایتون' : 'e.g. Build a small Python project') + '"></label><label>' + (fa ? 'شاخه مرتبط' : 'Related skill branch') + '<select name="stat">' + Object.keys(labels).map(key => '<option value="' + key + '"' + selectAttr(key, selectedStat) + '>' + labels[key] + '</option>').join('') + '</select></label><label>' + (fa ? 'اولویت' : 'Priority') + '<select name="priority"><option value="high"' + selectAttr('high', selectedPriority) + '>' + priorityLabels.high + '</option><option value="normal"' + selectAttr('normal', selectedPriority) + '>' + priorityLabels.normal + '</option><option value="low"' + selectAttr('low', selectedPriority) + '>' + priorityLabels.low + '</option></select></label><label>' + (fa ? 'مهلت (اختیاری)' : 'Deadline (optional)') + '<input name="dueDate" type="date" value="' + escapeLedgerText(selectedDue) + '"></label><label>' + (fa ? 'یادداشت کوتاه (اختیاری)' : 'Short note (optional)') + '<textarea name="note" maxlength="500" rows="2">' + escapeLedgerText(noteValue) + '</textarea></label><div class="roadmap-form-actions"><button type="submit">' + (editingItem ? (fa ? 'ذخیره ویرایش' : 'Save changes') : (fa ? 'افزودن گام به نقشه راه' : 'Add roadmap milestone')) + '</button>' + (editingItem ? '<button type="button" class="roadmap-action" data-roadmap-cancel-edit>' + (fa ? 'لغو ویرایش' : 'Cancel edit') + '</button>' : '') + '</div><p class="roadmap-feedback" data-roadmap-feedback role="status" aria-live="polite"></p></form>' +
      '<div class="roadmap-list">' + (rows || '<p class="roadmap-muted">' + (fa ? 'هنوز گامی ثبت نشده؛ اولین گام کوچک خود را اضافه کن.' : 'No milestones yet. Add your first small step.') + '</p>') + '<p class="roadmap-muted roadmap-no-filter-results" data-roadmap-no-results hidden>' + (fa ? 'با این فیلتر گامی پیدا نشد.' : 'No milestones match these filters.') + '</p></div><p class="roadmap-muted">' + (fa ? 'گام‌ها فقط در همین مرورگر ذخیره می‌شوند. برای انتقال به دستگاه دیگر، خروجی بگیر و در دستگاه مقصد وارد کن. تغییر وضعیت نقشه راه به‌تنهایی XP، سکه یا رتبه نمی‌دهد.' : 'Milestones stay in this browser. Export and import a JSON file to move them to another device. Roadmap changes do not award XP, coins or ranks.') + '</p></section>';

    applyRoadmapFilters(panel);
    const form = panel.querySelector('[data-roadmap-form]');
    if (form) form.addEventListener('submit', function (event) {
      event.preventDefault();
      const data = new FormData(form);
      const editingId = form.getAttribute('data-editing-id');
      const payload = { title: data.get('title'), stat: data.get('stat'), priority: data.get('priority'), dueDate: data.get('dueDate'), note: data.get('note') };
      const result = editingId ? api.update(editingId, payload) : api.add(payload);
      if (!result.ok) {
        const feedback = panel.querySelector('[data-roadmap-feedback]');
        const faErrors = { 'limit-reached': 'ظرفیت نقشه راه تکمیل است؛ ابتدا یک گام را حذف کن.', 'invalid-date': 'تاریخ معتبر نیست.', 'storage-unavailable': 'فضای ذخیره‌سازی در دسترس نیست.' };
        const enErrors = { 'limit-reached': 'Roadmap is full. Remove a milestone before adding another.', 'invalid-date': 'The date is invalid.', 'storage-unavailable': 'Browser storage is unavailable.' };
        if (feedback) feedback.textContent = (fa ? faErrors : enErrors)[result.error] || (fa ? 'ثبت نشد؛ ورودی‌ها را بررسی کن.' : 'Could not save. Check the inputs.');
        return;
      }
      roadmapEditId = null;
      renderSmartRoadmap(panel);
      const feedback = panel.querySelector('[data-roadmap-feedback]');
      if (feedback) feedback.textContent = fa ? (editingId ? 'ویرایش ذخیره شد.' : 'گام اضافه شد.') : (editingId ? 'Changes saved.' : 'Milestone added.');
    });

    panel.querySelectorAll('[data-roadmap-status]').forEach(button => button.addEventListener('click', function () {
      const result = api.setStatus(button.getAttribute('data-roadmap-status'), button.getAttribute('data-next-status'));
      if (result.ok) renderSmartRoadmap(panel); else { const feedback = panel.querySelector('[data-roadmap-feedback]'); if (feedback) feedback.textContent = fa ? 'تغییر ذخیره نشد.' : 'Could not save status change.'; }
    }));
    panel.querySelectorAll('[data-roadmap-edit]').forEach(button => button.addEventListener('click', function () {
      roadmapEditId = button.getAttribute('data-roadmap-edit');
      renderSmartRoadmap(panel);
      const titleInput = panel.querySelector('[data-roadmap-form] input[name="title"]');
      if (titleInput) { titleInput.focus(); titleInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    }));
    const cancelEdit = panel.querySelector('[data-roadmap-cancel-edit]');
    if (cancelEdit) cancelEdit.addEventListener('click', function () { roadmapEditId = null; renderSmartRoadmap(panel); });
    panel.querySelectorAll('[data-roadmap-remove]').forEach(button => button.addEventListener('click', function () {
      if (!globalThis.confirm(fa ? 'این گام حذف شود؟' : 'Delete this milestone?')) return;
      const removedId = button.getAttribute('data-roadmap-remove');
      const result = api.remove(removedId);
      if (result.ok) { if (roadmapEditId === removedId) roadmapEditId = null; renderSmartRoadmap(panel); }
      else { const feedback = panel.querySelector('[data-roadmap-feedback]'); if (feedback) feedback.textContent = fa ? 'حذف ذخیره نشد.' : 'Could not delete milestone.'; }
    }));

    const focusButton = panel.querySelector('[data-roadmap-focus]');
    if (focusButton) focusButton.addEventListener('click', function () {
      const item = api.list().find(entry => entry.id === focusButton.getAttribute('data-roadmap-focus'));
      if (!item) return;
      roadmapFilterState.query = item.title;
      roadmapFilterState.status = 'all';
      roadmapFilterState.stat = 'all';
      renderSmartRoadmap(panel);
      const input = panel.querySelector('[data-roadmap-search]');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    });
    const search = panel.querySelector('[data-roadmap-search]');
    const statusFilter = panel.querySelector('[data-roadmap-filter-status]');
    const statFilter = panel.querySelector('[data-roadmap-filter-stat]');
    if (search) search.addEventListener('input', function () { roadmapFilterState.query = search.value; applyRoadmapFilters(panel); });
    if (statusFilter) statusFilter.addEventListener('change', function () { roadmapFilterState.status = statusFilter.value; applyRoadmapFilters(panel); });
    if (statFilter) statFilter.addEventListener('change', function () { roadmapFilterState.stat = statFilter.value; applyRoadmapFilters(panel); });

    const exportButton = panel.querySelector('[data-roadmap-export]');
    if (exportButton) exportButton.addEventListener('click', function () {
      const blob = new Blob([api.exportJSON()], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'system-smart-roadmap-' + new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0') + '.json';
      link.hidden = true; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });

    const importTrigger = panel.querySelector('[data-roadmap-import-trigger]');
    const importFile = panel.querySelector('[data-roadmap-import-file]');
    if (importTrigger && importFile) importTrigger.addEventListener('click', function () { importFile.click(); });
    if (importFile) importFile.addEventListener('change', async function () {
      const file = importFile.files && importFile.files[0];
      if (!file) return;
      const feedback = panel.querySelector('[data-roadmap-feedback]');
      if (file.size > 512 * 1024) {
        if (feedback) feedback.textContent = fa ? 'فایل پشتیبان بزرگ‌تر از حد مجاز است.' : 'Backup file exceeds the size limit.';
        importFile.value = '';
        return;
      }
      const modeSelector = panel.querySelector('[data-roadmap-import-mode]');
      const mode = modeSelector ? modeSelector.value : 'merge';
      if (mode === 'replace' && !globalThis.confirm(fa ? 'این کار تمام گام‌های فعلی را با فایل پشتیبان جایگزین می‌کند. ادامه می‌دهی؟' : 'This replaces every current milestone with the backup. Continue?')) { importFile.value = ''; return; }
      try {
        const result = api.importJSON(await file.text(), { mode });
        if (!result.ok) {
          const faErrors = { 'invalid-json': 'فایل JSON معتبر نیست.', 'invalid-backup': 'ساختار پشتیبان SYSTEM معتبر نیست.', 'invalid-item': 'حداقل یک گام فایل نامعتبر است؛ هیچ تغییری اعمال نشد.', 'duplicate-id': 'شناسه‌های تکراری در فایل وجود دارد.', 'limit-reached': 'تعداد گام‌ها از ظرفیت ۲۰۰ مورد فراتر می‌رود.', 'backup-too-large': 'فایل پشتیبان بیش از حد بزرگ است.', 'storage-unavailable': 'ذخیره‌سازی ناموفق بود؛ اطلاعات فعلی حفظ شد.' };
          const enErrors = { 'invalid-json': 'The file is not valid JSON.', 'invalid-backup': 'This is not a valid SYSTEM roadmap backup.', 'invalid-item': 'At least one milestone is invalid; nothing was imported.', 'duplicate-id': 'The file contains duplicate milestone IDs.', 'limit-reached': 'The roadmap limit of 200 milestones would be exceeded.', 'backup-too-large': 'The backup file is too large.', 'storage-unavailable': 'Storage failed; existing data was preserved.' };
          if (feedback) feedback.textContent = (fa ? faErrors : enErrors)[result.error] || (fa ? 'واردکردن فایل انجام نشد.' : 'Import failed.');
          return;
        }
        roadmapEditId = null;
        renderSmartRoadmap(panel);
        const targetFeedback = panel.querySelector('[data-roadmap-feedback]');
        if (targetFeedback) targetFeedback.textContent = fa ? ('ورود موفق؛ ' + result.imported + ' گام اضافه شد' + (result.skipped ? '، ' + result.skipped + ' مورد تکراری رد شد.' : '.')) : ('Import complete: ' + result.imported + ' added' + (result.skipped ? ', ' + result.skipped + ' identical milestones skipped.' : '.'));
      } catch (_) {
        if (feedback) feedback.textContent = fa ? 'خواندن فایل ناموفق بود.' : 'Could not read the selected file.';
      } finally { importFile.value = ''; }
    });
  }

  // ---------- Status Command Deck ----------
  function updateStatusCommandText(isOpen) {
    const button = $('status-more-btn');
    const title = document.querySelector('[data-status-command-title]');
    const subtitle = document.querySelector('[data-status-command-subtitle]');
    const state = document.querySelector('[data-status-command-state]');
    const fa = isFa();
    if (title) title.textContent = fa ? 'مرکز فرمان' : 'COMMAND DECK';
    if (subtitle) subtitle.textContent = fa ? 'ابزارها · بینش · مهارت‌آموزی' : 'TOOLS · INSIGHT · MASTERY';
    if (state) state.textContent = isOpen ? (fa ? 'باز است' : 'OPEN') : (fa ? 'کاوش' : 'EXPLORE');
    if (button) {
      const label = isOpen ? (fa ? 'بستن مرکز فرمان وضعیت' : 'Close Status Command Deck') : (fa ? 'گشودن مرکز فرمان وضعیت' : 'Open Status Command Deck');
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    }
  }

  function openSheet() {
    const sheet = $('status-more-sheet');
    const btn = $('status-more-btn');
    if (!sheet) return;
    sheet.hidden = false;
    document.body.classList.add('status-sheet-open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    sheet.setAttribute('aria-modal', 'true');
    const title = sheet.querySelector('.status-more-sheet-head h2');
    if (title) title.textContent = isFa() ? 'مرکز فرمان وضعیت' : 'Status Command Deck';
    updateStatusCommandText(true);
    $('status-more-close')?.focus();
  }

  function closeSheet() {
    const sheet = $('status-more-sheet');
    const btn = $('status-more-btn');
    const panel = $('status-tool-panel');
    const wasOpen = Boolean(sheet && !sheet.hidden);
    if (sheet) sheet.hidden = true;
    document.body.classList.remove('status-sheet-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (panel) {
      panel.hidden = true;
      panel.innerHTML = '';
      panel.classList.remove('is-open');
    }
    updateStatusCommandText(false);
    if (wasOpen && btn) btn.focus();
  }

  function showTool(tool) {
    const panel = $('status-tool-panel');
    if (!panel) return;
    panel.hidden = false;
    panel.classList.add('is-open');
    panel.innerHTML = '';
    document.querySelectorAll('[data-status-tool]').forEach(function (button) {
      const selected = button.getAttribute('data-status-tool') === tool;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });

    if (tool === 'progress' || tool === 'timer') {
      const suite = document.getElementById('grok-progress-suite');
      if (suite) {
        const clone = suite.cloneNode(true);
        clone.id = 'grok-progress-suite-clone';
        clone.style.display = 'block';
        clone.hidden = false;
        panel.appendChild(clone);
        const bars = clone.querySelector('#grok-week-bars');
        const hist = clone.querySelector('#grok-history-list');
        const liveBars = document.getElementById('grok-week-bars');
        const liveHist = document.getElementById('grok-history-list');
        if (bars && liveBars) bars.innerHTML = liveBars.innerHTML;
        if (hist && liveHist) hist.innerHTML = liveHist.innerHTML;
        const mom = clone.querySelector('#grok-momentum');
        const liveMom = document.getElementById('grok-momentum');
        if (mom && liveMom) mom.textContent = liveMom.textContent;
        if (tool === 'timer') {
          const timerCard = clone.querySelector('.grok-progress-card:nth-child(2)');
          if (timerCard) timerCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else {
        panel.innerHTML = '<p class="grok-hint">' + (isFa() ? 'بخش پیشرفت هنوز بارگذاری نشده.' : 'Progress section is not loaded yet.') + '</p>';
      }
    } else if (tool === 'ledger') {
      renderActivityLedger(panel);
    } else if (tool === 'skill-review') {
      renderSkillReview(panel);
    } else if (tool === 'skill-mastery') {
      renderSkillMastery(panel);
    } else if (tool === 'smart-roadmap') {
      renderSmartRoadmap(panel);
    } else if (tool === 'intelligence') {
      if (typeof SYSTEMIntelligence !== 'undefined' && SYSTEMIntelligence.analyze) {
        const a = SYSTEMIntelligence.analyze();
        const lang = isFa() ? 'fa' : 'en';
        const insights = (a.insights || []).slice(0, 3).map(function (item) { return '<li>' + escapeLedgerText(item[lang]) + '</li>'; }).join('');
        panel.innerHTML = '<div class="system-intelligence-card" style="display:block;margin:0;"><div class="si-header"><strong>SYSTEM Intelligence</strong><span class="si-momentum">' + Number(a.momentum || 0) + '/100</span></div><p class="si-next">' + escapeLedgerText(a.nextAction && a.nextAction[lang] || '') + '</p><ul class="si-insights">' + (insights || '<li>' + (isFa() ? 'هنوز دادهٔ کافی نیست.' : 'Not enough data yet.') + '</li>') + '</ul></div>';
      } else {
        panel.innerHTML = '<p class="grok-hint">' + (isFa() ? 'موتور هوش در دسترس نیست.' : 'Intelligence engine is not available.') + '</p>';
      }
    }
    panel.setAttribute('aria-live', 'polite');
  }

  function initStatusMore() {
    const btn = $('status-more-btn');
    const close = $('status-more-close');
    const sheet = $('status-more-sheet');
    if (!btn || !sheet) return;
    updateStatusCommandText(false);

    btn.addEventListener('click', function () {
      if (sheet.hidden) openSheet();
      else closeSheet();
    });
    if (close) close.addEventListener('click', closeSheet);
    sheet.addEventListener('click', function (event) { if (event.target === sheet) closeSheet(); });
    sheet.querySelectorAll('[data-status-tool]').forEach(function (element) {
      element.setAttribute('aria-pressed', 'false');
      element.addEventListener('click', function () { showTool(element.getAttribute('data-status-tool')); });
    });
    window.addEventListener('system-roadmap-updated', function (event) {
      if (!event || !event.detail || event.detail.external !== true) return;
      const panel = $('status-tool-panel');
      if (panel && !panel.hidden && panel.querySelector('.system-roadmap')) renderSmartRoadmap(panel);
    });
    window.addEventListener('system-language-change', function () {
      updateStatusCommandText(Boolean(sheet && !sheet.hidden));
      if (sheet && !sheet.hidden) {
        const title = sheet.querySelector('.status-more-sheet-head h2');
        if (title) title.textContent = isFa() ? 'مرکز فرمان وضعیت' : 'Status Command Deck';
      }
    });
    document.addEventListener('keydown', function (event) {
      if (!sheet || sheet.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSheet();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(sheet.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'))
        .filter(function (element) { return !element.closest('[hidden]'); });
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    });
  }

  // ---------- Quest More ----------
  function openQuestSheet() {
    const sheet = $('quest-more-sheet');
    const btn = $('quest-more-btn');
    if (!sheet) return;
    sheet.hidden = false;
    if (btn) btn.setAttribute('aria-expanded', 'true');
    const title = sheet.querySelector('.status-more-sheet-head h2');
    if (title) title.textContent = isFa() ? 'ابزارهای Quest' : 'Quest Tools';
  }

  function closeQuestSheet() {
    const sheet = $('quest-more-sheet');
    const btn = $('quest-more-btn');
    const panel = $('quest-tool-panel');
    if (sheet) sheet.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (panel) {
      panel.hidden = true;
      panel.innerHTML = '';
      panel.classList.remove('is-open');
    }
  }

  function showQuestTool(tool) {
    const panel = $('quest-tool-panel');
    if (!panel) return;
    panel.hidden = false;
    panel.classList.add('is-open');
    panel.innerHTML = '';

    const command = document.querySelector('#quest-page .quest-command');
    const footer = document.querySelector('#quest-page .quest-list-footer');

    if (tool === 'command' || tool === 'metrics') {
      if (command) {
        const clone = command.cloneNode(true);
        clone.style.display = 'block';
        panel.appendChild(clone);
      }
      if (footer && tool === 'command') {
        const fclone = footer.cloneNode(true);
        fclone.style.display = 'block';
        panel.appendChild(fclone);
      }
      if (!command) {
        panel.innerHTML = '<p class="grok-hint">' + (isFa() ? 'مرکز فرمان کوئست هنوز بارگذاری نشده.' : 'Quest Command Center is not loaded yet.') + '</p>';
      }
    }
  }

  function initQuestMore() {
    const btn = $('quest-more-btn');
    const close = $('quest-more-close');
    const sheet = $('quest-more-sheet');
    if (!btn || !sheet) return;

    btn.addEventListener('click', function () {
      if (sheet.hidden) openQuestSheet();
      else closeQuestSheet();
    });
    if (close) close.addEventListener('click', closeQuestSheet);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) closeQuestSheet(); });
    sheet.querySelectorAll('[data-quest-tool]').forEach(function (el) {
      el.addEventListener('click', function () { showQuestTool(el.getAttribute('data-quest-tool')); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet && !sheet.hidden) closeQuestSheet();
    });
  }

  function boot() {
    initStatusMore();
    initQuestMore();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 350); });
  } else {
    setTimeout(boot, 350);
  }
})();
