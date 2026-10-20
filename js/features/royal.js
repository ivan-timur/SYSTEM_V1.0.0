/* SYSTEM — compatibility shim. A theme selected by the user wins; fresh installs
   use the Cosmic Blue default declared in index.html instead of forcing Royal Gold. */
(function () {
    "use strict";
    try {
        const savedTheme = localStorage.getItem("system_v2_theme");
        if (savedTheme && typeof applySystemTheme === "function") {
            applySystemTheme(savedTheme, false);
        }
    } catch (error) {
        /* Theme preference is optional when browser storage is unavailable. */
    }
})();
