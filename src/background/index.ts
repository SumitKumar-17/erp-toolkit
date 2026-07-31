import { fetchLatestRelease, isNewerVersion, setStoredUpdateInfo } from 'services/updateCheck'

const UPDATE_CHECK_ALARM = 'erp-toolkit-update-check'
const UPDATE_CHECK_PERIOD_MINUTES = 360

/**
 * There's no supported way for a manually "Load unpacked" extension to
 * silently replace its own installed files — Chrome's real auto-update
 * mechanism only applies to signed .crx builds installed via the Web Store
 * or enterprise policy. The best we can do here is check GitHub Releases and
 * surface a badge + in-popup banner linking to the new version.
 */
const checkForUpdate = async (): Promise<void> => {
  const currentVersion = chrome.runtime.getManifest().version
  const latest = await fetchLatestRelease()

  if (!latest || !isNewerVersion(latest.version, currentVersion)) {
    await setStoredUpdateInfo(null)
    await chrome.action.setBadgeText({ text: '' })
    return
  }

  await setStoredUpdateInfo({ latestVersion: latest.version, releaseUrl: latest.url, checkedAt: Date.now() })
  await chrome.action.setBadgeText({ text: '1' })
  await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' })
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getManifest().homepage_url }).catch(() => {
      /* new-tab creation can be blocked in some browser configurations — non-fatal */
    })
  }

  chrome.alarms.create(UPDATE_CHECK_ALARM, { periodInMinutes: UPDATE_CHECK_PERIOD_MINUTES })
  void checkForUpdate()
})

chrome.runtime.onStartup.addListener(() => void checkForUpdate())

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_CHECK_ALARM) void checkForUpdate()
})
