(() => {
  "use strict";

  const url = new URL(window.location.href);

  if (
    url.protocol !== "https:" ||
    url.hostname !== "sso.hcmut.edu.vn" ||
    url.pathname !== "/cas/login" ||
    !url.searchParams.has("service")
  ) {
    return;
  }

  let submitted = false;

  function findUsername() {
    return (
      document.querySelector('input[name="username"]') ||
      document.querySelector('#username') ||
      document.querySelector('input[type="text"]')
    );
  }

  function findPassword() {
    return (
      document.querySelector('input[name="password"]') ||
      document.querySelector('#password') ||
      document.querySelector('input[type="password"]')
    );
  }

  function setInputValue(input, value) {
    if (!input) return;

    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;

    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function submitLogin() {
    if (submitted) return;

    const username = findUsername();
    const password = findPassword();

    if (!username || !password) return;

    chrome.storage.local.get(
      {
        username: "",
        password: ""
      },
      (credentials) => {
        if (!credentials.username || !credentials.password || submitted) return;

        setInputValue(username, credentials.username);
        setInputValue(password, credentials.password);

        submitted = true;

        const form = password.form || username.form;

        if (!form) return;

        const button =
          form.querySelector('input[type="submit"]') ||
          form.querySelector('button[type="submit"]') ||
          form.querySelector('button[name="login"]') ||
          form.querySelector('input[name="login"]');

        if (button) {
          button.click();
        } else if (typeof form.requestSubmit === "function") {
          form.requestSubmit();
        } else {
          form.submit();
        }
      }
    );
  }

  submitLogin();

  const observer = new MutationObserver(() => {
    if (!submitted) submitLogin();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.setTimeout(() => observer.disconnect(), 15000);
})();