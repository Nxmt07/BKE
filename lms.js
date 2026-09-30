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

  chrome.storage.local.get(
    { autoRedirect: true },
    (settings) => {
      if (!settings.autoRedirect) return;

      window.location.replace(target);
    }
  );
})();