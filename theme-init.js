// Runs before the popup paints so it opens in the right theme (no flash).
// popup.js keeps this localStorage value in sync with chrome.storage.
(() => {
  "use strict";

  let dark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  try {
    const saved = localStorage.getItem("bke-popup-dark");
    if (saved !== null) dark = saved === "1";
  } catch (e) {
    // localStorage unavailable: fall back to the system theme.
  }

  document.documentElement.dataset.theme = dark ? "dark" : "light";
})();
