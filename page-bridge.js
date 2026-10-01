// ============================================================
// BKEnhance - page bridge (runs in the page's own JS world)
//
// Registered in manifest.json with "world": "MAIN" so it can reach
// Moodle's global `require`. showall.js sends it plain data:
//   [{ module, func, args }, ...]
// and this script runs  require([module], amd => amd[func](...args)).
// No code strings are evaluated, so the page's CSP does not matter.
// ============================================================
(() => {
  "use strict";

  window.addEventListener("bke-init-ui", (event) => {
    let calls;

    try {
      calls = JSON.parse(event.detail);
    } catch (e) {
      return;
    }

    if (!Array.isArray(calls) || typeof window.require !== "function") return;

    calls.forEach(({ module, func, args }) => {
      // Only CodeRunner modules, whatever the event says.
      if (typeof module !== "string" || !module.startsWith("qtype_coderunner/")) return;
      if (typeof func !== "string" || !Array.isArray(args)) return;

      window.require([module], (amd) => {
        try {
          amd[func](...args);
        } catch (e) {
          console.error("BKEnhance: editor init failed", module, func, e);
        }
      });
    });
  });
})();
