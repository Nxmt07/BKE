// ============================================================
// BKEnhance - show every quiz question on one page
//
// Runs on /mod/quiz/attempt.php. Fetches the other attempt pages,
// pulls their questions into the current form (in slot order) and
// updates the hidden "slots" field so one submit saves them all.
// Questions already on the page are left untouched, not cloned.
// ============================================================
(() => {
  "use strict";

  const url = new URL(window.location.href);

  if (
    url.protocol !== "https:" ||
    url.hostname !== "lms.hcmut.edu.vn" ||
    url.pathname !== "/mod/quiz/attempt.php"
  ) {
    return;
  }

  const DEFAULTS = { showAllQuestions: false };

  let started = false;
  let banner = null;

  // ---------- Helpers ----------

  function slotOf(que) {
    const byId = /^question-\d+-(\d+)$/.exec(que.id || "");
    if (byId) return parseInt(byId[1], 10);

    for (const input of que.querySelectorAll("[name]")) {
      const byName = /^q\d+:(\d+)_/.exec(input.name);
      if (byName) return parseInt(byName[1], 10);
    }
    return null;
  }

  function pagesToFetch() {
    const current = parseInt(url.searchParams.get("page") || "0", 10);

    // Moodle omits page=0 from links, so page 0 is always included.
    const pages = new Set([0]);

    document.querySelectorAll("a.qnbutton[href]").forEach((a) => {
      try {
        const p = new URL(a.href, window.location.href).searchParams.get("page");
        if (p !== null && Number.isInteger(parseInt(p, 10))) {
          pages.add(parseInt(p, 10));
        }
      } catch (e) {
        // Ignore malformed links.
      }
    });

    pages.delete(current); // already on screen
    return Array.from(pages).sort((a, b) => a - b);
  }

  async function fetchPage(page) {
    const pageUrl = new URL(url.href);
    pageUrl.searchParams.set("page", page);
    pageUrl.hash = "";

    const response = await fetch(pageUrl.href, { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return new DOMParser().parseFromString(await response.text(), "text/html");
  }

  function setBanner(form, text, type = "info") {
    if (!banner) {
      banner = document.createElement("div");
      form.before(banner);
    }
    banner.className = `alert alert-${type}`;
    banner.textContent = text;
  }

  // ---------- Re-initialising the answer editors (Ace) ----------
  //
  // Fetched pages are parsed, not run, so their editors never start.
  // Moodle's footer script on each fetched page contains the AMD calls
  // that start them, e.g. require(['qtype_coderunner/...'], function(amd) {...}).
  // We pull out the calls for the questions we imported and run them here.

  function fieldPrefix(que) {
    const m = /^question-(\d+)-(\d+)$/.exec(que.id || "");
    return m ? `q${m[1]}:${m[2]}_` : null;
  }

  // Index of the ")" matching the "(" at openIdx, skipping string literals.
  function findCallEnd(code, openIdx) {
    let depth = 0;
    let quote = null;

    for (let i = openIdx; i < code.length; i++) {
      const ch = code[i];

      if (quote) {
        if (ch === "\\") i++;
        else if (ch === quote) quote = null;
        continue;
      }

      if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      else if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  // "require(['mod'], function(amd) {amd.fn(a, b, {...});})"
  //   -> { module: "mod", func: "fn", args: [a, b, {...}] }
  // Moodle writes the arguments with json_encode, so they parse as JSON.
  function parseCall(call) {
    const moduleMatch = /require\(\s*\[\s*['"]([^'"]+)['"]/.exec(call);
    const fn = /\bamd\.(\w+)\(/.exec(call);
    if (!moduleMatch || !fn) return null;

    const open = fn.index + fn[0].length - 1;
    const close = findCallEnd(call, open);
    if (close === -1) return null;

    try {
      return {
        module: moduleMatch[1],
        func: fn[1],
        args: JSON.parse(`[${call.slice(open + 1, close)}]`)
      };
    } catch (e) {
      return null;
    }
  }

  function initCalls(doc, prefixes) {
    const calls = [];
    const start = /require\(\s*\[\s*['"]qtype_coderunner\/[^'"]+['"]/g;

    doc.querySelectorAll("script:not([src])").forEach((script) => {
      const code = script.textContent || "";
      let m;
      start.lastIndex = 0;

      while ((m = start.exec(code))) {
        const end = findCallEnd(code, m.index + "require".length);
        if (end === -1) break;

        const call = code.slice(m.index, end + 1);
        if (prefixes.some((p) => call.includes(p))) {
          const parsed = parseCall(call);
          if (parsed) calls.push(parsed);
        }

        start.lastIndex = end;
      }
    });

    return calls;
  }

  // Moodle's `require` lives in the page's own JS world, which this
  // content script cannot reach. page-bridge.js (a MAIN-world content
  // script) listens for this event and makes the require() calls.
  function runInPage(calls) {
    window.dispatchEvent(
      new CustomEvent("bke-init-ui", { detail: JSON.stringify(calls) })
    );
  }

  // ---------- Main ----------

  async function showAll() {
    if (started) return;

    const form =
      document.querySelector("#responseform") ||
      document.querySelector('form[action*="processattempt"]');

    if (!form) return;

    started = true;
    form.classList.add("bke-showall");

    const slotsInput = form.querySelector('input[name="slots"]');
    const placed = []; // [{ slot, node }] kept sorted by slot
    const seen = new Set();

    form.querySelectorAll(".que").forEach((que) => {
      const slot = slotOf(que);
      if (slot === null) return;
      seen.add(slot);
      placed.push({ slot, node: que });
    });
    placed.sort((a, b) => a.slot - b.slot);

    const pages = pagesToFetch();

    if (pages.length === 0) {
      started = false;
      return;
    }

    setBanner(form, "Loading all questions…");

    const results = await Promise.allSettled(pages.map(fetchPage));
    const failed = [];
    const fetched = new Map();
    const prefixesByDoc = new Map(); // fetched document -> field prefixes

    results.forEach((result, i) => {
      if (result.status !== "fulfilled") {
        failed.push(pages[i] + 1);
        return;
      }

      result.value.querySelectorAll(".que").forEach((que) => {
        const slot = slotOf(que);
        if (slot === null || seen.has(slot)) return;
        seen.add(slot);
        fetched.set(slot, document.importNode(que, true));

        const prefix = fieldPrefix(que);
        if (prefix) {
          if (!prefixesByDoc.has(result.value)) prefixesByDoc.set(result.value, []);
          prefixesByDoc.get(result.value).push(prefix);
        }
      });
    });

    // Insert in slot order, relative to the questions already on the page.
    Array.from(fetched.keys())
      .sort((a, b) => a - b)
      .forEach((slot) => {
        const node = fetched.get(slot);
        const next = placed.find((p) => p.slot > slot);

        if (next) {
          next.node.before(node);
        } else if (placed.length) {
          placed[placed.length - 1].node.after(node);
        } else {
          const submit = form.querySelector(".submitbtns");
          if (submit) submit.before(node);
          else form.append(node);
        }

        placed.push({ slot, node });
        placed.sort((a, b) => a.slot - b.slot);
      });

    if (slotsInput && placed.length) {
      slotsInput.value = placed.map((p) => p.slot).join(",");
    }

    // The textareas are in the DOM now, so start their editors.
    const calls = [];
    prefixesByDoc.forEach((prefixes, doc) => calls.push(...initCalls(doc, prefixes)));

    if (calls.length) {
      runInPage(calls);
    } else if (prefixesByDoc.size) {
      console.info("BKEnhance: no CodeRunner editor init calls found in fetched pages.");
    }

    if (failed.length) {
      setBanner(
        form,
        `Could not load page ${failed.join(", ")}. Those questions are not shown and will not be saved.`,
        "warning"
      );
    } else {
      setBanner(form, `Showing all ${placed.length} questions on this page.`, "success");
      setTimeout(() => banner && banner.remove(), 4000);
    }
  }

  // ---------- Settings ----------

  chrome.storage.local.get(DEFAULTS, (settings) => {
    if (settings.showAllQuestions) showAll();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.showAllQuestions) return;

    if (changes.showAllQuestions.newValue) {
      showAll();
    } else if (started) {
      const form = document.querySelector("#responseform");
      if (form) setBanner(form, "Reload the page to go back to one question per page.", "info");
    }
  });
})();