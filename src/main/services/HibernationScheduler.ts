// src/main/services/HibernationScheduler.ts
// ─────────────────────────────────────────────────────────────────
// Kitsune — Hibernation Scheduler
// Runs on a background timer. Finds idle tabs that haven't been
// accessed recently and hibernates them to free RAM.
// Respects per-tab pins and user settings.
// ─────────────────────────────────────────────────────────────────

import { HIBERNATE_CHECK_INTERVAL_MS } from '../../shared/constants'
import type { TabManager } from './TabManager'
import type { SettingsStore } from './SettingsStore'

export class HibernationScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false

  constructor(
    private readonly tabManager: TabManager,
    private readonly settings: SettingsStore,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.timer = setInterval(() => this.tick(), HIBERNATE_CHECK_INTERVAL_MS)
    console.log('[HibernationScheduler] started')
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.running = false
    console.log('[HibernationScheduler] stopped')
  }

  private async tick(): Promise<void> {
    if (!this.settings.get('autoHibernateEnabled')) return

    const hibernateAfter = this.settings.get('hibernateAfterMs')
    const now = Date.now()
    const activeId = this.tabManager.getActiveTabId()
    const tabs = this.tabManager.listTabs()

    // Memory pressure check — if total tabs use > threshold, be more aggressive
    const maxMB = this.settings.get('maxActiveTabMemoryMB')
    let totalMemMB = tabs.reduce((acc, t) => acc + t.memoryBytes / (1024 * 1024), 0)
    const underPressure = totalMemMB > maxMB

    for (const tab of tabs) {
      if (tab.hibernated) continue
      if (tab.id === activeId) continue
      if (tab.isPinned) continue

      const idleMs = now - tab.lastAccessedAt
      const threshold = underPressure ? hibernateAfter / 2 : hibernateAfter

      if (idleMs >= threshold) {
        console.log(
          `[HibernationScheduler] hibernating "${tab.title}" ` +
          `(idle ${Math.round(idleMs / 60000)}m, pressure=${underPressure})`
        )
        await this.tabManager.hibernateTab(tab.id)
        totalMemMB -= tab.memoryBytes / (1024 * 1024)
      }
    }
  }
}
