const DIALOG_STYLES = `
  body {
    overflow: hidden;
  }

  dialog#erp-toolkit-pin-dialog {
    z-index: 2147483646;
    position: fixed;
    left: 50%;
    transform: translate(-50%, 0);
    width: 340px;
    border: none;
    border-radius: 0 0 6px 6px;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.5);
    padding: 16px 24px;
    margin: 0;
    background-color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    font-family: system-ui, sans-serif;
  }

  dialog#erp-toolkit-pin-dialog::backdrop {
    background-color: rgb(0 0 0 / 0.5);
  }

  #erp-toolkit-pin-dialog .prompt {
    margin-bottom: 16px;
    font-size: 15px;
    color: #1a1a1a;
  }

  #erp-toolkit-pin-dialog .digit-group {
    display: flex;
    gap: 6px;
  }

  #erp-toolkit-pin-dialog .digit-group input {
    width: 36px;
    height: 48px;
    background-color: #fff;
    border: 2px solid #9ca3af;
    border-radius: 6px;
    text-align: center;
    font-size: 22px;
    color: #111827;
  }

  #erp-toolkit-pin-dialog button {
    margin-top: 16px;
    border-radius: 6px;
    border: none;
    background: #e5e7eb;
    color: #111827;
    padding: 6px 14px;
    cursor: pointer;
  }
`

const isDigitKey = (key: string): boolean => key.length === 1 && key >= '0' && key <= '9'

/**
 * Shows a native <dialog> with 4 individual digit boxes so the PIN never
 * lands in the browser's password-autofill/history for a plain <input>.
 */
async function getPinFromDialog(): Promise<string> {
  const style = document.createElement('style')
  style.textContent = DIALOG_STYLES

  const dialog = document.createElement('dialog')
  dialog.id = 'erp-toolkit-pin-dialog'
  dialog.innerHTML = `
    <div class="prompt">Enter your 4-digit PIN</div>
    <form class="digit-group" autocomplete="off">
      ${[0, 1, 2, 3].map((i) => `<input type="password" inputmode="numeric" maxlength="1" data-index="${i}" />`).join('')}
    </form>
    <button type="button" id="erp-toolkit-pin-cancel">Cancel</button>
  `

  document.head.append(style)
  document.body.append(dialog)
  dialog.showModal()

  const inputs = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[data-index]'))
  const cancelButton = dialog.querySelector<HTMLButtonElement>('#erp-toolkit-pin-cancel')

  let pin = ''

  inputs.forEach((input, index) => {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && input.value === '' && index > 0) {
        inputs[index - 1]?.focus()
        return
      }

      if (!isDigitKey(event.key)) return

      input.value = event.key
      event.preventDefault()

      if (index < inputs.length - 1) {
        inputs[index + 1]?.focus()
      } else {
        pin = inputs.map((i) => i.value).join('')
        dialog.close()
      }
    })
  })

  cancelButton?.addEventListener('click', () => dialog.close())
  inputs[0]?.focus()

  await new Promise((resolve) => dialog.addEventListener('close', resolve, { once: true }))

  dialog.remove()
  style.remove()

  return pin
}

export default getPinFromDialog
