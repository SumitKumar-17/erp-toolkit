import type Credential from 'models/Credential'

export type Theme = 'light' | 'dark'

export interface Preferences {
  theme: Theme
  showThemeBackground: boolean
  landingPage: string | null
  useAltPINDialog: boolean
}

const DEFAULT_CREDENTIAL: Credential = {
  requirePin: false,
  autoLogin: true,
  username: '',
  password: '',
  q1: '',
  q2: '',
  q3: '',
  a1: '',
  a2: '',
  a3: ''
}

export const getCredential = (): Promise<Credential> =>
  new Promise((resolve) => {
    chrome.storage.local.get({ authCredentials: DEFAULT_CREDENTIAL }, (result) => {
      resolve(result.authCredentials as Credential)
    })
  })

export const setCredential = (credential: Credential): Promise<void> =>
  new Promise((resolve) => {
    chrome.storage.local.set({ authCredentials: credential }, resolve)
  })

export const clearCredential = (): Promise<void> =>
  new Promise((resolve) => {
    chrome.storage.local.remove(['authCredentials'], resolve)
  })

export const getPreferences = (): Promise<Preferences> =>
  new Promise((resolve) => {
    chrome.storage.local.get(['theme', 'bg', 'landingPage', 'useAltPINDialog'], (result) => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      resolve({
        theme: result.theme === 'dark' || (!('theme' in result) && prefersDark) ? 'dark' : 'light',
        showThemeBackground: result.bg === 'yes',
        landingPage: result.landingPage ?? null,
        useAltPINDialog: Boolean(result.useAltPINDialog)
      })
    })
  })

export const setPreference = <K extends keyof Preferences>(
  key: K,
  value: K extends 'theme' ? Theme : K extends 'showThemeBackground' ? boolean : Preferences[K]
): Promise<void> =>
  new Promise((resolve) => {
    if (key === 'showThemeBackground') {
      chrome.storage.local.set({ bg: value ? 'yes' : 'no' }, resolve)
      return
    }

    chrome.storage.local.set({ [key]: value }, resolve)
  })
