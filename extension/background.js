(() => {
  "use strict";
  const REPO = "SumitKumar-17/erp-toolkit";
  const RELEASES_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
  const STORAGE_KEY = "updateInfo";
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
      chrome.storage.local.remove(STORAGE_KEY, resolve);
      return;
    }
    chrome.storage.local.set({
      [STORAGE_KEY]: info
    }, resolve);
  });
  const isSideloadedInstall = () => new Promise(resolve => {
    chrome.management.getSelf(info => resolve(info.installType !== "normal"));
  });
  const performUpdateCheck = async () => {
    if (!await isSideloadedInstall()) {
      await setStoredUpdateInfo(null);
      await chrome.action.setBadgeText({
        text: ""
      });
      return null;
    }
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
    chrome.storage.local.get([ STORAGE_KEY, DISMISSED_KEY ], result => {
      const info = result[STORAGE_KEY];
      const dismissedVersion = result[DISMISSED_KEY];
      resolve(info && info.latestVersion !== dismissedVersion ? info : null);
    });
  });
  const dismissUpdate = version => new Promise(resolve => chrome.storage.local.set({
    [DISMISSED_KEY]: version
  }, resolve));
  const UPDATE_CHECK_ALARM = "erp-toolkit-update-check";
  const UPDATE_CHECK_PERIOD_MINUTES = 360;
  chrome.runtime.onInstalled.addListener(details => {
    if (details.reason === "install") chrome.tabs.create({
      url: chrome.runtime.getManifest().homepage_url
    }).catch(() => {});
    chrome.alarms.create(UPDATE_CHECK_ALARM, {
      periodInMinutes: UPDATE_CHECK_PERIOD_MINUTES
    });
    void performUpdateCheck();
  });
  chrome.runtime.onStartup.addListener(() => void performUpdateCheck());
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === UPDATE_CHECK_ALARM) void performUpdateCheck();
  });
})();