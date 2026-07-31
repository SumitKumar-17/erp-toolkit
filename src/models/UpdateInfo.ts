export default interface UpdateInfo {
  latestVersion: string
  releaseUrl: string
  /** Direct download link for the release's zipped `extension/` build, if one was attached. */
  downloadUrl: string | null
  checkedAt: number
}
