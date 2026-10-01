(() => {
  "use strict";

  const DEFAULTS = {
    username: "",
    password: "",
    autoRedirect: true,
    hideMyCourses: true,
    darkMode: true,
    subjectCards: true,
    codeFormat: true,
    showAllQuestions: false,
    popupDark: null // null = follow the system theme until the user picks one
  };

  // Switches that simply save their checked state under their own id.
  const TOGGLE_IDS = ["autoRedirect", "hideMyCourses", "darkMode", "subjectCards", "codeFormat", "showAllQuestions"];

  const username = document.getElementById("username");
  const password = document.getElementById("password");
  const popupDark = document.getElementById("popupDark");
  const save = document.getElementById("save");
  const status = document.getElementById("status");

  let statusTimer;

  function showStatus(message, ok = true) {
    status.textContent = message;
    status.className = ok ? "ok" : "err";

    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      status.textContent = "";
      status.className = "";
    }, 2500);
  }

  function applyPopupTheme(dark) {
    document.documentElement.dataset.theme = dark ? "dark" : "light";

    try {
      localStorage.setItem("bke-popup-dark", dark ? "1" : "0");
    } catch (e) {
      // Not critical: theme-init.js falls back to the system theme.
    }
  }

  // ---------- Load ----------

  chrome.storage.local.get(DEFAULTS, (settings) => {
    username.value = settings.username;
    password.value = settings.password;

    TOGGLE_IDS.forEach((id) => {
      document.getElementById(id).checked = settings[id];
    });

    if (settings.popupDark === null) {
      popupDark.checked = window.matchMedia("(prefers-color-scheme: dark)").matches;
    } else {
      popupDark.checked = settings.popupDark;
      applyPopupTheme(settings.popupDark);
    }
  });

  // ---------- Credentials ----------

  save.addEventListener("click", () => {
    chrome.storage.local.set(
      {
        username: username.value.trim(),
        password: password.value
      },
      () => showStatus("Saved.")
    );
  });

  // ---------- Switches ----------

  TOGGLE_IDS.forEach((id) => {
    const input = document.getElementById(id);

    input.addEventListener("change", () => {
      chrome.storage.local.set({ [id]: input.checked });
      showStatus(`${input.dataset.label} ${input.checked ? "on" : "off"}.`);
    });
  });

  popupDark.addEventListener("change", () => {
    applyPopupTheme(popupDark.checked);
    chrome.storage.local.set({ popupDark: popupDark.checked });
  });
})();
