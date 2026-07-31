import type UpdateInfo from 'models/UpdateInfo'

const REPO = 'SumitKumar-17/erp-toolkit'
const RELEASES_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`
const STORAGE_KEY = 'updateInfo'
const DISMISSED_KEY = 'dismissedUpdateVersion'

interface GitHubRelease {
  tag_name?: string
  html_url?: string
  assets?: Array<{ name?: string; browser_download_url?: string }>
}

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
 * background service worker or the popup with no extra host permission.
 */
const fetchLatestRelease = async (): Promise<{ version: string; url: string; downloadUrl: string | null } | null> => {
  try {
    const response = await fetch(RELEASES_API_URL, { headers: { Accept: 'application/vnd.github+json' } })
    if (!response.ok) return null

    const release = (await response.json()) as GitHubRelease
    if (!release.tag_name || !release.html_url) return null

    const zipAsset = release.assets?.find((asset) => asset.name?.endsWith('.zip'))

    return {
      version: release.tag_name.replace(/^v/, ''),
      url: release.html_url,
      downloadUrl: zipAsset?.browser_download_url ?? null
    }
  } catch {
    return null
  }
}

const setStoredUpdateInfo = (info: UpdateInfo | null): Promise<void> =>
  new Promise((resolve) => {
    if (!info) {
      chrome.storage.local.remove(STORAGE_KEY, resolve)
      return
    }
    chrome.storage.local.set({ [STORAGE_KEY]: info }, resolve)
  })

/**
 * Fetches the latest release, compares it to the running version, and
 * updates storage + the toolbar badge accordingly. Safe to call from both
 * the background service worker (periodic alarm) and the popup (on open,
 * so users don't wait for the next alarm tick to see a fresh check).
 */
export const performUpdateCheck = async (): Promise<UpdateInfo | null> => {
  const currentVersion = chrome.runtime.getManifest().version
  const latest = await fetchLatestRelease()

  if (!latest || !isNewerVersion(latest.version, currentVersion)) {
    await setStoredUpdateInfo(null)
    await chrome.action.setBadgeText({ text: '' })
    return null
  }

  const info: UpdateInfo = {
    latestVersion: latest.version,
    releaseUrl: latest.url,
    downloadUrl: latest.downloadUrl,
    checkedAt: Date.now()
  }

  await setStoredUpdateInfo(info)
  await chrome.action.setBadgeText({ text: '1' })
  await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' })
  return info
}

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
