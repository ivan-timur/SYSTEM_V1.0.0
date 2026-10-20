/* SYSTEM — Reward Ascension Layer.
   Adds persistent favourites, next-milestone guidance, vault protection meters,
   and a portable reward-history export without replacing the stable reward engine. */
(function () {
    "use strict";
    if (typeof rewardDefinitions === "undefined" || typeof window.updateRewardCards !== "function") return;

    const FAVORITES_KEY = "system_v2_reward_favorites";
    const REWARD_LOG_KEY = "system_v2_reward_log";
    const VAULT_KEY = "system_v2_mystery_vault";
    const PAGE = document.getElementById("rewards-page");
    const HUB = PAGE && PAGE.querySelector(".rp-hub");
    const GRID = PAGE && PAGE.querySelector("#reward-card-grid");
    if (!PAGE || !HUB || !GRID) return;

    const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
    const safeNumber = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
    const whole = value => Math.floor(safeNumber(value)).toLocaleString();
    const readJSON = (key, fallback) => {
        try {
            if (typeof readLocalJSON === "function") return readLocalJSON(key, fallback);
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (_) { return fallback; }
    };
    const writeJSON = (key, value) => {
        try {
            if (typeof writeLocalJSON === "function") return writeLocalJSON(key, value) !== false;
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (_) { return false; }
    };
    const initialFavorites = readJSON(FAVORITES_KEY, []);
    let favorites = new Set(Array.isArray(initialFavorites)
        ? initialFavorites.filter(id => typeof id === "string" && id.length <= 140).slice(0, 250)
        : []);
    let savedFilterActive = false;
    let routePanel = null;

    function rewardByTitle(title) { return rewardDefinitions[title] || null; }
    function isClaimed(definition) {
        return Boolean(definition && Array.isArray(rewardState.claimed) && rewardState.claimed.includes(definition.id));
    }
    function currentMetric(kind) {
        if (kind === "quests") return safeNumber(systemProgress && systemProgress.totalDailyQuestsCompleted);
        if (kind === "level") return safeNumber(systemState && systemState.player && systemState.player.level) || 1;
        if (kind === "streak") return safeNumber(dailyLoginState && dailyLoginState.bestStreak);
        return 0;
    }
    function routeCandidates(kind) {
        if (kind === "quests") return [
            ["First Mission", 1], ["Quest Adept", 10], ["Quest Veteran", 50],
            ["Centurion", 100], ["Quest Champion", 250], ["Quest Legend", 500]
        ];
        if (kind === "level") return [
            ["Explorer", 2], ["Level Five", 5], ["Level Ten", 10], ["Level Twenty", 20],
            ["Level Thirty", 30], ["Level Fifty", 50], ["Level Hundred", 100]
        ];
        return [
            ["Three-Day Streak", 3], ["Week Warrior", 7], ["Fortnight Flame", 14],
            ["Monthly Legend", 30], ["Two-Month Flame", 60], ["Century Flame", 100]
        ];
    }
    function nextRouteReward(kind) {
        const current = currentMetric(kind);
        const rows = routeCandidates(kind).map(([title, target]) => ({ title, target, definition: rewardByTitle(title) }));
        const available = rows.filter(row => row.definition);
        return available.find(row => !(current >= row.target && isClaimed(row.definition))) || available[available.length - 1] || null;
    }
    function routeCard(kind, label, sublabel) {
        const row = nextRouteReward(kind);
        if (!row) return "";
        const current = currentMetric(kind);
        const value = Math.min(current, row.target);
        const percent = Math.round((value / Math.max(1, row.target)) * 100);
        const claimed = isClaimed(row.definition);
        const eligible = typeof window.canClaimReward === "function" && window.canClaimReward(row.definition);
        const state = claimed && current >= row.target ? "SECURED" : eligible ? "READY TO CLAIM" : "IN PROGRESS";
        const action = claimed && current >= row.target ? "Milestone secured" : eligible ? "View reward" : "Track milestone";
        return `<article class="ra-route-card ra-route-${kind}">
            <div class="ra-route-head"><span class="ra-route-kind">${label}</span><span class="ra-route-state ${eligible && !claimed ? "is-ready" : claimed ? "is-done" : ""}">${state}</span></div>
            <h3>${escapeHTML(row.title)}</h3>
            <p>${escapeHTML(row.definition.description || sublabel)}</p>
            <div class="ra-route-progress" role="progressbar" aria-label="${escapeHTML(row.title)} milestone progress" aria-valuemin="0" aria-valuemax="${row.target}" aria-valuenow="${value}"><i style="width:${percent}%"></i></div>
            <div class="ra-route-foot"><span>${whole(value)} / ${whole(row.target)} ${sublabel}</span><button type="button" data-ra-route="${escapeHTML(row.title)}" ${claimed && current >= row.target ? "disabled" : ""}>${action}</button></div>
        </article>`;
    }

    function ensureRoutePanel() {
        if (routePanel && routePanel.isConnected) return routePanel;
        routePanel = document.createElement("section");
        routePanel.className = "ra-ascension";
        routePanel.setAttribute("aria-labelledby", "ra-ascension-title");
        HUB.after(routePanel);
        return routePanel;
    }
    function renderRoutePanel() {
        const panel = ensureRoutePanel();
        const level = Math.max(1, safeNumber(systemState && systemState.player && systemState.player.level));
        const xp = safeNumber(systemState && systemState.player && systemState.player.xp);
        const required = Math.max(1, safeNumber(systemState && systemState.player && systemState.player.xpRequired) || 1000);
        const xpPercent = Math.min(100, Math.round((xp / required) * 100));
        const progress = safeNumber(systemProgress && systemProgress.totalDailyQuestsCompleted);
        const streak = safeNumber(dailyLoginState && dailyLoginState.currentStreak);
        panel.innerHTML = `
            <div class="ra-section-heading"><div><span class="ra-kicker">THE NEXT ASCENSION</span><h2 id="ra-ascension-title">Your Reward Route</h2><p>Three measurable milestones, selected from your current SYSTEM progress.</p></div><div class="ra-level-mark"><span>PLAYER LEVEL</span><strong>${whole(level)}</strong></div></div>
            <div class="ra-xp-overview"><div class="ra-xp-label"><span>LEVEL EXPERIENCE</span><b>${whole(xp)} <small>/ ${whole(required)} XP</small></b></div><div class="ra-xp-track" role="progressbar" aria-label="Player XP progress" aria-valuemin="0" aria-valuemax="${required}" aria-valuenow="${Math.min(xp, required)}"><i style="width:${xpPercent}%"></i></div><div class="ra-xp-foot"><span>${whole(Math.max(0, required - xp))} XP to next level</span><span>${xpPercent}%</span></div></div>
            <div class="ra-route-grid">${routeCard("quests", "QUEST MILESTONE", "daily quests")}${routeCard("level", "LEVEL MILESTONE", "player levels")}${routeCard("streak", "STREAK MILESTONE", "consecutive days")}</div>
            <div class="ra-route-note"><span class="ra-note-dot" aria-hidden="true"></span><span>Current record: <b>${whole(progress)}</b> daily quests completed · <b>${whole(streak)}</b> day current login streak. Rewards are only granted by the normal claim transaction.</span></div>`;
    }

    function updateFavoriteButtons() {
        GRID.querySelectorAll(".reward-card").forEach(card => {
            const title = card.querySelector("h3");
            const definition = title ? rewardByTitle(title.textContent.trim()) : null;
            if (!definition) return;
            let button = card.querySelector("[data-ra-favorite]");
            if (!button) {
                button = document.createElement("button");
                button.type = "button";
                button.className = "ra-favorite";
                button.dataset.raFavorite = definition.id;
                button.setAttribute("aria-pressed", "false");
                button.setAttribute("aria-label", `Save ${title.textContent.trim()} to favourites`);
                button.title = "Save to favourites";
                button.textContent = "☆";
                card.appendChild(button);
            }
            const active = favorites.has(definition.id);
            button.classList.toggle("is-favorite", active);
            button.setAttribute("aria-pressed", String(active));
            button.setAttribute("aria-label", `${active ? "Remove" : "Save"} ${title.textContent.trim()} ${active ? "from" : "to"} favourites`);
            button.title = active ? "Remove from favourites" : "Save to favourites";
            button.textContent = active ? "★" : "☆";
        });
    }

    function ensureSavedFilter() {
        const select = HUB.querySelector("[data-rp-status]");
        if (!select) return;
        let option = [...select.options].find(item => item.value === "saved");
        if (!option) {
            option = document.createElement("option");
            option.value = "saved";
            option.textContent = "Favourites";
            select.appendChild(option);
        }
        if (savedFilterActive) select.value = "saved";
    }

    function applySavedFilter() {
        const select = HUB.querySelector("[data-rp-status]");
        if (!select || select.value !== "saved") return;
        savedFilterActive = true;
        const tabs = [...PAGE.querySelectorAll(".reward-tab")];
        const tabIndex = Math.max(0, tabs.findIndex(tab => tab.classList.contains("active")));
        const categories = ["daily", "mission", "achievement", "special"];
        const query = String(HUB.querySelector("[data-rp-search]")?.value || "").trim().toLocaleLowerCase();
        let visible = 0;
        GRID.querySelectorAll(".reward-card").forEach(card => {
            const title = card.querySelector("h3");
            const description = card.querySelector("p");
            const definition = title ? rewardByTitle(title.textContent.trim()) : null;
            const textMatches = !query || `${title?.textContent || ""} ${description?.textContent || ""}`.toLocaleLowerCase().includes(query);
            const matches = Boolean(definition && definition.category === categories[tabIndex]
                && favorites.has(definition.id) && textMatches);
            card.hidden = !matches;
            if (matches) visible++;
        });
        const empty = HUB.querySelector(".rp-empty");
        if (empty) empty.hidden = visible > 0;
    }

    function saveFavorite(id) {
        const next = new Set(favorites);
        if (next.has(id)) next.delete(id);
        else if (next.size < 250) next.add(id);
        else {
            if (typeof notifySystem === "function") notifySystem("Favourites limit reached. Remove one saved reward first.");
            return;
        }
        const data = [...next];
        if (!writeJSON(FAVORITES_KEY, data)) {
            if (typeof notifySystem === "function") notifySystem("Favourite could not be saved. Check browser storage and try again.");
            return;
        }
        favorites = next;
        updateFavoriteButtons();
        if (savedFilterActive) applySavedFilter();
        renderRoutePanel();
        if (typeof notifySystem === "function") notifySystem(favorites.has(id) ? "Reward added to favourites." : "Reward removed from favourites.");
    }

    function csvCell(value) {
        const isTrustedNumber = typeof value === "number" && Number.isFinite(value);
        let text = String(value ?? "");
        if (!isTrustedNumber && /^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
    }
    function exportHistory() {
        const raw = readJSON(REWARD_LOG_KEY, []);
        const entries = Array.isArray(raw) ? raw.filter(row => row && typeof row === "object" && !Array.isArray(row)).slice(0, 10000) : [];
        if (!entries.length) {
            if (typeof notifySystem === "function") notifySystem("There is no reward history to export yet.");
            return;
        }
        const rows = [["Date", "Reward", "XP", "Coin change"], ...entries.map(row => {
            const timestamp = Number(row.t);
            const date = Number.isFinite(timestamp) ? new Date(Math.max(0, Math.min(Date.now() + 86400000, timestamp))) : new Date();
            return [date.toISOString(), String(row.title || "Reward").slice(0, 160), Math.max(0, Math.floor(safeNumber(row.xp))), Math.trunc(Number(row.coins) || 0)];
        })];
        const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`;
        try {
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `SYSTEM-reward-history-${typeof getLocalDateStamp === "function" ? getLocalDateStamp() : new Date().toISOString().slice(0, 10)}.csv`;
            link.hidden = true;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            if (typeof notifySystem === "function") notifySystem(`Exported ${entries.length} reward history records.`);
        } catch (_) {
            if (typeof notifySystem === "function") notifySystem("History export failed in this browser. Try another browser or check downloads permission.");
        }
    }

    function enhanceVaultProtection() {
        const info = HUB.querySelector(".rp-vault-info");
        if (!info) return;
        let vault = readJSON(VAULT_KEY, {});
        if (!vault || typeof vault !== "object" || Array.isArray(vault)) vault = {};
        const rareCount = Math.max(0, Math.min(9, Math.floor(safeNumber(vault.sinceRare))));
        const legendaryCount = Math.max(0, Math.min(39, Math.floor(safeNumber(vault.sinceLegendary))));
        let panel = info.querySelector(".ra-pity-grid");
        if (!panel) {
            panel = document.createElement("div");
            panel.className = "ra-pity-grid";
            info.appendChild(panel);
        }
        panel.innerHTML = `
            <div class="ra-pity-row"><div><span>RARE PROTECTION</span><b>${Math.max(1, 10 - rareCount)} opening${10 - rareCount === 1 ? "" : "s"} to guarantee</b></div><div class="ra-pity-track" role="progressbar" aria-label="Rare reward protection" aria-valuemin="0" aria-valuemax="9" aria-valuenow="${rareCount}"><i style="width:${Math.round((rareCount / 9) * 100)}%"></i></div><small>${rareCount} / 9 non-rare openings</small></div>
            <div class="ra-pity-row is-legendary"><div><span>LEGENDARY PROTECTION</span><b>${Math.max(1, 40 - legendaryCount)} opening${40 - legendaryCount === 1 ? "" : "s"} to guarantee</b></div><div class="ra-pity-track" role="progressbar" aria-label="Legendary reward protection" aria-valuemin="0" aria-valuemax="39" aria-valuenow="${legendaryCount}"><i style="width:${Math.round((legendaryCount / 39) * 100)}%"></i></div><small>${legendaryCount} / 39 non-legendary openings</small></div>`;
    }

    function addExportAction() {
        const actions = HUB.querySelector(".rp-actions");
        if (!actions || actions.querySelector("[data-ra-export]")) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ra-export-button";
        button.dataset.raExport = "true";
        button.textContent = "Export History";
        button.setAttribute("aria-label", "Export reward history as a CSV file");
        actions.appendChild(button);
    }

    GRID.addEventListener("click", event => {
        const button = event.target.closest("[data-ra-favorite]");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        saveFavorite(button.dataset.raFavorite);
    });
    HUB.addEventListener("click", event => {
        const exportButton = event.target.closest("[data-ra-export]");
        if (exportButton) {
            event.preventDefault();
            exportHistory();
            return;
        }
        const routeButton = event.target.closest("[data-ra-route]");
        if (!routeButton) return;
        const title = routeButton.dataset.raRoute;
        const tab = PAGE.querySelector("#reward-tab-achievement");
        const status = HUB.querySelector("[data-rp-status]");
        const search = HUB.querySelector("[data-rp-search]");
        if (tab) tab.click();
        if (status) {
            status.value = "all";
            savedFilterActive = false;
            status.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (search) {
            search.value = title;
            search.dispatchEvent(new Event("input", { bubbles: true }));
        }
        const targetCard = [...GRID.querySelectorAll(".reward-card")].find(card => card.querySelector("h3")?.textContent.trim() === title);
        if (targetCard) {
            targetCard.hidden = false;
            if (typeof window.selectRewardCard === "function") window.selectRewardCard(targetCard);
            targetCard.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
        }
    });
    HUB.addEventListener("change", event => {
        if (!event.target.matches("[data-rp-status]")) return;
        savedFilterActive = event.target.value === "saved";
        if (savedFilterActive) applySavedFilter();
    });
    HUB.addEventListener("input", event => {
        if (event.target.matches("[data-rp-search]") && savedFilterActive) applySavedFilter();
    });
    PAGE.addEventListener("click", event => {
        if (!event.target.closest(".reward-tab")) return;
        window.setTimeout(() => { if (savedFilterActive) applySavedFilter(); }, 0);
    });

    const baseUpdate = window.updateRewardCards;
    window.updateRewardCards = function () {
        const result = baseUpdate.apply(this, arguments);
        ensureSavedFilter();
        addExportAction();
        updateFavoriteButtons();
        enhanceVaultProtection();
        renderRoutePanel();
        if (savedFilterActive) applySavedFilter();
        return result;
    };

    ensureSavedFilter();
    addExportAction();
    updateFavoriteButtons();
    enhanceVaultProtection();
    renderRoutePanel();
    window.updateRewardCards();
})();
