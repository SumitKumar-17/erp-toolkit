export type LogType = 'info' | 'success' | 'warning' | 'error'

const ICON_BY_TYPE: Record<LogType, string> = {
  info: 'info',
  success: 'check',
  warning: 'warning',
  error: 'cross'
}

interface LogOptions {
  type?: LogType
  /** Shows Yes/Cancel confirmation actions instead of auto-dismissing. */
  onConfirm?: () => void
  onCancel?: () => void
}

/**
 * Writes a status line into the popup's inline log banner (`#log`) and
 * mirrors it onto the Home panel's status pill (`#status`).
 */
const logToPopup = (message: string, { type = 'info', onConfirm, onCancel }: LogOptions = {}): void => {
  const log = document.getElementById('log') as HTMLElement
  const logIcon = document.getElementById('logIcon') as HTMLElement
  const logText = document.getElementById('logText') as HTMLElement

  const status = document.getElementById('status') as HTMLElement
  const statusIcon = document.getElementById('statusIcon') as HTMLElement
  const statusText = document.getElementById('statusText') as HTMLElement

  const iconId = ICON_BY_TYPE[type]

  log.className = type
  logText.textContent = message
  logIcon.setAttribute('href', chrome.runtime.getURL(`assets/sprite.svg#${iconId}`))

  status.dataset.state = type
  statusText.textContent = message
  statusIcon.setAttribute('href', chrome.runtime.getURL(`assets/sprite.svg#${iconId}`))

  log.querySelectorAll('.action').forEach((el) => el.remove())

  if (onConfirm && onCancel) {
    const confirmBtn = document.createElement('button')
    confirmBtn.type = 'button'
    confirmBtn.className = 'action'
    confirmBtn.textContent = 'Yes'

    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'action'
    cancelBtn.textContent = 'Cancel'

    log.append(confirmBtn, cancelBtn)

    const cleanup = (): void => {
      confirmBtn.remove()
      cancelBtn.remove()
    }

    confirmBtn.addEventListener('click', () => {
      cleanup()
      onConfirm()
    })
    cancelBtn.addEventListener('click', () => {
      cleanup()
      onCancel()
    })
  }
}

export default logToPopup
