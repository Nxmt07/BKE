// ============================================================
// BKEnhance - LMS content script
// ============================================================

// ------------------------------------------------------------
// 1. Auto-redirect: LMS homepage -> My Courses
// ------------------------------------------------------------
(() => {
  "use strict";

  const current = new URL(window.location.href);
  const target = "https://lms.hcmut.edu.vn/my/courses.php";

  if (
    current.protocol !== "https:" ||
    current.hostname !== "lms.hcmut.edu.vn" ||
    current.pathname !== "/"
  ) {
    return;
  }

  chrome.storage.local.get({ autoRedirect: true }, (settings) => {
    if (settings.autoRedirect) {
      window.location.replace(target);
    }
  });
})();

// ------------------------------------------------------------
// 2. Appearance + navigation, driven by popup settings
//
//    darkMode       -> html.bke-dark           (dark-mode.css)
//    subjectCards   -> html.bke-cards          (enhance.css) + card DOM
//    hideMyCourses  -> html.bke-hide-mycourses (enhance.css) + Home link
// ------------------------------------------------------------
(() => {
  "use strict";

  const COURSES_URL = "https://lms.hcmut.edu.vn/my/courses.php";
  let root = null; // set once <html> exists (see bottom of this block)

  const DEFAULTS = {
    darkMode: true,
    hideMyCourses: true,
    subjectCards: true
  };

  let settings = { ...DEFAULTS };

  // ---------- Classes on <html> ----------

  function applyClasses() {
    if (!root) return;

    root.classList.toggle("bke-dark", settings.darkMode);
    root.classList.toggle("bke-cards", settings.subjectCards);
    root.classList.toggle("bke-hide-mycourses", settings.hideMyCourses);
  }

  // ---------- Navbar ----------

  function updateNavbar() {
    const homeLink = document.querySelector('li[data-key="home"] a.nav-link');

    if (!homeLink) return;

    if (settings.hideMyCourses) {
      if (homeLink.dataset.bkeOriginalHref === undefined) {
        homeLink.dataset.bkeOriginalHref = homeLink.getAttribute("href") || "";
      }

      if (homeLink.href !== COURSES_URL) {
        homeLink.href = COURSES_URL;
      }
    } else if (homeLink.dataset.bkeOriginalHref !== undefined) {
      homeLink.setAttribute("href", homeLink.dataset.bkeOriginalHref);
      delete homeLink.dataset.bkeOriginalHref;
    }
  }

  // ---------- Subject cards ----------

  function createSubjectCards() {
    const cards = document.querySelectorAll(
      "#page .block_myoverview .course-card"
    );

    cards.forEach((card) => {
      if (card.dataset.nxmtProcessed === "true") {
        return;
      }

      const courseNameElement = card.querySelector(".coursename");

      if (!courseNameElement) {
        return;
      }

      const fullCourseName =
        courseNameElement.querySelector(".multiline")?.getAttribute("title") ||
        courseNameElement.innerText.trim();

      if (!fullCourseName) {
        return;
      }

      const courseUrl = courseNameElement.href;

      const originalImageLink = card.querySelector(":scope > a:first-child");

      const originalImageElement =
        originalImageLink?.querySelector('[style*="background-image"]');

      const courseCodeElement = card.querySelector(
        ".course-info-container .text-muted > div"
      );

      const fullCourseCode = courseCodeElement?.innerText.trim() || "";

      let subjectName = fullCourseName;
      let teacherName = "";

      const underscoreIndex = fullCourseName.indexOf("_");

      if (underscoreIndex !== -1) {
        subjectName = fullCourseName.substring(0, underscoreIndex).trim();
        subjectName = subjectName
          .replace(/\s*\([A-Za-z]{2,}[0-9]{3,}\)\s*$/, "")
          .trim();

        const remaining = fullCourseName.substring(underscoreIndex + 1).trim();
        teacherName = remaining.replace(/\s*\([^)]*\).*/, "").trim();
      }

      let subjectCode = fullCourseCode;
      const codeParts = fullCourseCode.split("_");

      if (codeParts.length >= 2) {
        subjectCode = codeParts[1];
      }

      const newCard = document.createElement("a");
      newCard.className = "nxmt-subject-card";
      newCard.href = courseUrl;

      // Prevent Moodle's SPA router from intercepting the click and crashing
      newCard.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      const imageLink = document.createElement("div");
      imageLink.className = "nxmt-subject-image";

      if (originalImageElement) {
        const image = originalImageElement.cloneNode(true);
        image.className = "nxmt-subject-image-img";
        image.removeAttribute("style");
        image.style.backgroundImage =
          window.getComputedStyle(originalImageElement).backgroundImage;
        imageLink.appendChild(image);
      } else {
        imageLink.innerHTML = "<span>Images</span>";
      }

      const info = document.createElement("div");
      info.className = "nxmt-subject-info";

      const name = document.createElement("div");
      name.className = "nxmt-subject-name";
      name.textContent = subjectName;

      const teacher = document.createElement("div");
      teacher.className = "nxmt-teacher-name";
      teacher.textContent = teacherName;

      info.appendChild(name);
      info.appendChild(teacher);

      const code = document.createElement("div");
      code.className = "nxmt-subject-code";
      code.textContent = subjectCode;

      newCard.appendChild(imageLink);
      newCard.appendChild(info);
      newCard.appendChild(code);

      // Hide (not remove) Moodle's original card contents so they can be
      // restored when the option is switched off.
      Array.from(card.children).forEach((child) => {
        child.dataset.nxmtHidden = "true";
        child.style.display = "none";
      });

      card.appendChild(newCard);

      card.classList.add("nxmt-customized-card");
      card.dataset.nxmtProcessed = "true";
    });
  }

  function restoreSubjectCards() {
    document
      .querySelectorAll(".nxmt-subject-card")
      .forEach((el) => el.remove());

    document.querySelectorAll('[data-nxmt-hidden="true"]').forEach((el) => {
      el.style.removeProperty("display");
      delete el.dataset.nxmtHidden;
    });

    document.querySelectorAll(".nxmt-customized-card").forEach((card) => {
      card.classList.remove("nxmt-customized-card");
      delete card.dataset.nxmtProcessed;
    });
  }

  // ---------- Refresh ----------

  function refresh() {
    updateNavbar();

    if (settings.subjectCards) {
      createSubjectCards();
    } else {
      restoreSubjectCards();
    }
  }

  let scheduled = false;

  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      refresh();
    });
  }

  // ---------- Start ----------

  // At document_start <html> may not exist yet (and some documents, such as
  // raw files, are not HTML at all), so wait for it instead of assuming.
  function onRootReady(callback) {
    if (document.documentElement) {
      callback(document.documentElement);
      return;
    }

    const waiter = new MutationObserver(() => {
      if (document.documentElement) {
        waiter.disconnect();
        callback(document.documentElement);
      }
    });

    waiter.observe(document, { childList: true });
  }

  onRootReady((element) => {
    if (element.nodeName.toLowerCase() !== "html") return;

    root = element;

    // Apply defaults straight away so the page doesn't flash light before
    // the saved settings arrive, then correct it once storage answers.
    applyClasses();

    chrome.storage.local.get(DEFAULTS, (saved) => {
      settings = { ...DEFAULTS, ...saved };
      applyClasses();
      scheduleRefresh();
    });

    // Apply popup changes to open LMS tabs without a reload.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;

      let touched = false;

      Object.keys(DEFAULTS).forEach((key) => {
        if (changes[key]) {
          settings[key] = changes[key].newValue ?? DEFAULTS[key];
          touched = true;
        }
      });

      if (touched) {
        applyClasses();
        scheduleRefresh();
      }
    });

    new MutationObserver(scheduleRefresh).observe(root, {
      childList: true,
      subtree: true
    });
  });
})();
