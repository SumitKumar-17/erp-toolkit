import type UpdateInfo from 'models/UpdateInfo'

const REPO = 'SumitKumar-17/erp-toolkit'
const RELEASES_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`
const STORAGE_KEY = 'updateInfo'
const DISMISSED_KEY = 'dismissedUpdateVersion'

const parseVersion = (version: string): number[] =>
  version
    .replace(/^v/, '')
    .split('.')
    .map((part) => parseInt(part, 10) || 0)

export const isNewerVersion = (latest: string, current: string): boolean => {
  const latestParts = parseVersion(latest)
  const currentParts = parseVersion(current)

  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const diff = (latestParts[i] ?? 0) - (currentParts[i] ?? 0)
    if (diff !== 0) return diff > 0
  }

  return false
}

/**
 * Reads the latest published GitHub Release. `api.github.com` sends
 * permissive CORS headers on public read endpoints, so this works from the
 * background service worker with no extra host permission.
 */
export const fetchLatestRelease = async (): Promise<{ version: string; url: string } | null> => {
  try {
    const response = await fetch(RELEASES_API_URL, { headers: { Accept: 'application/vnd.github+json' } })
    if (!response.ok) return null

    const release = (await response.json()) as { tag_name?: string; html_url?: string }
    if (!release.tag_name || !release.html_url) return null

    return { version: release.tag_name.replace(/^v/, ''), url: release.html_url }
  } catch {
    return null
  }
}

export const setStoredUpdateInfo = (info: UpdateInfo | null): Promise<void> =>
  new Promise((resolve) => {
    if (!info) {
      chrome.storage.local.remove(STORAGE_KEY, resolve)
      return
    }
    chrome.storage.local.set({ [STORAGE_KEY]: info }, resolve)
  })

/** Resolves to `null` if there's no pending update, or the user already dismissed this version. */
export const getActionableUpdate = (): Promise<UpdateInfo | null> =>
  new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY, DISMISSED_KEY], (result) => {
      const info = result[STORAGE_KEY] as UpdateInfo | undefined
      const dismissedVersion = result[DISMISSED_KEY] as string | undefined
      resolve(info && info.latestVersion !== dismissedVersion ? info : null)
    })
  })

export const dismissUpdate = (version: string): Promise<void> =>
  new Promise((resolve) => chrome.storage.local.set({ [DISMISSED_KEY]: version }, resolve))
