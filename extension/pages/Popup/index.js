(() => {
  "use strict";
  const DEFAULT_CREDENTIAL = {
    requirePin: false,
    autoLogin: true,
    username: "",
    password: "",
    q1: "",
    q2: "",
    q3: "",
    a1: "",
    a2: "",
    a3: ""
  };
  const getCredential = () => new Promise(resolve => {
    chrome.storage.local.get({
      authCredentials: DEFAULT_CREDENTIAL
    }, result => {
      resolve(result.authCredentials);
    });
  });
  const setCredential = credential => new Promise(resolve => {
    chrome.storage.local.set({
      authCredentials: credential
    }, resolve);
  });
  const clearCredential = () => new Promise(resolve => {
    chrome.storage.local.remove([ "authCredentials" ], resolve);
  });
  const getPreferences = () => new Promise(resolve => {
    chrome.storage.local.get([ "theme", "bg", "landingPage", "useAltPINDialog" ], result => {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      resolve({
        theme: result.theme === "dark" || !("theme" in result) && prefersDark ? "dark" : "light",
        showThemeBackground: result.bg === "yes",
        landingPage: result.landingPage ?? null,
        useAltPINDialog: Boolean(result.useAltPINDialog)
      });
    });
  });
  const setPreference = (key, value) => new Promise(resolve => {
    if (key === "showThemeBackground") {
      chrome.storage.local.set({
        bg: value ? "yes" : "no"
      }, resolve);
      return;
    }
    chrome.storage.local.set({
      [key]: value
    }, resolve);
  });
  const enc = new TextEncoder;
  const dec = new TextDecoder;
  const BYTE_LENGTH = {
    salt: 16,
    iv: 12
  };
  const bufferToBase64 = buffer => window.btoa(String.fromCharCode(...buffer));
  const base64ToBuffer = base64 => Uint8Array.from(window.atob(base64), c => c.charCodeAt(0));
  const deriveKeyFromPassword = password => window.crypto.subtle.importKey("raw", enc.encode(password), {
    name: "PBKDF2"
  }, false, [ "deriveKey" ]);
  const deriveEncryptionKey = (keyFromPassword, salt) => window.crypto.subtle.deriveKey({
    name: "PBKDF2",
    salt,
    iterations: 1e5,
    hash: "SHA-256"
  }, keyFromPassword, {
    name: "AES-GCM",
    length: 256
  }, false, [ "encrypt", "decrypt" ]);
  const encrypt = async (secret, password) => {
    const keyFromPassword = await deriveKeyFromPassword(password);
    const salt = window.crypto.getRandomValues(new Uint8Array(BYTE_LENGTH.salt));
    const key = await deriveEncryptionKey(keyFromPassword, salt);
    const iv = window.crypto.getRandomValues(new Uint8Array(BYTE_LENGTH.iv));
    const cipherText = new Uint8Array(await window.crypto.subtle.encrypt({
      name: "AES-GCM",
      iv
    }, key, enc.encode(secret)));
    const payload = new Uint8Array(salt.byteLength + iv.byteLength + cipherText.byteLength);
    payload.set(salt, 0);
    payload.set(iv, salt.byteLength);
    payload.set(cipherText, salt.byteLength + iv.byteLength);
    return bufferToBase64(payload);
  };
  const decrypt = async (encrypted, password) => {
    const payload = base64ToBuffer(encrypted);
    const salt = payload.slice(0, BYTE_LENGTH.salt);
    const iv = payload.slice(BYTE_LENGTH.salt, BYTE_LENGTH.salt + BYTE_LENGTH.iv);
    const cipherText = payload.slice(BYTE_LENGTH.salt + BYTE_LENGTH.iv);
    const keyFromPassword = await deriveKeyFromPassword(password);
    const key = await deriveEncryptionKey(keyFromPassword, salt);
    const decrypted = await window.crypto.subtle.decrypt({
      name: "AES-GCM",
      iv
    }, key, cipherText);
    return dec.decode(decrypted);
  };
  const BASE_URL = "https://erp.iitkgp.ac.in";
  const postForm = async (path, body) => {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-type": "application/x-www-form-urlencoded"
      },
      body
    });
    if (!response.ok) throw new Error(`ERP request failed with status ${response.status}`);
    return response;
  };
  class ERP {
    onGetSecurityQues=() => {};
    username;
    securityQuestions=new Set;
    constructor(username) {
      this.username = username;
    }
    async getSecurityQues() {
      const response = await postForm("/SSOAdministration/getSecurityQues.htm", `user_id=${this.username}`);
      return response.text();
    }
    async getAllSecurityQues() {
      while (this.securityQuestions.size < 3) {
        const question = await this.getSecurityQues();
        if (question === "FALSE") return false;
        if (!this.securityQuestions.has(question)) {
          this.securityQuestions.add(question);
          this.onGetSecurityQues(question);
        } else break;
      }
      return Array.from(this.securityQuestions);
    }
  }
  const DEFAULT_HIGHLIGHTER_SETTINGS = {
    enabled: true,
    colors: {
      upcoming: "#16a34a",
      warning: "#d97706",
      urgent: "#ea580c",
      overdue: "#dc2626"
    },
    refreshIntervalMs: 1e3,
    autoStopMinutes: 5
  };
  const STORAGE_KEY = "highlighterSettings";
  const getHighlighterSettings = () => new Promise(resolve => {
    chrome.storage.local.get({
      [STORAGE_KEY]: DEFAULT_HIGHLIGHTER_SETTINGS
    }, result => {
      resolve(result[STORAGE_KEY]);
    });
  });
  const setHighlighterSettings = settings => new Promise(resolve => {
    chrome.storage.local.set({
      [STORAGE_KEY]: settings
    }, resolve);
  });
  const onHighlighterSettingsChanged = callback => {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && STORAGE_KEY in changes) callback(changes[STORAGE_KEY].newValue);
    });
  };
  const HIGHLIGHTER_PAGE_MATCH = "/IIT_ERP3/showmenu.htm";
  const getActiveTab = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    return tab;
  };
  const injectHighlighter = async tabId => {
    await chrome.scripting.executeScript({
      target: {
        tabId
      },
      files: [ "content/highlighter/index.js" ]
    });
    await chrome.scripting.insertCSS({
      target: {
        tabId
      },
      files: [ "content/highlighter.css" ]
    });
  };
  const sendHighlighterCommand = async command => {
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url?.includes(HIGHLIGHTER_PAGE_MATCH)) return {
      ok: false,
      onErpDeadlinePage: false,
      error: "Open the CDC placement page on ERP first."
    };
    try {
      const response = await chrome.tabs.sendMessage(tab.id, command);
      return {
        ok: true,
        onErpDeadlinePage: true,
        response
      };
    } catch {
      try {
        await injectHighlighter(tab.id);
        const response = await chrome.tabs.sendMessage(tab.id, command);
        return {
          ok: true,
          onErpDeadlinePage: true,
          response
        };
      } catch (error) {
        return {
          ok: false,
          onErpDeadlinePage: true,
          error: error.message
        };
      }
    }
  };
  const REPO = "SumitKumar-17/erp-toolkit";
  const RELEASES_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
  const updateCheck_STORAGE_KEY = "updateInfo";
  const DISMISSED_KEY = "dismissedUpdateVersion";
  const parseVersion = version => version.replace(/^v/, "").split(".").map(part => parseInt(part, 10) || 0);
  const isNewerVersion = (latest, current) => {
    const latestParts = parseVersion(latest);
    const currentParts = parseVersion(current);
    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const diff = (latestParts[i] ?? 0) - (currentParts[i] ?? 0);
      if (diff !== 0) return diff > 0;
    }
    return false;
  };
  const fetchLatestRelease = async () => {
    try {
      const response = await fetch(RELEASES_API_URL, {
        headers: {
          Accept: "application/vnd.github+json"
        }
      });
      if (!response.ok) return null;
      const release = await response.json();
      if (!release.tag_name || !release.html_url) return null;
      const zipAsset = release.assets?.find(asset => asset.name?.endsWith(".zip"));
      return {
        version: release.tag_name.replace(/^v/, ""),
        url: release.html_url,
        downloadUrl: zipAsset?.browser_download_url ?? null
      };
    } catch {
      return null;
    }
  };
  const setStoredUpdateInfo = info => new Promise(resolve => {
    if (!info) {
      chrome.storage.local.remove(updateCheck_STORAGE_KEY, resolve);
      return;
    }
    chrome.storage.local.set({
      [updateCheck_STORAGE_KEY]: info
    }, resolve);
  });
  const performUpdateCheck = async () => {
    const currentVersion = chrome.runtime.getManifest().version;
    const latest = await fetchLatestRelease();
    if (!latest || !isNewerVersion(latest.version, currentVersion)) {
      await setStoredUpdateInfo(null);
      await chrome.action.setBadgeText({
        text: ""
      });
      return null;
    }
    const info = {
      latestVersion: latest.version,
      releaseUrl: latest.url,
      downloadUrl: latest.downloadUrl,
      checkedAt: Date.now()
    };
    await setStoredUpdateInfo(info);
    await chrome.action.setBadgeText({
      text: "1"
    });
    await chrome.action.setBadgeBackgroundColor({
      color: "#dc2626"
    });
    return info;
  };
  const getActionableUpdate = () => new Promise(resolve => {
    chrome.storage.local.get([ updateCheck_STORAGE_KEY, DISMISSED_KEY ], result => {
      const info = result[updateCheck_STORAGE_KEY];
      const dismissedVersion = result[DISMISSED_KEY];
      resolve(info && info.latestVersion !== dismissedVersion ? info : null);
    });
  });
  const dismissUpdate = version => new Promise(resolve => chrome.storage.local.set({
    [DISMISSED_KEY]: version
  }, resolve));
  const ICON_BY_TYPE = {
    info: "info",
    success: "check",
    warning: "warning",
    error: "cross"
  };
  const logToPopup = (message, {type = "info", onConfirm, onCancel} = {}) => {
    const log = document.getElementById("log");
    const logIcon = document.getElementById("logIcon");
    const logText = document.getElementById("logText");
    const status = document.getElementById("status");
    const statusIcon = document.getElementById("statusIcon");
    const statusText = document.getElementById("statusText");
    const iconId = ICON_BY_TYPE[type];
    log.className = type;
    logText.textContent = message;
    logIcon.setAttribute("href", chrome.runtime.getURL(`assets/sprite.svg#${iconId}`));
    status.dataset.state = type;
    statusText.textContent = message;
    statusIcon.setAttribute("href", chrome.runtime.getURL(`assets/sprite.svg#${iconId}`));
    log.querySelectorAll(".action").forEach(el => el.remove());
    if (onConfirm && onCancel) {
      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "action";
      confirmBtn.textContent = "Yes";
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "action";
      cancelBtn.textContent = "Cancel";
      log.append(confirmBtn, cancelBtn);
      const cleanup = () => {
        confirmBtn.remove();
        cancelBtn.remove();
      };
      confirmBtn.addEventListener("click", () => {
        cleanup();
        onConfirm();
      });
      cancelBtn.addEventListener("click", () => {
        cleanup();
        onCancel();
      });
    }
  };
  const popupLogger = logToPopup;
  var FieldValidationStatus;
  (function(FieldValidationStatus) {
    FieldValidationStatus[FieldValidationStatus["SomeFieldIsEmpty"] = 0] = "SomeFieldIsEmpty";
    FieldValidationStatus[FieldValidationStatus["AllFieldsFilled"] = 1] = "AllFieldsFilled";
  })(FieldValidationStatus || (FieldValidationStatus = {}));
  const PLACEHOLDER_QUESTION = n => `Your erp question ${n}`;
  const validateCredentials = credential => {
    const allFilled = credential.username !== "" && credential.password !== "" && credential.a1 !== "" && credential.a2 !== "" && credential.a3 !== "" && credential.q1 !== PLACEHOLDER_QUESTION(1) && credential.q2 !== PLACEHOLDER_QUESTION(2) && credential.q3 !== PLACEHOLDER_QUESTION(3);
    return allFilled ? FieldValidationStatus.AllFieldsFilled : FieldValidationStatus.SomeFieldIsEmpty;
  };
  const utils_validateCredentials = validateCredentials;
  const STATUS_POLL_MS = 2e3;
  void initThemeAndPreferences();
  void initCredentialForm();
  void initHighlighterPanel();
  void initUpdateBanner();
  async function initUpdateBanner() {
    await performUpdateCheck();
    const update = await getActionableUpdate();
    if (!update) return;
    const banner = document.getElementById("updateBanner");
    const text = document.getElementById("updateBannerText");
    const dismissBtn = document.getElementById("updateBannerDismiss");
    const actionBtn = document.getElementById("updateBannerAction");
    const notesLink = document.getElementById("updateBannerNotes");
    text.textContent = `Update available: v${update.latestVersion}`;
    notesLink.href = update.releaseUrl;
    banner.hidden = false;
    actionBtn.addEventListener("click", () => {
      void downloadUpdate(update.downloadUrl, update.latestVersion);
    });
    dismissBtn.addEventListener("click", () => {
      banner.hidden = true;
      void dismissUpdate(update.latestVersion);
    });
  }
  async function downloadUpdate(downloadUrl, version) {
    if (downloadUrl) await chrome.downloads.download({
      url: downloadUrl,
      filename: `erp-toolkit-v${version}.zip`
    });
    await chrome.tabs.create({
      url: `chrome://extensions/?id=${chrome.runtime.id}`
    });
  }
  async function initThemeAndPreferences() {
    const prefs = await getPreferences();
    const useAltPINDialogInput = document.getElementById("useAltPINDialog");
    const themeSelect = document.getElementById("theme_select");
    const themeBgInput = document.getElementById("theme-bg");
    const landingPageSelect = document.getElementById("landing_page");
    useAltPINDialogInput.checked = prefs.useAltPINDialog;
    useAltPINDialogInput.onchange = event => {
      void setPreference("useAltPINDialog", event.target.checked);
    };
    themeSelect.value = prefs.theme;
    document.documentElement.classList.toggle("dark", prefs.theme === "dark");
    themeBgInput.checked = prefs.showThemeBackground;
    applyThemeBackground(prefs.theme, prefs.showThemeBackground);
    themeBgInput.onchange = event => {
      const enabled = event.target.checked;
      applyThemeBackground(themeSelect.value, enabled);
      void setPreference("showThemeBackground", enabled);
    };
    themeSelect.onchange = event => {
      const theme = event.target.value;
      document.documentElement.classList.toggle("dark", theme === "dark");
      applyThemeBackground(theme, themeBgInput.checked);
      void setPreference("theme", theme);
    };
    if (prefs.landingPage) landingPageSelect.value = prefs.landingPage;
    landingPageSelect.onchange = event => {
      void setPreference("landingPage", event.target.value);
    };
  }
  function applyThemeBackground(theme, enabled) {
    document.body.classList.remove("bg-theme", "bg-theme-dark");
    if (!enabled) return;
    document.body.classList.add(theme === "dark" ? "bg-theme-dark" : "bg-theme");
  }
  async function initCredentialForm() {
    const credential = await getCredential();
    const form = document.getElementById("form_add_user");
    const formResetBtn = document.getElementById("reset_form");
    const formSubmitBtn = document.getElementById("submit_form");
    const username = document.getElementById("username");
    const usernameSubmitBtn = document.getElementById("username_submit_button");
    const password = document.getElementById("password");
    const answers = [ document.getElementById("question_one"), document.getElementById("question_two"), document.getElementById("question_three") ];
    const pin = document.getElementById("pin");
    const questionInputs = document.querySelectorAll("input[name='question']");
    const boxToggleButtons = document.querySelectorAll(".left-button, .right-button");
    const loader = document.getElementById("loader");
    const container = document.querySelector(".box-container");
    const autoLoginToggle = document.getElementById("autoLogin");
    username.value = credential.username;
    password.value = credential.password;
    answers[0].value = credential.a1;
    answers[1].value = credential.a2;
    answers[2].value = credential.a3;
    answers[0].placeholder = credential.q1 || "Your erp question 1";
    answers[1].placeholder = credential.q2 || "Your erp question 2";
    answers[2].placeholder = credential.q3 || "Your erp question 3";
    autoLoginToggle.checked = credential.autoLogin;
    if (credential.username === "") {
      popupLogger("Enter your roll number to get started");
      username.removeAttribute("disabled");
      usernameSubmitBtn.removeAttribute("disabled");
    } else {
      popupLogger(`You are all set, ${credential.username}!`, {
        type: "success"
      });
      pin.style.display = "none";
      const pinNote = document.createElement("b");
      pinNote.setAttribute("style", "margin-left: 50px");
      pinNote.innerText = credential.requirePin ? "PIN was set!" : "PIN was NOT set!";
      pin.after(pinNote);
    }
    if (utils_validateCredentials(credential) === FieldValidationStatus.SomeFieldIsEmpty) container.classList.add("right-open");
    boxToggleButtons.forEach(button => button.addEventListener("click", () => container.classList.toggle("right-open")));
    autoLoginToggle.addEventListener("change", event => {
      credential.autoLogin = event.target.checked;
      void setCredential(credential);
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      void submitCredentialForm({
        credential,
        username,
        password,
        answers,
        pin,
        loader
      });
    });
    formResetBtn.addEventListener("click", event => {
      event.preventDefault();
      popupLogger("Are you sure? This clears all saved credentials.", {
        type: "warning",
        onConfirm: () => {
          form.reset();
          void clearCredential().then(() => location.reload());
        },
        onCancel: () => popupLogger("Cancelled.")
      });
    });
    username.addEventListener("keyup", () => {
      if (username.value.length === 8 || username.value.length === 10) {
        questionInputs.forEach((input, i) => {
          input.placeholder = `Your erp question ${i + 1}`;
          input.value = "";
          input.disabled = true;
        });
        password.value = "";
        pin.value = "";
        password.disabled = true;
        pin.disabled = true;
      }
    });
    usernameSubmitBtn.addEventListener("click", () => {
      void fetchSecurityQuestions({
        username: username.value,
        questionInputs,
        password,
        pin,
        formSubmitBtn
      });
    });
    setTimeout(() => loader.style.display = "none", 500);
  }
  async function submitCredentialForm({credential, username, password, answers, pin, loader}) {
    loader.style.display = "flex";
    setTimeout(() => loader.style.display = "none", 500);
    const base = {
      autoLogin: credential.autoLogin,
      username: username.value,
      q1: answers[0].placeholder,
      q2: answers[1].placeholder,
      q3: answers[2].placeholder
    };
    const nextCredential = pin.value ? {
      ...base,
      requirePin: true,
      password: await encrypt(password.value, pin.value),
      a1: await encrypt(answers[0].value, pin.value),
      a2: await encrypt(answers[1].value, pin.value),
      a3: await encrypt(answers[2].value, pin.value)
    } : {
      ...base,
      requirePin: false,
      password: password.value,
      a1: answers[0].value,
      a2: answers[1].value,
      a3: answers[2].value
    };
    await setCredential(nextCredential);
    location.reload();
  }
  async function fetchSecurityQuestions({username, questionInputs, password, pin, formSubmitBtn}) {
    popupLogger("Fetching your security questions...");
    const erpUser = new ERP(username);
    let index = 0;
    erpUser.onGetSecurityQues = question => {
      const input = questionInputs[index];
      if (input) {
        input.removeAttribute("disabled");
        input.placeholder = question;
      }
      index++;
    };
    const result = await erpUser.getAllSecurityQues();
    if (result === false) {
      popupLogger("Invalid roll number!", {
        type: "error"
      });
      return;
    }
    popupLogger("Questions fetched — fill in your answers below.", {
      type: "success"
    });
    password.removeAttribute("disabled");
    pin.removeAttribute("disabled");
    formSubmitBtn.removeAttribute("disabled");
  }
  async function initHighlighterPanel() {
    const enabledToggle = document.getElementById("highlighterEnabled");
    const colorInputs = {
      upcoming: document.getElementById("colorUpcoming"),
      warning: document.getElementById("colorWarning"),
      urgent: document.getElementById("colorUrgent"),
      overdue: document.getElementById("colorOverdue")
    };
    const refreshIntervalInput = document.getElementById("refreshIntervalSeconds");
    const autoStopInput = document.getElementById("autoStopMinutes");
    const startBtn = document.getElementById("highlighterStart");
    const stopBtn = document.getElementById("highlighterStop");
    const clearBtn = document.getElementById("highlighterClear");
    const statusBox = document.getElementById("highlighterStatusBox");
    const statusDot = document.getElementById("highlighterStatusDot");
    const statusText = document.getElementById("highlighterStatusText");
    const processedCount = document.getElementById("highlighterProcessedCount");
    const settings = await getHighlighterSettings();
    enabledToggle.checked = settings.enabled;
    colorInputs.upcoming.value = settings.colors.upcoming;
    colorInputs.warning.value = settings.colors.warning;
    colorInputs.urgent.value = settings.colors.urgent;
    colorInputs.overdue.value = settings.colors.overdue;
    refreshIntervalInput.value = String(Math.round(settings.refreshIntervalMs / 1e3));
    autoStopInput.value = String(settings.autoStopMinutes);
    const persist = async patch => {
      const current = await getHighlighterSettings();
      await setHighlighterSettings({
        ...current,
        ...patch
      });
    };
    enabledToggle.onchange = () => void persist({
      enabled: enabledToggle.checked
    });
    const persistColors = () => {
      void persist({
        colors: {
          upcoming: colorInputs.upcoming.value,
          warning: colorInputs.warning.value,
          urgent: colorInputs.urgent.value,
          overdue: colorInputs.overdue.value
        }
      });
    };
    colorInputs.upcoming.onchange = persistColors;
    colorInputs.warning.onchange = persistColors;
    colorInputs.urgent.onchange = persistColors;
    colorInputs.overdue.onchange = persistColors;
    refreshIntervalInput.onchange = () => void persist({
      refreshIntervalMs: Math.max(1, Number(refreshIntervalInput.value) || 1) * 1e3
    });
    autoStopInput.onchange = () => void persist({
      autoStopMinutes: Math.max(1, Number(autoStopInput.value) || 1)
    });
    const renderStatus = (isActive, rows, message) => {
      statusBox.classList.toggle("highlighter-status--active", isActive);
      statusDot.classList.toggle("highlighter-status__dot--active", isActive);
      statusText.textContent = message ?? (isActive ? "Active — monitoring deadlines" : "Inactive");
      processedCount.textContent = `${rows} row${rows === 1 ? "" : "s"} processed`;
      startBtn.disabled = isActive;
      stopBtn.disabled = !isActive;
    };
    const refreshStatus = async () => {
      const result = await sendHighlighterCommand({
        action: "highlighter:status"
      });
      if (!result.onErpDeadlinePage) {
        renderStatus(false, 0, "Open the CDC placement page to use this");
        startBtn.disabled = true;
        stopBtn.disabled = true;
        clearBtn.disabled = true;
        return;
      }
      clearBtn.disabled = false;
      renderStatus(result.response?.isActive ?? false, result.response?.processedRows ?? 0);
    };
    startBtn.addEventListener("click", async () => {
      await sendHighlighterCommand({
        action: "highlighter:start"
      });
      await refreshStatus();
    });
    stopBtn.addEventListener("click", async () => {
      await sendHighlighterCommand({
        action: "highlighter:stop"
      });
      await refreshStatus();
    });
    clearBtn.addEventListener("click", async () => {
      await sendHighlighterCommand({
        action: "highlighter:clear"
      });
      await refreshStatus();
    });
    await refreshStatus();
    window.setInterval(() => void refreshStatus(), STATUS_POLL_MS);
  }
})();