/**
 * SYSTEM — restrained visual atmosphere and milestone feedback.
 * This module owns only visual preferences and DOM presentation; progression
 * state, reward rules, achievements and quest persistence remain elsewhere.
 */
const MAX_DPR = 1.5;
const FRAME_INTERVAL = 1000 / 30;
const MAX_BURSTS = 5;
const MAX_MILESTONES = 5;
const MOBILE_FRAME_INTERVAL = 1000 / 24;
const LOW_POWER_FRAME_INTERVAL = 1000 / 20;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const SETTINGS_KEY = 'system_v3_visual_settings';
const DEFAULT_SETTINGS = Object.freeze({ ambient: true, celebrations: true });

export function createVisualEffectsController({ documentRef = document, windowRef = window } = {}) {
    let canvas = null;
    let context = null;
    let frameId = 0;
    let lastFrame = 0;
    let resizeFrameId = 0;
    let pointer = { x: -1000, y: -1000, active: false };
    let ambientEnabled = DEFAULT_SETTINGS.ambient;
    let celebrationsEnabled = DEFAULT_SETTINGS.celebrations;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frameInterval = FRAME_INTERVAL;
    let lowPowerDevice = false;
    let framesDrawn = 0;
    let lastFrameCost = 0;
    let averageFrameCost = 0;
    let lastPointerAt = 0;
    let particles = [];
    let bursts = [];
    let initialized = false;
    let transitionTimer = 0;
    let lastPageKey = '';
    let lastPageAt = 0;
    let toast = null;
    let toastTitle = null;
    let toastMessage = null;
    let toastIcon = null;
    let toastTimer = 0;
    let toastHideTimer = 0;
    const pendingMilestones = [];
    const recentMilestoneKeys = new Map();
    const MILESTONE_DEDUPE_WINDOW = 1800;
    const reducedMotion = windowRef.matchMedia?.(REDUCED_MOTION);

    function isReducedMotion() {
        return Boolean(reducedMotion?.matches);
    }

    function getSettings() {
        return Object.freeze({ ambient: ambientEnabled, celebrations: celebrationsEnabled });
    }

    function loadSettings() {
        try {
            const raw = windowRef.localStorage?.getItem(SETTINGS_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
            if (typeof saved.ambient === 'boolean') ambientEnabled = saved.ambient;
            if (typeof saved.celebrations === 'boolean') celebrationsEnabled = saved.celebrations;
        } catch {
            // Private-browsing/storage-denied environments use in-memory defaults.
        }
    }

    function persistSettings() {
        try {
            windowRef.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(getSettings()));
        } catch {
            // Visual preferences are optional and must never block the app.
        }
    }

    const makeParticle = (randomY = false) => ({
        x: Math.random() * Math.max(width, 1),
        y: randomY ? Math.random() * Math.max(height, 1) : height + 8 + Math.random() * 30,
        radius: 0.45 + Math.random() * 1.05,
        speed: 0.08 + Math.random() * 0.22,
        drift: (Math.random() - 0.5) * 0.12,
        alpha: 0.18 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        twinkle: 0.6 + Math.random() * 0.8,
        depth: Math.random(),
    });

    function resize() {
        if (!canvas || !context) return;
        width = Math.max(1, windowRef.innerWidth || 1);
        height = Math.max(1, windowRef.innerHeight || 1);
        lowPowerDevice = (windowRef.navigator?.deviceMemory && windowRef.navigator.deviceMemory <= 4)
            || (windowRef.navigator?.hardwareConcurrency && windowRef.navigator.hardwareConcurrency <= 4)
            || Boolean(windowRef.navigator?.connection?.saveData);
        frameInterval = lowPowerDevice ? LOW_POWER_FRAME_INTERVAL : (width < 600 ? MOBILE_FRAME_INTERVAL : FRAME_INTERVAL);
        pixelRatio = Math.min(windowRef.devicePixelRatio || 1, lowPowerDevice ? 1 : MAX_DPR);
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        const density = lowPowerDevice ? 90000 : (width < 600 ? 65000 : 42000);
        const maxParticles = lowPowerDevice ? 14 : (width < 600 ? 16 : 42);
        const count = Math.min(maxParticles, Math.max(6, Math.round(width * height / density)));
        particles = Array.from({ length: count }, () => makeParticle(true));
    }

    function draw(now) {
        frameId = 0;
        if (!ambientEnabled || !context || documentRef.hidden || isReducedMotion()) return;
        // Keep decorative work bounded; on low-power devices target 20 FPS.
        if (now - lastFrame < frameInterval) {
            frameId = windowRef.requestAnimationFrame(draw);
            return;
        }
        const delta = lastFrame ? Math.min(2, Math.max(0.5, (now - lastFrame) / frameInterval)) : 1;
        const frameStartedAt = windowRef.performance?.now?.() ?? now;
        lastFrame = now;
        framesDrawn += 1;
        context.clearRect(0, 0, width, height);

        for (const particle of particles) {
            particle.y -= particle.speed * delta;
            particle.x += particle.drift * delta;
            particle.phase += 0.012 * delta;
            if (pointer.active && Date.now() - lastPointerAt < 1800) {
                const px = pointer.x - particle.x;
                const py = pointer.y - particle.y;
                const distanceSquared = px * px + py * py;
                if (distanceSquared > 1 && distanceSquared < 190 * 190) {
                    const influence = (1 - Math.sqrt(distanceSquared) / 190) * 0.12 * delta;
                    particle.x -= px * influence;
                    particle.y -= py * influence;
                }
            }
            if (particle.y < -8) Object.assign(particle, makeParticle(false));
            if (particle.x < -8) particle.x = width + 8;
            if (particle.x > width + 8) particle.x = -8;
            const alpha = particle.alpha * (0.62 + Math.sin(particle.phase) * 0.38) * particle.twinkle;
            context.beginPath();
            context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            context.fillStyle = `rgba(106, 190, 255, ${alpha.toFixed(3)})`;
            context.fill();
        }

        // Very faint connections create a restrained, futuristic constellation.
        // Pairwise constellation lines are quadratic; omit them on narrow/low-power devices.
        if (!lowPowerDevice && width >= 600) for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const a = particles[i];
                const b = particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > 108) continue;
                const alpha = (1 - distance / 108) * 0.075;
                context.strokeStyle = `rgba(61, 156, 255, ${alpha.toFixed(3)})`;
                context.lineWidth = 0.65;
                context.beginPath();
                context.moveTo(a.x, a.y);
                context.lineTo(b.x, b.y);
                context.stroke();
            }
        }

        // Three restrained orbital layers create spatial depth without a heavy blur pass.
        const nowTime = Date.now();
        const seconds = nowTime * 0.00018;
        const orbitX = width * (0.5 + Math.sin(seconds * 0.7) * 0.12);
        const orbitY = height * (0.46 + Math.cos(seconds * 0.55) * 0.08);
        const orbitScale = 0.72 + (Math.sin(seconds) + 1) * 0.055;
        context.save();
        context.translate(orbitX, orbitY);
        context.rotate(seconds * 0.12);
        const orbitLayerCount = lowPowerDevice || width < 600 ? 1 : 3;
        for (let layer = 0; layer < orbitLayerCount; layer++) {
            const rx = Math.min(width * 0.42, 420) * orbitScale * (0.58 + layer * 0.22);
            const ry = Math.min(height * 0.26, 230) * orbitScale * (0.62 + layer * 0.18);
            context.beginPath();
            context.ellipse(0, 0, rx, ry, layer * 0.38, 0, Math.PI * 2);
            context.strokeStyle = `rgba(52, 157, 255, ${0.022 + layer * 0.009})`;
            context.lineWidth = layer === 1 ? 0.8 : 0.55;
            context.stroke();
        }
        context.restore();

        // PHASE 16: a restrained energy core with orbiting nodes. It is deliberately
        // low-detail and uses no blur/shadow pass, so it remains friendly to mobile GPUs.
        const coreX = width * 0.5;
        const coreY = height * 0.46;
        const pulse = 0.5 + 0.5 * Math.sin(nowTime * 0.0011);
        const coreRadius = Math.min(2.2 + pulse * 1.4, width < 600 ? 3 : 3.6);
        context.beginPath();
        context.arc(coreX, coreY, coreRadius, 0, Math.PI * 2);
        context.fillStyle = `rgba(107, 220, 255, ${0.12 + pulse * 0.12})`;
        context.fill();
        for (let node = 0; node < 4; node++) {
            const angle = nowTime * (node % 2 ? -0.00022 : 0.00022) + node * Math.PI / 2;
            const radius = Math.min(width * 0.24, 210) * (0.72 + node * 0.045);
            const nx = coreX + Math.cos(angle) * radius;
            const ny = coreY + Math.sin(angle) * radius * 0.42;
            context.beginPath();
            context.arc(nx, ny, node % 2 ? 1.05 : 1.45, 0, Math.PI * 2);
            context.fillStyle = `rgba(88, 202, 255, ${0.12 + pulse * 0.10})`;
            context.fill();
        }

        bursts = bursts.filter((burst) => nowTime - burst.started < burst.duration);
        for (const burst of bursts) {
            const progress = Math.min(1, Math.max(0, (nowTime - burst.started) / burst.duration));
            const eased = 1 - Math.pow(1 - progress, 3);
            for (let ring = 0; ring < 2; ring++) {
                const ringProgress = Math.min(1, progress + ring * 0.16);
                const radius = 8 + (1 - Math.pow(1 - ringProgress, 3)) * (48 + ring * 18);
                context.beginPath();
                context.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
                context.strokeStyle = `rgba(${ring ? '77, 130, 255' : '87, 220, 255'}, ${(1 - progress) * (ring ? 0.19 : 0.38)})`;
                context.lineWidth = (1.6 * (1 - progress)) + 0.2;
                context.stroke();
            }
            // A tiny center glint fades with the ring; no expensive shadowBlur is used.
            context.beginPath();
            context.arc(burst.x, burst.y, 2.2 * (1 - eased) + 0.35, 0, Math.PI * 2);
            context.fillStyle = `rgba(170, 235, 255, ${(1 - progress) * 0.48})`;
            context.fill();
        }
        const frameEndedAt = windowRef.performance?.now?.() ?? frameStartedAt;
        lastFrameCost = Math.max(0, frameEndedAt - frameStartedAt);
        averageFrameCost = framesDrawn === 1 ? lastFrameCost : (averageFrameCost * 0.9 + lastFrameCost * 0.1);
        frameId = windowRef.requestAnimationFrame(draw);
    }

    function stop() {
        if (frameId) windowRef.cancelAnimationFrame(frameId);
        frameId = 0;
        if (context) context.clearRect(0, 0, width, height);
    }

    function start() {
        if (!ambientEnabled || !canvas || !context || isReducedMotion() || documentRef.hidden || frameId) return;
        lastFrame = 0;
        frameId = windowRef.requestAnimationFrame(draw);
    }

    function setEnabled(nextEnabled) {
        ambientEnabled = Boolean(nextEnabled);
        persistSettings();
        if (!ambientEnabled || isReducedMotion()) stop();
        else start();
        if (canvas) canvas.hidden = !ambientEnabled || isReducedMotion();
        return ambientEnabled;
    }

    function setCelebrationsEnabled(nextEnabled) {
        celebrationsEnabled = Boolean(nextEnabled);
        persistSettings();
        if (!celebrationsEnabled) {
            pendingMilestones.length = 0;
            windowRef.clearTimeout(toastTimer);
            windowRef.clearTimeout(toastHideTimer);
            toast?.classList.remove('is-visible');
        }
        return celebrationsEnabled;
    }

    function configure(next = {}) {
        if (typeof next.ambient === 'boolean') setEnabled(next.ambient);
        if (typeof next.celebrations === 'boolean') setCelebrationsEnabled(next.celebrations);
        persistSettings();
        return getSettings();
    }

    function burstAt(x, y) {
        if (!ambientEnabled || isReducedMotion() || !Number.isFinite(x) || !Number.isFinite(y)) return false;
        bursts.push({ x, y, started: Date.now(), duration: 520 });
        const burstLimit = lowPowerDevice ? 2 : MAX_BURSTS;
        if (bursts.length > burstLimit) bursts.splice(0, bursts.length - burstLimit);
        start();
        return true;
    }

    function ensureToast() {
        if (toast || !documentRef.body) return;
        toast = documentRef.createElement('aside');
        toast.className = 'system-milestone-toast';
        toast.id = 'system-milestone-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.setAttribute('aria-atomic', 'true');
        toast.setAttribute('data-milestone-kind', 'level');
        toastIcon = documentRef.createElement('span');
        toastIcon.className = 'system-milestone-icon';
        toastIcon.setAttribute('aria-hidden', 'true');
        const copy = documentRef.createElement('span');
        copy.className = 'system-milestone-copy';
        const eyebrow = documentRef.createElement('span');
        eyebrow.className = 'system-milestone-eyebrow';
        eyebrow.textContent = documentRef.body.dataset.systemLanguage === 'fa' ? 'دستاورد جدید' : 'SYSTEM MILESTONE';
        toastTitle = documentRef.createElement('strong');
        toastTitle.className = 'system-milestone-title';
        toastMessage = documentRef.createElement('span');
        toastMessage.className = 'system-milestone-message';
        copy.append(eyebrow, toastTitle, toastMessage);
        toast.append(toastIcon, copy);
        documentRef.body.appendChild(toast);
    }

    function eventToMilestone(event) {
        const type = String(event?.type || 'system-level-up');
        const detail = event?.detail && typeof event.detail === 'object' ? event.detail : {};
        const isFa = documentRef.body?.dataset?.systemLanguage === 'fa';
        const target = detail.target || event?.target;
        const rank = String(detail.rank || '').trim();
        const level = String(detail.level || '').trim();
        let kind = 'quest';
        let defaultTitle = isFa ? 'مأموریت تکمیل شد' : 'QUEST COMPLETE';
        let defaultMessage = isFa ? 'پیشرفت تازه ثبت شد.' : 'Your progress has been recorded.';
        let icon = '✓';
        if (type === 'system-level-up') {
            kind = 'level'; icon = '↑';
            defaultTitle = isFa ? 'ارتقای سطح' : 'LEVEL UP';
            defaultMessage = isFa ? `به سطح ${level || 'جدید'} رسیدی.` : `You reached Level ${level || 'new'}.`;
        } else if (type === 'system-rank-up') {
            kind = 'rank'; icon = '✦';
            defaultTitle = isFa ? 'ارتقای رتبه' : 'RANK ASCENDED';
            defaultMessage = isFa ? `رتبهٔ تازه: ${rank || 'جدید'}` : `New rank unlocked: ${rank || 'new'}.`;
        } else if (type === 'system-achievement-unlocked') {
            kind = 'achievement'; icon = '◆';
            defaultTitle = isFa ? 'نشان باز شد' : 'ACHIEVEMENT UNLOCKED';
            defaultMessage = isFa ? 'یک نشان تازه به مجموعه‌ات اضافه شد.' : 'A new achievement has been added to your collection.';
        } else if (type === 'system-skill-level-up' || type === 'system-skill-evolved') {
            kind = type === 'system-skill-evolved' ? 'evolution' : 'skill'; icon = type === 'system-skill-evolved' ? '✧' : '⌁';
            defaultTitle = type === 'system-skill-evolved'
                ? (isFa ? 'تکامل مهارت' : 'SKILL EVOLVED')
                : (isFa ? 'پیشرفت مهارت' : 'SKILL LEVEL UP');
            defaultMessage = type === 'system-skill-evolved'
                ? (isFa ? 'مرحلهٔ تازه‌ای از مهارت باز شد.' : 'A new stage of this skill has opened.')
                : (isFa ? 'یک مهارت پیشرفت کرد.' : 'One of your skills progressed.');
        } else if (type === 'system-reward-revealed') {
            kind = 'reward'; icon = '◇';
            defaultTitle = isFa ? 'پاداش آشکار شد' : 'REWARD REVEALED';
            defaultMessage = isFa ? 'پاداش تازه‌ای برای پیشرفتت آماده است.' : 'A new reward is ready to celebrate your progress.';
        } else if (type === 'system-boss-cleared') {
            kind = 'boss'; icon = '⬡';
            defaultTitle = isFa ? 'چالش بزرگ تکمیل شد' : 'BOSS CHALLENGE CLEARED';
            defaultMessage = isFa ? 'یک چالش مهم را با موفقیت پشت سر گذاشتی.' : 'A major challenge has been completed.';
        }
        const title = String(detail.title || defaultTitle).slice(0, 120);
        const message = String(detail.message || defaultMessage).slice(0, 240);
        let center = null;
        try {
            const rect = target?.getBoundingClientRect?.();
            if (rect && rect.width >= 0 && rect.height >= 0) center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        } catch { /* Event targets are optional; a toast still works without one. */ }
        return { kind, title, message, icon, center };
    }

    function showNextMilestone() {
        windowRef.clearTimeout(toastTimer);
        windowRef.clearTimeout(toastHideTimer);
        if (!celebrationsEnabled || !pendingMilestones.length || !documentRef.body) return;
        ensureToast();
        const milestone = pendingMilestones.shift();
        if (!toast) return;
        toast.dataset.milestoneKind = milestone.kind;
        toastIcon.textContent = milestone.icon;
        toastTitle.textContent = milestone.title;
        toastMessage.textContent = milestone.message;
        toast.classList.remove('is-visible');
        // Let the browser observe the hidden state before beginning the next entry.
        void toast.offsetWidth;
        toast.classList.add('is-visible');
        toastTimer = windowRef.setTimeout(() => toast?.classList.remove('is-visible'), 3300);
        toastHideTimer = windowRef.setTimeout(() => {
            if (pendingMilestones.length) showNextMilestone();
        }, 3650);
    }

    function handleMilestone(event) {
        if (!celebrationsEnabled) return;
        const milestone = eventToMilestone(event);
        const detail = event?.detail && typeof event.detail === 'object' ? event.detail : {};
        const identity = String(detail.eventId || detail.questId || detail.skillId || detail.rank || detail.level || milestone.title).slice(0, 180);
        const dedupeKey = `${String(event?.type || 'milestone')}:${identity}`;
        const now = Date.now();
        for (const [key, at] of recentMilestoneKeys) if (now - at > MILESTONE_DEDUPE_WINDOW * 2) recentMilestoneKeys.delete(key);
        const previousAt = recentMilestoneKeys.get(dedupeKey) || 0;
        if (now - previousAt < MILESTONE_DEDUPE_WINDOW) return;
        recentMilestoneKeys.set(dedupeKey, now);
        if (ambientEnabled && milestone.center) burstAt(milestone.center.x, milestone.center.y);
        pendingMilestones.push(milestone);
        if (pendingMilestones.length > MAX_MILESTONES) pendingMilestones.shift();
        if (pendingMilestones.length === 1 && !toast?.classList.contains('is-visible')) showNextMilestone();
    }

    function animateActivePage(pageKey) {
        if (!pageKey || isReducedMotion() || !documentRef.body) return;
        const now = Date.now();
        // Ignore duplicate taps and rapid re-selection; navigation logic remains owned by the app.
        if (pageKey === lastPageKey && now - lastPageAt < 450) return;
        lastPageKey = pageKey;
        lastPageAt = now;
        windowRef.clearTimeout(transitionTimer);
        transitionTimer = windowRef.setTimeout(() => {
            const page = documentRef.getElementById(`${pageKey}-page`);
            if (!page || !page.classList.contains('active')) return;
            page.classList.remove('system-page-enter');
            void page.offsetWidth;
            page.classList.add('system-page-enter');
            windowRef.setTimeout(() => page.classList.remove('system-page-enter'), 420);
        }, 0);
    }

    function init() {
        if (initialized) return api;
        initialized = true;
        loadSettings();
        // Register feedback listeners even when reduced-motion disables Canvas.
        windowRef.addEventListener('system-quest-completed', handleMilestone);
        windowRef.addEventListener('system-level-up', handleMilestone);
        windowRef.addEventListener('system-rank-up', handleMilestone);
        windowRef.addEventListener('system-achievement-unlocked', handleMilestone);
        windowRef.addEventListener('system-skill-level-up', handleMilestone);
        windowRef.addEventListener('system-skill-evolved', handleMilestone);
        windowRef.addEventListener('system-reward-revealed', handleMilestone);
        windowRef.addEventListener('system-boss-cleared', handleMilestone);
        windowRef.addEventListener('system-quest-completed', () => documentRef.body?.classList.add('system-event-quest'));
        windowRef.addEventListener('system-level-up', () => documentRef.body?.classList.add('system-event-level'));
        windowRef.addEventListener('system-skill-level-up', () => documentRef.body?.classList.add('system-event-skill'));
        windowRef.addEventListener('system-skill-evolved', () => documentRef.body?.classList.add('system-event-evolution'));
        windowRef.addEventListener('system-reward-revealed', () => documentRef.body?.classList.add('system-event-reward'));
        windowRef.addEventListener('system-boss-cleared', () => documentRef.body?.classList.add('system-event-boss'));
        for (const eventClass of ['system-event-quest', 'system-event-level', 'system-event-skill', 'system-event-evolution', 'system-event-reward', 'system-event-boss']) {
            windowRef.addEventListener('animationend', (event) => {
                if (event.target === documentRef.body) documentRef.body.classList.remove(eventClass);
            });
        }
        documentRef.addEventListener('click', (event) => {
            const nav = event.target?.closest?.('[data-page]');
            if (nav) animateActivePage(String(nav.dataset.page || ''));
        }, true);
        documentRef.addEventListener('visibilitychange', () => documentRef.hidden ? stop() : start());
        reducedMotion?.addEventListener?.('change', () => {
            if (isReducedMotion()) stop(); else start();
            if (canvas) canvas.hidden = !ambientEnabled || isReducedMotion();
        });

        if (!documentRef.body || !documentRef.createElement || documentRef.documentElement?.dataset?.visualEffects === 'off') {
            return api;
        }
        canvas = documentRef.createElement('canvas');
        canvas.className = 'system-atmosphere-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.setAttribute('role', 'presentation');
        canvas.tabIndex = -1;
        canvas.hidden = !ambientEnabled || isReducedMotion();
        context = canvas.getContext('2d', { alpha: true, desynchronized: true });
        if (!context) {
            canvas = null;
            return api;
        }
        documentRef.body.prepend(canvas);
        resize();
        windowRef.addEventListener('resize', () => {
            if (resizeFrameId) return;
            resizeFrameId = windowRef.requestAnimationFrame(() => {
                resizeFrameId = 0;
                resize();
            });
        }, { passive: true });
        windowRef.addEventListener('pointermove', (event) => {
            if (event.pointerType === 'touch') return;
            pointer.x = event.clientX;
            pointer.y = event.clientY;
            pointer.active = true;
            lastPointerAt = Date.now();
        }, { passive: true });
        windowRef.addEventListener('pointerleave', () => { pointer.active = false; }, { passive: true });
        windowRef.addEventListener('blur', () => { pointer.active = false; }, { passive: true });
        start();
        return api;
    }

    const api = Object.freeze({
        init,
        setEnabled,
        setCelebrationsEnabled,
        configure,
        getSettings,
        getPerformanceSnapshot: () => Object.freeze({ framesDrawn, lastFrameCostMs: Number(lastFrameCost.toFixed(2)), averageFrameCostMs: Number(averageFrameCost.toFixed(2)), particleCount: particles.length, lowPowerMode: lowPowerDevice, frameIntervalMs: Number(frameInterval.toFixed(2)), reducedMotion: isReducedMotion() }),
        burstAt,
        stop,
    });
    return api;
}

const visualEffects = createVisualEffectsController();
export function initVisualEffects() {
    visualEffects.init();
    window.SYSTEMVisualEffects = visualEffects;
    return visualEffects;
}
