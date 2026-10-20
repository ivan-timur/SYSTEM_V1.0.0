/* SYSTEM 1.0.0 service worker — generated complete same-origin app shell. */
const APP_VERSION = "1.0.0";
const CACHE_NAME = `system-v${APP_VERSION}`;
const SHELL = [
  "./",
  "index.html",
  "VERSION",
  "manifest.webmanifest",
  "sw.js",
  "assets/images/backgrounds/ai-bg.webp",
  "assets/images/backgrounds/quest-bg.webp",
  "assets/images/backgrounds/rewards-bg.webp",
  "assets/images/backgrounds/settings-bg.webp",
  "assets/images/backgrounds/status-bg.webp",
  "assets/images/icons/ai.webp",
  "assets/images/icons/quest.webp",
  "assets/images/icons/rewards.webp",
  "assets/images/icons/settings.webp",
  "assets/images/icons/stats/computer.webp",
  "assets/images/icons/stats/entrepreneurship.webp",
  "assets/images/icons/stats/global-skills.webp",
  "assets/images/icons/stats/mathematics.webp",
  "assets/images/icons/stats/physics.webp",
  "assets/images/icons/stats/unique-thinking.webp",
  "assets/images/icons/status.webp",
  "assets/images/ranks/rank-a.svg",
  "assets/images/ranks/rank-b.svg",
  "assets/images/ranks/rank-c.svg",
  "assets/images/ranks/rank-d.svg",
  "assets/images/ranks/rank-e.webp",
  "assets/images/ranks/rank-s.svg",
  "assets/images/ui/Boss_Quest.webp",
  "assets/images/ui/Custom_Quest.webp",
  "css/features/apex-evolution.css",
  "css/features/experience.css",
  "css/features/goal-progress.css",
  "css/features/grok-suite.css",
  "css/features/personal-profile-settings.css",
  "css/features/rebirth-core.css",
  "css/features/rewards-ascension.css",
  "css/features/rewards-plus.css",
  "css/features/royal.css",
  "css/features/system-update.css",
  "css/features/visual-effects.css",
  "css/foundation/animations.css",
  "css/foundation/bilingual.css",
  "css/foundation/components.css",
  "css/foundation/design-tokens.css",
  "css/foundation/layout.css",
  "css/foundation/reset.css",
  "css/foundation/responsive.css",
  "css/foundation/style.css",
  "css/foundation/variables.css",
  "css/pages/ai.css",
  "css/pages/quest.css",
  "css/pages/rewards.css",
  "css/pages/settings.css",
  "css/pages/skills.css",
  "css/pages/status-reference.css",
  "css/pages/status.css",
  "css/refinements/adaptive-learning-path.css",
  "css/refinements/apex-finish.css",
  "css/refinements/apex-style.css",
  "css/refinements/atelier-nocturne.css",
  "css/refinements/atelier-pro.css",
  "css/refinements/beauty-apex.css",
  "css/refinements/beauty-foundation.css",
  "css/refinements/beauty-refinement.css",
  "css/refinements/beauty-signature.css",
  "css/refinements/command-deck.css",
  "css/refinements/crystal.css",
  "css/refinements/layout-organization.css",
  "css/refinements/mobile-nav-integrity.css",
  "css/refinements/mobile-premium.css",
  "css/refinements/mobile.css",
  "css/refinements/phase24-performance.css",
  "css/refinements/polish.css",
  "css/refinements/precision-foundation.css",
  "css/refinements/precision-refinement.css",
  "css/refinements/reduced-motion-override.css",
  "css/refinements/refinement.css",
  "css/refinements/rewards-beauty.css",
  "css/refinements/rewards-citadel.css",
  "css/refinements/rewards-couture.css",
  "css/refinements/rewards-elite.css",
  "css/refinements/rewards-miniature.css",
  "css/refinements/skill-mastery-refinement.css",
  "css/refinements/skill-review-refinement.css",
  "css/refinements/smart-roadmap-layout.css",
  "css/refinements/smart-roadmap-refinement.css",
  "css/refinements/status-declutter.css",
  "css/refinements/status-refinement.css",
  "css/refinements/theme-atelier-foundation.css",
  "css/refinements/theme-atelier-signature.css",
  "css/refinements/theme-engine-advanced.css",
  "css/system.css",
  "css/themes/aether-luxe.css",
  "css/themes/aurora.css",
  "css/themes/obsidian-couture.css",
  "css/themes/palettes.css",
  "css/themes/royal.css",
  "css/themes/theme-forge.css",
  "css/themes/theme-picker.css",
  "js/app.js",
  "js/core/goal-progress.js",
  "js/core/intelligence-engine.js",
  "js/core/progression-idempotency.js",
  "js/core/progression-math.js",
  "js/core/skill-curriculum.js",
  "js/core/skill-mastery.js",
  "js/core/skill-review.js",
  "js/core/smart-roadmap.js",
  "js/core/storage.js",
  "js/features/adaptive-learning-ui.js",
  "js/features/ai-quest-parser.js",
  "js/features/apex-evolution.js",
  "js/features/auto-snapshots.js",
  "js/features/experience.js",
  "js/features/grok-suite.js",
  "js/features/i18n.js",
  "js/features/personal-profile-settings.js",
  "js/features/quest-ascension.js",
  "js/features/rebirth-core.js",
  "js/features/rewards-ascension.js",
  "js/features/rewards-plus.js",
  "js/features/royal.js",
  "js/features/status-more.js",
  "js/generated/progression-math.js",
  "js/legacy/app-controller.js",
  "js/modules/ai-workspace-navigation.js",
  "js/modules/android-native.js",
  "js/modules/durable-storage-gate.js",
  "js/modules/security.js",
  "js/modules/storage.js",
  "js/modules/version.js",
  "js/modules/visual-effects.js",
  "dist/ts/core/achievements.js",
  "dist/ts/core/activity-ledger.js",
  "dist/ts/core/daily-quest-streak.js",
  "dist/ts/core/progression.js",
  "dist/ts/core/reward-command.js",
  "dist/ts/data/quest-catalog.js",
  "dist/ts/data/seed-validation.js",
  "dist/ts/features/adaptive-learning-path.js",
  "dist/ts/features/curriculum-command.js",
  "dist/ts/features/daily-quest-command.js",
  "dist/ts/features/goal-curriculum.js",
  "dist/ts/features/learning-cycle.js",
  "dist/ts/features/quest-command.js",
  "dist/ts/features/quest-completion-plan.js",
  "dist/ts/features/skill-assessment.js",
  "dist/ts/package.json",
  "dist/ts/storage/database-health.js",
  "dist/ts/storage/indexeddb.js",
  "dist/ts/storage/legacy-daily-quest-state.js",
  "dist/ts/storage/legacy-migration.js"
];

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(SHELL);
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("system-v") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;
    const requestUrl = new URL(request.url);
    if (requestUrl.origin !== self.location.origin) return;

    const imageRequest = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(requestUrl.pathname);
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        if (imageRequest) {
            const cached = await cache.match(request);
            if (cached) return cached;
            const network = await fetch(request);
            if (network.ok) await cache.put(request, network.clone());
            return network;
        }
        try {
            const network = await fetch(request);
            if (network.ok) await cache.put(request, network.clone());
            return network;
        } catch (error) {
            const cached = await cache.match(request);
            if (cached) return cached;
            const fallback = await cache.match("index.html");
            if (fallback && request.mode === "navigate") return fallback;
            throw error;
        }
    })());
});
