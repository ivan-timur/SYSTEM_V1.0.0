/* SYSTEM — Rewards Command Center.
   Extends the stable legacy reward APIs while keeping existing save IDs, claim logic,
   mystery-box pity counters, and reward history compatible with prior releases. */
(function () {
    "use strict";
    if (typeof rewardDefinitions === "undefined" || typeof window.updateRewardCards !== "function") return;

    const LOG_KEY = "system_v2_reward_log";
    const VAULT_KEY = "system_v2_mystery_vault";
    const BOX_COST = 100;
    const esc = value => String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
    const lv = () => Math.max(1, Number(systemState.player.level) || 1);
    const statLevels = () => Object.values(systemState.stats || {}).map(stat => Number(stat.level) || 1);
    const questStreak = () => {
        const state = readLocalJSON("system_v2_quest_streak", null);
        return state && state.last ? Math.max(0, Number(state.streak) || 0) : 0;
    };
    const safeMetric = metric => {
        const value = Number(metric());
        return Number.isFinite(value) ? Math.max(0, value) : 0;
    };
    const A = (id, title, xp, coins, description, current, max) => [title, {
        id: `achievement-${id}`,
        category: "achievement",
        xp,
        coins,
        minLevel: 1,
        description,
        dynamic: true,
        progress: () => [Math.min(safeMetric(current), max), max],
        test: () => safeMetric(current) >= max
    }];

    /* Additional permanent achievements are data-driven and progress-aware. */
    const EXTRA = Object.fromEntries([
        A("quest-veteran", "Quest Veteran", 300, 120, "Complete 50 daily quests in total.", () => systemProgress.totalDailyQuestsCompleted, 50),
        A("centurion", "Centurion", 600, 250, "Complete 100 daily quests in total.", () => systemProgress.totalDailyQuestsCompleted, 100),
        A("streak-14", "Fortnight Flame", 350, 150, "Reach a 14-day daily login streak.", () => dailyLoginState.bestStreak, 14),
        A("streak-30", "Monthly Legend", 900, 350, "Reach a 30-day daily login streak.", () => dailyLoginState.bestStreak, 30),
        A("iron-discipline", "Iron Discipline", 280, 110, "Keep a 7-day daily-quest streak.", questStreak, 7),
        A("level-ten", "Level Ten", 400, 150, "Reach Player Level 10.", lv, 10),
        A("level-twenty", "Level Twenty", 900, 300, "Reach Player Level 20.", lv, 20),
        A("rank-d", "Rank D Ascendant", 200, 80, "Reach Rank D (Level 6).", lv, 6),
        A("rank-c", "Rank C Ascendant", 450, 180, "Reach Rank C (Level 11).", lv, 11),
        A("rank-b", "Rank B Ascendant", 1000, 400, "Reach Rank B (Level 21).", lv, 21),
        A("specialist", "Specialist", 300, 120, "Raise any core stat to Level 5.", () => Math.max(1, ...statLevels()), 5),
        A("polymath", "Polymath", 500, 200, "Raise all six core stats to Level 3.", () => Math.min(...statLevels()), 3),
        A("boss-hunter", "Boss Hunter", 400, 160, "Clear five Boss Quests.", () => systemProgress.totalBossQuestsCompleted, 5),
        A("guild-architect", "Guild Architect", 250, 100, "Complete five custom quests you created.", () => systemProgress.totalCustomQuestsCompleted, 5),
        A("quest-champion", "Quest Champion", 1200, 500, "Complete 250 daily quests in total.", () => systemProgress.totalDailyQuestsCompleted, 250),
        A("quest-legend", "Quest Legend", 2400, 1000, "Complete 500 daily quests in total.", () => systemProgress.totalDailyQuestsCompleted, 500),
        A("streak-60", "Two-Month Flame", 1500, 600, "Reach a 60-day daily login streak.", () => dailyLoginState.bestStreak, 60),
        A("streak-100", "Century Flame", 3000, 1200, "Reach a 100-day daily login streak.", () => dailyLoginState.bestStreak, 100),
        A("level-thirty", "Level Thirty", 1500, 500, "Reach Player Level 30.", lv, 30),
        A("level-fifty", "Level Fifty", 3000, 1200, "Reach Player Level 50.", lv, 50),
        A("level-hundred", "Level Hundred", 10000, 4000, "Reach Player Level 100.", lv, 100),
        A("boss-conqueror", "Boss Conqueror", 1000, 400, "Clear 10 Boss Quests.", () => systemProgress.totalBossQuestsCompleted, 10),
        A("boss-myth", "Boss Myth", 3000, 1200, "Clear 25 Boss Quests.", () => systemProgress.totalBossQuestsCompleted, 25),
        A("guild-master", "Guild Master", 2000, 800, "Complete 50 custom quests you created.", () => systemProgress.totalCustomQuestsCompleted, 50),
        A("core-apex", "Core Apex", 1000, 400, "Raise any core stat to Level 10.", () => Math.max(1, ...statLevels()), 10),
        A("six-pillars", "Six Pillars", 2000, 800, "Raise all six core stats to Level 5.", () => Math.min(...statLevels()), 5)
    ]);
    Object.assign(rewardDefinitions, EXTRA);
    const extraById = Object.fromEntries(Object.values(EXTRA).map(definition => [definition.id, definition]));

    const doneToday = () => Math.max(0, Number(getCompletedQuestCount()) || 0);
    const BASE_PROGRESS = {
        "video-reward": () => [Math.min(doneToday(), 1), 1],
        "achievement-first-mission": () => [Math.min(Number(systemProgress.totalDailyQuestsCompleted) || 0, 1), 1],
        "achievement-quest-adept": () => [Math.min(Number(systemProgress.totalDailyQuestsCompleted) || 0, 10), 10],
        "achievement-streak-3": () => [Math.min(Number(dailyLoginState.bestStreak) || 0, 3), 3],
        "achievement-streak-7": () => [Math.min(Number(dailyLoginState.bestStreak) || 0, 7), 7],
        "achievement-boss-slayer": () => [Math.min(Number(systemProgress.totalBossQuestsCompleted) || 0, 1), 1],
        "achievement-skill-seeker": () => [Math.min(Math.max(1, ...statLevels()), 2), 2],
        "achievement-level-five": () => [Math.min(lv(), 5), 5],
        "achievement-quest-architect": () => [Math.min(Number(systemProgress.totalCustomQuestsCompleted) || 0, 1), 1],
        "mission-completion": () => [Math.min(doneToday(), 1), 1],
        "study-streak": () => [Math.min(doneToday(), 3), 3],
        "explorer": () => [Math.min(lv(), 2), 2],
        "level-up": () => [Math.min(lv(), 2), 2],
        "mystery-reward": () => [Math.min(lv(), 5), 5]
    };
    const progressOf = definition => {
        const progress = extraById[definition.id]?.progress || BASE_PROGRESS[definition.id];
        if (typeof progress !== "function") return null;
        const [rawCurrent, rawMax] = progress();
        const max = Math.max(1, Number(rawMax) || 1);
        const current = Math.max(0, Math.min(max, Number(rawCurrent) || 0));
        return [current, max];
    };
    const rarityOf = definition => {
        const xp = Math.max(0, Number(definition.xp) || 0);
        return xp >= 800 ? "legendary" : xp >= 400 ? "epic" : xp >= 180 ? "rare" : xp >= 90 ? "uncommon" : "common";
    };

    const baseCan = window.canClaimReward;
    window.canClaimReward = definition => Boolean(baseCan(definition)
        && !(definition && extraById[definition.id] && !extraById[definition.id].test()));

    /* ---------- Bounded reward history ---------- */
    const readLog = () => {
        const log = readLocalJSON(LOG_KEY, []);
        if (!Array.isArray(log)) return [];
        return log.filter(entry => entry && typeof entry === "object" && !Array.isArray(entry)).slice(0, 30).map(entry => ({
            t: Number.isFinite(Number(entry.t)) ? Math.max(0, Math.min(Date.now() + 86400000, Number(entry.t))) : Date.now(),
            title: String(entry.title ?? "Reward").slice(0, 140),
            xp: Math.max(0, Math.min(10000, Math.floor(Number(entry.xp) || 0))),
            coins: Math.max(-1000, Math.min(10000, Math.floor(Number(entry.coins) || 0)))
        }));
    };
    const addLog = entry => writeLocalJSON(LOG_KEY, [entry, ...readLog()].slice(0, 30));

    function burst(card) {
        if (!card || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
        const wrap = document.createElement("div");
        wrap.className = "rp-burst";
        wrap.setAttribute("aria-hidden", "true");
        for (let index = 0; index < 14; index++) {
            const spark = document.createElement("span");
            const angle = (index / 14) * Math.PI * 2;
            spark.style.setProperty("--dx", `${Math.cos(angle) * 72}px`);
            spark.style.setProperty("--dy", `${Math.sin(angle) * 72}px`);
            wrap.appendChild(spark);
        }
        card.appendChild(wrap);
        window.setTimeout(() => wrap.remove(), 900);
    }

    const baseClaim = window.claimReward;
    window.claimReward = function (card) {
        const before = new Set(rewardState.claimed);
        const result = baseClaim.apply(this, arguments);
        const newlyClaimed = rewardState.claimed.filter(id => !before.has(id));
        newlyClaimed.forEach(id => {
            const match = Object.entries(rewardDefinitions).find(([, definition]) => definition.id === id);
            if (match) {
                addLog({ t: Date.now(), title: match[0], xp: match[1].xp, coins: match[1].coins || 0 });
                if (match[1].category === "achievement") {
                    const isDari = document.body?.dataset?.systemLanguage === "fa";
                    window.dispatchEvent(new CustomEvent("system-achievement-unlocked", { detail: {
                        title: isDari ? "نشان باز شد" : "ACHIEVEMENT UNLOCKED",
                        message: match[0],
                        target: card
                    }}));
                }
            }
            burst(card);
        });
        // The base claim refreshes cards before this wrapper writes the history; refresh once more
        // only after a successful claim so the newest receipt is immediately visible.
        if (newlyClaimed.length && typeof window.updateRewardCards === "function") window.updateRewardCards();
        return result;
    };

    const baseDailyLoginClaim = window.claimDailyLoginReward;
    if (typeof baseDailyLoginClaim === "function") {
        window.claimDailyLoginReward = function () {
            const today = getLocalDateStamp();
            const previousClaimDate = dailyLoginState.lastClaimDate;
            const result = baseDailyLoginClaim.apply(this, arguments);
            if (previousClaimDate !== today && dailyLoginState.lastClaimDate === today
                && Array.isArray(DAILY_LOGIN_REWARDS) && DAILY_LOGIN_REWARDS.length) {
                const rewardDay = ((dailyLoginState.currentStreak - 1) % DAILY_LOGIN_REWARDS.length) + 1;
                const reward = DAILY_LOGIN_REWARDS[rewardDay - 1];
                if (reward) addLog({ t: Date.now(), title: `Daily Login · Day ${rewardDay}`, xp: reward.xp, coins: reward.coins });
                if (typeof window.updateRewardCards === "function") window.updateRewardCards();
            }
            return result;
        };
    }

    /* ---------- Mystery Vault: documented odds, soft pity, transaction-safe reward ---------- */
    const TABLE = [
        { k: "common", w: 55, xp: [60, 120], coins: [0, 0] },
        { k: "uncommon", w: 28, xp: [150, 250], coins: [20, 50] },
        { k: "rare", w: 13, xp: [300, 500], coins: [60, 120] },
        { k: "legendary", w: 4, xp: [800, 1200], coins: [200, 300] }
    ];
    const rand = () => (window.crypto && crypto.getRandomValues)
        ? crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296
        : Math.random();
    const between = ([low, high]) => low + Math.floor(rand() * (high - low + 1));
    const readVault = () => {
        const saved = readLocalJSON(VAULT_KEY, {});
        const raw = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
        const boundedInt = (value, max) => Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
        return {
            opens: boundedInt(raw.opens, 100000000),
            sinceRare: boundedInt(raw.sinceRare, 100),
            sinceLegendary: boundedInt(raw.sinceLegendary, 1000)
        };
    };
    function rollTier(vault) {
        let roll = rand() * 100;
        let tier = TABLE[0];
        for (const row of TABLE) {
            if (roll < row.w) { tier = row; break; }
            roll -= row.w;
        }
        if (vault.sinceLegendary >= 39) return TABLE[3];
        if (vault.sinceRare >= 9 && (tier.k === "common" || tier.k === "uncommon")) return TABLE[2];
        return tier;
    }
    let lastResult = null;
    function openBox() {
        if ((Number(systemState.player.coins) || 0) < BOX_COST) {
            notifySystem(`You need ${BOX_COST} Coins to open a Mystery Box.`);
            return;
        }
        const vault = readVault();
        let prize = null;
        const ok = runSystemTransaction("Mystery Box", () => {
            const tier = rollTier(vault);
            prize = { tier: tier.k, xp: between(tier.xp), coins: between(tier.coins) };
            const next = {
                opens: vault.opens + 1,
                sinceRare: tier.k === "rare" || tier.k === "legendary" ? 0 : vault.sinceRare + 1,
                sinceLegendary: tier.k === "legendary" ? 0 : vault.sinceLegendary + 1
            };
            if (!spendSystemCoins(BOX_COST)) return false;
            if (!addPlayerXP(prize.xp)) return false;
            if (prize.coins > 0 && !addSystemCoins(prize.coins)) return false;
            // Save the pity counters last so a failed reward write cannot consume a box attempt.
            if (!writeLocalJSON(VAULT_KEY, next)) return false;
            return true;
        });
        if (!ok || !prize) return;
        lastResult = prize;
        addLog({ t: Date.now(), title: `Mystery Box · ${prize.tier}`, xp: prize.xp, coins: prize.coins - BOX_COST });
        if (window.SYSTEMSound) SYSTEMSound.play(prize.tier === "legendary" ? "levelup" : prize.tier === "rare" ? "streak" : "reward");
        notifySystem(`Mystery Box (${prize.tier}): +${prize.xp} XP${prize.coins ? `, +${prize.coins} Coins` : ""}.`);
        window.updateRewardCards();
    }

    function claimAll() {
        let claimedCount = 0;
        const loginButton = document.getElementById("daily-login-claim");
        const loginAlreadyClaimed = typeof getLocalDateStamp === "function"
            && dailyLoginState.lastClaimDate === getLocalDateStamp();
        if (loginButton && !loginButton.disabled && !loginAlreadyClaimed && typeof window.claimDailyLoginReward === "function") {
            window.claimDailyLoginReward();
            if (dailyLoginState.lastClaimDate === getLocalDateStamp()) claimedCount++;
        }

        // Re-check up to three passes so newly unlocked streak/quest achievements can be claimed too.
        for (let pass = 0; pass < 3; pass++) {
            const cards = [...document.querySelectorAll("#rewards-page .available-rewards .reward-card")];
            let passCount = 0;
            for (const card of cards) {
                const title = card.querySelector("h3");
                const definition = title ? rewardDefinitions[title.textContent.trim()] : null;
                if (!definition || rewardState.claimed.includes(definition.id) || !window.canClaimReward(definition)) continue;
                const before = rewardState.claimed.length;
                window.claimReward(card);
                if (rewardState.claimed.length > before) passCount++;
            }
            claimedCount += passCount;
            if (passCount === 0) break;
        }
        if (!claimedCount) {
            notifySystem("No rewards are ready to claim. Complete a quest or meet a reward requirement first.");
            return;
        }
        notifySystem(`Collected ${claimedCount} reward${claimedCount === 1 ? "" : "s"}.`);
        window.updateRewardCards();
    }

    /* ---------- Hub state, search, status filters and sorting ---------- */
    const panel = document.querySelector("#rewards-page .daily-reward-panel");
    const hub = document.createElement("section");
    hub.className = "rp-hub";
    hub.setAttribute("aria-label", "Rewards command center");
    if (panel) panel.after(hub);

    let currentSearch = "";
    let currentStatus = "all";
    let currentSort = "recommended";
    hub.addEventListener("click", event => {
        const button = event.target.closest("[data-rp]");
        if (!button) return;
        if (button.dataset.rp === "all") claimAll();
        if (button.dataset.rp === "box") openBox();
    });
    hub.addEventListener("input", event => {
        if (!event.target.matches("[data-rp-search]")) return;
        currentSearch = event.target.value.slice(0, 100);
        applyFilter();
    });
    hub.addEventListener("change", event => {
        if (event.target.matches("[data-rp-status]")) currentStatus = event.target.value;
        if (event.target.matches("[data-rp-sort]")) currentSort = event.target.value;
        if (event.target.matches("[data-rp-status], [data-rp-sort]")) applyFilter();
    });

    // Three visible tabs intentionally group both repeatable daily and mission rewards together.
    // Keep category routing explicit: index-based routing previously hid achievement/special rewards.
    const CATS = [["daily", "mission"], ["achievement"], ["special"]];
    const number = value => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString();
    const signedNumber = value => {
        const amount = Math.trunc(Number(value) || 0);
        return `${amount > 0 ? "+" : amount < 0 ? "−" : ""}${Math.abs(amount).toLocaleString()}`;
    };
    const option = (value, label) => `<option value="${value}"${currentStatus === value ? " selected" : ""}>${label}</option>`;

    function syncTabs() {
        document.querySelectorAll("#rewards-page .reward-tab").forEach((tab, index) => {
            const selected = tab.classList.contains("active");
            tab.setAttribute("role", "tab");
            tab.setAttribute("aria-selected", String(selected));
            tab.tabIndex = selected ? 0 : -1;
            tab.setAttribute("aria-controls", "reward-card-grid");
            let badge = tab.querySelector(".rp-badge");
            if (!badge) { badge = document.createElement("i"); badge.className = "rp-badge"; tab.appendChild(badge); }
            const count = Object.values(rewardDefinitions).filter(definition => CATS[index]?.includes(definition.category)
                && !rewardState.claimed.includes(definition.id) && window.canClaimReward(definition)).length;
            badge.textContent = String(count);
            badge.hidden = count === 0;
            tab.setAttribute("aria-label", `${tab.textContent.replace(/\d+\s*$/, "").trim()}: ${count} ready to claim`);
        });
        const selectedTab = document.querySelector("#rewards-page .reward-tab.active");
        const grid = document.getElementById("reward-card-grid");
        if (selectedTab && grid) grid.setAttribute("aria-labelledby", selectedTab.id);
    }

    function renderHub() {
        const definitions = Object.values(rewardDefinitions);
        const claimableDefinitions = definitions.filter(definition => !rewardState.claimed.includes(definition.id) && window.canClaimReward(definition)).length;
        const dailyLoginReady = Boolean(document.getElementById("daily-login-claim") && !document.getElementById("daily-login-claim").disabled);
        const claimable = claimableDefinitions + Number(dailyLoginReady);
        const permanentDefinitions = definitions.filter(definition => definition.category !== "daily" && definition.category !== "mission");
        const collected = permanentDefinitions.filter(definition => rewardState.claimed.includes(definition.id)).length;
        const collectionPercent = Math.round((collected / Math.max(1, permanentDefinitions.length)) * 100);
        const vault = readVault();
        const log = readLog().slice(0, 8);
        const result = lastResult;
        const canAffordBox = (Number(systemState.player.coins) || 0) >= BOX_COST;
        hub.innerHTML = `
            <div class="rp-stats" aria-label="Reward summary">
                <div class="rp-stat-ready"><strong>${claimable}</strong><span>Ready to claim</span></div>
                <div><strong>${collected}<small>/${permanentDefinitions.length}</small></strong><span>Permanent collected</span></div>
                <div><strong>${number(systemState.player.coins)}</strong><span>Coin balance</span></div>
                <div><strong>${number(systemState.player.level)}</strong><span>Player level</span></div>
                <div><strong>${number(vault.opens)}</strong><span>Vault openings</span></div>
            </div>
            <div class="rp-collection">
                <div class="rp-collection-head"><span>PERMANENT COLLECTION</span><b>${collectionPercent}%</b></div>
                <div class="rp-collection-track" role="progressbar" aria-label="Permanent reward collection progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${collectionPercent}"><i style="width:${collectionPercent}%"></i></div>
            </div>
            <div class="rp-actions">
                <button type="button" data-rp="all" ${claimable ? "" : "disabled"}>Collect All Ready</button>
                <button type="button" data-rp="box" class="rp-box" ${canAffordBox ? "" : "disabled"}>Open Mystery Vault · ${BOX_COST} Coins</button>
            </div>
            <div class="rp-controls" aria-label="Reward filters">
                <label class="rp-search-label"><span>SEARCH REWARDS</span><input type="search" data-rp-search maxlength="100" autocomplete="off" placeholder="Name or requirement…" aria-label="Search reward names and requirements" value="${esc(currentSearch)}"></label>
                <label><span>SHOW</span><select data-rp-status aria-label="Filter reward status">${option("all", "All rewards")}${option("ready", "Ready to claim")}${option("locked", "Locked")}${option("claimed", "Collected")}</select></label>
                <label><span>SORT</span><select data-rp-sort aria-label="Sort rewards"><option value="recommended"${currentSort === "recommended" ? " selected" : ""}>Recommended</option><option value="rarity"${currentSort === "rarity" ? " selected" : ""}>Rarity</option><option value="xp"${currentSort === "xp" ? " selected" : ""}>XP value</option><option value="name"${currentSort === "name" ? " selected" : ""}>Name</option></select></label>
            </div>
            <p class="rp-empty" role="status" hidden>No rewards match these filters. Try another category or search.</p>
            <div class="rp-vault-info"><small class="rp-pity">Pity system: Rare guaranteed within ${Math.max(1, 10 - vault.sinceRare)} opening(s) · Legendary within ${Math.max(1, 40 - vault.sinceLegendary)} opening(s).</small><small class="rp-odds">Base odds: Common 55% · Uncommon 28% · Rare 13% · Legendary 4%.</small></div>
            ${result ? `<div class="rp-result rp-${esc(result.tier)}"><span class="rp-result-kicker">VAULT DROP CONFIRMED</span><strong>${esc(result.tier.toUpperCase())}</strong><span>+${number(result.xp)} XP${result.coins ? ` · +${number(result.coins)} Coins` : ""}</span></div>` : ""}
            <details class="rp-log"><summary>Recent reward history <span>(${log.length})</span></summary>
                ${log.length ? log.map(e => `<div class="rp-log-entry"><span>${esc(e.title)}</span><b>+${number(e.xp)} XP${e.coins ? ` · ${signedNumber(e.coins)} Coins` : ""}</b><time datetime="${new Date(e.t).toISOString()}">${new Date(e.t).toLocaleDateString()}</time></div>`).join("") : "<p class=\"rp-log-empty\">No rewards collected yet. Your first claim will appear here.</p>"}
            </details>`;
        syncTabs();
        applyFilter();
        syncSelectedMeta();
    }

    function syncSelectedMeta() {
        const selectedPanel = document.querySelector("#rewards-page .selected-reward");
        if (!selectedPanel) return;
        const title = selectedPanel.querySelector("h2");
        const cost = selectedPanel.querySelector(".reward-cost");
        if (!title || !cost) return;
        const definition = rewardDefinitions[title.textContent.trim()];
        if (!definition) return;
        let meta = selectedPanel.querySelector(".rp-detail-meta");
        if (!meta) {
            meta = document.createElement("div");
            meta.className = "rp-detail-meta";
            cost.before(meta);
        }
        meta.textContent = `${rarityOf(definition).toUpperCase()} · ${String(definition.category).toUpperCase()} REWARD`;
        meta.className = `rp-detail-meta rp-detail-${rarityOf(definition)}`;
        const claimed = rewardState.claimed.includes(definition.id);
        const progress = progressOf(definition);
        let progressEl = selectedPanel.querySelector(".rp-detail-progress");
        if (progress && !claimed) {
            if (!progressEl) {
                progressEl = document.createElement("div");
                progressEl.className = "rp-detail-progress";
                progressEl.innerHTML = '<div><i></i></div><span></span>';
                cost.before(progressEl);
            }
            const [current, max] = progress;
            progressEl.querySelector("i").style.width = `${Math.round((current / max) * 100)}%`;
            progressEl.querySelector("span").textContent = `${current} / ${max} progress`;
            progressEl.hidden = false;
        } else if (progressEl) {
            progressEl.hidden = true;
        }
    }

    /* ---------- Visual reward metadata and progress-aware card rendering ---------- */
    function wireNewCards() {
        if (typeof ensureDynamicRewardCards === "function") ensureDynamicRewardCards();
        document.querySelectorAll("#rewards-page .available-rewards .reward-card[data-dynamic-reward]").forEach(card => {
            if (card.dataset.rpReady || !extraById[card.dataset.dynamicReward]) return;
            card.dataset.rpReady = "1";
            card.addEventListener("click", event => {
                if (!event.target.closest("button")) window.selectRewardCard(card);
            });
            const button = card.querySelector("button");
            if (button) button.addEventListener("click", () => window.claimReward(card));
        });
    }

    function decorate() {
        document.querySelectorAll("#rewards-page .available-rewards .reward-card").forEach(card => {
            const heading = card.querySelector("h3");
            const definition = heading && rewardDefinitions[heading.textContent.trim()];
            if (!definition) return;
            card.dataset.rewardId = definition.id;
            card.dataset.category = definition.category;
            const rarity = definition.rarity || rarityOf(definition);
            const claimed = rewardState.claimed.includes(definition.id);
            card.classList.remove("rp-r-common", "rp-r-uncommon", "rp-r-rare", "rp-r-epic", "rp-r-legendary");
            card.classList.add(`rp-r-${rarity}`);
            card.classList.toggle("is-collected", claimed);
            card.classList.toggle("is-ready", !claimed && window.canClaimReward(definition));
            let chip = card.querySelector(".rp-chip");
            if (!chip) { chip = document.createElement("span"); chip.className = "rp-chip"; card.prepend(chip); }
            chip.textContent = `${rarity} · +${number(definition.xp)} XP${definition.coins ? ` · +${number(definition.coins)} Coins` : ""}`;
            chip.setAttribute("aria-label", `${rarity} reward, ${definition.xp} experience points${definition.coins ? ` and ${definition.coins} coins` : ""}`);

            const progress = progressOf(definition);
            let bar = card.querySelector(".rp-progress");
            if (!progress || claimed) {
                if (bar) bar.remove();
                return;
            }
            if (!bar) {
                bar = document.createElement("div");
                bar.className = "rp-progress";
                bar.innerHTML = "<i></i><em></em>";
                const button = card.querySelector("button");
                if (button) button.before(bar);
                else card.appendChild(bar);
            }
            const [current, max] = progress;
            bar.firstElementChild.style.width = `${Math.round((current / max) * 100)}%`;
            bar.lastElementChild.textContent = `${current} / ${max}`;
            bar.setAttribute("role", "progressbar");
            bar.setAttribute("aria-valuemin", "0");
            bar.setAttribute("aria-valuemax", String(max));
            bar.setAttribute("aria-valuenow", String(current));
            bar.setAttribute("aria-label", `${heading.textContent.trim()} progress`);
        });
    }

    function sortCards(cards) {
        const rarityValue = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
        const claimed = definition => rewardState.claimed.includes(definition.id);
        cards.sort((first, second) => {
            const firstDefinition = rewardDefinitions[first.querySelector("h3")?.textContent.trim()];
            const secondDefinition = rewardDefinitions[second.querySelector("h3")?.textContent.trim()];
            if (!firstDefinition || !secondDefinition) return 0;
            if (currentSort === "name") return firstDefinition.name?.localeCompare(secondDefinition.name || "")
                || first.querySelector("h3").textContent.localeCompare(second.querySelector("h3").textContent);
            if (currentSort === "xp") return (Number(secondDefinition.xp) || 0) - (Number(firstDefinition.xp) || 0);
            if (currentSort === "rarity") return (rarityValue[rarityOf(secondDefinition)] || 0) - (rarityValue[rarityOf(firstDefinition)] || 0);
            const firstReady = !claimed(firstDefinition) && window.canClaimReward(firstDefinition);
            const secondReady = !claimed(secondDefinition) && window.canClaimReward(secondDefinition);
            if (firstReady !== secondReady) return Number(secondReady) - Number(firstReady);
            if (claimed(firstDefinition) !== claimed(secondDefinition)) return Number(claimed(firstDefinition)) - Number(claimed(secondDefinition));
            return (Number(secondDefinition.xp) || 0) - (Number(firstDefinition.xp) || 0);
        });
        const container = document.querySelector("#rewards-page .available-rewards");
        if (container) cards.forEach(card => container.appendChild(card));
        return cards;
    }

    function applyFilter() {
        const tabs = [...document.querySelectorAll("#rewards-page .reward-tab")];
        const activeIndex = Math.max(0, tabs.findIndex(tab => tab.classList.contains("active")));
        const categories = CATS[activeIndex] || CATS[0];
        const container = document.querySelector("#rewards-page .available-rewards");
        if (!container) return;
        const cards = sortCards([...container.querySelectorAll(".reward-card")]);
        const query = currentSearch.trim().toLocaleLowerCase();
        let visible = 0;
        cards.forEach(card => {
            const heading = card.querySelector("h3");
            const paragraph = card.querySelector("p");
            const definition = heading ? rewardDefinitions[heading.textContent.trim()] : null;
            if (!definition) { card.hidden = true; return; }
            const isClaimed = rewardState.claimed.includes(definition.id);
            const isReady = !isClaimed && window.canClaimReward(definition);
            const textMatches = !query || `${heading.textContent} ${paragraph?.textContent || ""}`.toLocaleLowerCase().includes(query);
            const stateMatches = currentStatus === "all"
                || (currentStatus === "ready" && isReady)
                || (currentStatus === "locked" && !isClaimed && !isReady)
                || (currentStatus === "claimed" && isClaimed);
            const matches = categories.includes(definition.category) && textMatches && stateMatches;
            card.hidden = !matches;
            if (matches) visible++;
        });
        const empty = hub.querySelector(".rp-empty");
        if (empty) empty.hidden = visible > 0;
        syncTabs();
    }

    const baseSelect = window.selectRewardCard;
    window.selectRewardCard = function (card) {
        const result = baseSelect.apply(this, arguments);
        syncSelectedMeta();
        return result;
    };
    // Keep the rendered reward grid canonical. Older releases can leave a mixture
    // of static HTML cards and dynamically-added cards; dedupe by stable reward ID
    // (fallback: normalized title) after every legacy render.
    function removeDuplicateRewardCards() {
        const grid = document.getElementById("reward-card-grid");
        if (!grid) return;
        const seen = new Set();
        grid.querySelectorAll(":scope > .reward-card").forEach(card => {
            const title = card.querySelector("h3")?.textContent?.replace(/\s+/g, " ").trim() || "";
            const id = card.dataset.rewardId || rewardDefinitions[title]?.id || "";
            const key = id ? `id:${id}` : `title:${title.toLocaleLowerCase()}`;
            if (!title || seen.has(key)) {
                card.remove();
                return;
            }
            seen.add(key);
            if (id) card.dataset.rewardId = id;
        });
    }

    const baseUpdate = window.updateRewardCards;
    window.updateRewardCards = function () {
        baseUpdate.apply(this, arguments);
        removeDuplicateRewardCards();
        wireNewCards();
        decorate();
        renderHub();
    };
    document.querySelectorAll("#rewards-page .reward-tab").forEach((tab, index, tabList) => {
        tab.addEventListener("click", () => window.setTimeout(() => {
            syncTabs();
            applyFilter();
        }, 0));
        tab.addEventListener("keydown", event => {
            if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const rtl = document.documentElement.dir === "rtl";
            let nextIndex = index;
            if (event.key === "Home") nextIndex = 0;
            else if (event.key === "End") nextIndex = tabList.length - 1;
            else if (event.key === "ArrowRight") nextIndex = (index + (rtl ? -1 : 1) + tabList.length) % tabList.length;
            else if (event.key === "ArrowLeft") nextIndex = (index + (rtl ? 1 : -1) + tabList.length) % tabList.length;
            tabList[nextIndex].focus();
            tabList[nextIndex].click();
        });
    });

    window.updateRewardCards();
})();
