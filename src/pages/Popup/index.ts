import type Credential from 'models/Credential'
import type HighlighterSettings from 'models/HighlighterSettings'
import 'pages/Popup/style.css'
import { getCredential, getPreferences, setCredential, setPreference, clearCredential } from 'services/credentialStore'
import { encrypt } from 'services/crypto'
import ERP from 'services/erp'
import { getHighlighterSettings, setHighlighterSettings } from 'services/highlighterStore'
import { sendHighlighterCommand } from 'services/messaging'
import { dismissUpdate, getActionableUpdate, isSideloadedInstall, performUpdateCheck } from 'services/updateCheck'
import logToPopup from 'utils/popupLogger'
import validateCredentials, { FieldValidationStatus } from 'utils/validateCredentials'

const STATUS_POLL_MS = 2000

void initThemeAndPreferences()
void initCredentialForm()
void initHighlighterPanel()
void initUpdateBanner()
initFooterVersion()

/** Always-visible footer readout — set immediately, no network round-trip needed. */
function initFooterVersion(): void {
  const footerVersion = document.getElementById('footerVersion') as HTMLElement
  footerVersion.textContent = `v${chrome.runtime.getManifest().version} · © 2026`
}

async function initUpdateBanner(): Promise<void> {
  const currentVersion = chrome.runtime.getManifest().version

  const versionInfo = document.getElementById('versionInfo') as HTMLElement
  const versionInfoText = document.getElementById('versionInfoText') as HTMLElement

  // Installed from the Chrome Web Store (or similar) — Chrome's own updater
  // handles this, so our GitHub-based checker has nothing useful to say.
  if (!(await isSideloadedInstall())) {
    versionInfo.classList.remove('version-info--update')
    versionInfoText.textContent = `v${currentVersion}`
    return
  }

  // Re-check on every popup open rather than waiting for the next background
  // alarm tick, so a just-published release shows up immediately.
  await performUpdateCheck()

  const update = await getActionableUpdate()

  if (!update) {
    versionInfo.classList.remove('version-info--update')
    versionInfoText.textContent = `v${currentVersion} — you're up to date`
    return
  }

  versionInfo.classList.add('version-info--update')
  versionInfoText.textContent = `v${currentVersion} — v${update.latestVersion} available`

  const banner = document.getElementById('updateBanner') as HTMLElement
  const text = document.getElementById('updateBannerText') as HTMLElement
  const dismissBtn = document.getElementById('updateBannerDismiss') as HTMLButtonElement
  const actionBtn = document.getElementById('updateBannerAction') as HTMLButtonElement
  const notesLink = document.getElementById('updateBannerNotes') as HTMLAnchorElement

  text.textContent = `Update available: v${update.latestVersion}`
  notesLink.href = update.releaseUrl
  banner.hidden = false

  actionBtn.addEventListener('click', () => {
    void downloadUpdate(update.downloadUrl, update.releaseUrl, update.latestVersion)
  })

  dismissBtn.addEventListener('click', () => {
    banner.hidden = true
    void dismissUpdate(update.latestVersion)
  })
}

/**
 * Downloads the new build's zip and jumps straight to chrome://extensions so
 * the only steps left for the user are: unzip, then click the reload icon
 * next to ERP Toolkit. Falls back to opening the release page itself if a
 * release was published without a zip attached (e.g. a manually-created one).
 */
async function downloadUpdate(downloadUrl: string | null, releaseUrl: string, version: string): Promise<void> {
  if (!downloadUrl) {
    await chrome.tabs.create({ url: releaseUrl })
    return
  }

  await chrome.downloads.download({ url: downloadUrl, filename: `erp-toolkit-v${version}.zip` })
  await chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` })
}

async function initThemeAndPreferences(): Promise<void> {
  const prefs = await getPreferences()

  const useAltPINDialogInput = document.getElementById('useAltPINDialog') as HTMLInputElement
  const themeSelect = document.getElementById('theme_select') as HTMLSelectElement
  const themeBgInput = document.getElementById('theme-bg') as HTMLInputElement
  const landingPageSelect = document.getElementById('landing_page') as HTMLSelectElement

  useAltPINDialogInput.checked = prefs.useAltPINDialog
  useAltPINDialogInput.onchange = (event) => {
    void setPreference('useAltPINDialog', (event.target as HTMLInputElement).checked)
  }

  themeSelect.value = prefs.theme
  document.documentElement.classList.toggle('dark', prefs.theme === 'dark')

  themeBgInput.checked = prefs.showThemeBackground
  applyThemeBackground(prefs.theme, prefs.showThemeBackground)

  themeBgInput.onchange = (event) => {
    const enabled = (event.target as HTMLInputElement).checked
    applyThemeBackground(themeSelect.value as 'light' | 'dark', enabled)
    void setPreference('showThemeBackground', enabled)
  }

  themeSelect.onchange = (event) => {
    const theme = (event.target as HTMLSelectElement).value as 'light' | 'dark'
    document.documentElement.classList.toggle('dark', theme === 'dark')
    applyThemeBackground(theme, themeBgInput.checked)
    void setPreference('theme', theme)
  }

  if (prefs.landingPage) landingPageSelect.value = prefs.landingPage
  landingPageSelect.onchange = (event) => {
    void setPreference('landingPage', (event.target as HTMLSelectElement).value)
  }
}

function applyThemeBackground(theme: 'light' | 'dark', enabled: boolean): void {
  document.body.classList.remove('bg-theme', 'bg-theme-dark')
  if (!enabled) return
  document.body.classList.add(theme === 'dark' ? 'bg-theme-dark' : 'bg-theme')
}

async function initCredentialForm(): Promise<void> {
  const credential = await getCredential()

  const form = document.getElementById('form_add_user') as HTMLFormElement
  const formResetBtn = document.getElementById('reset_form') as HTMLButtonElement
  const formSubmitBtn = document.getElementById('submit_form') as HTMLButtonElement

  const username = document.getElementById('username') as HTMLInputElement
  const usernameSubmitBtn = document.getElementById('username_submit_button') as HTMLButtonElement

  const password = document.getElementById('password') as HTMLInputElement
  const answers = [
    document.getElementById('question_one') as HTMLInputElement,
    document.getElementById('question_two') as HTMLInputElement,
    document.getElementById('question_three') as HTMLInputElement
  ]
  const pin = document.getElementById('pin') as HTMLInputElement
  const questionInputs = document.querySelectorAll<HTMLInputElement>("input[name='question']")
  const boxToggleButtons = document.querySelectorAll<HTMLButtonElement>('.left-button, .right-button')

  const loader = document.getElementById('loader') as HTMLDivElement
  const container = document.querySelector('.box-container') as HTMLElement
  const autoLoginToggle = document.getElementById('autoLogin') as HTMLInputElement

  username.value = credential.username
  password.value = credential.password
  answers[0].value = credential.a1
  answers[1].value = credential.a2
  answers[2].value = credential.a3
  answers[0].placeholder = credential.q1 || 'Your erp question 1'
  answers[1].placeholder = credential.q2 || 'Your erp question 2'
  answers[2].placeholder = credential.q3 || 'Your erp question 3'
  autoLoginToggle.checked = credential.autoLogin

  if (credential.username === '') {
    logToPopup('Enter your roll number to get started')
    username.removeAttribute('disabled')
    usernameSubmitBtn.removeAttribute('disabled')
  } else {
    logToPopup(`You are all set, ${credential.username}!`, { type: 'success' })

    pin.style.display = 'none'
    const pinNote = document.createElement('b')
    pinNote.setAttribute('style', 'margin-left: 50px')
    pinNote.innerText = credential.requirePin ? 'PIN was set!' : 'PIN was NOT set!'
    pin.after(pinNote)
  }

  if (validateCredentials(credential) === FieldValidationStatus.SomeFieldIsEmpty) {
    container.classList.add('right-open')
  }

  boxToggleButtons.forEach((button) => button.addEventListener('click', () => container.classList.toggle('right-open')))

  autoLoginToggle.addEventListener('change', (event) => {
    credential.autoLogin = (event.target as HTMLInputElement).checked
    void setCredential(credential)
  })

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    void submitCredentialForm({ credential, username, password, answers, pin, loader })
  })

  formResetBtn.addEventListener('click', (event) => {
    event.preventDefault()
    logToPopup('Are you sure? This clears all saved credentials.', {
      type: 'warning',
      onConfirm: () => {
        form.reset()
        void clearCredential().then(() => location.reload())
      },
      onCancel: () => logToPopup('Cancelled.')
    })
  })

  username.addEventListener('keyup', () => {
    if (username.value.length === 8 || username.value.length === 10) {
      questionInputs.forEach((input, i) => {
        input.placeholder = `Your erp question ${i + 1}`
        input.value = ''
        input.disabled = true
      })
      password.value = ''
      pin.value = ''
      password.disabled = true
      pin.disabled = true
    }
  })

  usernameSubmitBtn.addEventListener('click', () => {
    void fetchSecurityQuestions({ username: username.value, questionInputs, password, pin, formSubmitBtn })
  })

  setTimeout(() => (loader.style.display = 'none'), 500)
}

async function submitCredentialForm({
  credential,
  username,
  password,
  answers,
  pin,
  loader
}: {
  credential: Credential
  username: HTMLInputElement
  password: HTMLInputElement
  answers: HTMLInputElement[]
  pin: HTMLInputElement
  loader: HTMLDivElement
}): Promise<void> {
  loader.style.display = 'flex'
  setTimeout(() => (loader.style.display = 'none'), 500)

  const base = {
    autoLogin: credential.autoLogin,
    username: username.value,
    q1: answers[0].placeholder,
    q2: answers[1].placeholder,
    q3: answers[2].placeholder
  }

  const nextCredential: Credential = pin.value
    ? {
        ...base,
        requirePin: true,
        password: await encrypt(password.value, pin.value),
        a1: await encrypt(answers[0].value, pin.value),
        a2: await encrypt(answers[1].value, pin.value),
        a3: await encrypt(answers[2].value, pin.value)
      }
    : {
        ...base,
        requirePin: false,
        password: password.value,
        a1: answers[0].value,
        a2: answers[1].value,
        a3: answers[2].value
      }

  await setCredential(nextCredential)
  location.reload()
}

async function fetchSecurityQuestions({
  username,
  questionInputs,
  password,
  pin,
  formSubmitBtn
}: {
  username: string
  questionInputs: NodeListOf<HTMLInputElement>
  password: HTMLInputElement
  pin: HTMLInputElement
  formSubmitBtn: HTMLButtonElement
}): Promise<void> {
  logToPopup('Fetching your security questions...')

  const erpUser = new ERP(username)
  let index = 0
  erpUser.onGetSecurityQues = (question) => {
    const input = questionInputs[index]
    if (input) {
      input.removeAttribute('disabled')
      input.placeholder = question
    }
    index++
  }

  const result = await erpUser.getAllSecurityQues()

  if (result === false) {
    logToPopup('Invalid roll number!', { type: 'error' })
    return
  }

  logToPopup('Questions fetched — fill in your answers below.', { type: 'success' })
  password.removeAttribute('disabled')
  pin.removeAttribute('disabled')
  formSubmitBtn.removeAttribute('disabled')
}

async function initHighlighterPanel(): Promise<void> {
  const enabledToggle = document.getElementById('highlighterEnabled') as HTMLInputElement
  const colorInputs = {
    upcoming: document.getElementById('colorUpcoming') as HTMLInputElement,
    warning: document.getElementById('colorWarning') as HTMLInputElement,
    urgent: document.getElementById('colorUrgent') as HTMLInputElement,
    overdue: document.getElementById('colorOverdue') as HTMLInputElement
  }
  const refreshIntervalInput = document.getElementById('refreshIntervalSeconds') as HTMLInputElement
  const autoStopInput = document.getElementById('autoStopMinutes') as HTMLInputElement

  const startBtn = document.getElementById('highlighterStart') as HTMLButtonElement
  const stopBtn = document.getElementById('highlighterStop') as HTMLButtonElement
  const clearBtn = document.getElementById('highlighterClear') as HTMLButtonElement

  const statusBox = document.getElementById('highlighterStatusBox') as HTMLElement
  const statusDot = document.getElementById('highlighterStatusDot') as HTMLElement
  const statusText = document.getElementById('highlighterStatusText') as HTMLElement
  const processedCount = document.getElementById('highlighterProcessedCount') as HTMLElement

  const settings = await getHighlighterSettings()
  enabledToggle.checked = settings.enabled
  colorInputs.upcoming.value = settings.colors.upcoming
  colorInputs.warning.value = settings.colors.warning
  colorInputs.urgent.value = settings.colors.urgent
  colorInputs.overdue.value = settings.colors.overdue
  refreshIntervalInput.value = String(Math.round(settings.refreshIntervalMs / 1000))
  autoStopInput.value = String(settings.autoStopMinutes)

  const persist = async (patch: Partial<HighlighterSettings>): Promise<void> => {
    const current = await getHighlighterSettings()
    await setHighlighterSettings({ ...current, ...patch })
  }

  enabledToggle.onchange = () => void persist({ enabled: enabledToggle.checked })

  const persistColors = (): void => {
    void persist({
      colors: {
        upcoming: colorInputs.upcoming.value,
        warning: colorInputs.warning.value,
        urgent: colorInputs.urgent.value,
        overdue: colorInputs.overdue.value
      }
    })
  }
  colorInputs.upcoming.onchange = persistColors
  colorInputs.warning.onchange = persistColors
  colorInputs.urgent.onchange = persistColors
  colorInputs.overdue.onchange = persistColors

  refreshIntervalInput.onchange = () =>
    void persist({ refreshIntervalMs: Math.max(1, Number(refreshIntervalInput.value) || 1) * 1000 })
  autoStopInput.onchange = () => void persist({ autoStopMinutes: Math.max(1, Number(autoStopInput.value) || 1) })

  const renderStatus = (isActive: boolean, rows: number, message?: string): void => {
    statusBox.classList.toggle('highlighter-status--active', isActive)
    statusDot.classList.toggle('highlighter-status__dot--active', isActive)
    statusText.textContent = message ?? (isActive ? 'Active — monitoring deadlines' : 'Inactive')
    processedCount.textContent = `${rows} row${rows === 1 ? '' : 's'} processed`
    startBtn.disabled = isActive
    stopBtn.disabled = !isActive
  }

  const refreshStatus = async (): Promise<void> => {
    const result = await sendHighlighterCommand({ action: 'highlighter:status' })
    if (!result.onErpDeadlinePage) {
      renderStatus(false, 0, 'Open the CDC placement page to use this')
      startBtn.disabled = true
      stopBtn.disabled = true
      clearBtn.disabled = true
      return
    }
    clearBtn.disabled = false
    renderStatus(result.response?.isActive ?? false, result.response?.processedRows ?? 0)
  }

  startBtn.addEventListener('click', async () => {
    await sendHighlighterCommand({ action: 'highlighter:start' })
    await refreshStatus()
  })
  stopBtn.addEventListener('click', async () => {
    await sendHighlighterCommand({ action: 'highlighter:stop' })
    await refreshStatus()
  })
  clearBtn.addEventListener('click', async () => {
    await sendHighlighterCommand({ action: 'highlighter:clear' })
    await refreshStatus()
  })

  await refreshStatus()
  window.setInterval(() => void refreshStatus(), STATUS_POLL_MS)
}
