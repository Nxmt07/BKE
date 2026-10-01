// ============================================================
// BKEnhance - Ace-style code formatting for question prompts
//
// Finds <pre> blocks in Moodle question text that contain plain-text
// code (br / div / span soup with inline light-mode styles), rebuilds
// the real line structure, highlights it, and renders it like the Ace
// editor. The original <pre> is kept and only hidden by CSS, so the
// "codeFormat" setting can switch the feature off without a reload.
// ============================================================
(() => {
  "use strict";

  const DEFAULTS = { codeFormat: true };
  const root = document.documentElement;

  function applyClass(on) {
    root.classList.toggle("bke-code-on", on);
  }

  applyClass(DEFAULTS.codeFormat);

  chrome.storage.local.get(DEFAULTS, (s) => applyClass(s.codeFormat));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.codeFormat) {
      applyClass(changes.codeFormat.newValue ?? DEFAULTS.codeFormat);
    }
  });

  // ---------- Which <pre> elements are candidates ----------

  const CANDIDATES = "#page .que .qtext pre, #page .que .formulation pre";
  const EXCLUDED =
    ".coderunner-test-results, .coderunnerexamples, .coderunner-examples, " +
    ".specificfeedback, .ace_editor, .ui_wrapper, .bke-code";

  // ---------- HTML -> plain text with real line breaks ----------

  const BLOCK_TAGS = /^(DIV|P|LI|UL|OL|TABLE|TR|H[1-6])$/;

  function extractText(el) {
    let out = "";
    const atLineStart = () => out === "" || out.endsWith("\n");

    (function walk(node) {
      node.childNodes.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          out += n.nodeValue.replace(/\u00a0/g, " ");
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          if (n.tagName === "BR") {
            out += "\n";
            return;
          }
          const block = BLOCK_TAGS.test(n.tagName);
          if (block && !atLineStart()) out += "\n";
          walk(n);
          if (block && !atLineStart()) out += "\n";
        }
      });
    })(el);

    return out.replace(/\r/g, "").replace(/^\n+/, "").replace(/\s+$/, "");
  }

  // ---------- Is it code? ----------

  function looksLikeCode(text) {
    const lines = text.split("\n");
    if (lines.length < 2) return false;

    const endings = lines.filter((l) => /[;{}]\s*$/.test(l)).length;
    const hasKeyword =
      /(^|\s)#\s*include\b|\btemplate\s*<|\busing\s+namespace\b|\bstd::|\b(class|struct|void|int|return|for|while|if|else|public|private|protected)\b/.test(
        text
      );

    return endings >= 3 || (endings >= 2 && hasKeyword);
  }

  // ---------- Tokenizer (C / C++ flavoured) ----------

  const KEYWORDS = new Set(
    (
      "if else for while do switch case default break continue return goto " +
      "class struct union enum template typename typedef namespace using " +
      "public private protected friend virtual override final static const " +
      "constexpr inline explicit extern mutable volatile operator new delete " +
      "try catch throw sizeof public: private: protected: import from def " +
      "in is not and or lambda pass"
    ).split(" ")
  );

  const TYPES = new Set(
    (
      "int long short char float double void bool unsigned signed auto " +
      "size_t string wchar_t"
    ).split(" ")
  );

  const CONSTS = new Set("true false NULL nullptr this self None True False".split(" "));

  const TOKEN_RE =
    /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|(?![\s\S])))|(^[ \t]*#[ \t]*[a-z]+[^\n]*)|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(\b(?:0[xX][\da-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?)[uUlLfF]*\b)|([A-Za-z_]\w*)/gm;

  function tokenize(text) {
    const tokens = [];
    const push = (type, value) => {
      if (!value) return;
      const last = tokens[tokens.length - 1];
      if (last && last.type === type) last.value += value;
      else tokens.push({ type, value });
    };

    let last = 0;
    let m;
    TOKEN_RE.lastIndex = 0;

    while ((m = TOKEN_RE.exec(text))) {
      push("plain", text.slice(last, m.index));
      last = TOKEN_RE.lastIndex;
      const v = m[0];

      if (m[1] !== undefined) push("comment", v);
      else if (m[2] !== undefined) push("preproc", v);
      else if (m[3] !== undefined) push("string", v);
      else if (m[4] !== undefined) push("number", v);
      else if (TYPES.has(v)) push("type", v);
      else if (KEYWORDS.has(v)) push("keyword", v);
      else if (CONSTS.has(v)) push("const", v);
      else if (/^[ \t]*\(/.test(text.slice(last, last + 12))) push("func", v);
      else push("plain", v);
    }

    push("plain", text.slice(last));
    return tokens;
  }

  // ---------- Rendering ----------

  function render(text) {
    const wrapper = document.createElement("div");
    wrapper.className = "bke-code";

    let line = document.createElement("span");
    line.className = "bke-line";

    const nextLine = () => {
      wrapper.appendChild(line);
      line = document.createElement("span");
      line.className = "bke-line";
    };

    tokenize(text).forEach(({ type, value }) => {
      value.split("\n").forEach((part, i) => {
        if (i > 0) nextLine();
        if (!part) return;

        if (type === "plain") {
          line.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement("span");
          span.className = `bke-tok-${type}`;
          span.textContent = part;
          line.appendChild(span);
        }
      });
    });

    wrapper.appendChild(line);
    return wrapper;
  }

  function process() {
    document.querySelectorAll(CANDIDATES).forEach((pre) => {
      if (pre.dataset.bkeChecked || pre.closest(EXCLUDED)) return;
      pre.dataset.bkeChecked = "1";

      const text = extractText(pre);
      if (!looksLikeCode(text)) return;

      pre.classList.add("bke-src");
      pre.before(render(text));
    });
  }

  // ---------- Start ----------

  let scheduled = false;

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      process();
    });
  }

  schedule();
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
})();
