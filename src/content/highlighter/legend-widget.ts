import type { DeadlineColors } from 'models/HighlighterSettings'

export interface LegendCallbacks {
  onStart: () => void
  onStop: () => void
  onClear: () => void
}

export interface LegendState {
  isActive: boolean
  processedCount: number
}

const WIDGET_ID = 'erp-toolkit-legend'

/**
 * The floating, draggable, collapsible widget injected onto the CDC
 * placement page. Purely presentational — all state comes from the engine
 * via `update()`, all interactions bubble out via the constructor callbacks.
 *
 * Uses plain text/emoji glyphs rather than the extension's SVG sprite:
 * `<use href="chrome-extension://...">` is blocked by browsers when the
 * referencing document (the host page, a different origin) tries to load an
 * external SVG fragment — that restriction applies regardless of
 * `web_accessible_resources`. The popup doesn't hit this because it's the
 * same origin as the sprite it references.
 */
export class LegendWidget {
  private readonly root: HTMLDivElement
  private collapsed = false

  constructor(colors: DeadlineColors, callbacks: LegendCallbacks) {
    this.root = document.createElement('div')
    this.root.id = WIDGET_ID
    this.root.innerHTML = `
      <div class="erp-toolkit-legend__header" data-drag-handle>
        <div class="erp-toolkit-legend__title">
          <span aria-hidden="true">🎯</span>
          <span>Deadline Highlighter</span>
        </div>
        <button type="button" class="erp-toolkit-legend__icon-btn" data-action="toggle" title="Collapse">
          <span aria-hidden="true" data-toggle-glyph>&minus;</span>
        </button>
      </div>
      <div class="erp-toolkit-legend__body">
        <div class="erp-toolkit-legend__status">
          <span class="erp-toolkit-legend__dot" data-status-dot></span>
          <span data-status-text>Inactive</span>
        </div>
        <p class="erp-toolkit-legend__stats" data-stats-text>0 rows processed</p>
        <div class="erp-toolkit-legend__controls">
          <button type="button" class="erp-toolkit-legend__btn erp-toolkit-legend__btn--start" data-action="start">
            <span aria-hidden="true">&#9654;</span> Start
          </button>
          <button type="button" class="erp-toolkit-legend__btn erp-toolkit-legend__btn--stop" data-action="stop">
            <span aria-hidden="true">&#10074;&#10074;</span> Stop
          </button>
          <button type="button" class="erp-toolkit-legend__btn erp-toolkit-legend__btn--clear" data-action="clear">
            <span aria-hidden="true">&#128465;</span> Clear
          </button>
        </div>
        <div class="erp-toolkit-legend__swatches">
          <span><i style="background:${colors.upcoming}"></i>Upcoming (&gt;24h)</span>
          <span><i style="background:${colors.warning}"></i>1 day left</span>
          <span><i style="background:${colors.urgent}"></i>6 hours or less</span>
          <span><i style="background:${colors.overdue}"></i>Overdue</span>
        </div>
      </div>
    `

    this.bindEvents(callbacks)
    this.makeDraggable()
  }

  mount(): void {
    if (!document.getElementById(WIDGET_ID)) {
      document.body.append(this.root)
    }
  }

  destroy(): void {
    this.root.remove()
  }

  update({ isActive, processedCount }: LegendState): void {
    const dot = this.root.querySelector<HTMLElement>('[data-status-dot]')
    const statusText = this.root.querySelector<HTMLElement>('[data-status-text]')
    const statsText = this.root.querySelector<HTMLElement>('[data-stats-text]')
    const startBtn = this.root.querySelector<HTMLButtonElement>('[data-action="start"]')
    const stopBtn = this.root.querySelector<HTMLButtonElement>('[data-action="stop"]')

    dot?.classList.toggle('erp-toolkit-legend__dot--active', isActive)
    if (statusText) statusText.textContent = isActive ? 'Active — monitoring deadlines' : 'Inactive'
    if (statsText) statsText.textContent = `${processedCount} row${processedCount === 1 ? '' : 's'} processed`
    if (startBtn) startBtn.disabled = isActive
    if (stopBtn) stopBtn.disabled = !isActive
  }

  private bindEvents({ onStart, onStop, onClear }: LegendCallbacks): void {
    this.root.querySelector('[data-action="toggle"]')?.addEventListener('click', () => this.toggleCollapsed())
    this.root.querySelector('[data-action="start"]')?.addEventListener('click', onStart)
    this.root.querySelector('[data-action="stop"]')?.addEventListener('click', onStop)
    this.root.querySelector('[data-action="clear"]')?.addEventListener('click', onClear)
  }

  private toggleCollapsed(): void {
    this.collapsed = !this.collapsed
    this.root.classList.toggle('erp-toolkit-legend--collapsed', this.collapsed)

    const glyph = this.root.querySelector('[data-toggle-glyph]')
    if (glyph) glyph.textContent = this.collapsed ? '+' : '−'
  }

  private makeDraggable(): void {
    const handle = this.root.querySelector<HTMLElement>('[data-drag-handle]')
    if (!handle) return

    let offsetX = 0
    let offsetY = 0
    let dragging = false

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging) return
      this.root.style.left = `${event.clientX - offsetX}px`
      this.root.style.top = `${event.clientY - offsetY}px`
      this.root.style.right = 'auto'
    }

    const onPointerUp = (): void => {
      dragging = false
      this.root.classList.remove('erp-toolkit-legend--dragging')
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
    }

    handle.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('[data-action="toggle"]')) return

      const rect = this.root.getBoundingClientRect()
      offsetX = event.clientX - rect.left
      offsetY = event.clientY - rect.top
      dragging = true
      this.root.classList.add('erp-toolkit-legend--dragging')

      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
    })
  }
}
