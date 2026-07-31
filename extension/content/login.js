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
  const OVERLAY_ID = "erp-toolkit-overlay";
  const openToolkitOverlay = () => {
    if (document.getElementById(OVERLAY_ID)) return;
    const dialog = document.createElement("dialog");
    dialog.id = OVERLAY_ID;
    dialog.style.cssText = "padding:0;border:none;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.45)";
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:relative;line-height:0";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.title = "Close";
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = [ "position:absolute", "top:8px", "right:8px", "z-index:1", "width:26px", "height:26px", "border-radius:9999px", "border:none", "background:rgba(0,0,0,0.55)", "color:#fff", "cursor:pointer", "font-size:13px", "line-height:1" ].join(";");
    closeBtn.addEventListener("click", () => dialog.close());
    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("pages/Popup/index.html");
    iframe.style.cssText = "width:360px;height:600px;border:none;display:block";
    iframe.title = "ERP Toolkit";
    wrapper.append(closeBtn, iframe);
    dialog.append(wrapper);
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  };
  const toolkitOverlay = openToolkitOverlay;
  const BANNER_ID = "erp-toolkit-login-banner";
  const showBannerMessage = (message, color = "#2563eb", showOpenButton = false) => {
    document.getElementById(BANNER_ID)?.remove();
    const banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.setAttribute("style", [ `background: linear-gradient(to right, ${color}, #ed4e50)`, "color: #fff", "font-weight: 500", "width: 100%", "min-height: 35px", "text-align: center", "display: flex", "justify-content: center", "align-items: center", "gap: 12px", "padding: 4px 12px" ].join(";"));
    const text = document.createElement("span");
    text.textContent = message;
    banner.append(text);
    if (showOpenButton) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Open ERP Toolkit";
      button.setAttribute("style", [ "background: rgba(255,255,255,0.2)", "color: #fff", "border: 1px solid rgba(255,255,255,0.4)", "border-radius: 6px", "padding: 4px 10px", "font-size: 13px", "cursor: pointer", "flex-shrink: 0" ].join(";"));
      button.addEventListener("click", toolkitOverlay);
      banner.append(button);
    }
    document.body.prepend(banner);
  };
  const bannerMessage = showBannerMessage;
  const DIALOG_STYLES = `\n  body {\n    overflow: hidden;\n  }\n\n  dialog#erp-toolkit-pin-dialog {\n    z-index: 2147483646;\n    position: fixed;\n    left: 50%;\n    transform: translate(-50%, 0);\n    width: 340px;\n    border: none;\n    border-radius: 0 0 6px 6px;\n    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.5);\n    padding: 16px 24px;\n    margin: 0;\n    background-color: #fff;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    flex-direction: column;\n    font-family: system-ui, sans-serif;\n  }\n\n  dialog#erp-toolkit-pin-dialog::backdrop {\n    background-color: rgb(0 0 0 / 0.5);\n  }\n\n  #erp-toolkit-pin-dialog .prompt {\n    margin-bottom: 16px;\n    font-size: 15px;\n    color: #1a1a1a;\n  }\n\n  #erp-toolkit-pin-dialog .digit-group {\n    display: flex;\n    gap: 6px;\n  }\n\n  #erp-toolkit-pin-dialog .digit-group input {\n    width: 36px;\n    height: 48px;\n    background-color: #fff;\n    border: 2px solid #9ca3af;\n    border-radius: 6px;\n    text-align: center;\n    font-size: 22px;\n    color: #111827;\n  }\n\n  #erp-toolkit-pin-dialog button {\n    margin-top: 16px;\n    border-radius: 6px;\n    border: none;\n    background: #e5e7eb;\n    color: #111827;\n    padding: 6px 14px;\n    cursor: pointer;\n  }\n`;
  const isDigitKey = key => key.length === 1 && key >= "0" && key <= "9";
  async function getPinFromDialog() {
    const style = document.createElement("style");
    style.textContent = DIALOG_STYLES;
    const dialog = document.createElement("dialog");
    dialog.id = "erp-toolkit-pin-dialog";
    dialog.innerHTML = `\n    <div class="prompt">Enter your 4-digit PIN</div>\n    <form class="digit-group" autocomplete="off">\n      ${[ 0, 1, 2, 3 ].map(i => `<input type="password" inputmode="numeric" maxlength="1" data-index="${i}" />`).join("")}\n    </form>\n    <button type="button" id="erp-toolkit-pin-cancel">Cancel</button>\n  `;
    document.head.append(style);
    document.body.append(dialog);
    dialog.showModal();
    const inputs = Array.from(dialog.querySelectorAll("input[data-index]"));
    const cancelButton = dialog.querySelector("#erp-toolkit-pin-cancel");
    let pin = "";
    inputs.forEach((input, index) => {
      input.addEventListener("keydown", event => {
        if (event.key === "Backspace" && input.value === "" && index > 0) {
          inputs[index - 1]?.focus();
          return;
        }
        if (!isDigitKey(event.key)) return;
        input.value = event.key;
        event.preventDefault();
        if (index < inputs.length - 1) inputs[index + 1]?.focus(); else {
          pin = inputs.map(i => i.value).join("");
          dialog.close();
        }
      });
    });
    cancelButton?.addEventListener("click", () => dialog.close());
    inputs[0]?.focus();
    await new Promise(resolve => dialog.addEventListener("close", resolve, {
      once: true
    }));
    dialog.remove();
    style.remove();
    return pin;
  }
  const pinDialog = getPinFromDialog;
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
  const autoLogin = async () => {
    const credential = await getCredential();
    if (!credential.username) {
      bannerMessage("ERP Toolkit is installed — add your login details to get started.", "#a16207", true);
      return;
    }
    if (!credential.autoLogin) {
      bannerMessage("Automatic login is turned off.", "#4b5563");
      return;
    }
    if (utils_validateCredentials(credential) === FieldValidationStatus.SomeFieldIsEmpty) {
      bannerMessage("Please finish setting up your login details.", "#4b5563", true);
      return;
    }
    const usernameInput = document.getElementById("user_id");
    const answerDiv = document.getElementById("answer_div");
    if (!usernameInput || !answerDiv) {
      bannerMessage("Could not find the login form on this page. Please refresh and retry.", "#dc2626");
      return;
    }
    bannerMessage("Prefilling your credentials, please wait...");
    const {requirePin, username} = credential;
    const {useAltPINDialog} = await getPreferences();
    const pin = requirePin ? useAltPINDialog ? await pinDialog() : prompt("Enter your 4-digit PIN") ?? "" : "";
    const observer = new MutationObserver(([mutation], instance) => {
      instance.disconnect();
      void handleSecurityQuestion(mutation.addedNodes[0]?.nodeValue ?? "", {
        credential,
        requirePin,
        pin
      });
    });
    observer.observe(answerDiv, {
      childList: true,
      subtree: true
    });
    usernameInput.value = username;
    usernameInput.blur();
  };
  const handleSecurityQuestion = async (question, {credential, requirePin, pin}) => {
    let answer;
    switch (question) {
     case credential.q1:
      answer = credential.a1;
      break;

     case credential.q2:
      answer = credential.a2;
      break;

     case credential.q3:
      answer = credential.a3;
      break;

     default:
      bannerMessage("Invalid username/password set — please update your credentials.", "#dc2626");
      return;
    }
    let password;
    if (requirePin) try {
      password = await decrypt(credential.password, pin);
      answer = await decrypt(answer, pin);
    } catch {
      bannerMessage("Incorrect PIN. Reset it if forgotten, or refresh the page to retry.", "#dc2626");
      return;
    } else password = credential.password;
    const passwordInput = document.getElementById("password");
    const answerInput = document.getElementById("answer");
    if (!passwordInput || !answerInput) {
      bannerMessage("Something went wrong. Please refresh the page and retry.", "#dc2626");
      return;
    }
    passwordInput.value = password;
    answerInput.value = answer;
    document.getElementById("getotp")?.click();
    bannerMessage("Details filled in — an OTP was sent to your mail, enter it to finish logging in.", "#4b5563");
  };
  autoLogin().catch(error => {
    void 0;
  });
})();