const enc = new TextEncoder()
const dec = new TextDecoder()
const BYTE_LENGTH = { salt: 16, iv: 12 }

const bufferToBase64 = (buffer: Uint8Array): string => window.btoa(String.fromCharCode(...buffer))
const base64ToBuffer = (base64: string): Uint8Array => Uint8Array.from(window.atob(base64), (c) => c.charCodeAt(0))

const deriveKeyFromPassword = (password: string): Promise<CryptoKey> =>
  window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey'])

const deriveEncryptionKey = (keyFromPassword: CryptoKey, salt: Uint8Array): Promise<CryptoKey> =>
  window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100000, hash: 'SHA-256' },
    keyFromPassword,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )

/**
 * Encrypts `secret` with a key derived from `password` (the user's 4-digit PIN).
 * Output layout: [salt(16) | iv(12) | ciphertext], base64-encoded.
 */
export const encrypt = async (secret: string, password: string): Promise<string> => {
  const keyFromPassword = await deriveKeyFromPassword(password)
  const salt = window.crypto.getRandomValues(new Uint8Array(BYTE_LENGTH.salt))
  const key = await deriveEncryptionKey(keyFromPassword, salt)
  const iv = window.crypto.getRandomValues(new Uint8Array(BYTE_LENGTH.iv))

  const cipherText = new Uint8Array(
    await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(secret))
  )

  const payload = new Uint8Array(salt.byteLength + iv.byteLength + cipherText.byteLength)
  payload.set(salt, 0)
  payload.set(iv, salt.byteLength)
  payload.set(cipherText, salt.byteLength + iv.byteLength)

  return bufferToBase64(payload)
}

/**
 * Reverses `encrypt`. Throws if `password` (PIN) is wrong or data is corrupt.
 */
export const decrypt = async (encrypted: string, password: string): Promise<string> => {
  const payload = base64ToBuffer(encrypted)
  const salt = payload.slice(0, BYTE_LENGTH.salt)
  const iv = payload.slice(BYTE_LENGTH.salt, BYTE_LENGTH.salt + BYTE_LENGTH.iv)
  const cipherText = payload.slice(BYTE_LENGTH.salt + BYTE_LENGTH.iv)

  const keyFromPassword = await deriveKeyFromPassword(password)
  const key = await deriveEncryptionKey(keyFromPassword, salt)

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    cipherText as BufferSource
  )
  return dec.decode(decrypted)
}
