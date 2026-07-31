(() => {
  "use strict";
  const isHighlighterCommand = message => {
    if (typeof message !== "object" || message === null || !("action" in message)) return false;
    const {action} = message;
    return typeof action === "string" && (action === "highlighter:start" || action === "highlighter:stop" || action === "highlighter:clear" || action === "highlighter:status");
  };
  const DEFAULT_HIGHLIGHTER_SETTINGS = {
    enabled: true,
    colors: {
      upcoming: "#16a34a",
      warning: "#d97706",
      urgent: "#ea580c",
      overdue: "#dc2626"
    },
    refreshIntervalMs: 1e3,
    autoStopMinutes: 5
  };
  const STORAGE_KEY = "highlighterSettings";
  const getHighlighterSettings = () => new Promise(resolve => {
    chrome.storage.local.get({
      [STORAGE_KEY]: DEFAULT_HIGHLIGHTER_SETTINGS
    }, result => {
      resolve(result[STORAGE_KEY]);
    });
  });
  const setHighlighterSettings = settings => new Promise(resolve => {
    chrome.storage.local.set({
      [STORAGE_KEY]: settings
    }, resolve);
  });
  const onHighlighterSettingsChanged = callback => {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && STORAGE_KEY in changes) callback(changes[STORAGE_KEY].newValue);
    });
  };
  const WARNING_WINDOW_HOURS = 24;
  const URGENT_WINDOW_HOURS = 6;
  const DEADLINE_CELL_SELECTOR = 'td[aria-describedby$="_resumedeadline"]';
  const TARGET_FRAME_NAME = "myframe";
  const HIGHLIGHT_CLASS = "erp-toolkit-deadline";
  const COLOR_PROPERTY = "--erp-toolkit-color";
  const STATUS_CLASSES = {
    upcoming: "erp-toolkit-status-upcoming",
    warning: "erp-toolkit-status-warning",
    urgent: "erp-toolkit-status-urgent",
    overdue: "erp-toolkit-status-overdue"
  };
  const parseDeadlineDate = text => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(/[-\s:]+/).map(part => parseInt(part, 10));
    if (parts.length < 5 || parts.some(n => Number.isNaN(n))) return null;
    const [first, second, third, hour, minute] = parts;
    const [year, month, day] = first > 31 ? [ first, second - 1, third ] : [ third, second - 1, first ];
    const date = new Date(year, month, day, hour, minute);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const formatTimeRemaining = diffMs => {
    const abs = Math.abs(diffMs);
    const days = Math.floor(abs / 864e5);
    const hours = Math.floor(abs % 864e5 / 36e5);
    if (diffMs < 0) return `Overdue by ${days}d ${hours}h`;
    const minutes = Math.floor(abs % 36e5 / 6e4);
    return `${days}d ${hours}h ${minutes}m remaining`;
  };
  const evaluateDeadline = (deadline, now) => {
    const diffMs = deadline.getTime() - now.getTime();
    const diffHours = diffMs / 36e5;
    const timeRemainingLabel = formatTimeRemaining(diffMs);
    if (diffMs < 0) return {
      status: "overdue",
      message: "Overdue",
      timeRemainingLabel
    };
    if (diffHours <= URGENT_WINDOW_HOURS) return {
      status: "urgent",
      message: "Due very soon",
      timeRemainingLabel
    };
    if (diffHours <= WARNING_WINDOW_HOURS) return {
      status: "warning",
      message: "Due within 24 hours",
      timeRemainingLabel
    };
    return {
      status: "upcoming",
      message: "Upcoming",
      timeRemainingLabel
    };
  };
  const getRowCells = cell => {
    const row = cell.closest("tr");
    return row ? Array.from(row.querySelectorAll("td")) : [ cell ];
  };
  const applyHighlight = (cell, deadline, evaluation, colors) => {
    getRowCells(cell).forEach(el => {
      el.style.setProperty(COLOR_PROPERTY, colors[evaluation.status]);
      el.title = `Deadline: ${deadline.toLocaleString()}\nStatus: ${evaluation.message}\n${evaluation.timeRemainingLabel}`;
      el.classList.add(HIGHLIGHT_CLASS, STATUS_CLASSES[evaluation.status]);
      Object.values(STATUS_CLASSES).filter(cls => cls !== STATUS_CLASSES[evaluation.status]).forEach(cls => el.classList.remove(cls));
    });
  };
  const clearHighlights = root => {
    const elements = root.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    elements.forEach(el => {
      el.style.removeProperty(COLOR_PROPERTY);
      el.removeAttribute("title");
      el.classList.remove(HIGHLIGHT_CLASS, ...Object.values(STATUS_CLASSES));
    });
    return elements.length;
  };
  const resolveTargetDocument = () => {
    const frames = window.frames;
    const named = frames[TARGET_FRAME_NAME];
    if (named) try {
      return named.document;
    } catch {}
    for (let i = 0; i < frames.length; i++) try {
      const frame = frames[i];
      if (frame?.name === TARGET_FRAME_NAME) return frame.document;
    } catch {
      continue;
    }
    return document;
  };
  class DeadlineHighlighterEngine {
    colors;
    refreshIntervalMs;
    autoStopMs;
    intervalId=null;
    autoStopTimeoutId=null;
    seenRowIds=new Set;
    constructor(colors, refreshIntervalMs, autoStopMinutes) {
      this.colors = colors;
      this.refreshIntervalMs = refreshIntervalMs;
      this.autoStopMs = autoStopMinutes * 6e4;
    }
    get isActive() {
      return this.intervalId !== null;
    }
    get processedCount() {
      return this.seenRowIds.size;
    }
    setColors(colors) {
      this.colors = colors;
    }
    start() {
      if (this.isActive) return;
      this.tick();
      this.intervalId = window.setInterval(() => this.tick(), this.refreshIntervalMs);
      this.autoStopTimeoutId = window.setTimeout(() => this.stop(), this.autoStopMs);
    }
    stop() {
      if (this.intervalId !== null) window.clearInterval(this.intervalId);
      if (this.autoStopTimeoutId !== null) window.clearTimeout(this.autoStopTimeoutId);
      this.intervalId = null;
      this.autoStopTimeoutId = null;
    }
    clear() {
      this.seenRowIds.clear();
      clearHighlights(resolveTargetDocument());
    }
    tick() {
      let cells;
      try {
        cells = resolveTargetDocument().querySelectorAll(DEADLINE_CELL_SELECTOR);
      } catch {
        return;
      }
      const now = new Date;
      cells.forEach((cell, index) => {
        const dateText = cell.getAttribute("title") ?? cell.textContent?.trim() ?? "";
        if (!dateText) return;
        const rowId = `${index}:${dateText}`;
        if (this.seenRowIds.has(rowId)) return;
        const deadline = parseDeadlineDate(dateText);
        if (!deadline) return;
        applyHighlight(cell, deadline, evaluateDeadline(deadline, now), this.colors);
        this.seenRowIds.add(rowId);
      });
    }
  }
  const OVERLAY_ID = "erp-toolkit-overlay";
  const getOverlay = () => document.getElementById(OVERLAY_ID);
  const makeDraggable = (dialog, handle) => {
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;
    const onPointerMove = event => {
      if (!dragging) return;
      dialog.style.margin = "0";
      dialog.style.left = `${event.clientX - offsetX}px`;
      dialog.style.top = `${event.clientY - offsetY}px`;
    };
    const onPointerUp = () => {
      dragging = false;
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
    handle.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      const rect = dialog.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      dragging = true;
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    });
  };
  const openToolkitOverlay = () => {
    if (getOverlay()) return;
    const dialog = document.createElement("dialog");
    dialog.id = OVERLAY_ID;
    dialog.style.cssText = "padding:0;border:none;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.45)";
    const titlebar = document.createElement("div");
    titlebar.style.cssText = [ "display:flex", "align-items:center", "justify-content:space-between", "gap:8px", "padding:6px 6px 6px 12px", "background:#4338ca", "color:#fff", "font:600 13px system-ui,sans-serif", "cursor:grab", "user-select:none" ].join(";");
    titlebar.innerHTML = `<span>ERP Toolkit</span>`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.title = "Close";
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = [ "width:22px", "height:22px", "border-radius:9999px", "border:none", "background:rgba(255,255,255,0.2)", "color:#fff", "cursor:pointer", "font-size:12px", "line-height:1" ].join(";");
    closeBtn.addEventListener("click", () => dialog.close());
    titlebar.append(closeBtn);
    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("pages/Popup/index.html");
    iframe.style.cssText = "width:360px;height:600px;border:none;display:block";
    iframe.title = "ERP Toolkit";
    dialog.append(titlebar, iframe);
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
    makeDraggable(dialog, titlebar);
  };
  chrome.runtime.onMessage.addListener(message => {
    if (typeof message === "object" && message !== null && message.action === "toolkit:close-overlay") getOverlay()?.close();
  });
  const toolkitOverlay = openToolkitOverlay;
  const WIDGET_ID = "erp-toolkit-legend";
  class LegendWidget {
    root;
    collapsed=false;
    constructor(colors, callbacks) {
      this.root = document.createElement("div");
      this.root.id = WIDGET_ID;
      this.root.innerHTML = `\n      <div class="erp-toolkit-legend__header" data-drag-handle>\n        <div class="erp-toolkit-legend__title">\n          <span aria-hidden="true">🎯</span>\n          <span>Deadline Highlighter</span>\n        </div>\n        <div class="erp-toolkit-legend__header-actions">\n          <button type="button" class="erp-toolkit-legend__icon-btn" data-action="open-popup" title="Open ERP Toolkit">\n            <span aria-hidden="true">&#9881;</span>\n          </button>\n          <button type="button" class="erp-toolkit-legend__icon-btn" data-action="toggle" title="Collapse">\n            <span aria-hidden="true" data-toggle-glyph>&minus;</span>\n          </button>\n        </div>\n      </div>\n      <div class="erp-toolkit-legend__body">\n        <div class="erp-toolkit-legend__status">\n          <span class="erp-toolkit-legend__dot" data-status-dot></span>\n          <span data-status-text>Inactive</span>\n        </div>\n        <p class="erp-toolkit-legend__stats" data-stats-text>0 rows processed</p>\n        <div class="erp-toolkit-legend__controls">\n          <button type="button" class="erp-toolkit-legend__btn erp-toolkit-legend__btn--start" data-action="start">\n            <span aria-hidden="true">&#9654;</span> Start\n          </button>\n          <button type="button" class="erp-toolkit-legend__btn erp-toolkit-legend__btn--stop" data-action="stop">\n            <span aria-hidden="true">&#10074;&#10074;</span> Stop\n          </button>\n          <button type="button" class="erp-toolkit-legend__btn erp-toolkit-legend__btn--clear" data-action="clear">\n            <span aria-hidden="true">&#128465;</span> Clear\n          </button>\n        </div>\n        <div class="erp-toolkit-legend__swatches">\n          <span><i style="background:${colors.upcoming}"></i>Upcoming (&gt;24h)</span>\n          <span><i style="background:${colors.warning}"></i>1 day left</span>\n          <span><i style="background:${colors.urgent}"></i>6 hours or less</span>\n          <span><i style="background:${colors.overdue}"></i>Overdue</span>\n        </div>\n      </div>\n    `;
      this.bindEvents(callbacks);
      this.makeDraggable();
    }
    mount() {
      if (!document.getElementById(WIDGET_ID)) document.body.append(this.root);
    }
    destroy() {
      this.root.remove();
    }
    update({isActive, processedCount}) {
      const dot = this.root.querySelector("[data-status-dot]");
      const statusText = this.root.querySelector("[data-status-text]");
      const statsText = this.root.querySelector("[data-stats-text]");
      const startBtn = this.root.querySelector('[data-action="start"]');
      const stopBtn = this.root.querySelector('[data-action="stop"]');
      dot?.classList.toggle("erp-toolkit-legend__dot--active", isActive);
      if (statusText) statusText.textContent = isActive ? "Active — monitoring deadlines" : "Inactive";
      if (statsText) statsText.textContent = `${processedCount} row${processedCount === 1 ? "" : "s"} processed`;
      if (startBtn) startBtn.disabled = isActive;
      if (stopBtn) stopBtn.disabled = !isActive;
    }
    bindEvents({onStart, onStop, onClear}) {
      this.root.querySelector('[data-action="toggle"]')?.addEventListener("click", () => this.toggleCollapsed());
      this.root.querySelector('[data-action="start"]')?.addEventListener("click", onStart);
      this.root.querySelector('[data-action="stop"]')?.addEventListener("click", onStop);
      this.root.querySelector('[data-action="clear"]')?.addEventListener("click", onClear);
      this.root.querySelector('[data-action="open-popup"]')?.addEventListener("click", toolkitOverlay);
    }
    toggleCollapsed() {
      this.collapsed = !this.collapsed;
      this.root.classList.toggle("erp-toolkit-legend--collapsed", this.collapsed);
      const glyph = this.root.querySelector("[data-toggle-glyph]");
      if (glyph) glyph.textContent = this.collapsed ? "+" : "−";
    }
    makeDraggable() {
      const handle = this.root.querySelector("[data-drag-handle]");
      if (!handle) return;
      let offsetX = 0;
      let offsetY = 0;
      let dragging = false;
      const onPointerMove = event => {
        if (!dragging) return;
        this.root.style.left = `${event.clientX - offsetX}px`;
        this.root.style.top = `${event.clientY - offsetY}px`;
        this.root.style.right = "auto";
      };
      const onPointerUp = () => {
        dragging = false;
        this.root.classList.remove("erp-toolkit-legend--dragging");
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
      };
      handle.addEventListener("pointerdown", event => {
        if (event.target.closest("button")) return;
        const rect = this.root.getBoundingClientRect();
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        dragging = true;
        this.root.classList.add("erp-toolkit-legend--dragging");
        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
      });
    }
  }
  const WIDGET_REFRESH_MS = 1e3;
  const bootstrap = async () => {
    if (window.__erpToolkitHighlighterLoaded) return;
    window.__erpToolkitHighlighterLoaded = true;
    const settings = await getHighlighterSettings();
    const engine = new DeadlineHighlighterEngine(settings.colors, settings.refreshIntervalMs, settings.autoStopMinutes);
    const widget = new LegendWidget(settings.colors, {
      onStart: () => {
        engine.start();
        refreshWidget();
      },
      onStop: () => {
        engine.stop();
        refreshWidget();
      },
      onClear: () => {
        engine.clear();
        refreshWidget();
      }
    });
    const refreshWidget = () => {
      widget.update({
        isActive: engine.isActive,
        processedCount: engine.processedCount
      });
    };
    widget.mount();
    refreshWidget();
    window.setInterval(refreshWidget, WIDGET_REFRESH_MS);
    onHighlighterSettingsChanged(updated => engine.setColors(updated.colors));
    if (settings.enabled) {
      engine.start();
      refreshWidget();
    }
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!isHighlighterCommand(message)) return;
      handleCommand(message, engine);
      refreshWidget();
      sendResponse({
        success: true,
        isActive: engine.isActive,
        processedRows: engine.processedCount
      });
      return true;
    });
  };
  const handleCommand = (command, engine) => {
    switch (command.action) {
     case "highlighter:start":
      engine.start();
      break;

     case "highlighter:stop":
      engine.stop();
      break;

     case "highlighter:clear":
      engine.clear();
      break;

     case "highlighter:status":
      break;
    }
  };
  bootstrap().catch(error => {
    void 0;
  });
})();