<p align="center">
  <img src="./src/assets/images/ext_icon.png" alt="ERP Toolkit - IITKGP logo" width="72" height="72">
</p>

<h1 align="center">ERP Toolkit - IITKGP</h1>

<p align="center">
  Auto-login and CV/resume deadline highlighting for IIT Kharagpur's ERP, in one lightweight, local-only browser extension.
  <br>
  <a href="https://github.com/SumitKumar-17/erp-toolkit/issues/new">Report a bug</a>
  ·
  <a href="https://github.com/SumitKumar-17/erp-toolkit/issues/new">Request a feature</a>
</p>

> Not published on the Chrome Web Store yet — install directly from this repo in a few clicks, no build tools required. See [Installation](#installation) below.

## What it does

**🔑 Auto-login** — fills and submits the ERP SSO login form for you: username, password, your three security-question answers, and (optionally) an AES-encrypted PIN-protected vault, so your password never sits in plain text in browser storage.

**🎯 Deadline Highlighter** — on the CDC placement portal, color-codes every CV/resume-deadline row across four stages — upcoming (green), 1 day left (amber), 6 hours or less (orange), overdue (red) — and drops a small floating, draggable status widget on the page so you don't have to hunt through the table. All four colors, plus the refresh/auto-stop timing, are configurable from the popup.

Both features live in a single popup, reachable from one toolbar icon.

## Installation

No Node.js, no `npm install`, no build step — just download and load the folder.

1. Go to the [**Releases**](https://github.com/SumitKumar-17/erp-toolkit/releases/latest) page and download the latest `erp-toolkit-vX.Y.Z.zip`, **or** click **Code → Download ZIP** on this repo.
2. Unzip it. Inside, find the **`extension`** folder — that's the ready-to-load extension.
3. Open `chrome://extensions` in Chrome (or `edge://extensions`, `brave://extensions` — any Chromium-based browser works the same way).
4. Turn on **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the `extension` folder.
6. Done — click the toolbar icon to open the popup and set up your login details.

Since this isn't distributed through the Chrome Web Store, the browser can't silently auto-update it for you. Instead, the extension checks GitHub in the background and shows a small banner in the popup ("Update available: vX.Y.Z") whenever a newer build has shipped — click it to grab the new ZIP and repeat step 5 (just re-select the same `extension` folder in **Load unpacked**; it'll refresh in place).

## Setting it up

1. Open the popup and enter your ERP roll number, then fetch your security questions and fill in your password + answers.
2. Optionally set a 4-digit PIN — when set, your password and answers are encrypted (AES-GCM, key derived via PBKDF2) before being saved, and the PIN is asked for on each login instead of being stored anywhere.
3. Head to **Preferences** for theme, landing page after login, and PIN-dialog style.
4. Head to **Deadline Highlighter** to enable/disable auto-start, tweak the four status colors, and set the refresh/auto-stop timing. It only ever runs on the CDC placement page.

## Why this exists

- **Local-only, serverless.** Nothing you enter ever leaves your browser — credentials live in `chrome.storage.local`, and network requests go only to `erp.iitkgp.ac.in` (to fetch your security questions) and to GitHub's public releases API (to check for updates).
- **Minimal permissions**, each justified below.
- **Small.** No frameworks in the runtime bundle — just TypeScript + a couple of small DOM helpers.

## Permissions used

| Permission                        | Why                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                         | Saves your (optionally encrypted) credentials and preferences locally.                                                             |
| `scripting`                       | Re-injects the deadline-highlighter content script if the popup is opened before it's had a chance to load on an already-open tab. |
| `alarms`                          | Schedules the periodic "is there a newer release?" check.                                                                          |
| Host access to `erp.iitkgp.ac.in` | Required to run the login-autofill and deadline-highlighter content scripts, and to fetch your security questions.                 |

The background service worker also calls the public `api.github.com` releases endpoint to check for updates — no extra host permission is needed for that since GitHub's API allows anonymous cross-origin reads.

## Security notes

- Passwords and security-question answers are stored as-is only if you don't set a PIN. If you do set one, they're encrypted with AES-GCM using a key derived from your PIN via PBKDF2 (100,000 iterations) — the PIN itself is never stored.
- Nothing is sent anywhere except `erp.iitkgp.ac.in` (to log you in) and GitHub's release API (to check your extension's version) — there's no backend of ours in the loop at all.

## Building from source (for contributors)

You don't need this to just use the extension — it's only for making changes.

```bash
git clone https://github.com/SumitKumar-17/erp-toolkit.git
cd erp-toolkit
npm install
npm run build-dev     # rebuilds extension/ on every change (npm start to watch)
npm run build-prod    # minified production build
```

Either command outputs to the same `extension/` folder — reload it from `chrome://extensions` after each build. CI automatically rebuilds `extension/`, bumps the version, and cuts a GitHub Release on every push to `main`.

## Contributing

Pull requests are welcome — please describe the change and, for anything touching the popup UI, include a screenshot. Run `npm run pretty` before committing.

## License

[MIT](./LICENSE) © Sumit Kumar

## Author

**Sumit Kumar** — [website](https://sumitk.me) · [GitHub](https://github.com/SumitKumar-17)

This project merges and rewrites two of the author's earlier extensions, [`auto-login-erp`](https://github.com/SumitKumar-17/auto-login-erp) and [`erp-cv-deadline-highlighter`](https://github.com/SumitKumar-17/erp-cv-deadline-highlighter), into one actively maintained toolkit.
