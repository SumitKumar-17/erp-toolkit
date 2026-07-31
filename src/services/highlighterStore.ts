import type HighlighterSettings from 'models/HighlighterSettings'
import { DEFAULT_HIGHLIGHTER_SETTINGS } from 'models/HighlighterSettings'

const STORAGE_KEY = 'highlighterSettings'

export const getHighlighterSettings = (): Promise<HighlighterSettings> =>
  new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: DEFAULT_HIGHLIGHTER_SETTINGS }, (result) => {
      resolve(result[STORAGE_KEY] as HighlighterSettings)
    })
  })

export const setHighlighterSettings = (settings: HighlighterSettings): Promise<void> =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: settings }, resolve)
  })

export const onHighlighterSettingsChanged = (callback: (settings: HighlighterSettings) => void): void => {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && STORAGE_KEY in changes) {
      callback(changes[STORAGE_KEY].newValue as HighlighterSettings)
    }
  })
}
