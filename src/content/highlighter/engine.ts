import type { DeadlineColors } from 'models/HighlighterSettings'

export type DeadlineStatus = 'upcoming' | 'warning' | 'urgent' | 'overdue'

export interface DeadlineEvaluation {
  status: DeadlineStatus
  message: string
  timeRemainingLabel: string
}

const WARNING_WINDOW_HOURS = 24
const URGENT_WINDOW_HOURS = 6
const DEADLINE_CELL_SELECTOR = 'td[aria-describedby$="_resumedeadline"]'
const TARGET_FRAME_NAME = 'myframe'
const HIGHLIGHT_CLASS = 'erp-toolkit-deadline'
const COLOR_PROPERTY = '--erp-toolkit-color'

const STATUS_CLASSES: Record<DeadlineStatus, string> = {
  upcoming: 'erp-toolkit-status-upcoming',
  warning: 'erp-toolkit-status-warning',
  urgent: 'erp-toolkit-status-urgent',
  overdue: 'erp-toolkit-status-overdue'
}

/**
 * Parses "DD-MM-YYYY HH:MM" or "YYYY-MM-DD HH:MM" (any of `-`, ` `, `:` as
 * separators) — this is however ERP renders the resume-deadline cell text.
 */
export const parseDeadlineDate = (text: string): Date | null => {
  const trimmed = text.trim()
  if (!trimmed) return null

  const parts = trimmed.split(/[-\s:]+/).map((part) => parseInt(part, 10))
  if (parts.length < 5 || parts.some((n) => Number.isNaN(n))) return null

  const [first, second, third, hour, minute] = parts as [number, number, number, number, number]
  const [year, month, day] = first > 31 ? [first, second - 1, third] : [third, second - 1, first]

  const date = new Date(year, month, day, hour, minute)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatTimeRemaining = (diffMs: number): string => {
  const abs = Math.abs(diffMs)
  const days = Math.floor(abs / 86_400_000)
  const hours = Math.floor((abs % 86_400_000) / 3_600_000)

  if (diffMs < 0) return `Overdue by ${days}d ${hours}h`

  const minutes = Math.floor((abs % 3_600_000) / 60_000)
  return `${days}d ${hours}h ${minutes}m remaining`
}

export const evaluateDeadline = (deadline: Date, now: Date): DeadlineEvaluation => {
  const diffMs = deadline.getTime() - now.getTime()
  const diffHours = diffMs / 3_600_000
  const timeRemainingLabel = formatTimeRemaining(diffMs)

  if (diffMs < 0) return { status: 'overdue', message: 'Overdue', timeRemainingLabel }
  if (diffHours <= URGENT_WINDOW_HOURS) return { status: 'urgent', message: 'Due very soon', timeRemainingLabel }
  if (diffHours <= WARNING_WINDOW_HOURS)
    return { status: 'warning', message: 'Due within 24 hours', timeRemainingLabel }
  return { status: 'upcoming', message: 'Upcoming', timeRemainingLabel }
}

const getRowCells = (cell: HTMLElement): HTMLElement[] => {
  const row = cell.closest('tr')
  return row ? Array.from(row.querySelectorAll('td')) : [cell]
}

const applyHighlight = (
  cell: HTMLElement,
  deadline: Date,
  evaluation: DeadlineEvaluation,
  colors: DeadlineColors
): void => {
  getRowCells(cell).forEach((el) => {
    el.style.setProperty(COLOR_PROPERTY, colors[evaluation.status])
    el.title = `Deadline: ${deadline.toLocaleString()}\nStatus: ${evaluation.message}\n${evaluation.timeRemainingLabel}`
    el.classList.add(HIGHLIGHT_CLASS, STATUS_CLASSES[evaluation.status])
    Object.values(STATUS_CLASSES)
      .filter((cls) => cls !== STATUS_CLASSES[evaluation.status])
      .forEach((cls) => el.classList.remove(cls))
  })
}

export const clearHighlights = (root: Document): number => {
  const elements = root.querySelectorAll<HTMLElement>(`.${HIGHLIGHT_CLASS}`)
  elements.forEach((el) => {
    el.style.removeProperty(COLOR_PROPERTY)
    el.removeAttribute('title')
    el.classList.remove(HIGHLIGHT_CLASS, ...Object.values(STATUS_CLASSES))
  })
  return elements.length
}

/**
 * The CDC placement table lives inside an iframe named "myframe". Falls back
 * to the top document if that frame can't be found or is cross-origin.
 */
export const resolveTargetDocument = (): Document => {
  const frames = window.frames as unknown as Record<string | number, Window> & { length: number }

  const named = frames[TARGET_FRAME_NAME]
  if (named) {
    try {
      return named.document
    } catch {
      /* cross-origin frame, fall through */
    }
  }

  for (let i = 0; i < frames.length; i++) {
    try {
      const frame = frames[i]
      if (frame?.name === TARGET_FRAME_NAME) return frame.document
    } catch {
      continue
    }
  }

  return document
}

export class DeadlineHighlighterEngine {
  private colors: DeadlineColors
  private refreshIntervalMs: number
  private autoStopMs: number
  private intervalId: number | null = null
  private autoStopTimeoutId: number | null = null
  private readonly seenRowIds = new Set<string>()

  constructor(colors: DeadlineColors, refreshIntervalMs: number, autoStopMinutes: number) {
    this.colors = colors
    this.refreshIntervalMs = refreshIntervalMs
    this.autoStopMs = autoStopMinutes * 60_000
  }

  get isActive(): boolean {
    return this.intervalId !== null
  }

  get processedCount(): number {
    return this.seenRowIds.size
  }

  setColors(colors: DeadlineColors): void {
    this.colors = colors
  }

  start(): void {
    if (this.isActive) return

    this.tick()
    this.intervalId = window.setInterval(() => this.tick(), this.refreshIntervalMs)
    this.autoStopTimeoutId = window.setTimeout(() => this.stop(), this.autoStopMs)
  }

  stop(): void {
    if (this.intervalId !== null) window.clearInterval(this.intervalId)
    if (this.autoStopTimeoutId !== null) window.clearTimeout(this.autoStopTimeoutId)
    this.intervalId = null
    this.autoStopTimeoutId = null
  }

  clear(): void {
    this.seenRowIds.clear()
    clearHighlights(resolveTargetDocument())
  }

  private tick(): void {
    let cells: NodeListOf<HTMLElement>
    try {
      cells = resolveTargetDocument().querySelectorAll<HTMLElement>(DEADLINE_CELL_SELECTOR)
    } catch {
      return
    }

    const now = new Date()

    cells.forEach((cell, index) => {
      const dateText = cell.getAttribute('title') ?? cell.textContent?.trim() ?? ''
      if (!dateText) return

      const rowId = `${index}:${dateText}`
      if (this.seenRowIds.has(rowId)) return

      const deadline = parseDeadlineDate(dateText)
      if (!deadline) return

      applyHighlight(cell, deadline, evaluateDeadline(deadline, now), this.colors)
      this.seenRowIds.add(rowId)
    })
  }
}
