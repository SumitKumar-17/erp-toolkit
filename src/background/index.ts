import { performUpdateCheck } from 'services/updateCheck'

const UPDATE_CHECK_ALARM = 'erp-toolkit-update-check'
const UPDATE_CHECK_PERIOD_MINUTES = 360

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getManifest().homepage_url }).catch(() => {
      /* new-tab creation can be blocked in some browser configurations — non-fatal */
    })
  }

  chrome.alarms.create(UPDATE_CHECK_ALARM, { periodInMinutes: UPDATE_CHECK_PERIOD_MINUTES })
  void performUpdateCheck()
})

chrome.runtime.onStartup.addListener(() => void performUpdateCheck())

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_CHECK_ALARM) void performUpdateCheck()
})
