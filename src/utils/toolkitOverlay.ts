const OVERLAY_ID = 'erp-toolkit-overlay'

const getOverlay = (): HTMLDialogElement | null => document.getElementById(OVERLAY_ID) as HTMLDialogElement | null

const makeDraggable = (dialog: HTMLDialogElement, handle: HTMLElement): void => {
  let offsetX = 0
  let offsetY = 0
  let dragging = false

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) return
    dialog.style.margin = '0'
    dialog.style.left = `${event.clientX - offsetX}px`
    dialog.style.top = `${event.clientY - offsetY}px`
  }

  const onPointerUp = (): void => {
    dragging = false
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
  }

  handle.addEventListener('pointerdown', (event) => {
    if ((event.target as HTMLElement).closest('button')) return

    const rect = dialog.getBoundingClientRect()
    offsetX = event.clientX - rect.left
    offsetY = event.clientY - rect.top
    dragging = true

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  })
}

/**
 * Opens the popup UI as an in-page, draggable modal (a native <dialog> with
 * the popup embedded via iframe) instead of the toolbar dropdown. Content
 * scripts can't invoke the real popup (no chrome.action access there), and
 * opening it as a separate tab feels disconnected from the page you were on
 * — this keeps it a same-tab overlay instead, closable via the X, Escape, or
 * clicking the backdrop.
 *
 * The title bar (not the iframe) is the drag handle deliberately — pointer
 * events over the iframe are captured by its own document, so dragging from
 * anywhere over the iframe itself wouldn't work.
 */
const openToolkitOverlay = (): void => {
  if (getOverlay()) return

  const dialog = document.createElement('dialog')
  dialog.id = OVERLAY_ID
  dialog.style.cssText =
    'padding:0;border:none;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.45)'

  const titlebar = document.createElement('div')
  titlebar.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:8px',
    'padding:6px 6px 6px 12px',
    'background:#4338ca',
    'color:#fff',
    'font:600 13px system-ui,sans-serif',
    'cursor:grab',
    'user-select:none'
  ].join(';')
  titlebar.innerHTML = `<span>ERP Toolkit</span>`

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.title = 'Close'
  closeBtn.textContent = '✕'
  closeBtn.style.cssText = [
    'width:22px',
    'height:22px',
    'border-radius:9999px',
    'border:none',
    'background:rgba(255,255,255,0.2)',
    'color:#fff',
    'cursor:pointer',
    'font-size:12px',
    'line-height:1'
  ].join(';')
  closeBtn.addEventListener('click', () => dialog.close())
  titlebar.append(closeBtn)

  const iframe = document.createElement('iframe')
  iframe.src = chrome.runtime.getURL('pages/Popup/index.html')
  iframe.style.cssText = 'width:360px;height:600px;border:none;display:block'
  iframe.title = 'ERP Toolkit'

  dialog.append(titlebar, iframe)

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close()
  })
  dialog.addEventListener('close', () => dialog.remove())

  document.body.append(dialog)
  dialog.showModal()
  makeDraggable(dialog, titlebar)
}

// If the real toolbar popup opens while our overlay is already showing on
// this page, having both up at once is confusing — the popup (see
// pages/Popup/index.ts) tells the active tab's content script to close its
// overlay when that happens.
chrome.runtime.onMessage.addListener((message: unknown) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    (message as { action?: string }).action === 'toolkit:close-overlay'
  ) {
    getOverlay()?.close()
  }
})

export default openToolkitOverlay
