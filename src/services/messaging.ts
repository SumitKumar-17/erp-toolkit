import type { HighlighterCommand, HighlighterStatusResponse } from 'models/Messages'

const HIGHLIGHTER_PAGE_MATCH = '/IIT_ERP3/showmenu.htm'

const getActiveTab = async (): Promise<chrome.tabs.Tab | undefined> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

/**
 * Re-injects the highlighter content script + stylesheet into a tab, for the
 * case where the extension was installed/reloaded after the tab was already
 * open (so no content script is listening yet).
 */
const injectHighlighter = async (tabId: number): Promise<void> => {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content/highlighter/index.js'] })
  await chrome.scripting.insertCSS({ target: { tabId }, files: ['content/highlighter.css'] })
}

export interface HighlighterMessageResult {
  ok: boolean
  onErpDeadlinePage: boolean
  response?: HighlighterStatusResponse
  error?: string
}

export const sendHighlighterCommand = async (command: HighlighterCommand): Promise<HighlighterMessageResult> => {
  const tab = await getActiveTab()

  if (!tab?.id || !tab.url?.includes(HIGHLIGHTER_PAGE_MATCH)) {
    return { ok: false, onErpDeadlinePage: false, error: 'Open the CDC placement page on ERP first.' }
  }

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, command)) as HighlighterStatusResponse
    return { ok: true, onErpDeadlinePage: true, response }
  } catch {
    try {
      await injectHighlighter(tab.id)
      const response = (await chrome.tabs.sendMessage(tab.id, command)) as HighlighterStatusResponse
      return { ok: true, onErpDeadlinePage: true, response }
    } catch (error) {
      return { ok: false, onErpDeadlinePage: true, error: (error as Error).message }
    }
  }
}
