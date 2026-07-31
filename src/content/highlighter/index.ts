import type { HighlighterCommand, HighlighterStatusResponse } from 'models/Messages'
import { isHighlighterCommand } from 'models/Messages'
import { getHighlighterSettings, onHighlighterSettingsChanged } from 'services/highlighterStore'
import { DeadlineHighlighterEngine } from './engine'
import { LegendWidget } from './legend-widget'

declare global {
  interface Window {
    __erpToolkitHighlighterLoaded?: boolean
  }
}

const WIDGET_REFRESH_MS = 1000

const bootstrap = async (): Promise<void> => {
  if (window.__erpToolkitHighlighterLoaded) return
  window.__erpToolkitHighlighterLoaded = true

  const settings = await getHighlighterSettings()
  const engine = new DeadlineHighlighterEngine(settings.colors, settings.refreshIntervalMs, settings.autoStopMinutes)

  const widget = new LegendWidget(settings.colors, {
    onStart: () => {
      engine.start()
      refreshWidget()
    },
    onStop: () => {
      engine.stop()
      refreshWidget()
    },
    onClear: () => {
      engine.clear()
      refreshWidget()
    }
  })

  const refreshWidget = (): void => {
    widget.update({ isActive: engine.isActive, processedCount: engine.processedCount })
  }

  widget.mount()
  refreshWidget()
  window.setInterval(refreshWidget, WIDGET_REFRESH_MS)

  onHighlighterSettingsChanged((updated) => engine.setColors(updated.colors))

  if (settings.enabled) {
    engine.start()
    refreshWidget()
  }

  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse: (response: HighlighterStatusResponse) => void) => {
      if (!isHighlighterCommand(message)) return undefined

      handleCommand(message, engine)
      refreshWidget()
      sendResponse({ success: true, isActive: engine.isActive, processedRows: engine.processedCount })
      return true
    }
  )
}

const handleCommand = (command: HighlighterCommand, engine: DeadlineHighlighterEngine): void => {
  switch (command.action) {
    case 'highlighter:start':
      engine.start()
      break
    case 'highlighter:stop':
      engine.stop()
      break
    case 'highlighter:clear':
      engine.clear()
      break
    case 'highlighter:status':
      break
  }
}

bootstrap().catch((error: unknown) => {
  console.error('ERP Toolkit: deadline highlighter failed to start', error)
})
