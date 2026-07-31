export interface DeadlineColors {
  /** More than 24 hours remaining. */
  upcoming: string
  /** 6-24 hours remaining. */
  warning: string
  /** 6 hours or less remaining. */
  urgent: string
  /** Deadline has passed. */
  overdue: string
}

export default interface HighlighterSettings {
  enabled: boolean
  colors: DeadlineColors
  refreshIntervalMs: number
  autoStopMinutes: number
}

export const DEFAULT_HIGHLIGHTER_SETTINGS: HighlighterSettings = {
  enabled: true,
  colors: {
    upcoming: '#16a34a',
    warning: '#d97706',
    urgent: '#ea580c',
    overdue: '#dc2626'
  },
  refreshIntervalMs: 1000,
  autoStopMinutes: 5
}
