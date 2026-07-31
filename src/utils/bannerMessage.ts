import openToolkitOverlay from 'utils/toolkitOverlay'

const BANNER_ID = 'erp-toolkit-login-banner'

/**
 * Shows a full-width status banner at the top of the ERP login page while
 * autofill/autologin is in progress (or has failed).
 *
 * `showOpenButton` adds a button that opens the popup UI as an in-page
 * overlay — a manual way in for anyone whose toolbar icon isn't opening the
 * popup dropdown for some reason.
 */
const showBannerMessage = (message: string, color = '#2563eb', showOpenButton = false): void => {
  document.getElementById(BANNER_ID)?.remove()

  const banner = document.createElement('div')
  banner.id = BANNER_ID
  banner.setAttribute(
    'style',
    [
      `background: linear-gradient(to right, ${color}, #ed4e50)`,
      'color: #fff',
      'font-weight: 500',
      'width: 100%',
      'min-height: 35px',
      'text-align: center',
      'display: flex',
      'justify-content: center',
      'align-items: center',
      'gap: 12px',
      'padding: 4px 12px'
    ].join(';')
  )

  const text = document.createElement('span')
  text.textContent = message
  banner.append(text)

  if (showOpenButton) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Open ERP Toolkit'
    button.setAttribute(
      'style',
      [
        'background: rgba(255,255,255,0.2)',
        'color: #fff',
        'border: 1px solid rgba(255,255,255,0.4)',
        'border-radius: 6px',
        'padding: 4px 10px',
        'font-size: 13px',
        'cursor: pointer',
        'flex-shrink: 0'
      ].join(';')
    )
    button.addEventListener('click', openToolkitOverlay)
    banner.append(button)
  }

  document.body.prepend(banner)
}

export default showBannerMessage
