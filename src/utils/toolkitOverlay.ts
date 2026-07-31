const OVERLAY_ID = 'erp-toolkit-overlay'

/**
 * Opens the popup UI as an in-page modal (a native <dialog> with the popup
 * embedded via iframe) instead of the toolbar dropdown. Content scripts
 * can't invoke the real popup (no chrome.action access there), and opening
 * it as a separate tab feels disconnected from the page you were on — this
 * keeps it a same-tab overlay instead, closable via the X, Escape, or
 * clicking the backdrop.
 */
const openToolkitOverlay = (): void => {
  if (document.getElementById(OVERLAY_ID)) return

  const dialog = document.createElement('dialog')
  dialog.id = OVERLAY_ID
  dialog.style.cssText =
    'padding:0;border:none;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.45)'

  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:relative;line-height:0'

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.title = 'Close'
  closeBtn.textContent = '✕'
  closeBtn.style.cssText = [
    'position:absolute',
    'top:8px',
    'right:8px',
    'z-index:1',
    'width:26px',
    'height:26px',
    'border-radius:9999px',
    'border:none',
    'background:rgba(0,0,0,0.55)',
    'color:#fff',
    'cursor:pointer',
    'font-size:13px',
    'line-height:1'
  ].join(';')
  closeBtn.addEventListener('click', () => dialog.close())

  const iframe = document.createElement('iframe')
  iframe.src = chrome.runtime.getURL('pages/Popup/index.html')
  iframe.style.cssText = 'width:360px;height:600px;border:none;display:block'
  iframe.title = 'ERP Toolkit'

  wrapper.append(closeBtn, iframe)
  dialog.append(wrapper)

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close()
  })
  dialog.addEventListener('close', () => dialog.remove())

  document.body.append(dialog)
  dialog.showModal()
}

export default openToolkitOverlay
