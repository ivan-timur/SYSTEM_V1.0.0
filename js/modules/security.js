/** Security-sensitive DOM compatibility helpers for the gradual modular migration. */
export function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

/** Replace an inline image-error handler with CSP-compatible event listeners. */
export function installCspCompatibility() {
    const hideFailedImage = (event) => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement) || !image.hasAttribute("data-hide-on-error")) return;
        image.hidden = true;
        image.setAttribute("aria-hidden", "true");
        console.error("SYSTEM image failed to load:", image.currentSrc || image.src);
    };
    document.addEventListener("error", hideFailedImage, true);
    window.SYSTEMSecurity = Object.freeze({ escapeHTML });
}
