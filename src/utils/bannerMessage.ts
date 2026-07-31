const BANNER_ID = 'erp-toolkit-login-banner'

/**
 * Shows a full-width status banner at the top of the ERP login page while
 * autofill/autologin is in progress (or has failed).
 */
const showBannerMessage = (message: string, color = '#2563eb'): void => {
  document.getElementById(BANNER_ID)?.remove()

  const banner = document.createElement('div')
  banner.id = BANNER_ID
  banner.textContent = message
  banner.setAttribute(
    'style',
    [
      `background: linear-gradient(to right, ${color}, #ed4e50)`,
      'color: #fff',
      'font-weight: 500',
      'width: 100%',
      'height: 35px',
      'text-align: center',
      'display: flex',
      'justify-content: center',
      'align-items: center'
    ].join(';')
  )

  document.body.prepend(banner)
}

export default showBannerMessage
