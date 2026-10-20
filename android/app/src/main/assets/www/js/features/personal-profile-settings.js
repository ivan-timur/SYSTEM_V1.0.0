/* SYSTEM Personal Profile & AI Memory — local-first, opt-in AI bridge. */
(function () {
  'use strict';
  const KEY = 'system.personalProfile.v1';
  const SCHEMA = 3;
  const form = document.getElementById('personal-profile-form');
  if (!form) return;
  const panel = document.getElementById('personal-profile');
  const status = document.getElementById('profile-save-state');
  const fileInput = document.getElementById('personal-profile-file');
  const fields = ['northStar','currentFocus','identity','interests','goals','strengths','learning','lifestyle','motivation','visual','patterns','rules','evidence','boundaries','autonomy','responseStyle'];
  const narrative = fields.filter(n => !['autonomy','responseStyle'].includes(n));
  const scopes = ['northStar','currentFocus','identity','interests','goals','strengths','learning','lifestyle','motivation','visual','rules','evidence','boundaries','responseStyle','autonomy','progress'];
  const defaultPreferences = Object.freeze({
    consent: false,
    scopes: { currentFocus:true, goals:true, interests:true, learning:true, strengths:true, motivation:true, responseStyle:true, autonomy:true }
  });
  const clone = value => JSON.parse(JSON.stringify(value));
  let preferences = clone(defaultPreferences);
  let insights = [];
  let saveTimer = null;
  let lastSaved = '';
  let activeInsightId = '';
  const el = id => document.getElementById(id);
  const readForm = () => Object.fromEntries(fields.map(name => [name, String(form.elements[name]?.value || '').slice(0, 12000)]));
  const setStatus = message => { if (status) status.textContent = message; };
  const setAIStatus = message => { if (el('profile-ai-status')) el('profile-ai-status').textContent = message; };
  function sanitizePreferences(raw) {
    const result = { consent: raw?.consent === true, scopes: {} };
    for (const name of scopes) result.scopes[name] = raw?.scopes?.[name] === true;
    // A legacy profile can have no privacy settings. Never infer permission to send data.
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clone(defaultPreferences);
    return result;
  }
  function readPreferences() {
    const consent = Boolean(el('profile-ai-consent')?.checked);
    const selected = {};
    document.querySelectorAll('[data-profile-scope]').forEach(box => {
      const name = box.dataset.profileScope;
      if (scopes.includes(name)) selected[name] = Boolean(box.checked);
    });
    return { consent, scopes: Object.fromEntries(scopes.map(name => [name, Boolean(selected[name])])) };
  }
  function applyPreferences(raw = preferences) {
    preferences = sanitizePreferences(raw);
    if (el('profile-ai-consent')) el('profile-ai-consent').checked = preferences.consent;
    document.querySelectorAll('[data-profile-scope]').forEach(box => {
      const name = box.dataset.profileScope;
      box.checked = Boolean(preferences.scopes[name]);
    });
    renderSharingState();
  }
  function renderSharingState() {
    const badge = el('profile-ai-sharing-state');
    if (badge) {
      badge.textContent = preferences.consent ? 'SHARING ENABLED' : 'PRIVATE BY DEFAULT';
      badge.dataset.enabled = preferences.consent ? 'true' : 'false';
    }
    document.querySelectorAll('[data-profile-scope]').forEach(box => { box.disabled = !preferences.consent; });
    const count = Object.entries(preferences.scopes).filter(([name, enabled]) => name !== 'progress' && enabled).length + (preferences.scopes.progress ? 1 : 0);
    if (!preferences.consent) setAIStatus('Profile sharing is off. Local profile analysis never sends data to a provider.');
    else if (!count) setAIStatus('Sharing is enabled, but no context categories are selected. No profile context will be sent.');
    else setAIStatus(`Sharing is enabled for ${count} selected context ${count === 1 ? 'category' : 'categories'}. Changes are saved locally.`);
  }
  function snapshotForm() { return JSON.stringify({ form: readForm(), preferences: readPreferences(), insights }); }
  function renderMetrics(data = readForm(), savedAt = '') {
    const filled = narrative.filter(name => data[name]?.trim()).length;
    const percent = Math.round(filled / narrative.length * 100);
    if (el('profile-completion')) el('profile-completion').textContent = percent + '%';
    if (el('profile-filled-count')) el('profile-filled-count').textContent = `${filled} / ${narrative.length}`;
    if (el('profile-last-updated')) {
      const date = savedAt ? new Date(savedAt) : null;
      el('profile-last-updated').textContent = date && !Number.isNaN(date.getTime()) ? date.toLocaleString([], {dateStyle:'medium',timeStyle:'short'}) : 'Not saved';
    }
    form.querySelectorAll('textarea').forEach(area => {
      let counter = area.parentElement.querySelector('.profile-char-count');
      if (!counter) { counter = document.createElement('small'); counter.className = 'profile-char-count'; counter.setAttribute('aria-live','polite'); area.insertAdjacentElement('afterend', counter); }
      counter.textContent = `${area.value.length.toLocaleString()} characters`;
    });
  }
  function makeData() { return { schema: SCHEMA, updatedAt: new Date().toISOString(), ...readForm(), aiPreferences: readPreferences(), insights: clone(insights) }; }
  function persist(quiet = false) {
    try {
      const data = makeData();
      localStorage.setItem(KEY, JSON.stringify(data));
      preferences = sanitizePreferences(data.aiPreferences);
      lastSaved = snapshotForm();
      renderMetrics(data, data.updatedAt);
      renderSharingState();
      setStatus(quiet ? 'Draft saved automatically' : 'Profile and AI preferences saved');
      return true;
    } catch (error) {
      setStatus('Save failed — browser storage may be full or disabled');
      return false;
    }
  }
  function scheduleSave() {
    preferences = sanitizePreferences(readPreferences());
    renderMetrics(); renderSharingState(); setStatus('Unsaved changes…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist(true), 650);
  }
  function safeInsight(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const list = (v, max=5) => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).slice(0,max).map(x => x.trim().slice(0,1200)) : [];
    return {
      id: String(raw.id || `insight-${Date.now()}-${Math.random().toString(36).slice(2,7)}`).slice(0,100),
      createdAt: typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : new Date().toISOString(),
      source: raw.source === 'local' ? 'local' : 'ai',
      status: ['proposed','reviewed','inaccurate'].includes(raw.status) ? raw.status : 'proposed',
      summary: String(raw.summary || '').slice(0,3000),
      strengths: list(raw.strengths),
      priorityGaps: list(raw.priorityGaps),
      recommendedActions: list(raw.recommendedActions, 7),
      assumptionsToConfirm: list(raw.assumptionsToConfirm)
    };
  }
  function loadInsights(raw) { insights = Array.isArray(raw) ? raw.slice(-12).map(safeInsight).filter(Boolean) : []; }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) { applyPreferences(defaultPreferences); renderMetrics(); setStatus('Not saved yet'); lastSaved=snapshotForm(); renderInsights(); return; }
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid stored profile');
      fields.forEach(name => { if (typeof data[name] === 'string' && form.elements[name]) form.elements[name].value = data[name].slice(0, 12000); });
      applyPreferences(data.aiPreferences || defaultPreferences);
      loadInsights(data.insights);
      lastSaved = snapshotForm();
      renderMetrics(data, data.updatedAt); setStatus(data.schema && data.schema < SCHEMA ? 'Profile upgraded and loaded' : 'Profile loaded on this device');
      renderInsights();
      if (data.schema && data.schema < SCHEMA) persist(true);
    } catch (error) { applyPreferences(defaultPreferences); renderMetrics(); setStatus('Could not read saved profile — export/restore a valid backup if available'); }
  }
  function getProgressContext() {
    let snapshot = null;
    try { if (typeof window.getSystemPersonalProgressSnapshot === 'function') snapshot = window.getSystemPersonalProgressSnapshot(); } catch (_) {}
    const player = snapshot?.player || {};
    const rows = Array.isArray(snapshot?.stats) ? snapshot.stats.slice(0,12).map(stat => `${String(stat?.name || stat?.id || 'Skill').slice(0,80)}: Level ${Number(stat?.level) || 1}, XP ${Number(stat?.xpIntoLevel) || 0}/${Number(stat?.xpRequired) || 100}`) : [];
    const history = (() => { try { const value=JSON.parse(localStorage.getItem('system_v2_progress_history')||'[]'); return Array.isArray(value)?value.length:0; } catch (_) { return 0; } })();
    return `Player: Level ${Number(player.level)||1}; rank ${String(player.rank||'E').slice(0,12)}; XP ${Number(player.xpIntoLevel)||0}/${Number(player.xpRequired)||1000}; coins ${Number(player.coins)||0}.\nSkill snapshot: ${rows.join('; ') || 'No live skill snapshot available'}.\nRecorded progress events: ${history}.`;
  }
  function getAIContext() {
    const currentPrefs = readPreferences();
    if (!currentPrefs.consent) return '';
    const data = readForm();
    const titles = { northStar:'North Star', currentFocus:'Current focus', identity:'Identity and values', interests:'Interests', goals:'Goals and vision', strengths:'Strengths and growth areas', learning:'Learning profile', lifestyle:'Schedule and constraints', motivation:'Motivation', visual:'Visual preferences', rules:'Personal rules', evidence:'Evidence and milestones', boundaries:'Boundaries', responseStyle:'Preferred response style', autonomy:'AI autonomy preference' };
    const parts = [];
    for (const name of scopes) {
      if (name === 'progress' || !currentPrefs.scopes[name] || !String(data[name] || '').trim()) continue;
      const value = String(data[name]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, 1050);
      if (value) parts.push(`${titles[name] || name}: ${value}`);
    }
    if (currentPrefs.scopes.progress) parts.push(`Current SYSTEM progress (selected by user): ${getProgressContext()}`);
    const context = parts.join('\n');
    return context.length > 6500 ? context.slice(0, 6500) + '\n[Context trimmed to protect request size.]' : context;
  }
  function buildLocalBrief() {
    const data = readForm();
    const names = [['northStar','NORTH STAR'],['currentFocus','CURRENT FOCUS'],['identity','IDENTITY & VALUES'],['interests','INTERESTS'],['goals','GOALS'],['strengths','STRENGTHS & GROWTH AREAS'],['learning','LEARNING PROFILE'],['lifestyle','SCHEDULE & CONSTRAINTS'],['motivation','MOTIVATION'],['visual','VISUAL PREFERENCES'],['patterns','OBSERVED PATTERNS'],['rules','PERSONAL RULES'],['evidence','EVIDENCE & MILESTONES'],['boundaries','BOUNDARIES']];
    const blocks = names.filter(([key]) => data[key]?.trim()).map(([key,label]) => `${label}\n${data[key].trim()}`);
    const text = blocks.length ? blocks.join('\n\n') : 'No profile entries yet. Complete North Star, Current focus, interests, goals and learning profile to start.';
    const pref=readPreferences();
    const included = pref.consent ? scopes.filter(key=>pref.scopes[key]).join(', ') || 'none' : 'none — AI sharing is off';
    return `${text}\n\nPROFILE COMPLETION: ${Math.round(narrative.filter(n=>data[n]?.trim()).length/narrative.length*100)}%\nAI CONTEXT SHARING: ${pref.consent?'enabled':'off'}\nSELECTED AI CONTEXT SCOPES: ${included}\n\nThis brief was assembled locally by SYSTEM. It was not sent to an AI provider.`;
  }
  function renderList(parent, heading, values) {
    if (!values?.length) return;
    const section=document.createElement('section'); section.className='profile-insight-group';
    const h=document.createElement('h5'); h.textContent=heading; section.appendChild(h);
    const ul=document.createElement('ul');
    values.forEach(value=>{const li=document.createElement('li');li.textContent=value;ul.appendChild(li);});
    section.appendChild(ul);parent.appendChild(section);
  }
  function renderInsights() {
    const wrap=el('profile-ai-insights'), content=el('profile-ai-insights-content');
    if (!wrap || !content) return;
    const item=insights.find(entry=>entry.id===activeInsightId) || insights[0];
    const history=el('profile-insight-history');
    if (!item) { wrap.hidden=true; activeInsightId=''; if(history) history.replaceChildren(); return; }
    activeInsightId=item.id; wrap.hidden=false; content.replaceChildren();
    const summary=document.createElement('p'); summary.className='profile-insight-summary'; summary.textContent=item.summary || 'No summary was returned.'; content.appendChild(summary);
    renderList(content,'Potential strengths',item.strengths);
    renderList(content,'Priority growth areas',item.priorityGaps);
    renderList(content,'Recommended actions',item.recommendedActions);
    renderList(content,'Assumptions to confirm',item.assumptionsToConfirm);
    const date=el('profile-insights-date'); if(date) date.textContent=new Date(item.createdAt).toLocaleString();
    const review=el('profile-insights-review-state'); if(review) review.textContent = item.status==='reviewed'?'You marked this analysis as reviewed / useful.':item.status==='inaccurate'?'You marked this analysis as inaccurate. Treat it as rejected.':'Awaiting your review';
    const confirm=el('profile-insights-confirm'), reject=el('profile-insights-reject');
    if(confirm) confirm.disabled=item.status==='reviewed'; if(reject) reject.disabled=item.status==='inaccurate';
    if(history) {
      history.replaceChildren();
      const older=insights.filter(entry=>entry.id!==item.id);
      if(older.length) {
        const heading=document.createElement('h5'); heading.className='profile-insight-history-title'; heading.textContent='Saved analysis history'; history.appendChild(heading);
        older.forEach(entry=>{
          const button=document.createElement('button'); button.type='button'; button.className='profile-insight-history-item';
          button.dataset.insightId=entry.id; button.setAttribute('aria-pressed', entry.id===item.id ? 'true':'false');
          const date=new Date(entry.createdAt).toLocaleDateString();
          const label=entry.summary || 'Profile analysis';
          button.textContent=`${date} · ${entry.status.toUpperCase()} · ${label.slice(0,105)}`;
          button.addEventListener('click',()=>{activeInsightId=entry.id;renderInsights();});
          history.appendChild(button);
        });
      }
    }
  }
  // Present My Profile as a dedicated, accessible full-screen dialog instead of
  // scrolling users to a long form at the bottom of Settings.
  let profileModal = null;
  let previouslyFocused = null;
  if (panel && !document.getElementById('personal-profile-modal')) {
    profileModal = document.createElement('div');
    profileModal.id = 'personal-profile-modal';
    profileModal.className = 'personal-profile-modal';
    profileModal.hidden = true;
    profileModal.setAttribute('role', 'dialog');
    profileModal.setAttribute('aria-modal', 'true');
    profileModal.setAttribute('aria-labelledby', 'personal-profile-title');
    const dialog = document.createElement('div');
    dialog.className = 'personal-profile-modal-dialog';
    const topbar = document.createElement('div');
    topbar.className = 'personal-profile-modal-topbar';
    const label = document.createElement('span');
    label.textContent = 'SYSTEM / PERSONALIZATION CORE';
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'personal-profile-modal-close';
    close.setAttribute('aria-label', 'Close My Profile'); close.textContent = '✕  Close';
    topbar.append(label, close);
    dialog.append(topbar, panel);
    profileModal.append(dialog);
    document.body.append(profileModal);
    const closeModal = () => {
      if (!profileModal || profileModal.hidden) return;
      profileModal.hidden = true;
      document.body.classList.remove('profile-modal-open');
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    };
    close.addEventListener('click', closeModal);
    profileModal.addEventListener('click', event => { if (event.target === profileModal) closeModal(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !profileModal.hidden) closeModal();
      if (event.key === 'Tab' && !profileModal.hidden) {
        const focusable = [...profileModal.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')].filter(node => node.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    document.getElementById('open-personal-profile')?.addEventListener('click', event => {
      previouslyFocused = event.currentTarget;
      profileModal.hidden = false;
      document.body.classList.add('profile-modal-open');
      close.focus();
    });
  }
  form.addEventListener('input', scheduleSave); form.addEventListener('change', scheduleSave);
  form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(saveTimer); persist(false); });
  document.getElementById('export-personal-profile')?.addEventListener('click', () => {
    clearTimeout(saveTimer); const data = makeData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'system-personal-profile.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Profile, sharing settings and insights exported — keep the file private');
  });
  document.getElementById('import-personal-profile')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0]; if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('File too large');
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid profile');
      fields.forEach(name => { if (typeof data[name] === 'string' && form.elements[name]) form.elements[name].value = data[name].slice(0, 12000); });
      // Never treat a legacy profile without the consent envelope as permission to share.
      applyPreferences(Object.prototype.hasOwnProperty.call(data,'aiPreferences') ? data.aiPreferences : defaultPreferences);
      loadInsights(data.insights);
      clearTimeout(saveTimer); if (!persist(false)) throw new Error('Could not save imported profile');
      renderInsights(); setStatus('Profile imported and saved. AI sharing is off unless the imported file explicitly opted in.');
    } catch (error) { setStatus('Import failed — choose a valid SYSTEM profile JSON file'); }
    finally { fileInput.value = ''; }
  });
  document.getElementById('clear-personal-profile')?.addEventListener('click', () => {
    if (!window.confirm('Delete your saved personal profile, AI sharing preferences and profile insights from this browser? This cannot be undone unless you exported a backup.')) return;
    clearTimeout(saveTimer);
    try { localStorage.removeItem(KEY); form.reset(); insights=[]; activeInsightId=''; applyPreferences(defaultPreferences); renderInsights(); lastSaved=''; renderMetrics(); setStatus('Profile and profile insights deleted'); }
    catch (error) { setStatus('Could not delete profile'); }
  });
  el('profile-build-local-brief')?.addEventListener('click', () => {
    const brief=el('profile-local-brief'), output=el('profile-local-brief-output');
    if (output) output.textContent=buildLocalBrief(); if (brief) { brief.hidden=false; brief.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'}); }
    setAIStatus('Local brief built on this device only. Nothing was sent to an AI provider.');
  });
  el('profile-analyze-with-ai')?.addEventListener('click', async () => {
    clearTimeout(saveTimer); persist(true);
    const prefs=readPreferences();
    if (!prefs.consent) { setAIStatus('Enable profile sharing first. This action sends selected context to the connected AI provider.'); el('profile-ai-consent')?.focus(); return; }
    const context=getAIContext();
    if (!context) { setAIStatus('Select at least one non-empty profile context category before analysis.'); return; }
    if (typeof window.callActiveAI!=='function') { setAIStatus('AI core is not ready yet. Wait for SYSTEM AI to finish loading, then retry.'); return; }
    if (typeof window.isActiveAIProviderReady==='function' && !window.isActiveAIProviderReady()) { setAIStatus('Connect Groq in the AI workspace first. No profile context was sent.'); return; }
    const button=el('profile-analyze-with-ai'); const old=button?.textContent;
    if(button){button.disabled=true;button.textContent='Analyzing…';}
    setAIStatus('Sending only your selected context to the connected provider for this requested analysis…');
    const prompt='Analyze the personal context explicitly selected by the user and attached to this request. Return a JSON object with keys: summary (string), strengths (array of strings), priorityGaps (array), recommendedActions (array), assumptionsToConfirm (array). Be rigorous, practical, non-diagnostic, avoid certainty beyond evidence, separate user-stated facts from hypotheses, prioritize at most 3 high-value actions, do not invent user history, and do not claim tasks were completed. Keep suggestions achievable and respect the stated boundaries and personal rules.';
    try {
      const answer=await window.callActiveAI(prompt,false,{jsonMode:true});
      let raw; try { raw=JSON.parse(answer); } catch(_) { raw={summary:answer, strengths:[],priorityGaps:[],recommendedActions:[],assumptionsToConfirm:['The provider did not return structured JSON; review this text manually.']}; }
      const item=safeInsight({...raw,source:'ai',status:'proposed',createdAt:new Date().toISOString()});
      if(!item) throw new Error('The provider response could not be interpreted.');
      insights.unshift(item); insights=insights.slice(0,12); activeInsightId=item.id; persist(true); renderInsights();
      setAIStatus('Analysis received. Review it below; no insight changes skill levels, XP or quests automatically.');
      el('profile-ai-insights')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
    } catch(error) { setAIStatus(`AI analysis failed: ${String(error?.message||'unknown error').slice(0,400)}. Your profile remains saved locally.`); }
    finally { if(button){button.disabled=false;button.textContent=old||'Analyze with connected AI';} }
  });
  function setInsightStatus(statusValue) {
    const current=insights.find(item=>item.id===activeInsightId); if(!current)return;
    current.status=statusValue; persist(true); renderInsights();
  }
  el('profile-insights-confirm')?.addEventListener('click',()=>setInsightStatus('reviewed'));
  el('profile-insights-reject')?.addEventListener('click',()=>setInsightStatus('inaccurate'));
  el('profile-clear-insights')?.addEventListener('click',()=>{
    if(!insights.length)return;
    if(!window.confirm('Delete saved profile insight analyses from this browser?'))return;
    insights=[];activeInsightId='';persist(false);renderInsights();
  });
  window.SystemPersonalization = Object.freeze({
    getAIContext,
    getPreferences: () => clone(readPreferences()),
    getProfileSnapshot: () => ({...readForm()}),
    getInsights: () => clone(insights),
    buildLocalBrief,
    isSharingEnabled: () => Boolean(readPreferences().consent)
  });
  window.addEventListener('beforeunload', () => {
    if (lastSaved && snapshotForm() !== lastSaved) { clearTimeout(saveTimer); persist(true); }
  });
  load();
})();
