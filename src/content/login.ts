import { getCredential, getPreferences } from 'services/credentialStore'
import { decrypt } from 'services/crypto'
import showBannerMessage from 'utils/bannerMessage'
import getPinFromDialog from 'utils/pinDialog'
import validateCredentials, { FieldValidationStatus } from 'utils/validateCredentials'

/**
 * Runs on the ERP SSO login page. Waits for the security-question field to
 * be populated by the page's own script (via MutationObserver), matches it
 * against the user's stored questions, then fills + submits the form.
 */
const autoLogin = async (): Promise<void> => {
  const credential = await getCredential()

  if (!credential.username) {
    showBannerMessage('ERP Toolkit is installed — add your login details to get started.', '#a16207', true)
    return
  }

  if (!credential.autoLogin) {
    showBannerMessage('Automatic login is turned off.', '#4b5563')
    return
  }

  if (validateCredentials(credential) === FieldValidationStatus.SomeFieldIsEmpty) {
    showBannerMessage('Please finish setting up your login details.', '#4b5563', true)
    return
  }

  const usernameInput = document.getElementById('user_id') as HTMLInputElement | null
  const answerDiv = document.getElementById('answer_div')

  if (!usernameInput || !answerDiv) {
    showBannerMessage('Could not find the login form on this page. Please refresh and retry.', '#dc2626')
    return
  }

  showBannerMessage('Prefilling your credentials, please wait...')

  const { requirePin, username } = credential
  const { useAltPINDialog } = await getPreferences()

  const pin = requirePin ? (useAltPINDialog ? await getPinFromDialog() : (prompt('Enter your 4-digit PIN') ?? '')) : ''

  const observer = new MutationObserver(([mutation], instance) => {
    instance.disconnect()
    void handleSecurityQuestion(mutation.addedNodes[0]?.nodeValue ?? '', { credential, requirePin, pin })
  })

  observer.observe(answerDiv, { childList: true, subtree: true })

  usernameInput.value = username
  usernameInput.blur()
}

const handleSecurityQuestion = async (
  question: string,
  {
    credential,
    requirePin,
    pin
  }: { credential: Awaited<ReturnType<typeof getCredential>>; requirePin: boolean; pin: string }
): Promise<void> => {
  let answer: string
  switch (question) {
    case credential.q1:
      answer = credential.a1
      break
    case credential.q2:
      answer = credential.a2
      break
    case credential.q3:
      answer = credential.a3
      break
    default:
      showBannerMessage('Invalid username/password set — please update your credentials.', '#dc2626')
      return
  }

  let password: string
  if (requirePin) {
    try {
      password = await decrypt(credential.password, pin)
      answer = await decrypt(answer, pin)
    } catch {
      showBannerMessage('Incorrect PIN. Reset it if forgotten, or refresh the page to retry.', '#dc2626')
      return
    }
  } else {
    password = credential.password
  }

  const passwordInput = document.getElementById('password') as HTMLInputElement | null
  const answerInput = document.getElementById('answer') as HTMLInputElement | null

  if (!passwordInput || !answerInput) {
    showBannerMessage('Something went wrong. Please refresh the page and retry.', '#dc2626')
    return
  }

  passwordInput.value = password
  answerInput.value = answer
  document.getElementById('getotp')?.click()

  showBannerMessage('Details filled in — an OTP was sent to your mail, enter it to finish logging in.', '#4b5563')
}

autoLogin().catch((error: unknown) => {
  console.error('ERP Toolkit: login autofill failed', error)
})
