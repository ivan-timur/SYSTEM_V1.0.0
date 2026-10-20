/* SYSTEM — Grok workspace feature port (vanilla JS, bilingual, additive). */
(() => {
  'use strict';
  const KEY='system_v39_grok_suite';
  const defaults={theme:'dusk',ownedThemes:['dusk'],crystals:0,credited:{daily:0,boss:0,achievement:0},titles:['novice'],equipped:'novice',chestDate:'',notes:[],chat:[],lastCounters:{}};
  const read=()=>{
    try {
      const raw=JSON.parse(localStorage.getItem(KEY)||'{}');
      const saved=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
      const value={...defaults,...saved};
      value.ownedThemes=Array.isArray(value.ownedThemes)?value.ownedThemes.filter(x=>typeof x==='string'&&x.length<=32).slice(0,20):defaults.ownedThemes.slice();
      value.titles=Array.isArray(value.titles)?value.titles.filter(x=>typeof x==='string'&&x.length<=32).slice(0,50):defaults.titles.slice();
      value.crystals=Math.max(0,Math.min(9999,Math.floor(Number(value.crystals)||0)));
      value.notes=Array.isArray(value.notes)?value.notes.filter(n=>n&&typeof n==='object').slice(-100).map((n,i)=>({id:String(n.id??`note-${i}`).slice(0,100),title:String(n.title??'').slice(0,200),body:String(n.body??'').slice(0,8000),at:Number.isFinite(Number(n.at))?Number(n.at):Date.now()})):[];
      value.chat=Array.isArray(value.chat)?value.chat.filter(m=>m&&typeof m==='object').slice(-16).map(m=>({role:m.role==='user'?'user':'assistant',content:String(m.content??'').slice(0,10000),at:Number.isFinite(Number(m.at))?Number(m.at):Date.now()})):[];
      value.credited=value.credited&&typeof value.credited==='object'&&!Array.isArray(value.credited)?value.credited:{};
      value.lastCounters=value.lastCounters&&typeof value.lastCounters==='object'&&!Array.isArray(value.lastCounters)?value.lastCounters:{};
      value.theme=['dusk','ember','verdant','amethyst','frost'].includes(value.theme)?value.theme:defaults.theme;
      value.equipped=['novice','scholar','warden','maker','myth'].includes(value.equipped)?value.equipped:defaults.equipped;
      value.chestDate=typeof value.chestDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.chestDate)?value.chestDate:'';
      return value;
    } catch(_) { return {...defaults,ownedThemes:defaults.ownedThemes.slice(),titles:defaults.titles.slice(),notes:[],chat:[]}; }
  };
  let state=read();
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){console.warn('Grok Suite save failed',e);}};
  const lang=()=>document.body.dataset.systemLanguage==='fa'?'fa':'en';
  const sys=()=>typeof systemState!=='undefined'?systemState:null;
  const prog=()=>typeof systemProgress!=='undefined'?systemProgress:{};
  const rewards=()=>typeof rewardState!=='undefined'?rewardState:null;
  const tx=(en,fa)=>lang()==='fa'?fa:en;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const themes=[{id:'dusk',en:'Dusk',fa:'غروب',cost:0,detailEn:'Original deep blue',detailFa:'آبی تیرهٔ اصلی'},{id:'ember',en:'Ember',fa:'اخگر',cost:12,detailEn:'Warm orange accent',detailFa:'رنگ نارنجی گرم'},{id:'verdant',en:'Verdant',fa:'سبزینه',cost:12,detailEn:'Calm green accent',detailFa:'رنگ سبز آرام'},{id:'amethyst',en:'Amethyst',fa:'یاقوت',cost:18,detailEn:'Royal violet accent',detailFa:'رنگ بنفش سلطنتی'},{id:'frost',en:'Frost',fa:'یخ',cost:18,detailEn:'Cool silver accent',detailFa:'رنگ نقره‌ای سرد'}];
  const titles=[{id:'novice',en:'Novice',fa:'نوآموز',detailEn:'Available from the start',detailFa:'از آغاز باز است',ready:()=>true},{id:'scholar',en:'Scholar',fa:'پژوهشگر',detailEn:'Reach Player Level 6',detailFa:'رسیدن به سطح ۶',ready:()=>Number(sys()?.player?.level||1)>=6},{id:'warden',en:'Streak Warden',fa:'نگهبان زنجیره',detailEn:'Reach a 7-day streak',detailFa:'زنجیرهٔ ۷ روزه',ready:()=>streak()>=7},{id:'maker',en:'Maker',fa:'سازنده',detailEn:'Complete 25 quests',detailFa:'تکمیل ۲۵ مأموریت',ready:()=>Number(prog().totalDailyQuestsCompleted||0)>=25},{id:'myth',en:'Mythic',fa:'افسانه‌ای',detailEn:'Reach Rank S',detailFa:'رسیدن به رتبهٔ S',ready:()=>String(sys()?.player?.rank||'E')==='S'}];
  function streak(){try{return Number(JSON.parse(localStorage.getItem('system_v2_quest_streak')||'{}').streak)||0}catch(_){return 0}}
  function syncCrystals(){const p=prog();const d=Number(p.totalDailyQuestsCompleted)||0,b=Number(p.totalBossQuestsCompleted)||0,a=Array.isArray(rewards()?.claimed)?rewards().claimed.filter(x=>String(x).startsWith('achievement-')).length:0;const cd=state.credited||{daily:0,boss:0,achievement:0};if(d>cd.daily)state.crystals+=d-cd.daily;if(b>cd.boss)state.crystals+=(b-cd.boss)*3;if(a>cd.achievement)state.crystals+=(a-cd.achievement)*2;state.credited={daily:d,boss:b,achievement:a};state.crystals=Math.max(0,Math.min(9999,Number(state.crystals)||0));save();}
  function applyTheme(){document.documentElement.dataset.grokTheme=state.theme;document.body.dataset.grokTheme=state.theme;}
  function addNote(tool,title,body){state.notes.unshift({id:'n'+Date.now(),tool,title,body,at:new Date().toISOString()});state.notes=state.notes.slice(0,12);save();}
  function draft(tool,raw){const text=raw.trim().slice(0,280);const stats=window.systemState?.stats||{};const weakest=Object.entries(stats).sort((a,b)=>(Number(a[1]?.level)||1)-(Number(b[1]?.level)||1))[0]?.[0]||'mathematics';
    if(tool==='math')return {title:(text?'Math: '+text.slice(0,42):'Step-by-step math sheet'),stat:'mathematics',body:[text?'Problem: '+text:'Write the problem precisely.','1. Separate the given information from what is required.','2. Write the relationship or formula before substituting numbers.','3. Explain the reason for each step.','4. Check units, signs, and one test case.','The sheet guides your work; it does not claim you solved it.'].join('\n')};
    if(tool==='code')return {title:(text?'Code: '+text.slice(0,42):'Small program and test'),stat:'computer',body:[text?'Task: '+text:'Describe a small task in one sentence.','Identify input, expected output, and one invalid input.','Write pseudocode before code. Improve one unclear name.','Run the invalid input and record what happened.'].join('\n')};
    if(tool==='idea')return {title:(text?'Idea: '+text.slice(0,42):'Problem to experiment'),stat:'entrepreneurship',body:[text?'Idea/problem: '+text:'Name a real problem.','Who has this problem, and what evidence shows it matters?','Write one hypothesis and a low-cost test you can run this week.'].join('\n')};
    return {title:'Plan: '+new Date().toLocaleDateString(),stat:weakest,body:[`Suggested focus: ${stats[weakest]?.name||weakest}, currently one of your lowest recorded skills.`,'Block 1: 25 minutes on one easy open quest.','Block 2: 25 minutes on a written problem or practical exercise.','Block 3: 10 minutes reviewing mistakes without extra tools.',text?'Your note: '+text:'Add a specific topic to personalize this plan.'].join('\n')};
  }
  let lastStudyTrigger = null;

  function mountStudy() {
    const ai = document.getElementById('ai-page');
    if (!ai || document.getElementById('grok-study-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'grok-study-modal';
    modal.className = 'grok-study-modal';
    modal.hidden = true;

    const backdrop = document.createElement('div');
    backdrop.className = 'grok-study-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    const section = document.createElement('section');
    section.id = 'grok-study-suite';
    section.className = 'grok-suite-panel grok-study-dialog';
    section.setAttribute('role', 'dialog');
    section.setAttribute('aria-modal', 'true');
    section.setAttribute('aria-labelledby', 'grok-study-title');
    section.setAttribute('tabindex', '-1');
    section.innerHTML = `<button type="button" class="grok-study-close" data-study-close aria-label="Close Study Desk" title="Close">×</button><div class="grok-suite-head"><div><p class="grok-eyebrow">SYSTEM · ADVANCED WORKSPACE</p><h2 id="grok-study-title">${tx('Study Desk & Live Mentor','میز مطالعه و مربی زنده')}</h2><p>${tx('Build structured work sheets, save notes, and ask Groq with your current progress as context.','برگه‌های منظم بسازید، یادداشت‌ها را ذخیره کنید و با زمینهٔ پیشرفت فعلی از Groq بپرسید.')}</p></div><span class="grok-gem" aria-hidden="true">✦</span></div><div class="grok-tabs" role="tablist" aria-label="Study workspace"><button type="button" data-grok-tab="desk" class="active" role="tab" aria-selected="true">${tx('Study Desk','میز مطالعه')}</button><button type="button" data-grok-tab="mentor" role="tab" aria-selected="false">${tx('Live Mentor','مربی زنده')}</button><button type="button" data-grok-tab="notes" role="tab" aria-selected="false">${tx('Saved Notes','یادداشت‌ها')}</button></div><div data-grok-view="desk" role="tabpanel"><div class="grok-tools"><button type="button" data-tool="math" class="active">${tx('Math','ریاضی')}</button><button type="button" data-tool="code">${tx('Code','کدنویسی')}</button><button type="button" data-tool="idea">${tx('Idea','ایده')}</button><button type="button" data-tool="plan">${tx('Plan','برنامه')}</button></div><p class="grok-hint" id="grok-desk-hint">${tx('Turn a problem into a clear sequence of steps.','مسئله را به قدم‌های روشن تبدیل کنید.')}</p><textarea id="grok-desk-input" maxlength="280" placeholder="${tx('Topic, problem, or project...','موضوع، مسئله یا پروژه...')}" aria-label="${tx('Topic, problem, or project...','موضوع، مسئله یا پروژه...')}"></textarea><div class="grok-actions"><button type="button" id="grok-build-sheet" class="grok-primary">${tx('Build Sheet','ساخت برگه')}</button><button type="button" id="grok-pin-sheet" class="grok-secondary" disabled>${tx('Add as Custom Quest','افزودن به مأموریت دلخواه')}</button></div><pre id="grok-sheet-output" class="grok-sheet" hidden></pre></div><div data-grok-view="mentor" role="tabpanel" hidden><p class="grok-hint">${tx('Uses your connected Groq model. If disconnected, a local study-planning answer is provided.','از مدل متصل Groq استفاده می‌کند. اگر وصل نباشد، پاسخ محلی برای برنامه‌ریزی درسی داده می‌شود.')}</p><div id="grok-mentor-log" class="grok-mentor-log" aria-live="polite"></div><textarea id="grok-mentor-input" maxlength="800" placeholder="${tx('Ask about your goals, weak skills, or next steps...','دربارهٔ هدف‌ها، مهارت‌های ضعیف یا قدم بعدی بپرسید...')}" aria-label="${tx('Ask about your goals, weak skills, or next steps...','دربارهٔ هدف‌ها، مهارت‌های ضعیف یا قدم بعدی بپرسید...')}"></textarea><div class="grok-actions"><button type="button" id="grok-mentor-send" class="grok-primary">${tx('Ask Mentor','پرسش از مربی')}</button><button type="button" id="grok-mentor-clear" class="grok-secondary">${tx('Clear Chat','پاک‌کردن گفت‌وگو')}</button></div><p id="grok-mentor-status" class="grok-hint" role="status" aria-live="polite"></p></div><div data-grok-view="notes" role="tabpanel" hidden><div id="grok-notes-list"></div></div>`;

    modal.append(backdrop, section);
    document.body.appendChild(modal);

    let tool = 'math', lastSheet = null;
    section.querySelector('.grok-study-close').addEventListener('click', closeStudyModal);
    backdrop.addEventListener('click', closeStudyModal);

    section.querySelectorAll('[data-grok-tab]').forEach(button => button.addEventListener('click', () => {
      section.querySelectorAll('[data-grok-tab]').forEach(tab => {
        const active = tab === button;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      section.querySelectorAll('[data-grok-view]').forEach(view => { view.hidden = view.dataset.grokView !== button.dataset.grokTab; });
      if (button.dataset.grokTab === 'notes') renderNotes();
      if (button.dataset.grokTab === 'mentor') renderChat();
    }));

    section.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => {
      tool = button.dataset.tool;
      section.querySelectorAll('[data-tool]').forEach(item => item.classList.toggle('active', item === button));
      const hint = section.querySelector('#grok-desk-hint');
      const hints = {
        math: tx('Turn a problem into a clear sequence of steps.', 'مسئله را به قدم‌های روشن تبدیل کنید.'),
        code: tx('Define the input, expected output, and one test case.', 'ورودی، خروجی مورد انتظار و یک مورد آزمایش را مشخص کنید.'),
        idea: tx('Turn an idea into a hypothesis you can test cheaply.', 'ایده را به فرضیه‌ای تبدیل کنید که با هزینهٔ کم آزمایش شود.'),
        plan: tx('Create a realistic study plan based on your current progress.', 'بر پایهٔ پیشرفت فعلی خود یک برنامهٔ واقع‌بینانه بسازید.')
      };
      if (hint) hint.textContent = hints[tool] || hints.math;
    }));

    section.querySelector('#grok-build-sheet').addEventListener('click', () => {
      lastSheet = draft(tool, section.querySelector('#grok-desk-input').value);
      const output = section.querySelector('#grok-sheet-output');
      output.textContent = lastSheet.body;
      output.hidden = false;
      section.querySelector('#grok-pin-sheet').disabled = false;
      addNote(tool, lastSheet.title, lastSheet.body);
    });

    section.querySelector('#grok-pin-sheet').addEventListener('click', () => {
      if (!lastSheet) return;
      let list = [];
      try {
        const stored = JSON.parse(localStorage.getItem('system_v2_custom_quests') || '[]');
        list = Array.isArray(stored) ? stored : [];
      } catch (_) { list = []; }
      list.push({ id: 'grok-' + Date.now(), title: lastSheet.title, description: lastSheet.body.slice(0, 180), xp: 50, coins: 10, completed: false, createdAt: new Date().toISOString() });
      try {
        localStorage.setItem('system_v2_custom_quests', JSON.stringify(list));
        if (typeof window.renderCustomQuests === 'function') window.renderCustomQuests();
        if (typeof window.notifySystem === 'function') window.notifySystem(tx('Study sheet saved as a custom quest.', 'برگهٔ مطالعه به مأموریت دلخواه افزوده شد.'));
      } catch (_) {
        if (typeof window.notifySystem === 'function') window.notifySystem(tx('Could not save the quest; check browser storage.', 'ذخیرهٔ مأموریت ناموفق بود؛ فضای ذخیره‌سازی مرورگر را بررسی کنید.'));
      }
    });

    section.querySelector('#grok-mentor-send').addEventListener('click', sendMentor);
    section.querySelector('#grok-mentor-input').addEventListener('keydown', event => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        sendMentor();
      }
    });
    section.querySelector('#grok-mentor-clear').addEventListener('click', () => { state.chat = []; save(); renderChat(); });
    renderChat();
    installStudyModalControls();
  }

  function openStudyModal(trigger) {
    const modal = document.getElementById('grok-study-modal');
    const section = document.getElementById('grok-study-suite');
    if (!modal || !section) return;
    lastStudyTrigger = trigger || document.activeElement;
    modal.hidden = false;
    document.body.classList.add('grok-modal-open');
    document.querySelectorAll('[data-open-study]').forEach(button => button.setAttribute('aria-expanded', 'true'));
    const firstTab = section.querySelector('[data-grok-tab="desk"]');
    if (firstTab) firstTab.focus();
    else section.focus();
  }

  function closeStudyModal() {
    const modal = document.getElementById('grok-study-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('grok-modal-open');
    document.querySelectorAll('[data-open-study]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (lastStudyTrigger && lastStudyTrigger.isConnected && typeof lastStudyTrigger.focus === 'function') lastStudyTrigger.focus();
  }

  function installStudyModalControls() {
    if (document.documentElement.dataset.grokStudyModalBound === 'true') return;
    document.documentElement.dataset.grokStudyModalBound = 'true';
    document.addEventListener('click', event => {
      const target = event.target;
      const trigger = target instanceof Element ? target.closest('[data-open-study]') : null;
      if (trigger) {
        event.preventDefault();
        openStudyModal(trigger);
      }
    });
    document.addEventListener('keydown', event => {
      const modal = document.getElementById('grok-study-modal');
      if (!modal || modal.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeStudyModal();
        return;
      }
      if (event.key !== 'Tab') return;
      const section = document.getElementById('grok-study-suite');
      if (!section) return;
      const focusable = Array.from(section.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(item => !item.closest('[hidden]'));
      if (!focusable.length) {
        event.preventDefault();
        section.focus();
        return;
      }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !section.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !section.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    });
  }

  async function sendMentor(){const input=document.getElementById('grok-mentor-input'),status=document.getElementById('grok-mentor-status');const text=input?.value.trim();if(!text)return;input.value='';state.chat.push({role:'user',content:text,at:Date.now()});state.chat=state.chat.slice(-16);save();renderChat();const snap=sys()||{};const stats=Object.entries(snap.stats||{}).map(([k,v])=>`${v.name||k}: Lv ${v.level||1}`).join(', ');const context=`Player level ${snap.player?.level||1}, rank ${snap.player?.rank||'E'}, coins ${snap.player?.coins||0}. Skills: ${stats}. Recent progress: ${JSON.stringify(window.systemProgress||{}).slice(0,900)}.`;if(status)status.textContent=tx('Thinking…','در حال فکر کردن…');const btn=document.getElementById('grok-mentor-send');if(btn)btn.disabled=true;let answer='';try{if(typeof window.callGroq==='function'&&typeof systemGroqApiKey!=='undefined'&&systemGroqApiKey){answer=await window.callGroq(text,false,{context:'Be a concise, age-appropriate study and self-improvement mentor. Prefer numbered actionable steps. Never claim the user completed anything.\n'+context+'\nRecent conversation: '+state.chat.slice(-6).map(x=>x.role+': '+x.content).join('\n')});}else{answer=localAnswer(text,context);if(status)status.textContent=tx('Groq is not connected; local guidance was used.','Groq وصل نیست؛ راهنمایی محلی استفاده شد.');}}catch(e){answer=localAnswer(text,context);if(status)status.textContent=tx('Groq request failed; local guidance was used.','درخواست Groq ناکام شد؛ راهنمایی محلی استفاده شد. ') +(e?.message||'');}state.chat.push({role:'assistant',content:answer,at:Date.now()});state.chat=state.chat.slice(-16);save();renderChat();if(btn)btn.disabled=false;}
  function localAnswer(q,context){const fa=lang()==='fa';return (fa?'راهنمایی محلی سیستم\n\n':'Local SYSTEM guidance\n\n')+(fa?'۱. پرسش را به یک نتیجهٔ روشن تبدیل کن.\n۲. کار را به قدم‌های ۲۵ دقیقه‌ای تقسیم کن.\n۳. نتیجه را ثبت کن و پس از انجام واقعی، مأموریت را تکمیل کن.\n\nوضعیت فعلی: ':'1. Define one measurable outcome.\n2. Split it into 25-minute work blocks.\n3. Record evidence, then mark a quest complete only after doing it.\n\nCurrent snapshot: ')+context;}
  function renderChat(){const box=document.getElementById('grok-mentor-log');if(!box)return;box.innerHTML=state.chat.map(m=>{const role=m&&m.role==='user'?'user':'assistant';return `<article class="grok-chat-line ${role}"><b>${role==='user'?tx('You','شما'):tx('Mentor','مربی')}</b><p>${esc(m&&m.content)}</p></article>`;}).join('')||`<p class="grok-hint">${tx('No messages yet. Ask for one useful next step.','هنوز پیامی نیست. یک قدم مفید بعدی بپرسید.')}</p>`;box.scrollTop=box.scrollHeight;}
  function renderNotes(){const box=document.getElementById('grok-notes-list');if(!box)return;box.innerHTML=state.notes.map(n=>`<article class="grok-note"><div><b>${esc(n.title)}</b><small>${esc(new Date(n.at).toLocaleString())}</small></div><pre>${esc(n.body)}</pre><button data-del-note="${esc(n.id)}">${tx('Delete','حذف')}</button></article>`).join('')||`<p class="grok-hint">${tx('Your saved study sheets will appear here.','برگه‌های ذخیره‌شدهٔ مطالعه در اینجا دیده می‌شوند.')}</p>`;box.querySelectorAll('[data-del-note]').forEach(b=>b.addEventListener('click',()=>{state.notes=state.notes.filter(n=>n.id!==b.dataset.delNote);save();renderNotes();}));}
  function mountRewards(){const page=document.getElementById('status-page');if(!page||document.getElementById('grok-rewards-suite'))return;const sec=document.createElement('section');sec.id='grok-rewards-suite';sec.className='grok-suite-panel';sec.innerHTML=`<div class="grok-suite-head"><div><p class="grok-eyebrow">GROK WORKSPACE · PLUS FEATURES</p><h2>${tx('Workspace Themes & Titles','تم‌های محیط کار و عنوان‌ها')}</h2><p>${tx('Earn crystals through recorded progress, unlock workspace accent themes and equip titles.','با ثبت پیشرفت بلور بگیر، تم‌های تأکیدی محیط کار را باز کن و عنوان انتخاب کن.')}</p></div><div class="grok-gem"><b id="grok-crystal-count">0</b></div></div><div class="grok-subsection"><h3>${tx('Workspace Accent Themes','تم‌های تأکیدی محیط کار')}</h3><div id="grok-theme-grid" class="grok-theme-grid"></div></div><div class="grok-subsection"><h3>${tx('Player Titles','عنوان‌های بازیکن')}</h3><div id="grok-title-list" class="grok-title-list"></div></div><div class="grok-subsection grok-chest"><div><h3>${tx('Night Chest','صندوق شب')}</h3><p>${tx('Unlock after a 5-day quest streak; claim once every 7 days. A 7-day streak grants more crystals.','پس از زنجیرهٔ ۵ روزه باز می‌شود؛ هر ۷ روز یک‌بار. زنجیرهٔ ۷ روزه بلور بیشتری می‌دهد.')}</p></div><button id="grok-open-chest" class="grok-primary">${tx('Open Chest','بازکردن صندوق')}</button></div>`;page.appendChild(sec);renderPlus();sec.querySelector('#grok-open-chest').addEventListener('click',claimChest);}
  function renderPlus(){const count=document.getElementById('grok-crystal-count'),tg=document.getElementById('grok-theme-grid'),tl=document.getElementById('grok-title-list');if(count)count.textContent=String(state.crystals);if(tg)tg.innerHTML=themes.map(t=>{const owned=state.ownedThemes.includes(t.id),active=state.theme===t.id;return `<button type="button" class="grok-theme-card ${active?'active':''}" data-theme-buy="${esc(t.id)}" aria-pressed="${active}"><b>${esc(lang()==='fa'?t.fa:t.en)}</b><span>${esc(lang()==='fa'?t.detailFa:t.detailEn)}</span><small>${active?tx('Active','فعال'):owned?tx('Owned','خریده‌شده'):t.cost===0?tx('Free','رایگان'):`${t.cost} crystals`}</small></button>`}).join('');tg?.querySelectorAll('[data-theme-buy]').forEach(b=>b.addEventListener('click',()=>buyTheme(b.dataset.themeBuy)));if(tl)tl.innerHTML=titles.map(t=>{const owned=state.titles.includes(t.id),ready=t.ready(),active=state.equipped===t.id;return `<article class="grok-title-card"><div><b>${esc(lang()==='fa'?t.fa:t.en)}</b><p>${esc(lang()==='fa'?t.detailFa:t.detailEn)}</p></div><button data-title="${esc(t.id)}" ${!owned&&!ready?'disabled':''}>${active?tx('Equipped','فعال روی کارت'):owned?tx('Equip','انتخاب'):tx('Unlock','بازکردن')}</button></article>`}).join('');tl?.querySelectorAll('[data-title]').forEach(b=>b.addEventListener('click',()=>{const t=titles.find(x=>x.id===b.dataset.title);if(!t)return;if(!state.titles.includes(t.id)&&!t.ready())return;if(!state.titles.includes(t.id))state.titles.push(t.id);state.equipped=t.id;save();renderPlus();if(typeof window.notifySystem==='function')window.notifySystem(tx('Player title updated.','عنوان بازیکن تغییر کرد.'));}));applyTheme();}
  function buyTheme(id){const t=themes.find(x=>x.id===id);if(!t)return;if(!state.ownedThemes.includes(id)){if(state.crystals<t.cost){window.notifySystem?.(tx('Not enough crystals. Complete quests and claim achievements first.','بلور کافی نیست. نخست مأموریت‌ها و نشان‌ها را تکمیل کن.'));return;}state.crystals-=t.cost;state.ownedThemes.push(id);}state.theme=id;save();renderPlus();window.notifySystem?.(tx('Theme activated.','تم فعال شد.'));}
  function claimChest(){syncCrystals();const today=new Date().toLocaleDateString('en-CA');if(streak()<5){window.notifySystem?.(tx('Reach a 5-day quest streak to unlock the chest.','برای بازکردن صندوق، زنجیرهٔ ۵ روزه بساز.'));return;}if(state.chestDate){const gap=Math.floor((new Date(today)-new Date(state.chestDate))/86400000);if(gap<7){window.notifySystem?.(tx(`${7-gap} days until the next chest.`,`تا صندوق بعدی ${7-gap} روز مانده است.`));return;}}const gain=streak()>=7?8:4;state.crystals=Math.min(9999,state.crystals+gain);state.chestDate=today;save();renderPlus();window.notifySystem?.(tx(`Night Chest opened: +${gain} crystals.`,`صندوق شب باز شد: ${gain} بلور دریافت شد.`));}
  function mountProgress(){const page=document.getElementById('status-page');if(!page||document.getElementById('grok-progress-suite'))return;const sec=document.createElement('section');sec.id='grok-progress-suite';sec.className='grok-suite-panel';sec.innerHTML=`<div class="grok-suite-head"><div><p class="grok-eyebrow">SYSTEM · PROGRESS INTELLIGENCE</p><h2>${tx('Momentum, Focus & History','شتاب، تمرکز و تاریخچه')}</h2><p>${tx('A live snapshot of your activity and a focus timer.','نمای زندهٔ فعالیت و زمان‌سنج تمرکز.')}</p></div><span class="grok-gem" id="grok-momentum">0 / 100</span></div><div class="grok-progress-grid"><div class="grok-progress-card"><h3>${tx('Weekly Activity','فعالیت هفتگی')}</h3><div id="grok-week-bars"></div></div><div class="grok-progress-card"><h3>${tx('Focus Timer','زمان‌سنج تمرکز')}</h3><div class="grok-timer" id="grok-timer-display">25:00</div><div class="grok-actions"><button class="grok-primary" id="grok-timer-start">${tx('Start 25 min','شروع ۲۵ دقیقه')}</button><button class="grok-secondary" id="grok-timer-pause">${tx('Pause','توقف')}</button><button class="grok-secondary" id="grok-timer-reset">${tx('Reset','از نو')}</button></div><p class="grok-hint">${tx('Timer supports focus; it does not automatically complete quests.','زمان‌سنج به تمرکز کمک می‌کند؛ مأموریت را خودکار تکمیل نمی‌کند.')}</p></div></div><div class="grok-subsection"><h3>${tx('Recent Activity','فعالیت‌های اخیر')}</h3><div id="grok-history-list"></div></div>`;page.appendChild(sec);let timer={remaining:1500,ends:0,running:false};try{const saved=JSON.parse(localStorage.getItem('system_v39_focus_timer')||'null');if(saved&&typeof saved==='object'&&!Array.isArray(saved)){const remaining=Number(saved.remaining),ends=Number(saved.ends);timer={remaining:Number.isFinite(remaining)?Math.max(0,Math.min(1500,Math.floor(remaining))):1500,ends:Number.isFinite(ends)&&ends>=0?ends:0,running:saved.running===true};if(timer.running&&(!timer.ends||timer.ends<=Date.now())){timer.remaining=0;timer.running=false;timer.ends=0;}}}catch(_){};let interval=null;const display=sec.querySelector('#grok-timer-display');function tick(){if(timer.running){timer.remaining=Math.max(0,Math.min(1500,Math.ceil((timer.ends-Date.now())/1000)));if(timer.remaining<=0){timer.running=false;timer.ends=0;clearInterval(interval);interval=null;window.notifySystem?.(tx('Focus block complete. Take a short break, then log your work.','بلاک تمرکز تکمیل شد. کمی استراحت کن و سپس کارت را ثبت کن.'));}saveTimer();}const m=Math.floor(timer.remaining/60),r=timer.remaining%60;if(display)display.textContent=String(m).padStart(2,'0')+':'+String(r).padStart(2,'0');}function saveTimer(){try{localStorage.setItem('system_v39_focus_timer',JSON.stringify(timer));return true;}catch(_){return false;}}sec.querySelector('#grok-timer-start').addEventListener('click',()=>{if(timer.remaining<=0)timer.remaining=1500;timer.running=true;timer.ends=Date.now()+timer.remaining*1000;saveTimer();if(!interval)interval=setInterval(tick,500);tick();});sec.querySelector('#grok-timer-pause').addEventListener('click',()=>{if(timer.running)timer.remaining=Math.max(0,Math.ceil((timer.ends-Date.now())/1000));timer.running=false;clearInterval(interval);interval=null;saveTimer();tick();});sec.querySelector('#grok-timer-reset').addEventListener('click',()=>{timer={remaining:1500,ends:0,running:false};clearInterval(interval);interval=null;saveTimer();tick();});if(timer.running){timer.remaining=Math.max(0,Math.ceil((timer.ends-Date.now())/1000));interval=setInterval(tick,500);}tick();renderProgress();}
  function renderProgress(){const p=prog(),m=document.getElementById('grok-momentum'),bars=document.getElementById('grok-week-bars'),hist=document.getElementById('grok-history-list');if(!m||!bars||!hist)return;const daily=Number(p.totalDailyQuestsCompleted)||0,custom=Number(p.totalCustomQuestsCompleted)||0,boss=Number(p.totalBossQuestsCompleted)||0;const momentum=Math.min(100,Math.round(Math.min(1,daily/35)*40+Math.min(1,custom/10)*20+Math.min(1,boss/5)*20+Math.min(1,streak()/7)*20));m.textContent=momentum+' / 100';let events=[];try{const parsed=JSON.parse(localStorage.getItem('system_v2_progress_history')||'[]');events=Array.isArray(parsed)?parsed.filter(e=>e&&typeof e==='object').slice(-500):[]}catch(_){};const last7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const stamp=d.toISOString().slice(0,10);const rows=events.filter(e=>String(e.at).slice(0,10)===stamp);return {label:d.toLocaleDateString(lang()==='fa'?'fa-IR':'en-US',{weekday:'short'}),count:rows.length}});const max=Math.max(1,...last7.map(x=>x.count));bars.innerHTML=last7.map(x=>`<div class="grok-week-row"><span>${esc(x.label)}</span><div class="grok-week-track"><i style="width:${Math.round(x.count/max*100)}%"></i></div><b>${x.count}</b></div>`).join('')+`<p class="grok-hint">${tx('Daily quests','مأموریت روزانه')}: ${daily} · ${tx('Custom','دلخواه')}: ${custom} · ${tx('Boss','غول')}: ${boss}</p>`;hist.innerHTML=events.slice(-8).reverse().map(e=>`<article class="grok-history-row"><div><b>${esc(e.title||e.type||'Activity')}</b><small>${esc(String(e.at||'').replace('T',' ').slice(0,16))}</small></div><span>+${Number(e.xp)||0} XP · +${Number(e.coins)||0} Coins</span></article>`).join('')||`<p class="grok-hint">${tx('Complete a quest to begin your activity history.','برای آغاز تاریخچه، یک مأموریت را تکمیل کن.')}</p>`;}
  function refresh(){syncCrystals();renderPlus();renderProgress();}
  function init(){mountStudy();mountRewards();mountProgress();applyTheme();refresh();setInterval(refresh,2500);window.addEventListener('system-language-change',()=>{const ai=document.getElementById('grok-study-modal'),rw=document.getElementById('grok-rewards-suite'),pr=document.getElementById('grok-progress-suite');if(ai){ai.remove();document.body.classList.remove('grok-modal-open');mountStudy();}if(rw){rw.remove();mountRewards();}if(pr){pr.remove();mountProgress();}renderPlus();refresh();});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
