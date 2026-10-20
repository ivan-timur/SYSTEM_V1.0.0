/* SYSTEM — Experience layer: synthesized sound, haptics, reminders, shortcuts, PWA.
   Loaded after app.js. Sounds are generated with WebAudio (no audio files). */
(function () {
    "use strict";
    const KEY = "system_v2_experience";
    const defaults = { sound: true, volume: 0.6, haptics: true, reminder: true, reminderHour: 20, lastReminder: null };
    let prefs = Object.assign({}, defaults);
    try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* defaults */ }
    prefs.volume = Math.min(1, Math.max(0, Number(prefs.volume) || 0));
    prefs.reminderHour = Math.min(23, Math.max(0, Math.floor(Number(prefs.reminderHour) || 20)));
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ } };

    /* ---------- Sound engine ---------- */
    let ctx = null, master = null, audioUnlockBound = false;
    const lastPlayedAt = new Map();
    const PLAY_COOLDOWN_MS = 180;
    // Success notifications are briefly deferred so the canonical domain event can
    // replace them with one precise sound/haptic instead of producing duplicates.
    let pendingNotifyTimer = 0;
    let pendingNotifySound = null;
    let pendingDomainTimer = 0;
    let pendingDomainSound = null;
    const NOTIFY_SOUND_GRACE_MS = 110;
    const DOMAIN_SOUND_PRIORITY = { quest: 1, reward: 2, streak: 3, levelup: 4, rank: 5 };
    function audio() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            try {
                ctx = new AC(); master = ctx.createGain();
                master.gain.value = prefs.volume * 0.5;
                master.connect(ctx.destination);
            } catch (error) { ctx = null; master = null; return null; }
        }
        if (ctx.state === "suspended") {
            // Browsers often require the context to resume from a user gesture.
            try { const resumed = ctx.resume(); if (resumed && resumed.catch) resumed.catch(() => {}); } catch (error) { /* gesture may be required */ }
        }
        if (master && ctx) {
            const target = prefs.sound ? prefs.volume * 0.5 : 0;
            try { master.gain.setTargetAtTime(target, ctx.currentTime, 0.025); }
            catch (error) { master.gain.value = target; }
        }
        return ctx;
    }
    function unlockAudio() {
        const c = audio();
        if (c && c.state === "suspended") { try { c.resume().catch(() => {}); } catch (error) { /* unsupported state */ } }
    }
    if (!audioUnlockBound) {
        audioUnlockBound = true;
        ["pointerdown", "keydown", "touchstart"].forEach(type => document.addEventListener(type, unlockAudio, { once: true, passive: true }));
    }
    document.addEventListener("visibilitychange", () => {
        if (document.hidden && ctx && master) {
            try { master.gain.setTargetAtTime(0, ctx.currentTime, 0.04); } catch (error) { master.gain.value = 0; }
        } else if (!document.hidden && ctx && master) {
            try { master.gain.setTargetAtTime(prefs.sound ? prefs.volume * 0.5 : 0, ctx.currentTime, 0.04); } catch (error) { master.gain.value = prefs.sound ? prefs.volume * 0.5 : 0; }
        }
    });
    function tone(freq, at, dur, type = "sine", gain = 0.5, slideTo = null) {
        const c = ctx, t = c.currentTime + at;
        const osc = c.createOscillator(), env = c.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, t);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(gain, t + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(env); env.connect(master); osc.start(t); osc.stop(t + dur + 0.02);
    }
    const notes = a => a.map((f, i) => [f, i * 0.1]);
    const SOUNDS = {
        click:   () => tone(880, 0, 0.06, "triangle", 0.25, 640),
        nav:     () => { tone(520, 0, 0.09, "sine", 0.35); tone(780, 0.07, 0.12, "sine", 0.3); },
        open:    () => { tone(380, 0, 0.16, "sine", 0.3, 820); tone(1240, 0.1, 0.1, "triangle", 0.12); },
        notify:  () => { tone(740, 0, 0.09, "sine", 0.35); tone(988, 0.09, 0.14, "sine", 0.3); },
        quest:   () => notes([523, 659, 784]).forEach(([f, t]) => tone(f, t, 0.18, "triangle", 0.4)),
        reward:  () => { tone(988, 0, 0.08, "square", 0.18); tone(1319, 0.08, 0.28, "square", 0.18); },
        streak:  () => notes([440, 554, 659, 880]).forEach(([f, t]) => tone(f, t, 0.14, "triangle", 0.3)),
        levelup: () => { notes([523, 659, 784, 1047]).forEach(([f, t]) => tone(f, t, 0.22, "triangle", 0.42));
                         [523, 659, 784].forEach(f => tone(f, 0.42, 0.7, "sine", 0.18)); },
        rank:    () => { notes([392, 523, 659, 784, 1047, 1319]).forEach(([f, t]) => tone(f, t, 0.26, "sawtooth", 0.16));
                         [523, 784, 1047].forEach(f => tone(f, 0.65, 1, "sine", 0.22)); },
        error:   () => { tone(240, 0, 0.18, "sawtooth", 0.25, 150); tone(180, 0.14, 0.22, "sawtooth", 0.22, 110); }
    };
    const HAPTIC = { click: 8, nav: 12, quest: [20, 40, 30], reward: [15, 30, 15], levelup: [40, 60, 40, 60, 120], rank: [60, 80, 60, 80, 200], error: [80, 40, 80], streak: [20, 30, 20] };
    function play(name, options = {}) {
        if (!SOUNDS[name]) return false;
        const now = Date.now();
        if (!options.force && now - (lastPlayedAt.get(name) || 0) < PLAY_COOLDOWN_MS) return false;
        lastPlayedAt.set(name, now);
        if (prefs.haptics && HAPTIC[name] && navigator.vibrate) { try { navigator.vibrate(HAPTIC[name]); } catch (e) { /* ignore */ } }
        if (!prefs.sound || document.hidden || !audio()) return false;
        try { SOUNDS[name](); return true; } catch (e) { console.warn("Sound failed", e); return false; }
    }
    function updateVolume() {
        if (!ctx || !master) return;
        const target = prefs.sound ? prefs.volume * 0.5 : 0;
        try { master.gain.setTargetAtTime(target, ctx.currentTime, 0.025); }
        catch (error) { master.gain.value = target; }
    }
    window.SYSTEMSound = { play, prefs, updateVolume, available: () => Boolean(window.AudioContext || window.webkitAudioContext) };

    // Domain events are the canonical feedback boundary; visual effects and audio
    // can react independently without embedding sound calls in progression logic.
    const EVENT_SOUNDS = {
        "system-quest-completed": "quest",
        "system-level-up": "levelup",
        "system-skill-level-up": "levelup",
        "system-rank-up": "rank",
        "system-achievement-unlocked": "reward",
        "system-reward-revealed": "reward",
        "system-boss-cleared": "streak",
        "system-skill-evolved": "levelup"
    };
    Object.entries(EVENT_SOUNDS).forEach(([eventName, soundName]) => {
        // app-controller dispatches these CustomEvents on window, not document.
        // Listen on the same event target so progression feedback actually arrives.
        window.addEventListener(eventName, () => {
            if (pendingNotifyTimer) window.clearTimeout(pendingNotifyTimer);
            pendingNotifyTimer = 0;
            pendingNotifySound = null;
            // Several domain events can describe one committed action (for example,
            // Boss cleared + Quest completed + Level up). Collapse the same-turn burst
            // to one highest-priority sound/haptic instead of stacking celebrations.
            if (!pendingDomainSound || DOMAIN_SOUND_PRIORITY[soundName] > DOMAIN_SOUND_PRIORITY[pendingDomainSound]) {
                pendingDomainSound = soundName;
            }
            if (!pendingDomainTimer) {
                pendingDomainTimer = window.setTimeout(() => {
                    const selected = pendingDomainSound;
                    pendingDomainTimer = 0;
                    pendingDomainSound = null;
                    if (selected) play(selected);
                }, 0);
            }
        }, { passive: true });
    });

    /* ---------- Hook existing app behaviour without editing it ---------- */
    const origNotify = window.notifySystem;
    if (typeof origNotify === "function") {
        window.notifySystem = function (message) {
            origNotify.apply(this, arguments);
            const m = String(message || "");
            const soundName = /NEW RANK/.test(m) ? "rank" : /LEVEL UP|PERFECT DAY/.test(m) ? "levelup" : /STREAK/.test(m) ? "streak"
                : /cancelled|could not|not saved|failed|already been claimed|first|not available/i.test(m) ? "error"
                : /claim|reward|purchase|bought|\+\d+ (XP|Coins)/i.test(m) ? "reward" : "notify";
            // Errors and ordinary notices are immediate. Success/progression messages
            // wait one event-loop beat for the corresponding committed domain event.
            const isSuccessFeedback = soundName !== "error" && soundName !== "notify";
            if (!isSuccessFeedback) {
                play(soundName);
            } else {
                if (pendingNotifyTimer) window.clearTimeout(pendingNotifyTimer);
                pendingNotifySound = soundName;
                pendingNotifyTimer = window.setTimeout(() => {
                    const fallback = pendingNotifySound;
                    pendingNotifyTimer = 0;
                    pendingNotifySound = null;
                    if (fallback) play(fallback);
                }, NOTIFY_SOUND_GRACE_MS);
            }
        };
    }
    const origModal = window.openSystemModal;
    if (typeof origModal === "function") {
        window.openSystemModal = function () { play("open"); return origModal.apply(this, arguments); };
    }
    document.addEventListener("click", event => {
        if (!event.isTrusted) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const quest = target.closest(".quest-go");
        if (quest && !quest.disabled) {
            const card = quest.closest(".quest-card");
            setTimeout(() => { if (quest.disabled || (card && card.classList.contains("completed"))) play("quest"); }, 30);
        } else if (target.closest(".nav-item")) play("nav");
        else if (target.closest("button, [role=button], .reward-card, .stat-card") && !target.closest("input, select, textarea, [data-no-sound]")) play("click");
    }, true);

    /* ---------- Keyboard shortcuts: 1-5 pages, M mute ---------- */
    document.addEventListener("keydown", event => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const tag = (event.target.tagName || "").toLowerCase();
        if (["input", "textarea", "select"].includes(tag) || event.target.isContentEditable) return;
        if (document.querySelector("dialog[open]")) return;
        if (/^[1-5]$/.test(event.key)) {
            const item = document.querySelectorAll(".sidebar .nav-item")[Number(event.key) - 1];
            if (item) item.click();
        } else if (event.key.toLowerCase() === "m") {
            prefs.sound = !prefs.sound; save();
            if (prefs.sound) play("notify");
            if (typeof window.notifySystem === "function") window.notifySystem(prefs.sound ? "Sound on" : "Sound muted");
        }
    });

    /* ---------- Daily quest reminder (runs while SYSTEM is open or installed) ---------- */
    function incompleteQuests() {
        try { return questDefinitions.filter(q => !completedQuests[q.id]).length; } catch (e) { return 0; }
    }
    function checkReminder() {
        if (!prefs.reminder) return;
        const now = new Date(), today = getLocalDateStamp(now);
        if (now.getHours() < prefs.reminderHour || prefs.lastReminder === today) return;
        const left = incompleteQuests();
        prefs.lastReminder = today; save();
        if (left === 0) return;
        const body = `${left} Daily Quest${left === 1 ? "" : "s"} still waiting. Keep your streak alive!`;
        if ("Notification" in window && Notification.permission === "granted") {
            try { new Notification("SYSTEM — Daily Quests", { body, tag: "daily-reminder", icon: "assets/images/icons/quest.webp" }); } catch (e) { /* ignore */ }
        }
        window.notifySystem(body);
    }
    setInterval(checkReminder, 30000); setTimeout(checkReminder, 4000);

    /* ---------- Settings panel ---------- */
    function renderExperienceModal(body) {
        const perm = "Notification" in window ? Notification.permission : "unsupported";
        const android = window.SYSTEMAndroid && typeof window.SYSTEMAndroid.getPlatform === "function"
            && window.SYSTEMAndroid.getPlatform() === "android" ? window.SYSTEMAndroid : null;
        const nativeReminderEnabled = android ? android.isDailyReminderEnabled() : false;
        const fa = (document.documentElement.lang || "en").toLowerCase().startsWith("fa");
        const nativeReminderLabel = fa ? "یادآور بومی اندروید (حتی وقتی برنامه بسته است)" : "Android daily reminder (works when app is closed)";
        const nativeReminderNote = fa ? "برای نمایش اعلان، اجازهٔ اعلان‌های اندروید لازم است." : "Android notification permission is required to display reminders.";
        const hours = Array.from({ length: 24 }, (_, h) => `<option value="${h}"${h === prefs.reminderHour ? " selected" : ""}>${String(h).padStart(2, "0")}:00</option>`).join("");
        body.innerHTML = `
            <div class="exp-panel">
                <label class="exp-row"><span>${fa ? "جلوه‌های صوتی" : "Sound effects"}</span><input type="checkbox" id="exp-sound" ${prefs.sound ? "checked" : ""}></label>
                <label class="exp-row"><span>${fa ? "بلندی صدا" : "Volume"}</span><input aria-label="${fa ? "بلندی صدا" : "Volume"}" type="range" id="exp-volume" min="0" max="1" step="0.05" value="${prefs.volume}"></label>
                <label class="exp-row"><span>${fa ? "لرزش موبایل" : "Vibration (mobile)"}</span><input type="checkbox" id="exp-haptics" ${prefs.haptics ? "checked" : ""}></label>
                <label class="exp-row"><span>${fa ? "یادآور مأموریت روزانه" : "Daily Quest reminder"}</span><input type="checkbox" id="exp-reminder" ${prefs.reminder ? "checked" : ""}></label>
                <label class="exp-row"><span>${fa ? "یادآوری از ساعت" : "Remind me from"}</span><select id="exp-hour">${hours}</select></label>
                ${android ? `<label class="exp-row exp-native-reminder-row"><span>${nativeReminderLabel}</span><input type="checkbox" id="exp-native-reminder" ${nativeReminderEnabled ? "checked" : ""}></label><small class="exp-native-reminder-note">${nativeReminderNote}</small>` : ""}
                <div class="exp-actions">
                    <button type="button" id="exp-test">${fa ? "آزمایش صداها" : "Test sounds"}</button>
                    <button type="button" id="exp-perm" ${perm === "granted" || perm === "unsupported" ? "disabled" : ""}>${perm === "granted" ? (fa ? "اعلان‌های سیستم فعال است ✓" : "System notifications on ✓") : perm === "denied" ? (fa ? "در تنظیمات مرورگر مسدود است" : "Blocked in browser settings") : perm === "unsupported" ? (fa ? "اعلان پشتیبانی نمی‌شود" : "Notifications unsupported") : (fa ? "فعال‌سازی اعلان‌های سیستم" : "Enable system notifications")}</button>
                </div>
                <small>${fa ? "یادآورها هنگام باز بودن SYSTEM یا اجرای آن به‌صورت اپ فعال‌اند. میان‌برها: ۱ تا ۵ برای جابه‌جایی صفحه و M برای قطع صدا." : "Reminders fire while SYSTEM is open or installed as an app. Shortcuts: 1–5 switch pages, M mutes."}</small>
            </div>`;
        const $ = id => body.querySelector(id);
        const bind = (id, prop, read) => $(id).addEventListener("change", e => { prefs[prop] = read(e.target); save(); });
        bind("#exp-sound", "sound", el => el.checked); bind("#exp-haptics", "haptics", el => el.checked);
        $("#exp-sound").addEventListener("change", updateVolume);
        bind("#exp-reminder", "reminder", el => el.checked);
        bind("#exp-hour", "reminderHour", el => {
            const hour = Number(el.value);
            if (android && android.isDailyReminderEnabled()) {
                android.scheduleDailyReminder(hour,
                    fa ? "SYSTEM — یادآور روزانه" : "SYSTEM — Daily Review",
                    fa ? "زمان مرور هدف‌ها و مأموریت‌های امروز است." : "Review today's goals, quests, and skill progress.");
            }
            return hour;
        });
        if (android) $("#exp-native-reminder").addEventListener("change", event => {
            if (event.target.checked) {
                android.scheduleDailyReminder(Number($("#exp-hour").value),
                    fa ? "SYSTEM — یادآور روزانه" : "SYSTEM — Daily Review",
                    fa ? "زمان مرور هدف‌ها و مأموریت‌های امروز است." : "Review today's goals, quests, and skill progress.");
                if (typeof window.notifySystem === "function") window.notifySystem(fa ? "یادآور اندروید تنظیم شد؛ اجازهٔ اعلان را تأیید کن." : "Android reminder saved. Allow notifications when prompted.");
            } else {
                android.cancelDailyReminder();
                if (typeof window.notifySystem === "function") window.notifySystem(fa ? "یادآور اندروید خاموش شد." : "Android reminder disabled.");
            }
        });
        $("#exp-volume").addEventListener("input", e => { prefs.volume = Number(e.target.value); save(); updateVolume(); });
        $("#exp-volume").addEventListener("change", () => play("notify"));
        $("#exp-test").addEventListener("click", () => {
            if (!prefs.sound) { prefs.sound = true; $("#exp-sound").checked = true; save(); updateVolume(); }
            ["quest", "reward", "levelup", "rank", "error"].forEach((n, i) => setTimeout(() => play(n, { force: true }), i * 1100));
        });
        $("#exp-perm").addEventListener("click", () => Notification.requestPermission().then(() => renderExperienceModal(body)));
    }
    function addSettingsRow() {
        const rows = document.querySelectorAll("#settings-page .settings-row");
        const last = rows[rows.length - 1];
        if (!last || document.getElementById("exp-settings-row")) return;
        const row = last.cloneNode(true);
        row.id = "exp-settings-row";
        row.querySelector(".settings-number").textContent = String(rows.length + 1).padStart(2, "0");
        row.querySelector(".settings-icon").textContent = "";
        row.querySelector("h2").textContent = "Sound & Alerts";
        row.querySelector("p").textContent = "Sound effects, vibration, daily quest reminders and shortcuts.";
        const old = row.querySelector("button"), button = old.cloneNode(true);
        button.textContent = "Configure →"; delete button.dataset.settingsReady;
        old.replaceWith(button);
        button.addEventListener("click", () => window.openSystemModal("Sound & Alerts", "", renderExperienceModal));
        last.after(row);
    }
    addSettingsRow();

    /* ---------- PWA: installable + offline app shell ---------- */
    const runningInNativeAndroid = window.SYSTEMAndroid && typeof window.SYSTEMAndroid.getPlatform === "function"
        && window.SYSTEMAndroid.getPlatform() === "android";
    // In the APK all files ship inside the application. Avoid a redundant PWA cache
    // on the appassets origin; the packaged web assets already work fully offline.
    if (!runningInNativeAndroid && "serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register("sw.js").catch(error => console.warn("Service worker unavailable:", error));
    }
})();
