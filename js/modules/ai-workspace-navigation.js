/** Accessible AI workspace navigation migrated out of the legacy app bundle. */
export function initAIWorkspaceNavigation() {
    const page = document.getElementById("ai-page");
    if (!page) return;

    const buttons = Array.from(page.querySelectorAll("[data-ai-view]"));
    const panels = Array.from(page.querySelectorAll("[data-ai-panel]"));
    if (!buttons.length || !panels.length) return;

    const storageKey = "system_v2_ai_workspace_view";
    const activateView = (viewName) => {
        if (!buttons.some((button) => button.dataset.aiView === viewName)) viewName = buttons[0].dataset.aiView;
        buttons.forEach((button) => {
            const selected = button.dataset.aiView === viewName;
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-selected", String(selected));
            button.tabIndex = selected ? 0 : -1;
        });
        panels.forEach((panel) => { panel.hidden = panel.dataset.aiPanel !== viewName; });
        try { localStorage.setItem(storageKey, viewName); } catch { /* storage is optional */ }
    };

    buttons.forEach((button) => {
        button.addEventListener("click", () => activateView(button.dataset.aiView));
        button.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const currentIndex = buttons.indexOf(button);
            const direction = event.key === "ArrowRight" ? 1 : -1;
            const nextIndex = (currentIndex + direction + buttons.length) % buttons.length;
            buttons[nextIndex].focus();
            activateView(buttons[nextIndex].dataset.aiView);
        });
    });

    let savedView = "";
    try { savedView = localStorage.getItem(storageKey) || ""; } catch { /* use default view */ }
    const initial = buttons.find((button) => button.dataset.aiView === savedView)
        || buttons.find((button) => button.classList.contains("is-active"))
        || buttons[0];
    activateView(initial.dataset.aiView);
}
