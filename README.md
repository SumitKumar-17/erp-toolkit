<p align="center">
  <img src="./src/assets/images/ext_icon.png" alt="ERP Toolkit - IITKGP logo" width="72" height="72">
</p>

<h1 align="center">ERP Toolkit - IITKGP</h1>

<p align="center">
  Auto-login and CV/resume deadline highlighting for IIT Kharagpur's ERP, in one lightweight, local-only browser extension.
</p>

<p align="center">
  <a href="https://github.com/SumitKumar-17/erp-toolkit/releases/latest">
    <img src="https://img.shields.io/github/v/release/SumitKumar-17/erp-toolkit?label=latest%20release&color=5c6ac4" alt="Latest release">
  </a>
  <img src="https://img.shields.io/badge/install-no%20build%20step-16a34a" alt="No build step required">
  <img src="https://img.shields.io/badge/works%20on-Chrome%20%7C%20Edge%20%7C%20Brave-4285F4" alt="Works on Chrome, Edge, Brave">
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License">
  </a>
</p>

<p align="center">
  <a href="https://github.com/SumitKumar-17/erp-toolkit/releases/latest">⬇️ Download latest release</a>
  ·
  <a href="https://github.com/SumitKumar-17/erp-toolkit/issues/new">🐞 Report a bug</a>
  ·
  <a href="https://github.com/SumitKumar-17/erp-toolkit/issues/new">💡 Request a feature</a>
</p>

> [!NOTE]
> Not published on the Chrome Web Store (yet) — that's fine, installing it takes about a minute. Jump to **[Installation](#-installation)**.

## What it does

One toolbar icon, one popup, two features:

### 🔑 Auto-login

Fills and submits the ERP SSO login form for you — username, password, and your three security-question answers. Optionally protected by a 4-digit PIN, in which case your password and answers are AES-encrypted before being saved, so nothing sensitive ever sits in plain text in browser storage.

### 🎯 Deadline Highlighter

On the CDC placement portal, color-codes every CV/resume-deadline row across four stages, so the urgent ones jump out instead of hiding in a wall of table rows:

| Stage                | Default color |
| -------------------- | ------------- |
| Upcoming (>24h left) | 🟢 Green      |
| 1 day left           | 🟡 Amber      |
| 6 hours or less      | 🟠 Orange     |
| Overdue              | 🔴 Red        |

A small floating, draggable status widget appears on the page itself, and all four colors — plus the refresh rate and auto-stop timing — are configurable from the popup.

---

## 📦 Installation

**No Node.js. No `npm install`. No build step.** Download a folder, load it, done.

| Step | Action                                                                                                                                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Go to [**Releases**](https://github.com/SumitKumar-17/erp-toolkit/releases/latest) and download **`erp-toolkit-vX.Y.Z.zip`** from the release's **Assets**. |
| 2    | Unzip it — you get a folder (named after the zip) with `manifest.json` inside. That's the whole extension, nothing else needed.                             |
| 3    | Open **`chrome://extensions`** (or `edge://extensions`, `brave://extensions` — any Chromium browser works identically).                                     |
| 4    | Turn on **Developer mode** (top-right toggle).                                                                                                              |
| 5    | Click **Load unpacked** and select the unzipped folder.                                                                                                     |
| 6    | Click the toolbar icon and set up your login details — you're done.                                                                                         |

> [!WARNING]
> Every GitHub release also gets automatic **"Source code (zip)"** / **"(tar.gz)"** links — that's GitHub's doing, not a download option we provide. Those contain the entire repository (source, build configs, everything), not the built extension. Always grab **`erp-toolkit-vX.Y.Z.zip`** from **Assets** specifically.

## Setting it up

1. Open the popup and enter your ERP roll number, then fetch your security questions and fill in your password + answers.
2. Optionally set a 4-digit PIN — your password and answers get encrypted (AES-GCM, key derived via PBKDF2) before saving, and the PIN is asked for on each login instead of being stored anywhere.
3. **Preferences** — theme, landing page after login, PIN-dialog style.
4. **Deadline Highlighter** — enable/disable auto-start, tweak the four status colors, set refresh/auto-stop timing. Only ever runs on the CDC placement page.

## Staying updated

> [!IMPORTANT]
> Chrome does not allow any extension loaded via **Load unpacked** to silently auto-update itself — that's a platform restriction, not a limitation of this project.

Instead, the popup checks GitHub every time you open it (and periodically in the background) and shows a banner the moment a new version ships:

1. Banner reads **"Update available: vX.Y.Z"**.
2. Click **Download update** — it downloads the new ZIP _and_ opens `chrome://extensions` for you.
3. Unzip, then click the reload icon (🔄) next to ERP Toolkit. Done.

Your installed version is always visible at the bottom of the popup, and the **About** panel shows a fuller readout — "up to date" or the version you can update to.

## Privacy & permissions

Local-only, serverless — nothing you enter ever leaves your browser. Credentials live in `chrome.storage.local`; if you set a PIN, they're AES-GCM encrypted with a key derived from it via PBKDF2 (100,000 iterations), and the PIN itself is never stored. Network requests go only to `erp.iitkgp.ac.in` (login + security questions) and GitHub's public releases API (update checks) — there's no backend of ours in the loop.

| Permission                        | Why                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                         | Saves your (optionally encrypted) credentials and preferences locally.                                                             |
| `scripting`                       | Re-injects the deadline-highlighter content script if the popup is opened before it's had a chance to load on an already-open tab. |
| `alarms`                          | Schedules the periodic "is there a newer release?" check.                                                                          |
| `downloads`                       | Lets the "Download update" button save a new release's ZIP straight to your Downloads folder.                                      |
| Host access to `erp.iitkgp.ac.in` | Required to run the login-autofill and deadline-highlighter content scripts, and to fetch your security questions.                 |

## License

[MIT](./LICENSE) © Sumit Kumar

## Author

**Sumit Kumar** — [website](https://sumitk.me) · [GitHub](https://github.com/SumitKumar-17)

This project merges and rewrites two of the author's earlier extensions, [`auto-login-erp`](https://github.com/SumitKumar-17/auto-login-erp) and [`erp-cv-deadline-highlighter`](https://github.com/SumitKumar-17/erp-cv-deadline-highlighter), into one actively maintained toolkit.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).
