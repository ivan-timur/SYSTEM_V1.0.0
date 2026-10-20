/* SYSTEM Quest Ascension — additive UI enhancement, preserves existing quest engine. */
(() => {
  "use strict";
  const init = () => {
    const page = document.querySelector("#quest-page");
    if (!page || page.dataset.questAscensionReady) return;
    page.dataset.questAscensionReady = "true";
    const layout = page.querySelector(".quest-layout");
    const panel = page.querySelector(".quest-main-panel");
    const list = page.querySelector(".quest-list");
    if (!layout || !panel || !list) return;

    const cards = () => [...list.querySelectorAll(".quest-card")];
    const summary = document.createElement("section");
    summary.className = "quest-command";
    summary.setAttribute("aria-label", "Quest command overview");
    summary.innerHTML = `
      <div class="quest-command-top">
        <div><span class="quest-kicker">MISSION CONTROL</span><h2>Quest Command Center</h2>
        <p>Small wins. Compounding progress.</p></div>
        <div class="quest-command-emblem" aria-hidden="true">✦</div>
      </div>
      <div class="quest-metrics">
        <div class="quest-metric"><span>DAILY PROGRESS</span><strong data-qstat="progress">0%</strong><div class="quest-metric-track"><i data-qbar></i></div></div>
        <div class="quest-metric"><span>MISSIONS CLEARED</span><strong data-qstat="cleared">0 / 0</strong></div>
        <div class="quest-metric"><span>XP AVAILABLE</span><strong data-qstat="xp">0 XP</strong></div>
      </div>
      <div class="quest-tools">
        <label class="quest-search-wrap"><span aria-hidden="true">⌕</span><input type="search" data-qsearch placeholder="Search missions…" aria-label="Search quests"></label>
        <div class="quest-filters" role="group" aria-label="Filter quests">
          <button type="button" class="is-active" data-qfilter="all" aria-pressed="true">All</button>
          <button type="button" data-qfilter="active" aria-pressed="false">Active</button>
          <button type="button" data-qfilter="completed" aria-pressed="false">Cleared</button>
        </div>
      </div>`;
    panel.insertBefore(summary, panel.querySelector(".quest-list"));
    const footer = document.createElement("div");
    footer.className = "quest-list-footer";
    footer.innerHTML = `<span data-qvisible>Showing missions</span><button type="button" data-qreset>Reset filters</button>`;
    list.after(footer);

    const update = () => {
      const all = cards();
      const done = all.filter(c => c.classList.contains("completed") || c.querySelector(".quest-go")?.disabled).length;
      const xp = all.filter(c => !(c.classList.contains("completed") || c.querySelector(".quest-go")?.disabled))
        .reduce((sum,c) => sum + (Number((c.querySelector(".quest-reward")?.textContent || "").match(/\d+/)?.[0]) || 0), 0);
      const pct = all.length ? Math.round(done / all.length * 100) : 0;
      summary.querySelector('[data-qstat="progress"]').textContent = `${pct}%`;
      summary.querySelector('[data-qstat="cleared"]').textContent = `${done} / ${all.length}`;
      summary.querySelector('[data-qstat="xp"]').textContent = `${xp} XP`;
      summary.querySelector("[data-qbar]").style.width = `${pct}%`;
      const q = summary.querySelector("[data-qsearch]").value.trim().toLocaleLowerCase();
      const filter = summary.querySelector("[data-qfilter].is-active")?.dataset.qfilter || "all";
      let visible = 0;
      all.forEach(c => {
        const completed = c.classList.contains("completed") || !!c.querySelector(".quest-go")?.disabled;
        const matches = (c.textContent || "").toLocaleLowerCase().includes(q) &&
          (filter === "all" || (filter === "active" ? !completed : completed));
        c.hidden = !matches;
        if (matches) visible++;
      });
      footer.querySelector("[data-qvisible]").textContent = `Showing ${visible} of ${all.length} missions`;
    };
    summary.addEventListener("input", e => { if (e.target.matches("[data-qsearch]")) update(); });
    summary.addEventListener("click", e => {
      const button = e.target.closest("[data-qfilter]");
      if (button) {
        summary.querySelectorAll("[data-qfilter]").forEach(b => {
          const active = b === button;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-pressed", String(active));
        });
        update();
      }
    });
    footer.querySelector("[data-qreset]").addEventListener("click", () => {
      summary.querySelector("[data-qsearch]").value = "";
      const allButton = summary.querySelector('[data-qfilter="all"]');
      allButton.click();
    });
    // Existing quest engine owns rewards/completion; observe its DOM updates without replacing handlers.
    new MutationObserver(update).observe(list, {subtree:true, attributes:true, childList:true, attributeFilter:["class","disabled"]});
    update();
    page.addEventListener("click", e => {
      if (e.target.closest(".quest-go")) window.setTimeout(update, 80);
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
  document.addEventListener("system-app-ready", init);
})();
