/* SYSTEM — English / Dari interface layer.
   Additive only: preserves the existing controller and local-save contracts. */
(() => {
  "use strict";
  const KEY = "system_v39_language";
  const translations = {
    "Status":"وضعیت","Quest":"مأموریت","Rewards":"پاداش‌ها","AI":"هوش مصنوعی","Settings":"تنظیمات",
    "SKILL PROGRESSION":"روند مهارت‌ها","Select a Stat":"یک شاخه را انتخاب کنید","Select a stat to view its skills.":"برای دیدن مهارت‌ها یک شاخه را انتخاب کنید.",
    "No Skill Selected":"هیچ مهارتی انتخاب نشده","Select one of the six stats above.":"یکی از شش شاخهٔ بالا را انتخاب کنید.",
    "UNLOCKED":"بازشده","LOCKED":"قفل‌شده","All":"همه","Unlocked":"بازشده","Locked":"قفل‌شده",
    "Search skills":"جست‌وجوی مهارت‌ها","Search skills...":"جست‌وجوی مهارت‌ها...","Skill progress":"پیشرفت مهارت‌ها",
    "Filter skills":"فیلتر مهارت‌ها","Showing":"نمایش","skills":"مهارت",
    "Main Navigation":"ناوبری اصلی","SYSTEM ONLINE":"سیستم فعال است","PLAYER":"بازیکن","STATS":"آمار",
    "Level":"سطح","Rank":"رتبه","XP":"امتیاز تجربه","Coins":"سکه‌ها","Skills":"مهارت‌ها",
    "Daily Quest":"مأموریت روزانه","Boss Quest":"مأموریت غول","Custom Quest":"مأموریت دلخواه",
    "Daily Prize":"جایزه روز","DAILY MYSTERY DROP":"پاداش مخفی روزانه","Complete all six Daily Quests to reveal a random surprise reward.":"تمام ۶ مأموریت روزانه را تکمیل کنید تا یک جایزهٔ تصادفی و شگفت‌انگیز باز شود.",
    "AI Chat":"گفت‌وگوی هوش مصنوعی","Groq API":"رابط برنامه‌نویسی Groq","AI Quest":"مأموریت هوشمند",
    "Ask questions, plan, and learn.":"پرسش کنید، برنامه‌ریزی کنید و یاد بگیرید.",
    "Clear Chat":"پاک‌کردن گفت‌وگو","SYSTEM AI Core is ready. Connect Groq above. The API key stays in this browser tab only; never publish it in a project ZIP.":"هستهٔ هوش مصنوعی سیستم آماده است. Groq را از بخش بالا وصل کنید. کلید API در همین مرورگر نگه‌داری می‌شود؛ آن را در فایل ZIP پروژه منتشر نکنید.",
    "Groq API key":"کلید API گروک","Paste your Groq API key here":"کلید API گروک را اینجا وارد کنید",
    "GROQ SETUP REQUIRED · API DISCONNECTED":"تنظیم گروک لازم است · API وصل نیست","GROQ · DISCONNECTED":"گروک · وصل نیست",
    "Connect":"وصل‌کردن","Disconnect":"قطع اتصال","Save":"ذخیره","Cancel":"لغو","Close":"بستن",
    "Daily":"روزانه","Completed":"تکمیل‌شده","Complete":"تکمیل","Claim Reward":"گرفتن پاداش",
    "Your Coins":"سکه‌های شما","Store":"فروشگاه","Inventory":"گنجینه","Goals":"هدف‌ها","Roadmap":"نقشهٔ راه",
    "Theme":"تم","Change Theme →":"تغییر تم ←","Data Backup":"نسخهٔ پشتیبان اطلاعات",
    "Export your progress or restore it from a backup file.":"پیشرفت خود را صادر کنید یا از فایل پشتیبان بازیابی نمایید.",
    "Backup / Restore →":"پشتیبان‌گیری / بازیابی ←","Entrepreneurship":"کارآفرینی","Global Skills":"مهارت‌های جهانی",
    "Mathematics":"ریاضی","Computer":"کمپیوتر","Physics":"فزیک","Unique Thinking":"تفکر یگانه",
    "Easy":"آسان","Medium":"متوسط","Hard":"سخت","Send":"فرستادن","Type your message...":"پیام خود را بنویسید...",
    "Loading...":"در حال بارگذاری...","No quests available.":"فعلاً مأموریتی موجود نیست.",
    "Choose a theme. Each preset updates the interface palette, panels, controls, and accents.":"یک تم انتخاب کنید. هر تم رنگ‌بندی، پنل‌ها، کنترل‌ها و رنگ‌های تأکیدی رابط را تغییر می‌دهد.",
    "Midnight regalia, antique gold and velvet shadow":"شکوه نیمه‌شب، طلای کهنه و سایهٔ مخملی",
    "Ethereal glass, liquid metal and violet-cyan aurora":"شیشهٔ اثیری، فلز مایع و شفق بنفش-فیروزه‌ای",
    "Aether Luxe":"آتر لوکس",
    "Obsidian glass, sapphire light and champagne-gold rewards":"شیشهٔ ابسیدین، نور یاقوت‌کبود و پاداش طلای شامپاینی",
    "Original SYSTEM look":"ظاهر اصلی آبی سیستم",
    "Full cosmic artwork skin":"ظاهر هنری کامل با جلوه‌های کیهانی",
    "Deep violet-blue glow":"درخشش ژرف بنفش و آبی",
    "Cool cyan highlights":"درخشش سرد آبی فیروزه‌ای",
    "Blood-red edge light":"نور لبه‌ای سرخ و تیره",
    "Toxic-green arcane glow":"درخشش رازآلود سبز زمردی",
    "Royal amber radiance":"درخشش کهربایی سلطنتی",
    "Neon magenta bloom":"درخشش نئونی ارغوانی",
    "Personalization core":"هستهٔ شخصی‌سازی","PERSONALIZATION ENGINE":"موتور شخصی‌سازی","Connect your profile to SYSTEM AI":"پروفایل خود را به هوش مصنوعی SYSTEM وصل کنید","Use your own goals and learning preferences to make answers, study plans and mission suggestions more relevant. This is request-time context, not permanent memory stored by the AI provider.":"از هدف‌ها و ترجیحات یادگیری خود استفاده کنید تا پاسخ‌ها، برنامه‌های آموزشی و مأموریت‌ها متناسب‌تر شوند. این اطلاعات هنگام درخواست استفاده می‌شوند و حافظهٔ دائمی ارائه‌دهندهٔ هوش مصنوعی نیستند.",
    "PRIVATE BY DEFAULT":"به‌طور پیش‌فرض خصوصی","SHARING ENABLED":"اشتراک‌گذاری فعال است","Allow selected profile details to be sent to the connected AI provider":"اجازه بدهید جزئیات انتخاب‌شدهٔ پروفایل به ارائه‌دهندهٔ هوش مصنوعی وصل‌شده ارسال شود","OFF means no My Profile fields are attached to AI requests. Your actual prompt and normal chat history still follow the existing AI chat behavior.":"در حالت خاموش، هیچ فیلدی از پروفایل من به درخواست هوش مصنوعی افزوده نمی‌شود. پیام و تاریخچهٔ عادی گفت‌وگو همچنان طبق رفتار قبلی بخش هوش مصنوعی پردازش می‌شوند.",
    "Current focus":"تمرکز فعلی","Goals & vision":"هدف‌ها و چشم‌انداز","Interests":"علاقه‌مندی‌ها","Learning profile":"پروفایل یادگیری","Strengths & growth areas":"نقاط قوت و زمینه‌های رشد","Motivation":"انگیزه","North Star / mission":"قطب‌نمای اصلی / مأموریت","Identity & values":"هویت و ارزش‌ها","Schedule & constraints":"برنامهٔ زمانی و محدودیت‌ها","Personal rules":"قواعد شخصی","Boundaries":"حدومرزها","Evidence & milestones":"شواهد و نقاط عطف","Visual preferences":"ترجیحات بصری","Preferred response style":"سبک پاسخ‌گویی مطلوب","AI autonomy preference":"میزان اختیار هوش مصنوعی","Current SYSTEM level & skill snapshot":"نمای فعلی سطح و مهارت‌های SYSTEM",
    "Build private local brief":"ساخت خلاصهٔ خصوصی روی همین دستگاه","Analyze with connected AI":"تحلیل با هوش مصنوعی متصل","Clear AI insights":"پاک‌کردن تحلیل‌های هوش مصنوعی","Personal operating brief · local only":"خلاصهٔ عملیاتی شخصی · فقط محلی","AI profile analysis":"تحلیل پروفایل توسط هوش مصنوعی","Suggestions are hypotheses, not diagnoses or facts. Review them before relying on them.":"این پیشنهادها فرضیه‌اند، نه تشخیص یا حقیقت قطعی. پیش از اتکا به آن‌ها بررسی‌شان کنید.",
    "Mark as reviewed / useful":"بازبینی‌شده / مفید علامت بزن","Mark as inaccurate":"نادقیق علامت بزن","Saved analysis history":"تاریخچهٔ تحلیل‌های ذخیره‌شده","Profile sharing is off. Local profile analysis never sends data to a provider.":"اشتراک‌گذاری پروفایل خاموش است. تحلیل محلی هیچ اطلاعاتی به ارائه‌دهنده نمی‌فرستد.",
    "When sharing is enabled, only non-empty fields selected above are attached as context to AI requests. This feature does not send the profile during provider connection tests. You can turn sharing off at any time. Do not enter passwords, API keys, financial identifiers or other secrets into your profile.":"هنگام فعال‌بودن اشتراک‌گذاری، فقط فیلدهای غیرخالی انتخاب‌شده به درخواست‌های هوش مصنوعی افزوده می‌شوند. هنگام آزمایش اتصال، پروفایل ارسال نمی‌شود. هر زمان می‌توانید اشتراک‌گذاری را خاموش کنید. رمز عبور، کلید API، شناسه‌های مالی یا اطلاعات محرمانه را در پروفایل ننویسید.",
    "English":"انگلیسی","Dari":"دری","Persian":"فارسی / دری",
    "Language":"زبان","Choose the language used throughout the SYSTEM interface.":"زبان مورد استفاده در سراسر رابط SYSTEM را انتخاب کنید.",
    "TOOLS":"ابزارها","Study":"مطالعه","Code":"کدنویسی","Math":"ریاضی","Idea":"ایده","Goals":"هدف‌ها","Study Desk":"میز مطالعه",
    "Create Study Plan":"ساخت برنامهٔ مطالعه","Explain a Topic":"تشریح یک موضوع","Solve a Problem":"حل یک مسئله","Get Suggestions":"گرفتن پیشنهادها",
    "Study Analyzer":"تحلیل‌گر مطالعه","Code Helper":"دستیار کدنویسی","Math Solver":"حل‌کنندهٔ ریاضی","Idea Generator":"ایده‌پرداز","Goal Assistant":"دستیار هدف",
    "Open Study Desk":"گشودن میز مطالعه","Close Study Desk":"بستن میز مطالعه","Saved":"ذخیره‌شده","API calls":"درخواست‌های API","AI tools":"ابزارهای هوش مصنوعی","AI activity":"فعالیت هوش مصنوعی","AI message composer":"بخش نوشتن پیام هوش مصنوعی",
    "Command Deck":"مرکز فرمان","COMMAND DECK":"مرکز فرمان","Status Command Deck":"مرکز فرمان وضعیت","Status Tools":"ابزارهای وضعیت","Status tools":"ابزارهای وضعیت",
    "Progress Graph":"نمودار پیشرفت","Weekly activity, momentum & history":"فعالیت هفتگی، شتاب و تاریخچه","Focus Timer":"زمان‌سنج تمرکز","25-minute focus block":"بلاک تمرکز ۲۵ دقیقه‌ای",
    "Insights, focus & next action":"بینش، تمرکز و اقدام بعدی","Activity Ledger":"دفتر فعالیت","Review and export recorded progress":"بازبینی و صادرکردن پیشرفت ثبت‌شده",
    "Smart Roadmap":"نقشهٔ راه هوشمند","Plan milestones, priorities and deadlines":"برنامه‌ریزی نقاط عطف، اولویت‌ها و مهلت‌ها","Mastery Tracker":"ردیاب تسلط",
    "Log practice, tests, projects and evidence":"ثبت تمرین، آزمون، پروژه و شواهد","Skill Review":"بازبینی مهارت","Rate confidence and record practical evidence":"ارزیابی اطمینان و ثبت شواهد عملی",
    "Tools · insight · mastery":"ابزارها · بینش · تسلط","Tools · insights · skill mastery":"ابزارها · بینش · مهارت‌آموزی",
    "Open Status Command Deck":"گشودن مرکز فرمان وضعیت","Close Status Command Deck":"بستن مرکز فرمان وضعیت","Send message":"فرستادن پیام"
  };

  // Release 8.8: translate the Goal/Evidence workflow and storage-health controls.
  // Keep stable phrases isolated in the UI so dynamically rendered panels can use this map.
  Object.assign(translations, {
    "Turn long-term goals into measurable milestones. Link Custom Quests to a Goal to record evidence and update its progress automatically.":"هدف‌های درازمدت را به نقاط عطف قابل‌اندازه‌گیری تبدیل کنید. مأموریت‌های دلخواه را به یک هدف وصل کنید تا شواهد ثبت و پیشرفت آن خودکار به‌روزرسانی شود.",
    "Create a Goal":"ایجاد هدف","Goal title":"عنوان هدف","For example: Finish algebra unit 1":"مثلاً: تکمیل بخش اول جبر",
    "Progress branch":"شاخهٔ پیشرفت","Choose a branch…":"یک شاخه انتخاب کنید…","General — Player XP only":"عمومی — فقط امتیاز تجربهٔ بازیکن",
    "Linked mission target":"هدف تعداد مأموریت‌های پیوندشده","Number of linked Custom Quests needed for evidence-based completion.":"تعداد مأموریت‌های دلخواه لازم برای تکمیل هدف بر اساس شواهد.",
    "Target date":"مهلت هدف","Save Goal":"ذخیرهٔ هدف","No target date set":"مهلتی تعیین نشده","Target:":"مهلت:",
    "General goal":"هدف عمومی","COMPLETED":"تکمیل‌شده","IN PROGRESS":"در حال پیشرفت","VERIFIED BY MISSIONS":"تأییدشده با مأموریت‌ها",
    "MANUALLY MARKED":"علامت‌گذاری‌شده به‌صورت دستی","linked missions":"مأموریت‌های پیوندشده","evidence record(s)":"مدرک شواهد",
    "View evidence":"نمایش شواهد","Link Custom Quests to this Goal to build verifiable progress.":"مأموریت‌های دلخواه را به این هدف وصل کنید تا پیشرفت قابل‌اثبات ایجاد شود.",
    "Mark Complete":"تکمیل هدف","Done ✓":"انجام شد ✓","OVERDUE":"از مهلت گذشته","No goals added yet":"هنوز هدفی اضافه نشده است",
    "Add one clear goal above, then link missions from the Custom Quest panel.":"یک هدف روشن در بالا اضافه کنید و سپس از بخش مأموریت دلخواه، مأموریت‌ها را به آن وصل کنید.",
    "Goal saved. Link matching Custom Quests to collect evidence.":"هدف ذخیره شد. مأموریت‌های دلخواهِ هم‌شاخه را برای ثبت شواهد وصل کنید.",
    "Goal marked complete: +50 XP and +10 Coins.":"هدف تکمیل شد: ۵۰ امتیاز تجربه و ۱۰ سکه دریافت کردید.",
    "Turn long-term goals into measurable milestones.":"هدف‌های درازمدت را به نقاط عطف قابل‌اندازه‌گیری تبدیل کنید.",
    "Create Custom Quest":"ایجاد مأموریت دلخواه",
    "Create your own missions. Link a mission to an active Goal to record evidence; reaching its mission target completes that Goal and grants its completion bonus.":"مأموریت‌های خود را بسازید. برای ثبت شواهد، مأموریت را به یک هدف فعال وصل کنید؛ با رسیدن به تعداد لازم، هدف تکمیل و پاداش آن داده می‌شود.",
    "Quest name":"نام مأموریت","For example: Finish one Python lesson":"مثلاً: تکمیل یک درس پایتون","Description":"توضیحات",
    "Define what completion means.":"مشخص کنید تکمیل مأموریت به چه معناست.","Linked Goal (optional)":"هدف پیوندشده (اختیاری)",
    "No linked Goal":"بدون هدف پیوندشده","A Stat-specific Goal can only be linked to a Quest from the same branch.":"هدف وابسته به یک شاخه فقط می‌تواند به مأموریتی از همان شاخه وصل شود.",
    "XP reward":"پاداش امتیاز تجربه","Coin reward":"پاداش سکه","Create Quest":"ایجاد مأموریت","Custom mission":"مأموریت دلخواه",
    "Goal no longer available":"این هدف دیگر در دسترس نیست","No custom quests yet":"هنوز مأموریت دلخواهی وجود ندارد",
    "Create your first mission above.":"اولین مأموریت خود را در بالا بسازید.","Custom Quest created.":"مأموریت دلخواه ساخته شد.",
    "Custom Quest complete:":"مأموریت دلخواه تکمیل شد:","Complete Goal":"تکمیل هدف",
    "Export keeps a portable copy of your SYSTEM data on this device. Restore validates the file and checks its integrity before replacing SYSTEM data.":"صادرکردن، یک نسخهٔ قابل‌انتقال از داده‌های SYSTEM را روی دستگاه نگه می‌دارد. بازیابی پیش از جایگزینی داده‌ها، فایل را اعتبارسنجی و یکپارچگی آن را بررسی می‌کند.",
    "Export verified backup (.json)":"صادرکردن نسخهٔ پشتیبان بررسی‌شده (.json)","Restore from backup (.json)":"بازیابی از نسخهٔ پشتیبان (.json)",
    "LOCAL DATA":"داده‌های محلی","Storage health":"سلامت ذخیره‌سازی","Run check":"اجرای بررسی",
    "Run a check to inspect saved SYSTEM data. No personal message content is included in the report.":"برای بررسی داده‌های ذخیره‌شدهٔ SYSTEM، بررسی را اجرا کنید. محتوای پیام‌های شخصی در گزارش گنجانده نمی‌شود.",
    "App data keys":"کلیدهای دادهٔ برنامه","Approx. storage used":"حجم تقریبی ذخیره‌سازی","Progress events":"رویدادهای پیشرفت","Data issues":"مشکلات داده",
    "Attention recommended: one or more saved values are malformed or do not match the expected data shape. Export a backup before making changes.":"توجه لازم است: یک یا چند مقدار ذخیره‌شده خراب است یا با ساختار مورد انتظار مطابقت ندارد. پیش از هر تغییر، نسخهٔ پشتیبان صادر کنید.",
    "Attention required: one or more saved values are missing or invalid. SYSTEM blocks unverified backup restore to prevent wiping existing progress.":"توجه ضروری است: یک یا چند مقدار ذخیره‌شده وجود ندارد یا نامعتبر است. SYSTEM برای جلوگیری از حذف پیشرفت، بازیابی نسخهٔ پشتیبان تأییدنشده را مسدود می‌کند.",
    "Keys to review:":"کلیدهای نیازمند بررسی:",
    "Keep any existing automatic snapshots until the problem is resolved.":"تا زمان رفع مشکل، تمام Snapshotهای خودکار موجود را نگه دارید.",
    "No main progress save exists yet. This is normal for a fresh profile; create progress and check again.":"هنوز ذخیرهٔ اصلی پیشرفت وجود ندارد. این حالت در پروفایل تازه طبیعی است؛ کمی پیشرفت ثبت کنید و دوباره بررسی نمایید.",
    "No malformed JSON values or known schema issues were detected. This basic scan cannot prove that every saved value is correct.":"مقدار JSON خراب یا مشکل شناخته‌شدهٔ ساختاری پیدا نشد؛ بااین‌حال، این بررسی ابتدایی صحت همهٔ داده‌ها را تضمین نمی‌کند.",
    "Main player save is present. A successful scan does not replace a downloadable backup.":"ذخیرهٔ اصلی بازیکن موجود است. بررسی موفق، جای نسخهٔ پشتیبان قابل‌دریافت را نمی‌گیرد.",
    "New backups include an integrity checksum for accidental corruption detection. The checksum is not a security signature.":"نسخه‌های پشتیبان جدید برای شناسایی خرابی تصادفی، چک‌سام یکپارچگی دارند؛ این چک‌سام امضای امنیتی نیست.",
    "Delete goal":"حذف هدف","Delete":"حذف","Goals":"هدف‌ها","missions":"مأموریت‌ها","evidence":"شواهد",
    "Goal linked mission progress":"پیشرفت مأموریت‌های پیوندشده","Linked mission evidence":"شواهد مأموریت‌های پیوندشده"
  });

  Object.assign(translations, {
    "Visual Effects":"جلوه‌های بصری",
    "Control the cosmic atmosphere and milestone celebrations.":"فضای کیهانی و بازخورد ارتقا و دستاوردها را تنظیم کن.",
    "Configure →":"تنظیم →"
  });

  function readSavedLanguage() {
    try { return localStorage.getItem(KEY) === "fa" ? "fa" : "en"; }
    catch (_) { return "en"; }
  }
  function saveLanguage(value) {
    try { localStorage.setItem(KEY, value); return true; }
    catch (_) { return false; }
  }
  let language = readSavedLanguage();
  const original = new WeakMap();
  const isText = n => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim().length > 0;
  function walk(rootNode, fn) {
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode); nodes.forEach(fn);
  }
  function translateNode(node) {
    if (!original.has(node)) original.set(node,node.nodeValue);
    const base=original.get(node), trimmed=base.trim();
    if (language === "en") { node.nodeValue=base; return; }
    let value=translations[trimmed];
    if (!value) {
      const levelMatch = trimmed.match(/^(?:LEVEL|Level|LV\.)\s*(\d+)$/i);
      if (levelMatch) value = `سطح ${levelMatch[1]}`;
    }
    if (value) node.nodeValue=base.replace(trimmed,value);
  }
  function translateAttributes() {
    const attrs=["placeholder","title","aria-label"];
    document.querySelectorAll("input,textarea,button,[title],[aria-label]").forEach(el=>{
      attrs.forEach(attr=>{
        if(!el.hasAttribute(attr)) return;
        const key="data-i18n-original-"+attr;
        if(!el.hasAttribute(key)) el.setAttribute(key,el.getAttribute(attr));
        const base=el.getAttribute(key);
        if(language==="en") el.setAttribute(attr,base);
        else if(translations[base]) el.setAttribute(attr,translations[base]);
      });
    });
  }
  function apply() {
    document.documentElement.lang=language==="fa"?"fa-AF":"en";
    document.documentElement.dir=language==="fa"?"rtl":"ltr";
    walk(document.body,translateNode); translateAttributes();
    const button=document.getElementById("system-language-toggle");
    if(button){
      button.innerHTML='<span class="lang-dot" aria-hidden="true"></span>'+(language==="fa"?'English · EN':'فارسی · FA');
      button.setAttribute("aria-label",language==="fa"?"Switch interface to English":"Switch interface to Persian");
      button.setAttribute("title",language==="fa"?"Switch between Persian and English":"Switch between English and Persian");
    }
    document.body.dataset.systemLanguage=language;
    window.dispatchEvent(new CustomEvent("system-language-change",{detail:{language}}));
  }
  function init(){
    const button=document.getElementById("system-language-toggle");
    if(button){
      button.addEventListener("click",()=>{language=language==="en"?"fa":"en";saveLanguage(language);apply();});
    }
    apply();
    let queued=false;
    new MutationObserver(records=>{
      if(queued)return;queued=true;
      requestAnimationFrame(()=>{queued=false;records.forEach(r=>{
        r.addedNodes&&r.addedNodes.forEach(n=>{if(n.nodeType===Node.TEXT_NODE)translateNode(n);else if(n.nodeType===Node.ELEMENT_NODE)walk(n,translateNode);});
      });translateAttributes();});
    }).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();