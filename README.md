# BKEnhance

A Chrome extension that makes the HCMUT login and LMS nicer to use: automatic CAS sign-in, a faster route to your courses, a gray dark theme, and a cleaner course list. Every LMS feature can be switched on or off from the popup.

**Version:** 2.1.1 · **Requires:** Chrome or Chromium 120+ (Manifest V3)

## Features

| Feature | What it does | Popup switch |
| --- | --- | --- |
| CAS auto-login | Fills in and submits the HCMUT SSO login form with your saved credentials. | Save credentials |
| Auto redirect LMS | Opening the LMS homepage takes you straight to My Courses. | Auto redirect LMS |
| Hide My courses tab | Hides the extra My courses item in the navbar and points Home to My Courses. | Hide My courses tab |
| Website dark mode | Applies a modern gray dark theme across the LMS. | Website dark mode |
| Subject card list | Shows your courses as a list of cards with subject name, teacher, subject code and the course image. | Subject card list |
| Dark popup | Switches the popup itself between light and dark. Follows your system until you choose. | Dark popup |

Changes to the LMS switches apply to open LMS tabs immediately, with no reload.

Notes on how the switches interact:

- **Hide My courses tab** also controls where the Home link goes. When it is on, Home opens My Courses. When it is off, both the tab and the Home link return to Moodle's defaults.
- **Subject card list** follows the website theme, so the cards are dark with dark mode on and light with it off. Turning the option off restores Moodle's original course cards.

## Installation

1. Download or clone this folder and make sure it contains the `icons/` directory referenced by `manifest.json`.
2. Open `chrome://extensions/` in Chrome or Chromium.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `BKEnhance` folder.
5. Pin BKEnhance to the toolbar if you like.
6. Open the popup, enter your HCMUT username and password, and click **Save credentials**.

If an older BKENav or BKEnhance copy is installed, remove or disable it first. Two copies running at once duplicate the scripts and cause errors.

### Updating

Replace the files in the folder, then click **Reload** on the extension in `chrome://extensions/` and reload any open LMS tabs. Tabs that stay open keep running the previous script until they are reloaded.

## Usage

Click the BKEnhance icon to open the popup.

- **Credentials:** enter your username and password and click **Save credentials**. They are used on `https://sso.hcmut.edu.vn/cas/login` when the URL has a `service` parameter.
- **Navigation:** Auto redirect LMS and Hide My courses tab.
- **Appearance:** Website dark mode, Subject card list and Dark popup.

All defaults are on, except the popup theme, which follows your system.

## Project structure

```
BKEnhance/
├── manifest.json     Extension manifest (MV3), content script registration
├── cas.js            CAS login auto-fill and submit
├── content.js        LMS redirect, navbar changes, subject cards, settings handling
├── dark-mode.css     Dark theme, nested under html.bke-dark
├── enhance.css       Subject card list styles and My courses rule
├── popup.html        Popup markup
├── popup.css         Popup styles (light and dark)
├── popup.js          Popup logic and settings storage
├── theme-init.js     Applies the popup theme before it paints
├── icons/            Extension icons (16, 32, 48, 128 px)
└── README.md
```

`lms.js` from earlier versions is not loaded by the manifest and can be deleted.

### How the toggles work

`content.js` runs on `https://lms.hcmut.edu.vn/*` and reads the saved settings. It then adds or removes classes on the `<html>` element:

| Setting | Class on `<html>` | Used by |
| --- | --- | --- |
| `darkMode` | `bke-dark` | `dark-mode.css` |
| `subjectCards` | `bke-cards` | `enhance.css` |
| `hideMyCourses` | `bke-hide-mycourses` | `enhance.css` |

The dark theme uses native CSS nesting under `html.bke-dark`, which is why Chrome 120+ is required. The script also listens for `chrome.storage.onChanged`, so popup changes reach open tabs instantly.

### Stored settings

Everything is saved in `chrome.storage.local`:

| Key | Type | Default |
| --- | --- | --- |
| `username` | string | `""` |
| `password` | string | `""` |
| `autoRedirect` | boolean | `true` |
| `hideMyCourses` | boolean | `true` |
| `darkMode` | boolean | `true` |
| `subjectCards` | boolean | `true` |
| `popupDark` | boolean or null | `null` (follow system) |

## Permissions and privacy

- The only permission requested is `storage`.
- The extension runs only on `sso.hcmut.edu.vn/cas/login*` and `lms.hcmut.edu.vn/*`.
- It makes no network requests of its own and sends no data anywhere.
- Your password is stored **unencrypted** in Chrome's extension storage on your computer. Anyone with access to your browser profile could read it. Use the auto-login feature only on a computer and browser profile you trust, and clear the fields and save if you want to remove the stored credentials.

## Troubleshooting

**The Moodle message icon throws `Cannot read properties of null (reading 'attr')`.**
This error also appears on unmodified Moodle sites and is usually fixed by a hard refresh (Ctrl+F5). The extension does not touch the message drawer. To check, disable BKEnhance and retry; if the error persists, it comes from Moodle.

**`Failed to execute 'observe' on 'MutationObserver'` in the extension's Errors page.**
This was fixed in 2.1.1. Click **Reload** on the extension, clear the error list, and reload your LMS tabs, since older tabs keep running the previous script.

**Dark mode or cards don't change after updating.**
Reload the extension in `chrome://extensions/` and reload the LMS tab.

**Auto-login does nothing.**
Check that credentials are saved in the popup and that the login page URL includes a `service` parameter. Clicking the LMS login link normally provides it.

## Known limitations

- Dark mode is tuned for the HCMUT Moodle theme. Some pages may still have elements that look out of place.
- The course card layout depends on the current Moodle markup. If the LMS changes that markup, the cards may need updating.
- On first paint, the defaults are applied before your saved settings load, so with dark mode turned off you may briefly see one dark frame.
"# BKE" 
